import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../config/prisma.service';
import { ChatService } from './chat.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class PosterSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PosterSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const disabled = String(this.configService.get<string>('DISABLE_POSTER_CRON') || 'false').toLowerCase() === 'true';
    if (disabled) {
      this.logger.log('Poster cron worker is disabled by DISABLE_POSTER_CRON=true');
      return;
    }
    const imagesDisabled =
      String(this.configService.get<string>('DISABLE_IMAGE_GENERATION') ?? 'true').toLowerCase() === 'true' ||
      String(this.configService.get<string>('IMAGE_GENERATION_DISABLED') ?? 'true').toLowerCase() === 'true';
    if (imagesDisabled) {
      this.logger.log('Poster cron worker is disabled because image generation is disabled');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, 30_000);
    setTimeout(() => void this.tick(), 5_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private timezoneOffsetMinutes(code: string): number {
    const tz = String(code || 'UTC').toUpperCase();
    const map: Record<string, number> = {
      UTC: 0,
      GMT: 0,
      IST: 330,
      EST: -300,
      EDT: -240,
      CST: -360,
      CDT: -300,
      MST: -420,
      MDT: -360,
      PST: -480,
      PDT: -420,
      CET: 60,
      CEST: 120,
    };
    return map[tz] ?? 0;
  }

  private parseTimeTo24h(v: string): { hour: number; minute: number } {
    const text = String(v || '').toLowerCase();
    const m12 = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
    if (m12) {
      const base = Number(m12[1]);
      const minute = Number(m12[2] || '0');
      const ap = String(m12[3]).toLowerCase();
      let hour = base % 12;
      if (ap === 'pm') hour += 12;
      return { hour, minute };
    }
    const m24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (m24) return { hour: Number(m24[1]), minute: Number(m24[2]) };
    return { hour: 9, minute: 0 };
  }

  private parseDayOfWeek(v: string): number {
    const t = String(v || '').toLowerCase();
    if (/\bmonday\b|\bmon\b/.test(t)) return 1;
    if (/\btuesday\b|\btue\b|\btues\b/.test(t)) return 2;
    if (/\bwednesday\b|\bwed\b/.test(t)) return 3;
    if (/\bthursday\b|\bthu\b|\bthur\b|\bthurs\b/.test(t)) return 4;
    if (/\bfriday\b|\bfri\b/.test(t)) return 5;
    if (/\bsaturday\b|\bsat\b/.test(t)) return 6;
    if (/\bsunday\b|\bsun\b/.test(t)) return 0;
    return 1;
  }

  private computeNextWeeklyRunAt(dayOfWeek: number, time: string, timezone: string, from = new Date()) {
    const [hhRaw, mmRaw] = String(time || '09:00').split(':');
    const hh = Math.max(0, Math.min(23, Number(hhRaw || 9)));
    const mm = Math.max(0, Math.min(59, Number(mmRaw || 0)));
    const offset = this.timezoneOffsetMinutes(timezone);

    const localNowMs = from.getTime() + offset * 60_000;
    const localNow = new Date(localNowMs);
    const nowDow = localNow.getUTCDay();
    let daysAhead = (dayOfWeek - nowDow + 7) % 7;
    const nowMinutes = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
    const targetMinutes = hh * 60 + mm;
    if (daysAhead === 0 && targetMinutes <= nowMinutes) daysAhead = 7;

    const targetLocalMs = Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate() + daysAhead,
      hh,
      mm,
      0,
      0,
    );
    return new Date(targetLocalMs - offset * 60_000).toISOString();
  }

  private parseScheduleFromRaw(raw: string, cadence: 'weekly' | 'oneoff') {
    const text = String(raw || '').trim();
    const timezoneMatch = text.toUpperCase().match(/\b(UTC|GMT|IST|EST|EDT|CST|CDT|MST|MDT|PST|PDT|CET|CEST)\b/);
    const timezone = timezoneMatch?.[1] || 'UTC';
    const tm = this.parseTimeTo24h(text);
    const time = `${String(tm.hour).padStart(2, '0')}:${String(tm.minute).padStart(2, '0')}`;

    if (cadence === 'weekly') {
      const dayOfWeek = this.parseDayOfWeek(text);
      return {
        cadence: 'weekly',
        dayOfWeek,
        time,
        timezone,
        enabled: true,
        nextRunAt: this.computeNextWeeklyRunAt(dayOfWeek, time, timezone),
      };
    }

    const date = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    const offset = this.timezoneOffsetMinutes(timezone);
    const now = new Date();
    const localNow = new Date(now.getTime() + offset * 60_000);
    const y = date ? Number(date[1]) : localNow.getUTCFullYear();
    const m = date ? Number(date[2]) - 1 : localNow.getUTCMonth();
    const d = date ? Number(date[3]) : localNow.getUTCDate() + 1;
    const localMs = Date.UTC(y, m, d, tm.hour, tm.minute, 0, 0);
    let nextMs = localMs - offset * 60_000;
    if (nextMs <= now.getTime()) nextMs = now.getTime() + 5 * 60_000;

    return {
      cadence: 'oneoff',
      date: date ? `${date[1]}-${date[2]}-${date[3]}` : null,
      time,
      timezone,
      enabled: true,
      nextRunAt: new Date(nextMs).toISOString(),
    };
  }

  private cleanErr(e: any) {
    const msg = String(e?.message || e || 'Unknown error');
    return msg.length > 300 ? msg.slice(0, 300) : msg;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const orders = await this.prisma.order.findMany({
        where: {
          status: { notIn: ['CANCELLED', 'REFUNDED', 'REJECTED'] as any },
        },
        select: {
          id: true,
          customerId: true,
          influencerId: true,
          projectBrief: true,
          influencer: {
            select: { id: true, name: true, isActive: true, aiConfig: true },
          },
        },
      });

      for (const order of orders) {
        const brief =
          order.projectBrief && typeof order.projectBrief === 'object'
            ? ({ ...(order.projectBrief as any) } as any)
            : {};
        const plan = brief.posterPlan && typeof brief.posterPlan === 'object' ? ({ ...(brief.posterPlan as any) } as any) : null;
        if (!plan) continue;

        const cadence: 'weekly' | 'oneoff' = plan.cadence === 'weekly' ? 'weekly' : 'oneoff';
        const posters = Array.isArray(plan.posters) ? [...plan.posters] : [];
        if (posters.length === 0) continue;

        let changed = false;

        for (let i = 0; i < posters.length; i++) {
          const p = posters[i] && typeof posters[i] === 'object' ? ({ ...(posters[i] as any) } as any) : null;
          if (!p) continue;

          let schedule = p.schedule && typeof p.schedule === 'object' ? ({ ...(p.schedule as any) } as any) : null;
          if (!schedule && p?.requirements?.schedule) {
            schedule = this.parseScheduleFromRaw(String(p.requirements.schedule), cadence);
            p.schedule = schedule;
            changed = true;
          }
          if (!schedule) {
            posters[i] = p;
            continue;
          }
          if (schedule.enabled === false) {
            posters[i] = p;
            continue;
          }

          if (!schedule.nextRunAt) {
            if (schedule.cadence === 'weekly') {
              schedule.nextRunAt = this.computeNextWeeklyRunAt(
                Number(schedule.dayOfWeek ?? 1),
                String(schedule.time || '09:00'),
                String(schedule.timezone || 'UTC'),
                now,
              );
            } else {
              schedule.nextRunAt = new Date(now.getTime() + 60_000).toISOString();
            }
            p.schedule = schedule;
            posters[i] = p;
            changed = true;
            continue;
          }

          const nextAt = new Date(String(schedule.nextRunAt));
          if (!Number.isFinite(nextAt.getTime()) || nextAt.getTime() > now.getTime()) {
            posters[i] = p;
            continue;
          }

          const cfg = (order.influencer as any)?.aiConfig || {};
          const apiUrl = String(cfg?.imageApiUrl || '');
          const apiKey = String(cfg?.imageApiKey || '');
          const model = String(cfg?.imageModel || '');
          if (!apiUrl || !apiKey || !model) {
            p.lastError = 'Image service is not configured for this influencer.';
            p.lastErrorAt = nowIso;
            if (cadence === 'weekly') {
              schedule.nextRunAt = this.computeNextWeeklyRunAt(
                Number(schedule.dayOfWeek ?? 1),
                String(schedule.time || '09:00'),
                String(schedule.timezone || 'UTC'),
                new Date(now.getTime() + 60_000),
              );
            } else {
              schedule.enabled = false;
              schedule.nextRunAt = null;
            }
            p.schedule = schedule;
            posters[i] = p;
            changed = true;
            continue;
          }

          const prompt = String(p.optimizedPrompt || '').trim();
          if (!prompt) {
            p.lastError = 'Missing optimized prompt for scheduled poster.';
            p.lastErrorAt = nowIso;
            schedule.nextRunAt = new Date(now.getTime() + 30 * 60_000).toISOString();
            p.schedule = schedule;
            posters[i] = p;
            changed = true;
            continue;
          }

          try {
            const chat = await this.chatService.findOrCreateChat(order.customerId, order.influencerId);
            const imageUrl = await this.aiService.generateImage(apiUrl, apiKey, model, prompt);
            const caption = `Scheduled poster ${p.index || i + 1} is ready.`;
            await this.chatService.addMessage(chat.id, 'ASSISTANT', caption, imageUrl);

            p.lastGeneratedAt = nowIso;
            p.lastError = null;
            p.lastErrorAt = null;
            schedule.lastRunAt = nowIso;
            if (cadence === 'weekly') {
              schedule.nextRunAt = this.computeNextWeeklyRunAt(
                Number(schedule.dayOfWeek ?? 1),
                String(schedule.time || '09:00'),
                String(schedule.timezone || 'UTC'),
                new Date(now.getTime() + 60_000),
              );
            } else {
              schedule.enabled = false;
              schedule.nextRunAt = null;
            }
            p.schedule = schedule;
            posters[i] = p;
            changed = true;
          } catch (e) {
            p.lastError = this.cleanErr(e);
            p.lastErrorAt = nowIso;
            schedule.nextRunAt = new Date(now.getTime() + 10 * 60_000).toISOString();
            p.schedule = schedule;
            posters[i] = p;
            changed = true;
          }
        }

        if (!changed) continue;
        plan.posters = posters;
        plan.updatedAt = nowIso;
        brief.posterPlan = plan;
        await this.prisma.order.update({
          where: { id: order.id },
          data: { projectBrief: brief as any },
        });
      }
    } catch (e) {
      this.logger.error(`Poster cron worker failed: ${this.cleanErr(e)}`);
    } finally {
      this.running = false;
    }
  }
}
