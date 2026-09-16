import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../config/prisma.service';
import { PineconeMemoryService } from './pinecone-memory.service';
import { AiService } from '../ai/ai.service';

export interface StructuredMemoryExtraction {
  brandAndProfile?: {
    brandName?: string;
    productName?: string;
    website?: string;
    clientName?: string;
    clientEmail?: string;
    targetAudience?: string;
    industry?: string;
    tone?: string;
  };
  requirements?: Array<{ key: string; value: string }>;
  preferences?: Array<{ key: string; value: string; type?: string }>;
  decisions?: Array<{ key: string; value: string; status?: string }>;
  technicalContext?: Array<{ key: string; value: string }>;
  tasks?: Array<{ task: string; status?: string }>;
  feedback?: Array<{ feedback: string; adjustment?: string }>;
  notes?: string[];
}

export interface AgentUsageAndHireStatus {
  isHired: boolean;
  hasRemainingUsage: boolean;
  remainingUnits: number;
  totalOrderedUnits: number;
  totalDeliveredUnits: number;
  activeOrdersCount: number;
  completedOrdersCount: number;
}

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private pineconeMemory: PineconeMemoryService,
    private aiService: AiService,
  ) {}

  private chatMetaCache = new Map<string, { customerId: string; influencerId: string }>();
  private workflowCache = new Map<string, any>();
  private aiExtractionPending = new Set<string>();

  private async getChatMetaCached(chatId: string) {
    const cached = this.chatMetaCache.get(chatId);
    if (cached) return cached;
    try {
      const meta = await this.prisma.chat.findUnique({
        where: { id: chatId },
        select: { customerId: true, influencerId: true },
      });
      if (!meta) return null;
      this.chatMetaCache.set(chatId, meta);
      return meta;
    } catch {
      return null;
    }
  }

  private cleanValue(v: string) {
    return v.replace(/\s+/g, ' ').trim();
  }

  private parseBrief(raw: any): Record<string, any> {
    if (!raw) return {};
    if (typeof raw === 'object') return { ...raw };
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : { raw };
      } catch {
        return { raw };
      }
    }
    return {};
  }

  /**
   * Fast synchronous rule-based extractor that captures brand profile,
   * project specifications, preferences, decisions, technical context, tasks, and feedback.
   */
  private extractKeyDetails(text: string, role?: string): StructuredMemoryExtraction {
    const t = (text ?? '').trim();
    if (!t) return {};

    const profile: Record<string, string> = {};
    const requirements: Array<{ key: string; value: string }> = [];
    const preferences: Array<{ key: string; value: string; type?: string }> = [];
    const decisions: Array<{ key: string; value: string; status?: string }> = [];
    const technicalContext: Array<{ key: string; value: string }> = [];
    const tasks: Array<{ task: string; status?: string }> = [];
    const feedback: Array<{ feedback: string; adjustment?: string }> = [];
    const notes: string[] = [];

    // ─── 1. Brand & Contact Details ──────────────────────────────────────────
    const emailMatch = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) profile.clientEmail = emailMatch[0].replace(/[.,;]+$/, '');

    const urlMatch =
      t.match(/https?:\/\/[^\s)]+/i) ||
      t.match(/\bwww\.[^\s)]+/i) ||
      t.match(/\b(?:website|site|url|domain)\b\s*(?:is|:)?\s*([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s)]*)?)/i) ||
      t.match(/\b([a-zA-Z0-9][a-zA-Z0-9-]*\.(?:com|ai|io|co|org|net|app|dev|me|tech|store|shop|online|xyz|in|us|uk|ca|de)(?:\/[^\s)]*)?)\b/i);
    if (urlMatch) {
      let rawUrl = (urlMatch[1] || urlMatch[0]).replace(/[.,;)]+$/, '');
      if (!/^https?:\/\//i.test(rawUrl) && !/^www\./i.test(rawUrl) && rawUrl.includes('.')) {
        rawUrl = `https://${rawUrl}`;
      }
      profile.website = rawUrl;
    }

    const nameMatch =
      t.match(/\b(?:my name is|call me|this is)\s+([A-Za-z][A-Za-z\s.'-]{1,60})\b/i) ||
      (role === 'USER' ? t.match(/^\s*i(?:'| a)?m\s+([A-Za-z][A-Za-z\s.'-]{1,60})\b/i) : null);
    if (nameMatch?.[1]) {
      const name = this.cleanValue(nameMatch[1].split(/\b(?:and|from|at|with)\b/i)[0]);
      if (
        name.length >= 2 &&
        name.length <= 40 &&
        !/^(here|happy|excited|interested|looking|working|planning|ready|an|the|glad|thrilled|sorry)\b/i.test(name)
      ) {
        profile.clientName = name;
      }
    }

    const brandMatch =
      t.match(/\b(?:our|my)\s+(?:brand|company|business)\s+(?:name\s+)?is\s+["']?([^"'\n.,;]{2,80})/i) ||
      t.match(/\b(?:we are|we're)\s+(?:called|named)\s+["']?([^"'\n.,;]{2,80})/i) ||
      t.match(/\bbrand\s+name\s+is\s+["']?([^"'\n.,;]{2,80})/i) ||
      t.match(/\bbrand\s+(?:named|called)\s+["']?([^"'\n.,;]{2,80})/i) ||
      t.match(/\bfor\s+(?:a\s+)?brand\s+named\s+["']?([^"'\n.,;]{2,80})/i);
    if (brandMatch?.[1]) {
      let brandName = this.cleanValue(brandMatch[1].split(/\b(?:and\s+(?:our|my|we)|at\s+https?|which|with)\b/i)[0]);
      if (brandName.length >= 2 && brandName.length <= 80) profile.brandName = brandName;
    }

    const productMatch =
      t.match(/\b(?:our|my)\s+(?:product|app|service|tool|platform)\s+(?:name\s+)?is\s+["']?([^"'\n.,;]{2,80})/i) ||
      t.match(/\bproduct\s+name\s+is\s+["']?([^"'\n.,;]{2,80})/i);
    if (productMatch?.[1]) {
      let productName = this.cleanValue(productMatch[1].split(/\b(?:at\s+https?|which|built|with|and)\b/i)[0]);
      if (productName.length >= 2 && productName.length <= 80) profile.productName = productName;
    }

    const audienceMatch =
      t.match(/\b(?:target audience|ideal customer|audience|target market)\s*(?:is|are|:)\s*([^.\n]{4,120})/i) ||
      t.match(/\btargeting\s+([^.\n]{4,100})/i);
    if (audienceMatch?.[1]) {
      const targetAudience = this.cleanValue(audienceMatch[1].split(/\b(?:and\s+our|with|for)\b/i)[0]);
      if (targetAudience.length >= 4 && targetAudience.length <= 120) profile.targetAudience = targetAudience;
    }

    const toneMatch =
      t.match(/\b(?:tone|voice|brand voice|style of speech)\s*(?:is|should be|must be|:)\s*([^.\n]{3,80})/i) ||
      t.match(/\bkeep the tone\s+([^.\n]{3,60})/i);
    if (toneMatch?.[1]) {
      const tone = this.cleanValue(toneMatch[1].split(/\b(?:and|while|also)\b/i)[0]);
      if (tone.length >= 3 && tone.length <= 80) profile.tone = tone;
    }

    // ─── 2. Project Requirements & Specs ────────────────────────────────────
    // Video Length / Duration
    const lengthMatch =
      t.match(/\b(\d{1,3})\s*(?:-?\s*(?:seconds?|secs?|minutes?|mins?))\s*(?:video|reel|clip|duration|long)?\b/i) ||
      t.match(/\b(?:duration|length)\s*(?:is|should be|:)\s*(\d{1,3}\s*(?:seconds?|secs?|minutes?|mins?))/i);
    if (lengthMatch?.[1]) {
      const rawNum = lengthMatch[1];
      const isMin = /min/i.test(lengthMatch[0]);
      const normLength = `${rawNum} ${isMin ? 'minutes' : 'seconds'}`;
      requirements.push({ key: 'Video Length', value: normLength });
    }

    // Aspect Ratio / Orientation / Format
    const formatMatch =
      t.match(/\b(9:16|16:9|1:1|4:5|vertical|horizontal|widescreen|portrait|square)\s*(?:format|ratio|video|aspect ratio)?\b/i);
    if (formatMatch?.[1]) {
      const f = formatMatch[1].toLowerCase();
      const norm = f.includes('9:16') || f === 'vertical' || f === 'portrait' ? '9:16 Vertical (Reels/TikTok)'
        : f.includes('16:9') || f === 'horizontal' || f === 'widescreen' ? '16:9 Widescreen'
        : f.includes('1:1') || f === 'square' ? '1:1 Square'
        : formatMatch[1];
      requirements.push({ key: 'Format / Aspect Ratio', value: norm });
    }

    // Deliverables Count
    const deliverableMatch =
      t.match(/\b(?:need|want|create|make|deliver|order(?:ing)?)\s+(\d{1,3})\s+(?:videos?|posts?|reels?|creatives?|tiktoks?|assets?)\b/i);
    if (deliverableMatch?.[1]) {
      requirements.push({ key: 'Deliverables Count', value: `${deliverableMatch[1]} items` });
    }

    // Target Platforms
    const platforms: string[] = [];
    if (/\b(?:instagram|ig|reels)\b/i.test(t)) platforms.push('Instagram Reels');
    if (/\b(?:tiktok|tt)\b/i.test(t)) platforms.push('TikTok');
    if (/\b(?:youtube|yt|shorts)\b/i.test(t)) platforms.push('YouTube Shorts');
    if (/\b(?:linkedin)\b/i.test(t)) platforms.push('LinkedIn');
    if (/\b(?:facebook|meta)\b/i.test(t)) platforms.push('Facebook');
    if (/\b(?:x|twitter)\b/i.test(t)) platforms.push('X (Twitter)');
    if (platforms.length > 0 && /\b(platform|channel|post on|for|publish on|share on|reels?|tiktoks?|shorts?)\b/i.test(t)) {
      requirements.push({ key: 'Target Platforms', value: platforms.join(', ') });
    }

    // Deadlines & Timeline
    const deadlineMatch =
      t.match(/\b(?:deadline|due date|launch date|timeline|needed by|need it by|by)\s*(?:is|:)?\s*([A-Za-z0-9\s]{3,40}(?:tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|end of week|asap|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+|\d{1,2}\/\d{1,2}))\b/i);
    if (deadlineMatch?.[1] && !/\b(the|a|any|some)\b/i.test(deadlineMatch[1].trim())) {
      const cleanDeadline = this.cleanValue(deadlineMatch[1].split(/\b(?:with|and|for)\b/i)[0]);
      requirements.push({ key: 'Deadline / Timeline', value: cleanDeadline });
    }

    // Budget
    const budgetMatch =
      t.match(/\b(?:budget|spending limit)\s*(?:is|of|:)?\s*(\$?\d+(?:,\d{3})*(?:\.\d{2})?(?:\s*(?:usd|dollars|k))?)\b/i);
    if (budgetMatch?.[1]) {
      requirements.push({ key: 'Budget', value: this.cleanValue(budgetMatch[1]) });
    }

    // ─── 3. Client Preferences & Constraints (Do's & Don'ts) ──────────────────
    const prefMatch =
      t.match(/\b(?:we prefer|i prefer|preference is|always make sure to|make sure you|please always)\s+([^.\n]{5,120})/i);
    if (prefMatch?.[1]) {
      preferences.push({ key: 'Preference', value: this.cleanValue(prefMatch[1].split(/\b(?:and\s+always|also)\b/i)[0]), type: 'preference' });
    }

    const constraintMatch =
      t.match(/\b(?:never|do not|don't|avoid|no|prohibit(?:ed)?)\s+(?:use|mention|show|include|put)\s+([^.\n]{3,100})/i);
    if (constraintMatch?.[1]) {
      const cleanCon = this.cleanValue(constraintMatch[1].split(/\b(?:and\s+always|also)\b/i)[0]);
      preferences.push({ key: 'Strict Constraint', value: `Avoid: ${cleanCon}`, type: 'constraint' });
    }

    const recurringRuleMatch =
      t.match(/\b(?:always include|always feature|always end with|always use|must include)\s+([^.\n]{5,100})/i);
    if (recurringRuleMatch?.[1]) {
      preferences.push({ key: 'Recurring Instruction', value: `Always include: ${this.cleanValue(recurringRuleMatch[1])}`, type: 'recurring_instruction' });
    }

    // ─── 4. Decisions & Approvals ───────────────────────────────────────────
    const approvedMatch =
      t.match(/\b(?:approved|let's go with|go with|proceed with|i like option|we chose|we selected|confirm(?:ed)?)\s+([^.\n]{4,80})/i);
    if (approvedMatch?.[1]) {
      const cleanApp = this.cleanValue(approvedMatch[1].split(/[!.]|\b(?:and\s+i\s+will|and\s+we\s+will)\b/i)[0]);
      decisions.push({ key: 'Approved Decision', value: cleanApp, status: 'approved' });
    }

    const rejectedMatch =
      t.match(/\b(?:rejected|not going with|scrap|don't want option|pass on)\s+([^.\n]{4,80})/i);
    if (rejectedMatch?.[1]) {
      const cleanRej = this.cleanValue(rejectedMatch[1].split(/[!.]|\b(?:and|instead)\b/i)[0]);
      decisions.push({ key: 'Rejected Approach', value: cleanRej, status: 'rejected' });
    }

    // ─── 5. Technical Context, Tools & Integrations ────────────────────────
    const techTools: string[] = [];
    if (/\b(?:shopify)\b/i.test(t)) techTools.push('Shopify');
    if (/\b(?:woocommerce)\b/i.test(t)) techTools.push('WooCommerce');
    if (/\b(?:stripe)\b/i.test(t)) techTools.push('Stripe');
    if (/\b(?:figma)\b/i.test(t)) techTools.push('Figma');
    if (/\b(?:next\.?js|react)\b/i.test(t)) techTools.push('Next.js/React');
    if (/\b(?:wordpress)\b/i.test(t)) techTools.push('WordPress');
    if (/\b(?:klaviyo|mailchimp)\b/i.test(t)) techTools.push('Email Marketing (Klaviyo/Mailchimp)');
    if (/\b(?:hubspot|salesforce)\b/i.test(t)) techTools.push('CRM (HubSpot/Salesforce)');
    if (/\b(?:notion|google drive|dropbox)\b/i.test(t)) techTools.push('Shared Cloud Workspace');
    if (techTools.length > 0) {
      technicalContext.push({ key: 'Tools & Integrations', value: techTools.join(', ') });
    }

    // ─── 6. Tasks & Action Items ────────────────────────────────────────────
    const pendingTaskMatch =
      t.match(/\b(?:i will send|will upload|will provide|waiting on|waiting for|need to send|pending)\s+([^.\n]{5,100})/i);
    if (pendingTaskMatch?.[1]) {
      const cleanTask = this.cleanValue(pendingTaskMatch[1].split(/[!.]|\b(?:and|also)\b/i)[0]);
      tasks.push({ task: `Send ${cleanTask}`, status: 'pending' });
    }

    const completedTaskMatch =
      t.match(/\b(?:i have sent|uploaded|provided|finished|completed|sent over)\s+([^.\n]{5,100})/i);
    if (completedTaskMatch?.[1]) {
      const cleanDone = this.cleanValue(completedTaskMatch[1].split(/[!.]|\b(?:and|also)\b/i)[0]);
      tasks.push({ task: `Uploaded/Sent ${cleanDone}`, status: 'completed' });
    }

    // ─── 7. Feedback & Adjustments ──────────────────────────────────────────
    const feedbackMatch =
      t.match(/\b(?:revision:|feedback:|change the|make it more|make it less|tweak the)\s+([^.\n]{5,120})/i);
    if (feedbackMatch?.[1]) {
      const cleanFb = this.cleanValue(feedbackMatch[1].split(/[!.]/)[0]);
      feedback.push({ feedback: cleanFb });
    }

    return {
      brandAndProfile: Object.keys(profile).length > 0 ? profile : undefined,
      requirements: requirements.length > 0 ? requirements : undefined,
      preferences: preferences.length > 0 ? preferences : undefined,
      decisions: decisions.length > 0 ? decisions : undefined,
      technicalContext: technicalContext.length > 0 ? technicalContext : undefined,
      tasks: tasks.length > 0 ? tasks : undefined,
      feedback: feedback.length > 0 ? feedback : undefined,
      notes: notes.length > 0 ? notes : undefined,
    };
  }

  private isImportantMessage(role: 'USER' | 'ASSISTANT', content: string, imageUrl?: string) {
    if (imageUrl) return true;
    const text = (content ?? '').trim();
    if (!text) return false;
    if (/https?:\/\//i.test(text)) return true;
    if (text.length >= 180) return true;

    const lower = text.toLowerCase();
    const trivial = new Set([
      'ok', 'okay', 'k', 'kk', 'yes', 'no', 'sure', 'thanks', 'thank you', 'thx',
      'cool', 'great', 'nice', 'got it', 'sounds good', 'hi', 'hello', 'bye', 'good morning',
      'good afternoon', 'good evening', 'hey', 'sup', 'yo',
    ]);
    if (text.length <= 15 && trivial.has(lower)) return false;

    const importantSignals = [
      /\b(my|our)\s+(brand|company|product|website|app|startup|business|audience|tone)\b/i,
      /\b(email|phone|address|contact|website|url)\b/i,
      /\b(budget|deadline|launch|due|timeline|milestone|schedule)\b/i,
      /\b(requirements?|specifications?|must|need|goal|objective|deliverable|deliverables)\b/i,
      /\b(aspect ratio|9:16|16:9|vertical|horizontal|seconds?|minutes?|duration|length)\b/i,
      /\b(prefer|preference|always|never|do not|don't|avoid|constraint|rule|instruction)\b/i,
      /\b(approved?|rejected?|confirm|confirmed|agreed|decision|decided|chose|selected)\b/i,
      /\b(shopify|stripe|figma|klaviyo|hubspot|integration|tech stack|platform)\b/i,
      /\b(feedback|revision|tweak|change|adjust|adjustment)\b/i,
      /\b(pending|completed|will send|uploaded|waiting for)\b/i,
    ];
    if (importantSignals.some((re) => re.test(text))) return true;

    if (role === 'USER' && text.includes('?') && text.length >= 35) return true;
    if (role === 'ASSISTANT' && text.length >= 120) return true;

    return false;
  }

  /**
   * Intelligently merges new extracted memory items into existing details & facts,
   * updating existing keys to avoid redundant or conflicting duplicates.
   */
  private mergeStructuredMemory(
    details: Record<string, any>,
    facts: any[],
    extraction: StructuredMemoryExtraction,
    meta: { customerId: string; chatId: string; messageId: string; createdAtIso: string },
  ) {
    // 1. Profile / Brand
    if (extraction.brandAndProfile) {
      for (const [k, v] of Object.entries(extraction.brandAndProfile)) {
        if (!v) continue;
        details[k] = v;
        const signature = `profile::${k}`;
        const existingIdx = facts.findIndex((f: any) => f.category === 'profile' && f.key === k);
        const factItem = {
          category: 'profile',
          key: k,
          value: v,
          messageId: meta.messageId,
          chatId: meta.chatId,
          customerId: meta.customerId,
          updatedAt: meta.createdAtIso,
        };
        if (existingIdx >= 0) {
          facts[existingIdx] = factItem;
        } else {
          facts.push(factItem);
        }
      }
    }

    // 2. Requirements & Specs
    if (extraction.requirements && extraction.requirements.length > 0) {
      if (!details.requirements || typeof details.requirements !== 'object') {
        details.requirements = {};
      }
      for (const req of extraction.requirements) {
        if (!req.key || !req.value) continue;
        details.requirements[req.key] = req.value;
        const existingIdx = facts.findIndex((f: any) => f.category === 'requirement' && f.key === req.key);
        const factItem = {
          category: 'requirement',
          key: req.key,
          value: req.value,
          messageId: meta.messageId,
          chatId: meta.chatId,
          customerId: meta.customerId,
          updatedAt: meta.createdAtIso,
        };
        if (existingIdx >= 0) {
          facts[existingIdx] = factItem;
        } else {
          facts.push(factItem);
        }
      }
    }

    // 3. Preferences & Guidelines (Do's & Don'ts)
    if (extraction.preferences && extraction.preferences.length > 0) {
      if (!details.preferences || typeof details.preferences !== 'object') {
        details.preferences = {};
      }
      for (const pref of extraction.preferences) {
        if (!pref.key || !pref.value) continue;
        details.preferences[pref.key] = pref.value;
        const existingIdx = facts.findIndex((f: any) => f.category === 'preference' && f.key === pref.key);
        const factItem = {
          category: 'preference',
          key: pref.key,
          value: pref.value,
          type: pref.type || 'preference',
          messageId: meta.messageId,
          chatId: meta.chatId,
          customerId: meta.customerId,
          updatedAt: meta.createdAtIso,
        };
        if (existingIdx >= 0) {
          facts[existingIdx] = factItem;
        } else {
          facts.push(factItem);
        }
      }
    }

    // 4. Decisions & Approvals
    if (extraction.decisions && extraction.decisions.length > 0) {
      if (!details.decisions || typeof details.decisions !== 'object') {
        details.decisions = {};
      }
      for (const dec of extraction.decisions) {
        if (!dec.key || !dec.value) continue;
        details.decisions[dec.key] = dec.value;
        const existingIdx = facts.findIndex((f: any) => f.category === 'decision' && f.key === dec.key);
        const factItem = {
          category: 'decision',
          key: dec.key,
          value: dec.value,
          status: dec.status || 'approved',
          messageId: meta.messageId,
          chatId: meta.chatId,
          customerId: meta.customerId,
          updatedAt: meta.createdAtIso,
        };
        if (existingIdx >= 0) {
          facts[existingIdx] = factItem;
        } else {
          facts.push(factItem);
        }
      }
    }

    // 5. Technical Context & Integrations
    if (extraction.technicalContext && extraction.technicalContext.length > 0) {
      if (!details.technicalContext || typeof details.technicalContext !== 'object') {
        details.technicalContext = {};
      }
      for (const tech of extraction.technicalContext) {
        if (!tech.key || !tech.value) continue;
        details.technicalContext[tech.key] = tech.value;
        const existingIdx = facts.findIndex((f: any) => f.category === 'technical' && f.key === tech.key);
        const factItem = {
          category: 'technical',
          key: tech.key,
          value: tech.value,
          messageId: meta.messageId,
          chatId: meta.chatId,
          customerId: meta.customerId,
          updatedAt: meta.createdAtIso,
        };
        if (existingIdx >= 0) {
          facts[existingIdx] = factItem;
        } else {
          facts.push(factItem);
        }
      }
    }

    // 6. Tasks & Milestones
    if (extraction.tasks && extraction.tasks.length > 0) {
      if (!Array.isArray(details.tasks)) details.tasks = [];
      for (const t of extraction.tasks) {
        if (!t.task) continue;
        const existingIdx = details.tasks.findIndex(
          (item: any) => item.task?.toLowerCase() === t.task.toLowerCase(),
        );
        const taskObj = {
          task: t.task,
          status: t.status || 'pending',
          updatedAt: meta.createdAtIso,
        };
        if (existingIdx >= 0) {
          details.tasks[existingIdx] = taskObj;
        } else {
          details.tasks.push(taskObj);
        }
      }
      if (details.tasks.length > 20) details.tasks = details.tasks.slice(-20);
    }

    // 7. Feedback & Adjustments
    if (extraction.feedback && extraction.feedback.length > 0) {
      if (!Array.isArray(details.feedback)) details.feedback = [];
      for (const fb of extraction.feedback) {
        if (!fb.feedback) continue;
        const fbObj = {
          feedback: fb.feedback,
          adjustment: fb.adjustment || '',
          updatedAt: meta.createdAtIso,
        };
        details.feedback.push(fbObj);
      }
      if (details.feedback.length > 15) details.feedback = details.feedback.slice(-15);
    }

    // 8. General Notes
    if (extraction.notes && extraction.notes.length > 0) {
      if (!Array.isArray(details.notes)) details.notes = [];
      for (const n of extraction.notes) {
        if (!n) continue;
        if (!details.notes.includes(n)) details.notes.push(n);
      }
      if (details.notes.length > 20) details.notes = details.notes.slice(-20);
    }
  }

  /**
   * Background AI memory extraction worker that asynchronously runs LLM synthesis
   * to catch complex nuances and updates. Never blocks chat message processing.
   */
  private async triggerBackgroundAiMemoryExtraction(
    chatId: string,
    meta: { customerId: string; influencerId: string },
  ) {
    if (this.aiExtractionPending.has(chatId)) return;
    this.aiExtractionPending.add(chatId);

    setTimeout(async () => {
      try {
        const recentMessages = await this.prisma.message.findMany({
          where: { chatId },
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: { role: true, content: true },
        });
        if (!recentMessages.length) return;

        const existing = await this.prisma.chatMemory.findUnique({
          where: { chatId },
          select: { details: true, facts: true },
        });

        const influencerAiConfig = await this.prisma.aIConfig.findUnique({
          where: { influencerId: meta.influencerId },
        });

        const aiExtracted = await this.aiService.extractConversationMemory({
          recentMessages: recentMessages.reverse().map((m) => ({
            role: m.role === 'USER' ? 'user' : 'assistant',
            content: m.content,
          })),
          existingMemory: {
            details: existing?.details,
            facts: Array.isArray(existing?.facts) ? existing.facts : [],
          },
          customChat: influencerAiConfig ?? undefined,
        });

        if (!aiExtracted || Object.keys(aiExtracted).length === 0) return;

        const currentMem = await this.prisma.chatMemory.findUnique({
          where: { chatId },
          select: { details: true, facts: true, snippets: true },
        });

        const details: Record<string, any> =
          currentMem?.details && typeof currentMem.details === 'object'
            ? { ...(currentMem.details as any) }
            : {};
        const facts: any[] = Array.isArray(currentMem?.facts) ? [...currentMem.facts] : [];
        const snippets = Array.isArray(currentMem?.snippets) ? currentMem.snippets : [];

        this.mergeStructuredMemory(
          details,
          facts,
          aiExtracted,
          {
            chatId,
            customerId: meta.customerId,
            messageId: `ai-sync-${Date.now()}`,
            createdAtIso: new Date().toISOString(),
          },
        );

        await this.prisma.chatMemory.upsert({
          where: { chatId },
          create: {
            chatId,
            customerId: meta.customerId,
            influencerId: meta.influencerId,
            details,
            facts,
            snippets,
          },
          update: {
            details,
            facts,
          },
        });
      } catch (err) {
        console.warn('[ChatService] Background AI memory extraction error:', (err as any)?.message || err);
      } finally {
        this.aiExtractionPending.delete(chatId);
      }
    }, 1500);
  }

  private async updateChatMemoryFromMessage(
    message: { id: string; chatId: string; role: string; content: string; imageUrl?: string; createdAt: Date },
    meta: { customerId: string; influencerId: string } | null,
  ) {
    if (!meta) return;
    const role = message.role === 'USER' ? 'USER' : 'ASSISTANT';
    const extracted = this.extractKeyDetails(message.content, role);
    const isImportant = this.isImportantMessage(role, message.content, message.imageUrl);
    const hasExtractedInfo =
      !!extracted.brandAndProfile ||
      !!extracted.requirements ||
      !!extracted.preferences ||
      !!extracted.decisions ||
      !!extracted.technicalContext ||
      !!extracted.tasks ||
      !!extracted.feedback;

    if (!isImportant && !hasExtractedInfo) return;

    const createdAtIso =
      message.createdAt instanceof Date ? message.createdAt.toISOString() : new Date(message.createdAt).toISOString();
    let existing: any = null;
    try {
      existing = await this.prisma.chatMemory.findUnique({
        where: { chatId: message.chatId },
        select: { details: true, facts: true, snippets: true },
      });
    } catch {
      return;
    }

    const details: Record<string, any> =
      existing?.details && typeof existing.details === 'object' ? { ...(existing.details as any) } : {};
    const facts: any[] = Array.isArray(existing?.facts) ? [...existing.facts] : [];
    const snippets: any[] = Array.isArray(existing?.snippets) ? [...existing.snippets] : [];

    const wfCached = this.workflowCache.get(message.chatId);
    if (wfCached && !details._workflow) {
      details._workflow = wfCached;
    } else if (!wfCached && details._workflow) {
      this.workflowCache.set(message.chatId, details._workflow);
    }

    // Merge rule-based structured extraction immediately
    this.mergeStructuredMemory(
      details,
      facts,
      extracted,
      {
        chatId: message.chatId,
        customerId: meta.customerId,
        messageId: message.id,
        createdAtIso,
      },
    );

    if (isImportant) {
      const snippetContent = this.cleanValue(message.content).slice(0, 600);
      if (!snippets.some((s: any) => s.messageId === message.id)) {
        snippets.push({
          messageId: message.id,
          chatId: message.chatId,
          customerId: meta.customerId,
          role,
          content: snippetContent,
          ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
          createdAt: createdAtIso,
        });
      }
      if (snippets.length > 50) snippets.splice(0, snippets.length - 50);
    }

    if (facts.length > 200) facts.splice(0, facts.length - 200);

    try {
      await this.prisma.chatMemory.upsert({
        where: { chatId: message.chatId },
        create: {
          chatId: message.chatId,
          customerId: meta.customerId,
          influencerId: meta.influencerId,
          details,
          facts,
          snippets,
        },
        update: {
          customerId: meta.customerId,
          influencerId: meta.influencerId,
          details,
          facts,
          snippets,
        },
      });
    } catch {}

    // Upsert into Pinecone for vector retrieval
    if (isImportant && message.content?.trim()) {
      void this.pineconeMemory
        .upsertSnippet(message.chatId, message.id, role, message.content)
        .catch(() => {});
    }

    // Trigger asynchronous AI background memory extractor for deep synthesis
    if (isImportant || hasExtractedInfo) {
      void this.triggerBackgroundAiMemoryExtraction(message.chatId, meta);
    }
  }

  async getChatMemoryForPrompt(chatId: string, currentMessage?: string) {
    let row: any = null;
    try {
      row = await this.prisma.chatMemory.findUnique({
        where: { chatId },
        select: { details: true, facts: true, snippets: true },
      });
    } catch {
      return '';
    }
    const details: any = await this.getChatMemoryDetails(chatId);
    const sections: string[] = [];

    // 1. Brand & Client Profile
    const profileLines: string[] = [];
    if (details.clientName) profileLines.push(`- Client Name: ${details.clientName}`);
    if (details.clientEmail) profileLines.push(`- Client Email: ${details.clientEmail}`);
    if (details.brandName) profileLines.push(`- Brand Name: ${details.brandName}`);
    if (details.productName) profileLines.push(`- Product Name: ${details.productName}`);
    if (details.website) profileLines.push(`- Website: ${details.website}`);
    if (details.targetAudience) profileLines.push(`- Target Audience: ${details.targetAudience}`);
    if (details.tone) profileLines.push(`- Defined Tone: ${details.tone}`);
    if (details.industry) profileLines.push(`- Industry: ${details.industry}`);
    if (profileLines.length > 0) {
      sections.push(`[Brand & Client Profile]\n${profileLines.join('\n')}`);
    }

    // 2. Project Requirements & Specifications
    const reqLines: string[] = [];
    if (details.requirements && typeof details.requirements === 'object') {
      for (const [k, v] of Object.entries(details.requirements)) {
        if (v) reqLines.push(`- ${k}: ${v}`);
      }
    }
    if (reqLines.length > 0) {
      sections.push(`[Project Requirements & Specifications]\n${reqLines.join('\n')}`);
    }

    // 3. Client Preferences & Guidelines (Do's & Don'ts)
    const prefLines: string[] = [];
    if (details.preferences && typeof details.preferences === 'object') {
      for (const [k, v] of Object.entries(details.preferences)) {
        if (v) prefLines.push(`- ${k}: ${v}`);
      }
    }
    if (prefLines.length > 0) {
      sections.push(`[Client Preferences & Guidelines (Do's & Don'ts)]\n${prefLines.join('\n')}`);
    }

    // 4. Key Decisions & Approvals
    const decLines: string[] = [];
    if (details.decisions && typeof details.decisions === 'object') {
      for (const [k, v] of Object.entries(details.decisions)) {
        if (v) decLines.push(`- ${k}: ${v}`);
      }
    }
    if (decLines.length > 0) {
      sections.push(`[Key Decisions & Approvals]\n${decLines.join('\n')}`);
    }

    // 5. Technical Context & Integrations
    const techLines: string[] = [];
    if (details.technicalContext && typeof details.technicalContext === 'object') {
      for (const [k, v] of Object.entries(details.technicalContext)) {
        if (v) techLines.push(`- ${k}: ${v}`);
      }
    }
    if (techLines.length > 0) {
      sections.push(`[Technical Context & Integrations]\n${techLines.join('\n')}`);
    }

    // 6. Active Tasks & Milestones
    const taskLines: string[] = [];
    if (Array.isArray(details.tasks) && details.tasks.length > 0) {
      for (const t of details.tasks) {
        if (t?.task) {
          const statusTag = String(t.status || 'pending').toUpperCase();
          taskLines.push(`- [${statusTag}] ${t.task}`);
        }
      }
    }
    if (taskLines.length > 0) {
      sections.push(`[Active Tasks & Milestones]\n${taskLines.join('\n')}`);
    }

    // 7. Client Feedback & Adjustments
    const fbLines: string[] = [];
    if (Array.isArray(details.feedback) && details.feedback.length > 0) {
      for (const fb of details.feedback.slice(-4)) {
        if (fb?.feedback) {
          const adj = fb.adjustment ? ` -> (Applied: ${fb.adjustment})` : '';
          fbLines.push(`- Feedback: "${fb.feedback}"${adj}`);
        }
      }
    }
    if (fbLines.length > 0) {
      sections.push(`[Client Feedback & Adjustments]\n${fbLines.join('\n')}`);
    }

    // 8. General Notes
    if (Array.isArray(details.notes) && details.notes.length > 0) {
      sections.push(`[Important Saved Notes]\n${details.notes.slice(-5).map((n: string) => `- ${n}`).join('\n')}`);
    }

    // Semantic retrieval via Pinecone when a current message is available
    let semanticSnippets: Array<{ role: string; content: string }> = [];
    if (currentMessage?.trim()) {
      try {
        semanticSnippets = await this.pineconeMemory.queryRelevant(chatId, currentMessage, 5);
      } catch {
        semanticSnippets = [];
      }
    }

    if (semanticSnippets.length > 0) {
      const semLines = semanticSnippets.map((s) => `- (${s.role === 'USER' ? 'User' : 'Assistant'}) ${s.content}`);
      sections.push(`[Relevant Past Context (Semantically Matched)]\n${semLines.join('\n')}`);
    } else {
      // Fall back to recent MySQL snippets
      const snippets = Array.isArray(row?.snippets) ? row.snippets.slice(-5) : [];
      if (snippets.length) {
        const snipLines = snippets.map((s: any) => `- (${s?.role === 'USER' ? 'User' : 'Assistant'}) ${typeof s?.content === 'string' ? s.content : ''}`);
        sections.push(`[Recent Important Conversation Notes]\n${snipLines.join('\n')}`);
      }
    }

    return sections.join('\n\n');
  }

  async getChatMemoryDetails(chatId: string) {
    let row: any = null;
    try {
      row = await this.prisma.chatMemory.findUnique({
        where: { chatId },
        select: { details: true, customerId: true },
      });
    } catch {
      return {};
    }
    const details = row?.details && typeof row.details === 'object' ? { ...(row.details as any) } : {};

    // Fall back to User profile fields if not already populated in memory
    try {
      const meta = await this.getChatMetaCached(chatId);
      const customerId = row?.customerId || meta?.customerId;
      if (customerId) {
        const customer = await this.prisma.user.findUnique({
          where: { id: customerId },
          select: { name: true, email: true, website: true, brandName: true, productName: true, targetAudience: true, tone: true, company: true },
        });
        if (customer) {
          if (!details.clientName && customer.name) details.clientName = customer.name;
          if (!details.clientEmail && customer.email) details.clientEmail = customer.email;
          if (!details.website && customer.website) details.website = customer.website;
          if (!details.brandName && (customer.brandName || customer.company)) details.brandName = customer.brandName || customer.company;
          if (!details.productName && customer.productName) details.productName = customer.productName;
          if (!details.targetAudience && customer.targetAudience) details.targetAudience = customer.targetAudience;
          if (!details.tone && customer.tone) details.tone = customer.tone;
        }
      }
    } catch {}

    // Scan chat message history if important fields or requirements are still missing
    if (!details.website || !details.brandName || !details.requirements || Object.keys(details.requirements).length === 0) {
      try {
        const pastMessages = await this.prisma.message.findMany({
          where: { chatId },
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, createdAt: true },
        });
        let modified = false;
        const facts: any[] = Array.isArray(row?.facts) ? [...row.facts] : [];

        for (const m of pastMessages) {
          if (!m.content?.trim()) continue;
          const extracted = this.extractKeyDetails(m.content, m.role === 'USER' ? 'USER' : 'ASSISTANT');
          if (
            extracted.brandAndProfile ||
            extracted.requirements ||
            extracted.preferences ||
            extracted.decisions ||
            extracted.technicalContext ||
            extracted.tasks ||
            extracted.feedback
          ) {
            this.mergeStructuredMemory(details, facts, extracted, {
              chatId,
              customerId: row?.customerId || '',
              messageId: m.id,
              createdAtIso: m.createdAt.toISOString(),
            });
            modified = true;
          }
        }

        if (modified && row) {
          await this.prisma.chatMemory
            .update({
              where: { chatId },
              data: { details, facts },
            })
            .catch(() => {});
        }
      } catch {}
    }

    return details;
  }

  async getWorkflowState(chatId: string) {
    if (this.workflowCache.has(chatId)) {
      return this.workflowCache.get(chatId);
    }
    const details: any = await this.getChatMemoryDetails(chatId);
    const wf = details?._workflow;
    const normalized = wf && typeof wf === 'object' ? wf : null;
    if (normalized) {
      this.workflowCache.set(chatId, normalized);
    }
    return normalized;
  }

  async setWorkflowState(chatId: string, state: any | null) {
    if (state) {
      this.workflowCache.set(chatId, state);
    } else {
      this.workflowCache.delete(chatId);
    }
    let meta: { customerId: string; influencerId: string } | null = null;
    try {
      meta = await this.prisma.chat.findUnique({
        where: { id: chatId },
        select: { customerId: true, influencerId: true },
      });
    } catch {}
    if (!meta) return;

    let existing: any = null;
    try {
      existing = await this.prisma.chatMemory.findUnique({
        where: { chatId },
        select: { details: true, facts: true, snippets: true },
      });
    } catch {}

    const details: Record<string, any> =
      existing?.details && typeof existing.details === 'object' ? { ...(existing.details as any) } : {};
    if (state) {
      details._workflow = state;
    } else {
      delete (details as any)._workflow;
    }

    const facts = Array.isArray(existing?.facts) ? existing.facts : [];
    const snippets = Array.isArray(existing?.snippets) ? existing.snippets : [];

    try {
      await this.prisma.chatMemory.upsert({
        where: { chatId },
        create: {
          chatId,
          customerId: meta.customerId,
          influencerId: meta.influencerId,
          details,
          facts,
          snippets,
        },
        update: {
          customerId: meta.customerId,
          influencerId: meta.influencerId,
          details,
        },
      });
    } catch {}
  }

  async updateChatMemoryDetails(chatId: string, patch: Record<string, any>) {
    let meta: { customerId: string; influencerId: string } | null = null;
    try {
      meta = await this.prisma.chat.findUnique({
        where: { id: chatId },
        select: { customerId: true, influencerId: true },
      });
    } catch {}
    if (!meta) return;

    let existing: any = null;
    try {
      existing = await this.prisma.chatMemory.findUnique({
        where: { chatId },
        select: { details: true, facts: true, snippets: true },
      });
    } catch {}

    const details: Record<string, any> =
      existing?.details && typeof existing.details === 'object' ? { ...(existing.details as any) } : {};
    for (const [k, v] of Object.entries(patch ?? {})) {
      if (typeof v === 'undefined') continue;
      (details as any)[k] = v;
    }

    const facts = Array.isArray(existing?.facts) ? existing.facts : [];
    const snippets = Array.isArray(existing?.snippets) ? existing.snippets : [];

    try {
      await this.prisma.chatMemory.upsert({
        where: { chatId },
        create: {
          chatId,
          customerId: meta.customerId,
          influencerId: meta.influencerId,
          details,
          facts,
          snippets,
        },
        update: {
          customerId: meta.customerId,
          influencerId: meta.influencerId,
          details,
        },
      });
    } catch {}
  }

  async savePosterPlanToLatestProject(chatId: string, plan: Record<string, any>) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { customerId: true, influencerId: true },
    });
    if (!chat) return;

    const order = await this.prisma.order.findFirst({
      where: {
        customerId: chat.customerId,
        influencerId: chat.influencerId,
        status: { notIn: ['CANCELLED', 'REFUNDED', 'REJECTED'] as any },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, projectBrief: true },
    });

    if (!order) {
      return;
    }

    const brief = this.parseBrief(order.projectBrief);
    const existingPlan = brief.posterPlan && typeof brief.posterPlan === 'object' ? { ...(brief.posterPlan as any) } : {};
    const nextPlan = { ...existingPlan, ...(plan as any) };
    const existingList = Array.isArray(existingPlan.posters) ? existingPlan.posters : [];
    const nextList = Array.isArray((plan as any)?.posters) ? (plan as any).posters : [];
    if (nextList.length > 0) {
      const seen = new Set(existingList.map((p: any) => String(p?.id || p?.createdAt || '')));
      for (const p of nextList) {
        const key = String(p?.id || p?.createdAt || '');
        if (!key || seen.has(key)) continue;
        existingList.push(p);
        seen.add(key);
      }
      nextPlan.posters = existingList;
    }

    brief.posterPlan = nextPlan;
    await this.prisma.order.update({
      where: { id: order.id },
      data: { projectBrief: JSON.stringify(brief) },
    });
  }

  async savePostPlanToLatestProject(chatId: string, plan: Record<string, any>) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { customerId: true, influencerId: true },
    });
    if (!chat) return;

    const order = await this.prisma.order.findFirst({
      where: {
        customerId: chat.customerId,
        influencerId: chat.influencerId,
        status: { notIn: ['CANCELLED', 'REFUNDED', 'REJECTED'] as any },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, projectBrief: true },
    });

    if (!order) {
      return;
    }

    const brief = this.parseBrief(order.projectBrief);

    const existingPlan = brief.postPlan && typeof brief.postPlan === 'object' ? { ...(brief.postPlan as any) } : {};
    const nextPlan = { ...existingPlan, ...(plan as any) };
    const existingList = Array.isArray(existingPlan.posts) ? existingPlan.posts : [];
    const nextList = Array.isArray((plan as any)?.posts) ? (plan as any).posts : [];
    if (nextList.length > 0) {
      const seen = new Set(existingList.map((p: any) => String(p?.id || p?.createdAt || '')));
      for (const p of nextList) {
        const key = String(p?.id || p?.createdAt || '');
        if (!key || seen.has(key)) continue;
        existingList.push(p);
        seen.add(key);
      }
      nextPlan.posts = existingList;
    }

    brief.postPlan = nextPlan;
    await this.prisma.order.update({
      where: { id: order.id },
      data: { projectBrief: JSON.stringify(brief) },
    });
  }

  async saveGeneratedPostToProject(chatId: string, post: any) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { customerId: true, influencerId: true },
    });
    if (!chat) return;

    await this.addPostToCustomerOrder(chat.customerId, chat.influencerId, post);
  }

  async addPostToCustomerOrder(customerId: string, influencerId: string, post: any) {
    const validStatuses = [
      OrderStatus.PAID,
      OrderStatus.GENERATING,
      OrderStatus.PENDING_REVIEW,
      OrderStatus.APPROVED,
      OrderStatus.DELIVERED,
    ];

    const orders = await this.prisma.order.findMany({
      where: {
        customerId,
        influencerId,
        status: { in: validStatuses },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, customerId: true, projectBrief: true, videosOrdered: true, videosDelivered: true, status: true },
    });

    if (!orders || orders.length === 0) {
      // Client has not hired the agent; do not create unpurchased orders
      return;
    }

    const postEntry = {
      id: post.id || `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: post.title || 'Social Post',
      caption: post.caption || post.content || '',
      content: post.content || post.caption || '',
      hashtags: Array.isArray(post.hashtags)
        ? post.hashtags
        : typeof post.hashtags === 'string'
          ? post.hashtags.split(/\s+/).filter(Boolean)
          : [],
      imageUrl: post.imageUrl || null,
      imagePrompt: post.imagePrompt || null,
      platforms: Array.isArray(post.platforms) ? post.platforms : [],
      topic: post.topic || '',
      tone: post.tone || null,
      callToAction: post.callToAction || null,
      createdAt: post.createdAt || new Date().toISOString(),
      delivered: true,
    };

    // Prefer the active order that still has remaining capacity, or latest order
    const targetOrder =
      orders.find((o) => (o.videosDelivered || 0) < (o.videosOrdered || 1) && o.status !== OrderStatus.DELIVERED) ||
      orders[0];

    let brief: any = {};
    if (targetOrder.projectBrief) {
      if (typeof targetOrder.projectBrief === 'string') {
        try {
          brief = JSON.parse(targetOrder.projectBrief);
        } catch {
          brief = { raw: targetOrder.projectBrief };
        }
      } else if (typeof targetOrder.projectBrief === 'object') {
        brief = { ...(targetOrder.projectBrief as any) };
      }
    }

    const existingPosts = Array.isArray(brief.generatedPosts) ? [...brief.generatedPosts] : [];
    const isDup = existingPosts.some(
      (p: any) =>
        (p?.id && p.id === postEntry.id) ||
        (p?.title && p.title.trim().toLowerCase() === postEntry.title.trim().toLowerCase() && p?.caption && p.caption.trim().toLowerCase() === postEntry.caption.trim().toLowerCase()),
    );
    if (!isDup) {
      existingPosts.push(postEntry);
    }
    brief.generatedPosts = existingPosts;

    if (postEntry.imageUrl) {
      const existingImages = Array.isArray(brief.generatedImages) ? [...brief.generatedImages] : [];
      if (!existingImages.some((img: any) => img.url === postEntry.imageUrl)) {
        existingImages.push({
          url: postEntry.imageUrl,
          messageId: postEntry.id,
          createdAt: postEntry.createdAt,
          delivered: true,
        });
        brief.generatedImages = existingImages;
      }
    }

    const currentDelivered = targetOrder.videosDelivered || 0;
    const newDelivered = isDup ? currentDelivered : Math.max(currentDelivered + 1, existingPosts.length);
    const orderedUnits = targetOrder.videosOrdered > 0 ? targetOrder.videosOrdered : 1;
    const isComplete = newDelivered >= orderedUnits;

    await this.prisma.order.update({
      where: { id: targetOrder.id },
      data: {
        projectBrief: JSON.stringify(brief),
        videosDelivered: newDelivered,
        status: isComplete ? OrderStatus.DELIVERED : targetOrder.status,
        deliveredAt: isComplete ? new Date() : undefined,
      },
    });
  }

  async findOrCreateChat(customerId: string, influencerId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
    });

    if (!influencer || !influencer.isActive) {
      throw new NotFoundException('Influencer not found');
    }

    const include = {
      messages: { orderBy: { createdAt: 'asc' as const } },
      influencer: { include: { portfolio: true } },
    };

    let chat: any;
    try {
      chat = await this.prisma.chat.create({
        data: { customerId, influencerId },
        include,
      });
    } catch (err: any) {
      // P2002 = unique constraint violation — chat already exists
      if (err?.code === 'P2002') {
        chat = await this.prisma.chat.findUnique({
          where: { customerId_influencerId: { customerId, influencerId } },
          include,
        });
      } else {
        throw err;
      }
    }

    // Save welcome message on first open
    if (chat.messages.length === 0) {
      const welcome = await this.prisma.message.create({
        data: {
          chatId: chat.id,
          role: 'ASSISTANT',
          content: `Hi! I'm ${influencer.name}. Tell me about your brand and what kind of content you're looking to create — I'm here to help! 🎯`,
        },
      });
      chat.messages.push(welcome);

      // Seed ChatMemory using user onboarding details
      try {
        const customer = await this.prisma.user.findUnique({
          where: { id: customerId },
        });

        if (customer && customer.isOnboarded) {
          const details = {
            brandName: customer.brandName || '',
            productName: customer.productName || '',
            website: customer.website || '',
            targetAudience: customer.targetAudience || '',
            tone: customer.tone || '',
            industry: customer.industry || '',
            goal: customer.goal || '',
          };
          const facts = [
            { key: 'brandName', value: customer.brandName || '' },
            { key: 'productName', value: customer.productName || '' },
            { key: 'website', value: customer.website || '' },
            { key: 'targetAudience', value: customer.targetAudience || '' },
            { key: 'tone', value: customer.tone || '' },
            { key: 'industry', value: customer.industry || '' },
            { key: 'goal', value: customer.goal || '' },
          ]
            .filter((f) => f.value !== '')
            .map((f) => ({
              key: f.key,
              value: f.value,
              messageId: 'onboarding-seeded',
              chatId: chat.id,
              customerId: customer.id,
              createdAt: new Date().toISOString(),
            }));

          await this.prisma.chatMemory.create({
            data: {
              chatId: chat.id,
              customerId: customer.id,
              influencerId: influencer.id,
              details,
              facts,
              snippets: [],
            },
          });
        }
      } catch (err) {
        console.error('[ChatService] Failed to seed ChatMemory during findOrCreateChat:', err);
      }
    }

    return chat;
  }

  async addMessage(chatId: string, role: 'USER' | 'ASSISTANT', content: string, imageUrl?: string) {
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { chatId, role, content, ...(imageUrl ? { imageUrl } : {}) } }),
      this.prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } }),
    ]);
    if (role === 'ASSISTANT' && imageUrl) {
      try {
        await this.attachGeneratedImageToLatestProject(chatId, message.id, imageUrl, message.createdAt);
      } catch (e) {
        console.error('[ChatService] Failed to attach generated image to project:', e);
      }
    }
    try {
      const meta = await this.getChatMetaCached(chatId);
      await this.updateChatMemoryFromMessage(message as any, meta);
    } catch {}
    return message;
  }

  private async attachGeneratedImageToLatestProject(
    chatId: string,
    messageId: string,
    imageUrl: string,
    createdAt: Date,
  ) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { customerId: true, influencerId: true },
    });
    if (!chat) return;

    const order = await this.prisma.order.findFirst({
      where: {
        customerId: chat.customerId,
        influencerId: chat.influencerId,
        createdAt: { lte: createdAt },
        status: { notIn: ['CANCELLED', 'REFUNDED', 'REJECTED'] as any },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, projectBrief: true, videosDelivered: true },
    });
    if (!order) {
      const fallback = await this.prisma.order.findFirst({
        where: {
          customerId: chat.customerId,
          influencerId: chat.influencerId,
          status: {
            in: [
              OrderStatus.PAID,
              OrderStatus.GENERATING,
              OrderStatus.PENDING_REVIEW,
              OrderStatus.APPROVED,
              OrderStatus.DELIVERED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, projectBrief: true, videosDelivered: true },
      });
      if (fallback) {
        return this.attachGeneratedImageToOrder(fallback.id, fallback.projectBrief as any, messageId, imageUrl, createdAt);
      }
      return;
    }

    await this.attachGeneratedImageToOrder(order.id, order.projectBrief as any, messageId, imageUrl, createdAt);
  }

  private async attachGeneratedImageToOrder(
    orderId: string,
    projectBrief: any,
    messageId: string,
    imageUrl: string,
    createdAt: Date,
  ) {
    const brief = this.parseBrief(projectBrief);
    const list = Array.isArray(brief.generatedImages) ? [...brief.generatedImages] : [];
    const isDup = list.some((x: any) => x?.messageId === messageId || x?.url === imageUrl);
    if (!isDup) {
      list.push({
        url: imageUrl,
        messageId,
        createdAt: createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString(),
        delivered: true,
        deliveredAt: new Date().toISOString(),
      });
    }
    brief.generatedImages = list;

    const deliveredCount = list.filter((x: any) => x && x.delivered === true).length;

    const current = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, deliveredAt: true, videosOrdered: true, videosDelivered: true },
    });

    const orderedUnits = current?.videosOrdered && current.videosOrdered > 0 ? current.videosOrdered : 1;
    const currentDelivered = current?.videosDelivered || 0;
    const newDelivered = isDup ? currentDelivered : Math.max(currentDelivered + 1, deliveredCount);
    const isComplete = newDelivered >= orderedUnits;

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        projectBrief: JSON.stringify(brief),
        videosDelivered: newDelivered,
        status: isComplete ? OrderStatus.DELIVERED : current?.status,
        deliveredAt: isComplete ? (current?.deliveredAt || new Date()) : undefined,
      },
    });
  }

  async getChatHistory(chatId: string) {
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getLastAssistantImage(chatId: string) {
    return this.prisma.message.findFirst({
      where: { chatId, role: 'ASSISTANT', imageUrl: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true, imageUrl: true, createdAt: true },
    });
  }

  async getUserChats(customerId: string) {
    return this.prisma.chat.findMany({
      where: { customerId },
      include: {
        influencer: { include: { portfolio: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getInfluencerChats(influencerId: string) {
    return this.prisma.chat.findMany({
      where: { influencerId },
      include: {
        customer: true,
        influencer: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getAllChats() {
    return this.prisma.chat.findMany({
      include: {
        customer: true,
        influencer: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getChatById(chatId: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        customer: true,
        influencer: { include: { portfolio: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!chat) throw new NotFoundException('Chat not found');
    return chat;
  }

  async getChatMeta(chatId: string) {
    return this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { customerId: true, influencerId: true, influencer: { select: { name: true } } },
    });
  }

  async getInfluencerUsageAndHireStatus(
    customerId: string,
    influencerId: string,
  ): Promise<AgentUsageAndHireStatus> {
    const emptyResult: AgentUsageAndHireStatus = {
      isHired: false,
      hasRemainingUsage: false,
      remainingUnits: 0,
      totalOrderedUnits: 0,
      totalDeliveredUnits: 0,
      activeOrdersCount: 0,
      completedOrdersCount: 0,
    };

    if (!customerId || !influencerId) return emptyResult;

    try {
      // Fetch all valid orders for this specific customer and influencer
      const validStatuses = [
        OrderStatus.PAID,
        OrderStatus.GENERATING,
        OrderStatus.PENDING_REVIEW,
        OrderStatus.APPROVED,
        OrderStatus.DELIVERED,
      ];

      const orders = await this.prisma.order.findMany({
        where: {
          customerId,
          influencerId,
          status: { in: validStatuses },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          videosOrdered: true,
          videosDelivered: true,
          projectBrief: true,
        },
      });

      if (!orders || orders.length === 0) {
        return emptyResult;
      }

      let totalOrderedUnits = 0;
      let totalDeliveredUnits = 0;
      let completedOrdersCount = 0;
      let activeOrdersCount = 0;

      for (const o of orders) {
        let postsDelivered = 0;
        let imagesDelivered = 0;
        if (o.projectBrief) {
          try {
            const brief = typeof o.projectBrief === 'string' ? JSON.parse(o.projectBrief) : o.projectBrief;
            if (Array.isArray(brief?.generatedPosts)) {
              postsDelivered = brief.generatedPosts.length;
            }
            if (Array.isArray(brief?.generatedImages)) {
              imagesDelivered = brief.generatedImages.length;
            }
          } catch {}
        }
        const effectiveDelivered = Math.max(o.videosDelivered || 0, postsDelivered, imagesDelivered);
        const ordered = o.videosOrdered > 0 ? o.videosOrdered : 1;
        const deliveredForOrder = Math.min(ordered, effectiveDelivered);

        totalOrderedUnits += ordered;
        totalDeliveredUnits += deliveredForOrder;

        if (o.status === OrderStatus.DELIVERED || deliveredForOrder >= ordered) {
          completedOrdersCount++;
        } else {
          activeOrdersCount++;
        }
      }

      const remainingUnits = Math.max(0, totalOrderedUnits - totalDeliveredUnits);
      const hasRemainingUsage = remainingUnits > 0;

      return {
        isHired: true,
        hasRemainingUsage,
        remainingUnits,
        totalOrderedUnits,
        totalDeliveredUnits,
        activeOrdersCount,
        completedOrdersCount,
      };
    } catch (err) {
      console.error('[ChatService] getInfluencerUsageAndHireStatus error:', err);
      return emptyResult;
    }
  }

  async isInfluencerHired(customerId: string, influencerId: string): Promise<boolean> {
    const status = await this.getInfluencerUsageAndHireStatus(customerId, influencerId);
    return status.isHired;
  }

  async getInfluencerSystemPrompt(influencerId: string): Promise<string> {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { systemPrompt: true, name: true },
    });

    if (!influencer) throw new NotFoundException('Influencer not found');
    return influencer.systemPrompt;
  }

  async getInfluencerAIContext(influencerId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
      select: {
        name: true,
        industries: true,
        contentStyle: true,
        locationCity: true,
        locationState: true,
        locationCountry: true,
        locationAddress: true,
        locationPincode: true,
        systemPrompt: true,
        topic: true,
        outOfTopicMessage: true,
        serviceType: true,
        aiConfig: {
          select: {
            imageApiUrl: true,
            imageApiKey: true,
            imageModel: true,
            chatApiUrl: true,
            chatApiKey: true,
            chatModel: true,
            chatProvider: true,
            postApiUrl: true,
            postApiKey: true,
            postModel: true,
          },
        },
      },
    });
    if (!influencer) throw new NotFoundException('Influencer not found');
    return influencer;
  }

  async getInfluencerActivePackages(influencerId: string) {
    return this.prisma.influencerPackage.findMany({
      where: { influencerId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        type: true,
        name: true,
        price: true,
        videoCount: true,
        description: true,
        isMonthly: true,
        sortOrder: true,
      },
    });
  }

  async getRecentMessages(chatId: string, limit = 20) {
    const messages = await this.prisma.message.findMany({
      where: { chatId, role: { not: 'SYSTEM' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }

  async getChatNotes(chatId: string, userId: string) {
    return this.prisma.chatNote.findMany({
      where: { chatId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createChatNote(chatId: string, userId: string, content: string, title?: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');

    return this.prisma.chatNote.create({
      data: {
        chatId,
        userId,
        title: title?.trim() || null,
        content,
      },
    });
  }

  async updateChatNote(noteId: string, userId: string, content: string, title?: string) {
    const note = await this.prisma.chatNote.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    if (note.userId !== userId) throw new NotFoundException('Note not found or access denied');

    return this.prisma.chatNote.update({
      where: { id: noteId },
      data: {
        title: title?.trim() || null,
        content,
      },
    });
  }

  async deleteChatNote(noteId: string, userId: string) {
    const note = await this.prisma.chatNote.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    if (note.userId !== userId) throw new NotFoundException('Note not found or access denied');

    await this.prisma.chatNote.delete({ where: { id: noteId } });
    return true;
  }
}
