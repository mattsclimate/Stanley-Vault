import { ItemView, MarkdownRenderer, MarkdownView, Notice, WorkspaceLeaf } from 'obsidian';
import type StanleyPlugin from '../main';
import type { RAGEngine } from '../services/RAGEngine';
import type { IndexManager } from '../services/IndexManager';
import type { PerformanceMonitor } from '../services/PerformanceMonitor';
import type { ChatMessage } from '../types';

export const VIEW_TYPE_CHAT = 'stanley-chat-view';

export class ChatView extends ItemView {
  private plugin: StanleyPlugin;
  private ragEngine: RAGEngine;
  private indexManager: IndexManager;
  private monitor: PerformanceMonitor;

  private messagesEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private actionsEl!: HTMLElement;
  private statusDot!: HTMLElement;
  private statsEl!: HTMLElement;

  private lastResponse = '';
  private lastQuery = '';

  constructor(
    leaf: WorkspaceLeaf,
    plugin: StanleyPlugin,
    ragEngine: RAGEngine,
    indexManager: IndexManager,
    monitor: PerformanceMonitor
  ) {
    super(leaf);
    this.plugin = plugin;
    this.ragEngine = ragEngine;
    this.indexManager = indexManager;
    this.monitor = monitor;
  }

  getViewType(): string { return VIEW_TYPE_CHAT; }
  getDisplayText(): string { return 'Stanley Chat'; }
  getIcon(): string { return 'message-circle'; }

  async onOpen(): Promise<void> {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass('stanley-chat-root');

    this.renderHeader(root);
    this.messagesEl = root.createDiv({ cls: 'stanley-messages' });
    this.actionsEl = root.createDiv({ cls: 'stanley-actions' });
    this.actionsEl.hide();
    this.renderActions(this.actionsEl);
    this.renderInput(root);
    this.renderStats(root);

    await this.updateStatus();
  }

  async onClose(): Promise<void> {}

  private renderHeader(root: HTMLElement): void {
    const header = root.createDiv({ cls: 'stanley-header' });
    header.createEl('span', { text: 'Stanley', cls: 'stanley-title' });

    this.statusDot = header.createEl('span', { cls: 'stanley-status-dot stanley-status-unknown' });
    this.statusDot.title = 'Checking Ollama connection...';

    const settingsBtn = header.createEl('button', { text: '⚙', cls: 'stanley-icon-btn' });
    settingsBtn.title = 'Open Stanley settings';
    settingsBtn.addEventListener('click', () => {
      // @ts-ignore — Obsidian internal API
      this.app.setting?.open?.();
      // @ts-ignore
      this.app.setting?.openTabById?.('stanley');
    });
  }

  private renderActions(container: HTMLElement): void {
    const insertBtn = container.createEl('button', { text: 'Insert', cls: 'stanley-btn' });
    insertBtn.title = 'Insert last response at cursor in active note';
    insertBtn.addEventListener('click', () => this.insertIntoNote());

    const newNoteBtn = container.createEl('button', { text: 'New Note', cls: 'stanley-btn' });
    newNoteBtn.title = 'Create a new note from last response';
    newNoteBtn.addEventListener('click', () => void this.createNewNote());
  }

  private renderInput(root: HTMLElement): void {
    const inputRow = root.createDiv({ cls: 'stanley-input-row' });

    this.inputEl = inputRow.createEl('textarea', {
      cls: 'stanley-input',
      attr: { placeholder: 'Ask your vault...', rows: '2' },
    }) as HTMLTextAreaElement;

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void this.handleSend();
      }
    });

    this.sendBtn = inputRow.createEl('button', { text: '↑', cls: 'stanley-send-btn' });
    this.sendBtn.addEventListener('click', () => void this.handleSend());
  }

  private renderStats(root: HTMLElement): void {
    const statsSection = root.createDiv({ cls: 'stanley-stats-section' });
    const toggle = statsSection.createEl('button', { text: '▶ Stats', cls: 'stanley-stats-toggle' });
    this.statsEl = statsSection.createDiv({ cls: 'stanley-stats-content' });
    this.statsEl.hide();

    toggle.addEventListener('click', () => {
      if (this.statsEl.isShown()) {
        this.statsEl.hide();
        toggle.textContent = '▶ Stats';
      } else {
        this.statsEl.show();
        toggle.textContent = '▼ Stats';
        this.refreshStats();
      }
    });

    const reindexBtn = statsSection.createEl('button', {
      text: 'Re-index vault',
      cls: 'stanley-btn stanley-reindex-btn',
    });
    reindexBtn.addEventListener('click', () => {
      new Notice('Stanley: Re-indexing vault...');
      void this.indexManager.reindexAll().then(() => {
        new Notice('Stanley: Re-index complete.');
        this.refreshStats();
      });
    });
  }

  private refreshStats(): void {
    const stats = this.monitor.getStats();
    this.statsEl.empty();
    const rows: [string, string][] = [
      ['Indexed chunks', String(stats.indexedChunkCount)],
      ['Last index', `${stats.lastIndexDurationMs}ms`],
      ['Avg query latency', `${Math.round(stats.avgQueryLatencyMs)}ms`],
      ['Total tokens used', String(stats.totalTokensUsed)],
      ['Cache hit rate', `${Math.round(stats.cacheHitRate * 100)}%`],
    ];
    for (const [label, value] of rows) {
      const row = this.statsEl.createDiv({ cls: 'stanley-stat-row' });
      row.createEl('span', { text: label, cls: 'stanley-stat-label' });
      row.createEl('span', { text: value, cls: 'stanley-stat-value' });
    }
  }

  private async updateStatus(): Promise<void> {
    const healthy = await this.plugin.ollamaClient.checkHealth();
    this.statusDot.removeClass('stanley-status-unknown', 'stanley-status-ok', 'stanley-status-error');
    if (healthy) {
      this.statusDot.addClass('stanley-status-ok');
      this.statusDot.title = 'Ollama connected';
      this.inputEl.disabled = false;
      this.sendBtn.disabled = false;
    } else {
      this.statusDot.addClass('stanley-status-error');
      this.statusDot.title = `Ollama unreachable at ${this.plugin.settings.ollamaBaseUrl}`;
      this.inputEl.disabled = true;
      this.sendBtn.disabled = true;
      this.appendMessage(
        'assistant',
        `⚠ Ollama not reachable at \`${this.plugin.settings.ollamaBaseUrl}\`. Start Ollama and re-open this panel.`
      );
    }
  }

  private async handleSend(): Promise<void> {
    const query = this.inputEl.value.trim();
    if (!query) return;

    this.lastQuery = query;
    this.inputEl.value = '';
    this.actionsEl.hide();
    this.sendBtn.disabled = true;
    this.inputEl.disabled = true;

    this.appendMessage('user', query);

    const streamingEl = this.appendStreamingBubble();
    let streamedText = '';

    try {
      const result = await this.ragEngine.query(
        query,
        this.plugin.settings,
        (token) => {
          streamedText += token;
          streamingEl.textContent = streamedText;
          this.messagesEl.scrollTo({ top: this.messagesEl.scrollHeight, behavior: 'smooth' });
        }
      );

      streamingEl.textContent = '';
      await MarkdownRenderer.renderMarkdown(result.response, streamingEl, '', this);

      this.lastResponse = result.response;

      if (result.settings !== this.plugin.settings) {
        this.plugin.settings = result.settings;
        await this.plugin.saveSettings();
      }

      this.actionsEl.show();
    } catch (err) {
      streamingEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.sendBtn.disabled = false;
      this.inputEl.disabled = false;
      this.inputEl.focus();
    }
  }

  private appendMessage(role: 'user' | 'assistant', content: string): void {
    const bubble = this.messagesEl.createDiv({ cls: `stanley-bubble stanley-bubble-${role}` });
    bubble.textContent = content;
    this.messagesEl.scrollTo({ top: this.messagesEl.scrollHeight, behavior: 'smooth' });
  }

  private appendStreamingBubble(): HTMLElement {
    const bubble = this.messagesEl.createDiv({
      cls: 'stanley-bubble stanley-bubble-assistant stanley-bubble-streaming',
    });
    this.messagesEl.scrollTo({ top: this.messagesEl.scrollHeight, behavior: 'smooth' });
    return bubble;
  }

  private insertIntoNote(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      new Notice('Stanley: No active note to insert into.');
      return;
    }
    view.editor.replaceSelection(this.lastResponse);
  }

  private async createNewNote(): Promise<void> {
    const baseName = this.lastQuery.slice(0, 50).replace(/[/\\?%*:|"<>]/g, '-');
    const title = `Stanley - ${baseName}`;
    try {
      await this.app.vault.create(`${title}.md`, this.lastResponse);
      new Notice(`Stanley: Created note "${title}"`);
    } catch {
      new Notice(`Stanley: Could not create note "${title}" — it may already exist.`);
    }
  }
}
