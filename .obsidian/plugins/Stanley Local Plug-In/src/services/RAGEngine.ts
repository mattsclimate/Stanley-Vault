import type { OllamaClient } from './OllamaClient';
import type { VectorStore } from './VectorStore';
import type { PerformanceMonitor } from './PerformanceMonitor';
import type { StanleySettings } from '../settings';
import type { ChatMessage } from '../types';

export class RAGEngine {
  constructor(
    private client: OllamaClient,
    private store: VectorStore,
    private monitor: PerformanceMonitor
  ) {}

  async query(
    userQuery: string,
    settings: StanleySettings,
    onToken: (token: string) => void
  ): Promise<{ response: string; settings: StanleySettings }> {
    const t0 = Date.now();

    const queryEmbedding = await this.client.embed(userQuery);
    const t1 = Date.now();

    const chunks = this.store.search(queryEmbedding, settings.topK);
    const t2 = Date.now();

    const context = chunks
      .map((c) => {
        const noteName = c.filePath.replace(/\.md$/, '').split('/').pop() ?? c.filePath;
        return `[[${noteName}]]\n${c.content}`;
      })
      .join('\n\n---\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: [
          'You are a knowledge assistant for a personal Obsidian vault.',
          'Answer the question using only the context provided below.',
          'If the answer is not in the context, say "I couldn\'t find that in your vault."',
          'Cite the source notes using [[wikilink]] format.',
          '',
          'Context:',
          context,
          '',
          `Question: ${userQuery}`,
        ].join('\n'),
        timestamp: Date.now(),
      },
    ];

    const { response, tokenCount } = await this.client.chat(messages, onToken);
    const t3 = Date.now();

    this.monitor.recordQuery(t1 - t0, t2 - t1, t3 - t2, tokenCount, settings.maxContextTokens);
    const updatedSettings = this.monitor.maybeAutoTune(settings);

    return { response, settings: updatedSettings };
  }
}
