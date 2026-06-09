import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';

@Injectable()
export class FaqService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.faqEntry.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async create(data: { question: string; answers: string[]; keywords?: string }) {
    return this.prisma.faqEntry.create({ data: { ...data, answers: data.answers } });
  }

  async update(id: string, data: { question?: string; answers?: string[]; keywords?: string; isActive?: boolean }) {
    return this.prisma.faqEntry.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.prisma.faqEntry.delete({ where: { id } });
    return true;
  }

  /** Returns the best predefined answer for the user message, or null if no entry matches well enough. */
  async findMatch(userMessage: string): Promise<string | null> {
    const entries = await this.prisma.faqEntry.findMany({ where: { isActive: true } });
    if (entries.length === 0) return null;

    // Common words that carry no semantic meaning — ignored during scoring
    const STOP_WORDS = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'what', 'how', 'why', 'when',
      'where', 'who', 'which', 'that', 'this', 'these', 'those',
      'it', 'its', 'my', 'your', 'his', 'her', 'our', 'their',
      'me', 'you', 'him', 'us', 'them', 'not', 'no', 'so',
      'just', 'very', 'too', 'also', 'more', 'some', 'any', 'all',
      'up', 'out', 'if', 'as', 'by', 'with', 'from', 'here', 'there',
      'then', 'than', 'please', 'tell', 'know', 'into', 'about', 'get',
      'im', 'id', 'ive', 'ill', 'dont', 'doesnt', 'cant', 'wont',
    ]);

    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const tokenize = (s: string) =>
      normalize(s).split(/\s+/).filter((w) => w.length >= 2);
    const contentWords = (tokens: string[]) =>
      tokens.filter((t) => !STOP_WORDS.has(t));

    // Fuzzy prefix match: "price"↔"pricing", "deliver"↔"delivery", etc.
    const fuzzyMatch = (a: string, b: string): boolean => {
      if (a === b) return true;
      if (a.length >= 5 && b.length >= 5) {
        const prefix = a.length <= b.length ? a.slice(0, -1) : b.slice(0, -1);
        if (prefix.length >= 4 && a.startsWith(prefix) && b.startsWith(prefix))
          return true;
      }
      return false;
    };

    const userNorm   = normalize(userMessage);
    const userAll    = tokenize(userMessage);
    const userTokens = contentWords(userAll);
    // Fall back to all tokens when stop-word filtering leaves nothing
    const effectiveUser = userTokens.length > 0 ? userTokens : userAll;
    if (effectiveUser.length === 0) return null;

    let bestScore   = 0;
    let bestAnswers: string[] = [];

    for (const entry of entries) {
      const haystackText  = [entry.question, entry.keywords ?? ''].join(' ');
      const haystackAll   = tokenize(haystackText);
      const haystackTokens = contentWords(haystackAll);
      const effectiveHaystack = haystackTokens.length > 0 ? haystackTokens : haystackAll;
      const questionNorm  = normalize(entry.question);

      // ── Signal 1: exact substring match ─────────────────────────────────
      if (normalize(haystackText).includes(userNorm) ||
          questionNorm.includes(userNorm)) {
        if (0.97 > bestScore) {
          bestScore   = 0.97;
          bestAnswers = Array.isArray(entry.answers) ? (entry.answers as string[]) : [];
        }
        continue;
      }

      // ── Signal 2: content-word overlap ──────────────────────────────────
      let userMatched = 0;
      for (const ut of effectiveUser) {
        if (effectiveHaystack.some((ht) => fuzzyMatch(ut, ht))) userMatched++;
      }
      let haystackMatched = 0;
      for (const ht of effectiveHaystack) {
        if (effectiveUser.some((ut) => fuzzyMatch(ut, ht))) haystackMatched++;
      }

      const userCov     = userMatched / effectiveUser.length;
      const haystackCov = effectiveHaystack.length > 0
        ? haystackMatched / effectiveHaystack.length
        : 0;

      // Both sides must contribute: harmonic mean (F1-style)
      const score =
        userCov + haystackCov > 0
          ? (2 * userCov * haystackCov) / (userCov + haystackCov)
          : 0;

      if (score > bestScore) {
        bestScore   = score;
        bestAnswers = Array.isArray(entry.answers) ? (entry.answers as string[]) : [];
      }
    }

    // Require strong confidence — both sides must overlap significantly
    if (bestScore < 0.65 || bestAnswers.length === 0) return null;

    return bestAnswers[Math.floor(Math.random() * bestAnswers.length)];
  }
}
