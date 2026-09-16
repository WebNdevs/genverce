import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

interface SnippetMetadata {
  chatId: string;
  messageId: string;
  role: string;
  content: string;
  createdAt: string;
}

@Injectable()
export class PineconeMemoryService {
  private readonly logger = new Logger(PineconeMemoryService.name);

  /** Lazily-initialised Pinecone client — undefined when PINECONE_API_KEY is absent */
  private pineconeIndex: any | null = null;
  private pineconeReady = false;
  private initAttempted = false;

  constructor(private readonly configService: ConfigService) {}

  // ─── Initialisation ─────────────────────────────────────────────────────────

  private async getIndex(): Promise<any | null> {
    if (this.pineconeReady) return this.pineconeIndex;
    if (this.initAttempted) return null;
    this.initAttempted = true;

    const apiKey = this.configService.get<string>('PINECONE_API_KEY')?.trim() ?? '';
    const indexName = this.configService.get<string>('PINECONE_INDEX')?.trim() ?? '';

    if (!apiKey || !indexName) {
      this.logger.warn(
        'Pinecone is not configured (PINECONE_API_KEY or PINECONE_INDEX missing). ' +
          'Chat memory will fall back to MySQL snippets.',
      );
      return null;
    }

    try {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const pc = new Pinecone({ apiKey });
      this.pineconeIndex = pc.Index(indexName);
      this.pineconeReady = true;
      this.logger.log(`Pinecone memory initialised (index: "${indexName}")`);
      return this.pineconeIndex;
    } catch (err) {
      this.logger.error('Failed to initialise Pinecone client', err);
      return null;
    }
  }

  // ─── Embedding ───────────────────────────────────────────────────────────────

  private async embed(text: string): Promise<number[] | null> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY')?.trim() ?? '';
    if (!apiKey) {
      // Try to use the site-settings key if available (will be undefined here — handled by caller)
      return null;
    }

    try {
      const client = new OpenAI({ apiKey });
      const res = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000), // stay well within token limit
      });
      return res.data[0]?.embedding ?? null;
    } catch (err) {
      this.logger.warn(`Embedding failed: ${(err as Error).message}`);
      return null;
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Store a chat message snippet as a vector in Pinecone.
   * No-op when Pinecone is not configured or embedding fails.
   */
  async upsertSnippet(
    chatId: string,
    messageId: string,
    role: 'USER' | 'ASSISTANT',
    content: string,
  ): Promise<void> {
    const index = await this.getIndex();
    if (!index) return;

    const text = (content ?? '').trim();
    if (!text) return;

    const vector = await this.embed(text);
    if (!vector) return;

    try {
      const metadata: SnippetMetadata = {
        chatId,
        messageId,
        role,
        content: text.slice(0, 512), // Pinecone metadata size limit
        createdAt: new Date().toISOString(),
      };

      await index.upsert([
        {
          id: `${chatId}::${messageId}`,
          values: vector,
          metadata,
        },
      ]);
    } catch (err) {
      this.logger.warn(`Pinecone upsert failed for message ${messageId}: ${(err as Error).message}`);
    }
  }

  /**
   * Find the top-K most semantically relevant snippets for a given query text,
   * filtered to the specified chatId.
   *
   * Returns an empty array when Pinecone is not configured or query fails.
   */
  async queryRelevant(
    chatId: string,
    queryText: string,
    topK = 5,
  ): Promise<Array<{ role: string; content: string }>> {
    const index = await this.getIndex();
    if (!index) return [];

    const text = (queryText ?? '').trim();
    if (!text) return [];

    const vector = await this.embed(text);
    if (!vector) return [];

    try {
      const result = await index.query({
        vector,
        topK: Math.min(topK, 10),
        filter: { chatId: { $eq: chatId } },
        includeMetadata: true,
      });

      const matches: any[] = result?.matches ?? [];
      return matches
        .filter((m: any) => m.score >= 0.30) // discard very low-relevance results
        .map((m: any) => ({
          role: String(m.metadata?.role ?? 'USER'),
          content: String(m.metadata?.content ?? ''),
        }))
        .filter((m) => m.content.length > 0);
    } catch (err) {
      this.logger.warn(`Pinecone query failed for chat ${chatId}: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Delete all vectors for a chat. Call this when a chat is deleted.
   */
  async deleteChat(chatId: string): Promise<void> {
    const index = await this.getIndex();
    if (!index) return;

    try {
      // Pinecone supports deleteMany by metadata filter
      await index.deleteMany({ filter: { chatId: { $eq: chatId } } });
      this.logger.log(`Deleted Pinecone vectors for chat ${chatId}`);
    } catch (err) {
      this.logger.warn(`Pinecone deleteChat failed for ${chatId}: ${(err as Error).message}`);
    }
  }

  /** True when Pinecone has been successfully initialised */
  get isEnabled(): boolean {
    return this.pineconeReady;
  }
}
