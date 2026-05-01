import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import type { CommandHistoryEntry, RecentUrl } from '../../renderer/types/index';
import log from 'electron-log';

interface HistoryData {
  commands: CommandHistoryEntry[];
  urls: RecentUrl[];
}

function normalizeCommand(command: string): string {
  return command.trim();
}

function normalizeUrl(url: string): string {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    const pathname = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname.replace(/\/+$/, '');
    return `${parsedUrl.protocol}//${parsedUrl.host.toLowerCase()}${pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return trimmedUrl.toLowerCase();
  }
}

export class HistoryStore {
  private historyPath: string;
  private data: HistoryData;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.historyPath = join(userDataPath, 'history.json');
    this.data = this.load();
    log.info('HistoryStore initialized');
  }

  private load(): HistoryData {
    try {
      if (existsSync(this.historyPath)) {
        return JSON.parse(readFileSync(this.historyPath, 'utf-8'));
      }
    } catch (e) {
      log.error('Failed to load history:', e);
    }
    return { commands: [], urls: [] };
  }

  private persist(): void {
    try {
      const dir = join(app.getPath('userData'));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.historyPath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      log.error('Failed to save history:', e);
    }
  }

  addCommand(entry: CommandHistoryEntry): void {
    const commandKey = normalizeCommand(entry.command);
    if (!commandKey) {
      return;
    }

    this.data.commands = [
      { ...entry, command: commandKey },
      ...this.data.commands.filter((command) => normalizeCommand(command.command) !== commandKey)
    ].slice(0, 500);
    this.persist();
  }

  addUrl(entry: RecentUrl): void {
    const urlKey = normalizeUrl(entry.url);
    if (!urlKey || urlKey === 'about:blank') {
      return;
    }

    this.data.urls = [
      { ...entry, url: urlKey },
      ...this.data.urls.filter((url) => normalizeUrl(url.url) !== urlKey)
    ].slice(0, 200);
    this.persist();
  }

  getCommands(): CommandHistoryEntry[] {
    return this.data.commands;
  }

  getUrls(): RecentUrl[] {
    return this.data.urls;
  }
}
