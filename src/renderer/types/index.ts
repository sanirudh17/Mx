export type PaneType = 'terminal' | 'agent' | 'browser' | 'empty';
export type InteractivePaneType = 'terminal' | 'agent';
export type PaneStatus = 'running' | 'idle' | 'exited' | 'error';
export type ShellType = 'powershell' | 'cmd' | 'wsl';
export type LayoutDirection = 'horizontal' | 'vertical';
export type PaneAttention = 'none' | 'success' | 'error' | 'activity';

export interface AgentPreset {
  id: string;
  name: string;
  type?: 'agent' | 'browser';
  command?: string;
  targetUrl?: string;
  shell?: ShellType;
  cwdMode?: 'workspace' | 'home' | 'custom';
  cwdCustom?: string;
  colorTag?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PresetStore {
  version: number;
  presets: AgentPreset[];
  lastUsedOrder: string[];
}

export interface BasePane {
  id: string;
  type: PaneType;
  label: string;
  colorTag?: string;
  status: PaneStatus;
  cwd?: string;
  attention?: PaneAttention;
}

export interface TerminalPane extends BasePane {
  type: 'terminal';
  command: string;
  shell: ShellType;
  startedAt: string;
}

export interface AgentPane extends BasePane {
  type: 'agent';
  presetId: string;
  command: string;
  shell: ShellType;
  startedAt: string;
  sessionId?: string;
}

export interface BrowserPane extends BasePane {
  type: 'browser';
  url: string;
  history: string[];
  historyIndex: number;
}

export interface EmptyPane extends BasePane {
  type: 'empty';
}

export type Pane = TerminalPane | AgentPane | BrowserPane | EmptyPane;

export interface LayoutNode {
  id: string;
  direction: LayoutDirection;
  children: (LayoutNode | string)[];
  sizes: number[];
  parentId?: string;
}

export type LayoutTemplate = {
  id: string;
  name: string;
  layout: LayoutNode;
  panes: Pane[];
  createdAt: string;
};

export interface Workspace {
  id: string;
  name: string;
  cwd: string;
  layout: LayoutNode;
  panes: Pane[];
  lastFocusedPaneId?: string;
  zoomedPaneId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommandHistoryEntry {
  id: string;
  command: string;
  paneId: string;
  workspaceId: string;
  timestamp: string;
}

export interface RecentUrl {
  id: string;
  url: string;
  title?: string;
  timestamp: string;
}

export interface AppNotification {
  title: string;
  body: string;
  kind?: 'info' | 'success' | 'error';
  silent?: boolean;
}

export interface NotificationHistoryItem {
  id: string;
  title: string;
  body: string;
  kind: 'info' | 'success' | 'error';
  timestamp: string;
  workspaceId?: string;
  workspaceName?: string;
  paneId?: string;
  paneLabel?: string;
}

export interface NotificationAction {
  id: string;
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  payload?: Record<string, unknown>;
}

export interface GlobalNotification {
  id: string;
  agentIcon?: string;
  agentName?: string;
  contextTag?: string;
  title: string;
  body: string;
  kind: 'info' | 'success' | 'error' | 'action';
  timestamp: string;
  sourcePaneId?: string;
  sourceWorkspaceId?: string;
  actions?: NotificationAction[];
  dismissed?: boolean;
  autoExpireMs?: number;
}

export interface ListeningPort {
  port: number;
  pid: number;
}

export interface PaneTab {
  id: string;
  label: string;
  paneId: string;
}

export interface AppSettings {
  version: number;
  window: {
    width: number;
    height: number;
    x: number;
    y: number;
    maximized: boolean;
  };
  theme: 'dark' | 'light' | 'system';
  shell: ShellType;
  quickActionsBar: boolean;
  showStatusDots: boolean;
  persistSessionOnQuit: boolean;
  paneHeaderHeight: number;
  terminalFontSize: number;
  terminalFontFamily: string;
  colorTags: string[];
  keyboardShortcuts: Record<string, string>;
  recentProjects: string[];
  layoutTemplates: LayoutTemplate[];
  saveScreenshotsToDisk: boolean;
  startupBehavior: 'empty' | 'restore' | 'specific';
  startupWorkspaceId?: string;
  verticalTabs: boolean;
  sidebarCollapsed?: boolean;
}

export interface AppState {
  version: number;
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
  recentCommands: CommandHistoryEntry[];
  recentUrls: RecentUrl[];
}

export interface IpcChannels {
  'pane.create': (params: { type: PaneType; presetId?: string; cwd?: string; url?: string }) => Promise<string>;
  'pane.close': (params: { paneId: string; workspaceId: string }) => Promise<void>;
  'pane.resize': (params: { paneId: string; cols: number; rows: number }) => Promise<void>;
  'pty.spawn': (params: { paneId: string; command?: string; cwd: string; shell: ShellType; presetId?: string; paneType?: InteractivePaneType; cols?: number; rows?: number; }) => Promise<void>;
  'pty.write': (params: { paneId: string; data: string }) => Promise<void>;
  'pty.resize': (params: { paneId: string; cols: number; rows: number }) => Promise<void>;
  'pty.kill': (params: { paneId: string }) => Promise<void>;
  'pty.getOutput': (params: { paneId: string }) => Promise<string>;
  'pty.isAlive': (params: { paneId: string }) => Promise<boolean>;
  'browser.load': (params: { paneId: string; url: string }) => Promise<void>;
  'browser.navigate': (params: { paneId: string; action: 'back' | 'forward' | 'reload' | 'stop' }) => Promise<void>;
  'browser.openExternal': (params: { url: string }) => Promise<void>;
  'browser.setBounds': (params: { paneId: string; bounds: { x: number; y: number; width: number; height: number } }) => Promise<void>;
  'browser.setFocused': (params: { paneId: string }) => Promise<void>;
  'browser.captureScreenshot': (params: { paneId: string; webContentsId: number; projectDirectory?: string }) => Promise<{ savedToPath: string | null }>;
  'session.save': (params: { state: AppState }) => Promise<void>;
  'session.load': () => Promise<AppState | null>;
  'preset.list': () => Promise<AgentPreset[]>;
  'preset.create': (params: AgentPreset) => Promise<AgentPreset>;
  'preset.update': (params: { id: string; patch: Partial<AgentPreset> }) => Promise<AgentPreset>;
  'preset.delete': (params: { id: string }) => Promise<void>;
  'settings.get': () => Promise<AppSettings>;
  'settings.set': (params: { settings: Partial<AppSettings> }) => Promise<void>;
  'history.addCommand': (params: CommandHistoryEntry) => Promise<void>;
  'history.addUrl': (params: RecentUrl) => Promise<void>;
  'history.getCommands': () => Promise<CommandHistoryEntry[]>;
  'history.getUrls': () => Promise<RecentUrl[]>;
  'app.openInExplorer': (params: { path: string }) => Promise<void>;
  'app.selectDirectory': () => Promise<string | null>;
  'app.getHomeDirectory': () => Promise<string>;
  'app.notify': (params: AppNotification) => Promise<void>;
  'app.reload': () => Promise<void>;
  'app.forceReload': () => Promise<void>;
  'app.setQuickActionsBarVisible': (params: { visible: boolean }) => Promise<void>;
  'pane.getBounds': (params: { paneId: string }) => Promise<{ x: number; y: number; width: number; height: number } | null>;
  'browser.openDevTools': (params: { paneId: string }) => Promise<void>;
  'system.getListeningPorts': () => Promise<ListeningPort[]>;
}
