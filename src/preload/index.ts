import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { AgentPreset, AppNotification, AppSettings, AppState, CommandHistoryEntry, RecentUrl, PaneType, ShellType, ListeningPort, InteractivePaneType } from '../renderer/types/index';

export type IpcInvoke = any;

const electronAPI = {
  pane: {
    create: (params: { type: PaneType; presetId?: string; cwd?: string; url?: string }): Promise<string> =>
      ipcRenderer.invoke('pane.create', params),
    close: (params: { paneId: string; workspaceId: string }): Promise<void> =>
      ipcRenderer.invoke('pane.close', params),
    resize: (params: { paneId: string; cols: number; rows: number }): Promise<void> =>
      ipcRenderer.invoke('pane.resize', params)
  },
  pty: {
    spawn: (params: { paneId: string; command?: string; cwd: string; shell: ShellType; presetId?: string; paneType?: InteractivePaneType; cols?: number; rows?: number; }): Promise<void> =>
      ipcRenderer.invoke('pty.spawn', params),
    write: (params: { paneId: string; data: string }): Promise<void> =>
      ipcRenderer.invoke('pty.write', params),
    resize: (params: { paneId: string; cols: number; rows: number }): Promise<void> =>
      ipcRenderer.invoke('pty.resize', params),
    kill: (params: { paneId: string }): Promise<void> =>
      ipcRenderer.invoke('pty.kill', params),
    getOutput: (params: { paneId: string }): Promise<string> =>
      ipcRenderer.invoke('pty.getOutput', params),
    isAlive: (params: { paneId: string }): Promise<boolean> =>
      ipcRenderer.invoke('pty.isAlive', params),
    onData: (callback: (event: IpcRendererEvent, data: { paneId: string; data: string }) => void) => {
      ipcRenderer.on('pty:data', callback);
      return () => ipcRenderer.removeListener('pty:data', callback);
    },
    onExit: (callback: (event: IpcRendererEvent, data: { paneId: string; exitCode: number }) => void) => {
      ipcRenderer.on('pty:exit', callback);
      return () => ipcRenderer.removeListener('pty:exit', callback);
    },
    onCwd: (callback: (event: IpcRendererEvent, data: { paneId: string; cwd: string }) => void) => {
      ipcRenderer.on('pty:cwd', callback);
      return () => ipcRenderer.removeListener('pty:cwd', callback);
    }
  },
  browser: {
    create: (params: { paneId: string; url: string }): Promise<void> =>
      ipcRenderer.invoke('browser.create', params),
    load: (params: { paneId: string; url: string }): Promise<void> =>
      ipcRenderer.invoke('browser.load', params),
    navigate: (params: { paneId: string; action: 'back' | 'forward' | 'reload' | 'stop' }): Promise<void> =>
      ipcRenderer.invoke('browser.navigate', params),
    openExternal: (params: { url: string }): Promise<void> =>
      ipcRenderer.invoke('browser.openExternal', params),
    setBounds: (params: { paneId: string; bounds: { x: number; y: number; width: number; height: number } }): Promise<void> =>
      ipcRenderer.invoke('browser.setBounds', params),
    setFocused: (params: { paneId: string }): Promise<void> =>
      ipcRenderer.invoke('browser.setFocused', params),
    captureScreenshot: (params: { paneId: string; webContentsId: number; projectDirectory?: string }): Promise<{ savedToPath: string | null }> =>
      ipcRenderer.invoke('browser.captureScreenshot', params),
    openDevTools: (params: { paneId: string }): Promise<void> =>
      ipcRenderer.invoke('browser.openDevTools', params),
    onLoaded: (callback: (event: IpcRendererEvent, data: { paneId: string; url: string }) => void) => {
      ipcRenderer.on('browser:loaded', callback);
      return () => ipcRenderer.removeListener('browser:loaded', callback);
    },
    onError: (callback: (event: IpcRendererEvent, data: { paneId: string; error: string }) => void) => {
      ipcRenderer.on('browser:error', callback);
      return () => ipcRenderer.removeListener('browser:error', callback);
    }
  },
  session: {
    save: (params: { state: AppState }): Promise<void> =>
      ipcRenderer.invoke('session.save', params),
    load: (): Promise<AppState | null> =>
      ipcRenderer.invoke('session.load')
  },
  preset: {
    list: (): Promise<AgentPreset[]> =>
      ipcRenderer.invoke('preset.list'),
    create: (preset: AgentPreset): Promise<AgentPreset> =>
      ipcRenderer.invoke('preset.create', preset),
    update: (params: { id: string; patch: Partial<AgentPreset> }): Promise<AgentPreset> =>
      ipcRenderer.invoke('preset.update', params),
    delete: (params: { id: string }): Promise<void> =>
      ipcRenderer.invoke('preset.delete', params)
  },
  settings: {
    get: (): Promise<AppSettings> =>
      ipcRenderer.invoke('settings.get'),
    set: (params: { settings: Partial<AppSettings> }): Promise<void> =>
      ipcRenderer.invoke('settings.set', params)
  },
  history: {
    addCommand: (entry: CommandHistoryEntry): Promise<void> =>
      ipcRenderer.invoke('history.addCommand', entry),
    addUrl: (entry: RecentUrl): Promise<void> =>
      ipcRenderer.invoke('history.addUrl', entry),
    getCommands: (): Promise<CommandHistoryEntry[]> =>
      ipcRenderer.invoke('history.getCommands'),
    getUrls: (): Promise<RecentUrl[]> =>
      ipcRenderer.invoke('history.getUrls')
  },
  app: {
    openInExplorer: (params: { path: string }): Promise<void> =>
      ipcRenderer.invoke('app.openInExplorer', params),
    selectDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('app.selectDirectory'),
    getHomeDirectory: (): Promise<string> =>
      ipcRenderer.invoke('app.getHomeDirectory'),
    notify: (params: AppNotification): Promise<void> =>
      ipcRenderer.invoke('app.notify', params),
    reload: (): Promise<void> =>
      ipcRenderer.invoke('app.reload'),
    forceReload: (): Promise<void> =>
      ipcRenderer.invoke('app.forceReload'),
    setQuickActionsBarVisible: (params: { visible: boolean }): Promise<void> =>
      ipcRenderer.invoke('app.setQuickActionsBarVisible', params),
    writeTempFile: (params: { filename: string; content: string }): Promise<string> =>
      ipcRenderer.invoke('app.writeTempFile', params),
    onMenuAction: (callback: (action: string) => void) => {
      const actions = [
        'app:saveWorkspace', 'app:search', 'app:newTerminal', 'app:newAgent',
        'app:newBrowser', 'app:splitH', 'app:splitV', 'app:newWorkspace',
        'app:openProjectSwitcher', 'app:closePane', 'app:toggleNotes',
        'app:saveWorkspaceOrScreenshot', 'app:takeFocusedPaneScreenshot',
        'app:toggleCommandPalette', 'app:openSettings', 'app:toggleQuickActionsBar',
        'app:nextWorkspace', 'app:previousWorkspace',
        'app:openTerminalFind', 'app:closeTerminalFind',
        'app:toggleNotifications'
      ];
      const cleanupFns = actions.map(action => {
        const handler = () => callback(action);
        ipcRenderer.on(action, handler);
        return () => ipcRenderer.removeListener(action, handler);
      });
      return () => cleanupFns.forEach(fn => fn());
    }
  },
  system: {
    getListeningPorts: (): Promise<ListeningPort[]> =>
      ipcRenderer.invoke('system.getListeningPorts')
  },
  watcher: {
    start: (params: { paneId: string; projectPath: string }): Promise<void> =>
      ipcRenderer.invoke('watcher.start', params),
    stop: (params: { paneId: string }): Promise<void> =>
      ipcRenderer.invoke('watcher.stop', params),
    onFileChanged: (callback: (event: IpcRendererEvent, data: { paneId: string }) => void) => {
      ipcRenderer.on('file-changed', callback);
      return () => ipcRenderer.removeListener('file-changed', callback);
    }
  }
};

contextBridge.exposeInMainWorld('electron', electronAPI);

export type ElectronAPI = typeof electronAPI;
