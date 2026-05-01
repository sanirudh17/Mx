import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import type { AgentPreset, PresetStore as PresetStoreData, AppSettings, ShellType } from '../../renderer/types/index';
import log from 'electron-log';
import {
  ACTUAL_KEYBOARD_SHORTCUTS
} from '../../common/shortcuts';

const DEFAULT_COLOR_TAGS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#6b7280'
];

const DEFAULT_SHORTCUTS: Record<string, string> = ACTUAL_KEYBOARD_SHORTCUTS;

const EXAMPLE_PRESETS: AgentPreset[] = [
  {
    id: 'preset-opencore',
    name: 'OpenCode',
    command: 'opencode',
    shell: 'powershell',
    cwdMode: 'workspace',
    icon: '🤖',
    colorTag: '#10b981',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'preset-droid',
    name: 'Droid',
    command: 'droid',
    shell: 'powershell',
    cwdMode: 'workspace',
    icon: '🦾',
    colorTag: '#8b5cf6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'preset-git',
    name: 'Git',
    command: 'git',
    shell: 'powershell',
    cwdMode: 'workspace',
    icon: '🌿',
    colorTag: '#f97316',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'preset-npm-dev',
    name: 'npm dev',
    command: 'npm run dev',
    shell: 'powershell',
    cwdMode: 'workspace',
    icon: '📦',
    colorTag: '#ef4444',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'preset-python',
    name: 'Python REPL',
    command: 'python',
    shell: 'powershell',
    cwdMode: 'workspace',
    icon: '🐍',
    colorTag: '#3b82f6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export class PresetStore {
  private presetsPath: string;
  private presetsData: PresetStoreData;
  private settingsPath: string;
  private settings: AppSettings;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.presetsPath = join(userDataPath, 'presets.json');
    this.settingsPath = join(userDataPath, 'settings.json');

    this.presetsData = this.loadPresets();
    this.settings = this.loadSettings();

    log.info('PresetStore initialized', { presetsPath: this.presetsPath });
  }

  private getDefaultSettings(): AppSettings {
    return {
      version: 1,
      window: { width: 1200, height: 800, x: 100, y: 100, maximized: false },
      theme: 'dark',
      shell: 'powershell' as ShellType,
      quickActionsBar: true,
      showStatusDots: true,
      persistSessionOnQuit: true,
      paneHeaderHeight: 32,
      terminalFontSize: 14,
      terminalFontFamily: 'Cascadia Code, Consolas, monospace',
      colorTags: DEFAULT_COLOR_TAGS,
      keyboardShortcuts: DEFAULT_SHORTCUTS,
      recentProjects: [],
      layoutTemplates: [],
      saveScreenshotsToDisk: false,
      startupBehavior: 'restore',
      verticalTabs: false,
      sidebarCollapsed: false
    };
  }

  private loadSettings(): AppSettings {
    const defaults = this.getDefaultSettings();
    try {
      if (existsSync(this.settingsPath)) {
        const data = JSON.parse(readFileSync(this.settingsPath, 'utf-8'));
        const keyboardShortcuts = { ...ACTUAL_KEYBOARD_SHORTCUTS };

        return {
          ...defaults,
          ...data,
          keyboardShortcuts
        };
      }
    } catch (e) {
      log.error('Failed to load settings:', e);
    }
    return defaults;
  }

  private loadPresets(): PresetStoreData {
    const defaults: PresetStoreData = { version: 1, presets: EXAMPLE_PRESETS, lastUsedOrder: [] };
    try {
      if (existsSync(this.presetsPath)) {
        const data = JSON.parse(readFileSync(this.presetsPath, 'utf-8'));
        return { ...defaults, ...data, presets: data.presets || EXAMPLE_PRESETS };
      } else {
        this.savePresets(defaults);
      }
    } catch (e) {
      log.error('Failed to load presets:', e);
    }
    return defaults;
  }

  private savePresets(data: PresetStoreData): void {
    try {
      const dir = join(app.getPath('userData'));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.presetsPath, JSON.stringify(data, null, 2));
    } catch (e) {
      log.error('Failed to save presets:', e);
    }
  }

  getPresets(): AgentPreset[] {
    return this.presetsData.presets;
  }

  getPreset(id: string): AgentPreset | undefined {
    return this.presetsData.presets.find(p => p.id === id);
  }

  createPreset(preset: AgentPreset): AgentPreset {
    this.presetsData.presets.push(preset);
    this.presetsData.lastUsedOrder.unshift(preset.id);
    this.savePresets(this.presetsData);
    return preset;
  }

  updatePreset(id: string, patch: Partial<AgentPreset>): AgentPreset {
    const idx = this.presetsData.presets.findIndex(p => p.id === id);
    if (idx === -1) throw new Error(`Preset not found: ${id}`);
    this.presetsData.presets[idx] = {
      ...this.presetsData.presets[idx],
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.savePresets(this.presetsData);
    return this.presetsData.presets[idx];
  }

  deletePreset(id: string): void {
    this.presetsData.presets = this.presetsData.presets.filter(p => p.id !== id);
    this.presetsData.lastUsedOrder = this.presetsData.lastUsedOrder.filter(i => i !== id);
    this.savePresets(this.presetsData);
  }

  markPresetUsed(id: string): void {
    this.presetsData.lastUsedOrder = [id, ...this.presetsData.lastUsedOrder.filter(i => i !== id)].slice(0, 20);
    this.savePresets(this.presetsData);
  }

  getAppSettings(): AppSettings {
    return { ...this.settings };
  }

  saveAppSettings(patch: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...patch };
    try {
      const dir = join(app.getPath('userData'));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
    } catch (e) {
      log.error('Failed to save settings:', e);
    }
  }
}
