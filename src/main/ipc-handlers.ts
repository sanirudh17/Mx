import { app, ipcMain, dialog, BrowserWindow, Notification, clipboard, webContents, Menu } from 'electron';
import { access, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { PaneManager } from './services/pane-manager';
import type { PresetStore } from './stores/preset-store';
import type { WorkspaceStore } from './stores/workspace-store';
import type { HistoryStore } from './stores/history-store';
import type { AppState, ListeningPort } from '../renderer/types/index';
import log from 'electron-log';
import { v4 as uuidv4 } from 'uuid';

const execFileAsync = promisify(execFile);

const SCREENSHOT_DIRECTORY_NAME = '.mx-screenshots';

function formatScreenshotTimestamp(date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + '-' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('-');
}

async function getUniqueScreenshotPath(baseDirectory: string): Promise<string> {
  const screenshotDirectory = join(baseDirectory, SCREENSHOT_DIRECTORY_NAME);
  await mkdir(screenshotDirectory, { recursive: true });

  const timestamp = formatScreenshotTimestamp();
  let suffix = 0;

  while (true) {
    const suffixLabel = suffix === 0 ? '' : `-${suffix + 1}`;
    const filePath = join(screenshotDirectory, `screenshot-${timestamp}${suffixLabel}.png`);

    try {
      await access(filePath);
      suffix += 1;
    } catch {
      return filePath;
    }
  }
}

export function setupIpcHandlers(
  mainWindow: BrowserWindow,
  paneManager: PaneManager,
  presetStore: PresetStore,
  workspaceStore: WorkspaceStore,
  historyStore: HistoryStore
): void {
  paneManager.setMainWindow(mainWindow);

  // Pane lifecycle
  ipcMain.handle('pane.create', async (_, params) => {
    const paneId = uuidv4();
    log.info(`Creating pane: ${params.type} -> ${paneId}`);
    return paneId;
  });

  ipcMain.handle('pane.close', async (_, params) => {
    log.info(`Closing pane: ${params.paneId}`);
    paneManager.killPty(params.paneId);
  });

  ipcMain.handle('pane.resize', async (_, params) => {
    if (params.cols && params.rows) {
      paneManager.resizePty(params.paneId, params.cols, params.rows);
    }
  });

  // PTY operations
  ipcMain.handle('pty.spawn', async (_, params) => {
    paneManager.spawnPty(
      params.paneId,
      params.command,
      params.cwd,
      params.shell,
      params.cols || 80,
      params.rows || 24,
      params.presetId,
      params.paneType || 'terminal'
    );
  });

  ipcMain.handle('pty.write', async (_, params) => {
    paneManager.writePty(params.paneId, params.data);
  });

  ipcMain.handle('pty.resize', async (_, params) => {
    paneManager.resizePty(params.paneId, params.cols, params.rows);
  });

  ipcMain.handle('pty.kill', async (_, params) => {
    paneManager.killPty(params.paneId);
  });

  ipcMain.handle('pty.getOutput', async (_, params) => {
    return paneManager.getPaneOutput(params.paneId);
  });

  ipcMain.handle('pty.isAlive', async (_, params) => {
    return paneManager.hasPty(params.paneId);
  });

  // Browser pane operations (handled via webview in the renderer)
  ipcMain.handle('browser.create', async () => {
    // No-op: browser panes are now <webview> in DOM
  });

  ipcMain.handle('browser.load', async () => {
    // No-op: handled by renderer webview
  });

  ipcMain.handle('browser.navigate', async () => {
    // No-op: handled by renderer webview
  });

  ipcMain.handle('browser.openExternal', async (_, params) => {
    paneManager.openExternal(params.url);
  });

  ipcMain.handle('browser.setBounds', async () => {
    // No-op: webview handled in DOM layout
  });

  ipcMain.handle('browser.setFocused', async () => {
    // No-op
  });

  ipcMain.handle('browser.captureScreenshot', async (_, params) => {
    const contents = webContents.fromId(params.webContentsId);

    if (!contents || contents.isDestroyed()) {
      throw new Error(`Browser contents unavailable for pane ${params.paneId}`);
    }

    const image = await contents.capturePage();
    clipboard.writeImage(image);

    const settings = presetStore.getAppSettings();
    let savedToPath: string | null = null;

    if (settings.saveScreenshotsToDisk) {
      const baseDirectory = params.projectDirectory?.trim() || app.getPath('home');
      const filePath = await getUniqueScreenshotPath(baseDirectory);
      await writeFile(filePath, image.toPNG());
      savedToPath = filePath;
    }

    log.info('Captured pane screenshot', {
      paneId: params.paneId,
      savedToPath
    });

    return { savedToPath };
  });

  ipcMain.handle('browser.openDevTools', async () => {
    // No-op: handled in renderer via webview methods
  });

  // Session
  ipcMain.handle('session.save', async (_, params) => {
    workspaceStore.saveAppState(params.state);
    log.info('Session saved');
  });

  ipcMain.handle('session.load', async () => {
    const state = workspaceStore.getAppState();
    return state.workspaces.length > 0 ? state : null;
  });

  // Presets
  ipcMain.handle('preset.list', async () => {
    return presetStore.getPresets();
  });

  ipcMain.handle('preset.create', async (_, preset) => {
    const newPreset = presetStore.createPreset(preset);
    log.info(`Preset created: ${newPreset.name}`);
    return newPreset;
  });

  ipcMain.handle('preset.update', async (_, params) => {
    const updated = presetStore.updatePreset(params.id, params.patch);
    log.info(`Preset updated: ${updated.name}`);
    return updated;
  });

  ipcMain.handle('preset.delete', async (_, params) => {
    presetStore.deletePreset(params.id);
    log.info(`Preset deleted: ${params.id}`);
  });

  // Settings
  ipcMain.handle('settings.get', async () => {
    return presetStore.getAppSettings();
  });

  ipcMain.handle('settings.set', async (_, params) => {
    presetStore.saveAppSettings(params.settings);
  });

  // History
  ipcMain.handle('history.addCommand', async (_, entry) => {
    historyStore.addCommand(entry);
  });

  ipcMain.handle('history.addUrl', async (_, entry) => {
    historyStore.addUrl(entry);
  });

  ipcMain.handle('history.getCommands', async () => {
    return historyStore.getCommands();
  });

  ipcMain.handle('history.getUrls', async () => {
    return historyStore.getUrls();
  });

  // App utilities
  ipcMain.handle('app.openInExplorer', async (_, params) => {
    paneManager.openInExplorer(params.path);
  });

  ipcMain.handle('app.selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('app.getHomeDirectory', async () => {
    return app.getPath('home');
  });

  ipcMain.handle('app.notify', async (_, params) => {
    if (!Notification.isSupported()) {
      log.warn('Native notifications are not supported on this system');
      return;
    }

    const notification = new Notification({
      title: params.title,
      body: params.body,
      silent: Boolean(params.silent)
    });

    notification.show();
  });

  ipcMain.handle('app.reload', async () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }
  });

  ipcMain.handle('app.forceReload', async () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  ipcMain.handle('app.setQuickActionsBarVisible', async (_, params) => {
    const menu = Menu.getApplicationMenu();
    const toggleItem = menu?.getMenuItemById('view.toggleQuickActionsBar');

    if (toggleItem && typeof params.visible === 'boolean') {
      toggleItem.label = params.visible ? 'Hide Action Bar' : 'Show Action Bar';
    }
  });

  // Listening ports
  ipcMain.handle('system.getListeningPorts', async (): Promise<ListeningPort[]> => {
    try {
      const result = await execFileAsync('netstat', ['-ano', '-p', 'TCP'], {
        windowsHide: true,
        timeout: 8000
      });

      const lines = result.stdout.split('\n');
      const ports: ListeningPort[] = [];
      const seen = new Set<number>();

      for (const line of lines) {
        if (!line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) continue;

        const localAddr = parts[1];
        const pid = parseInt(parts[4], 10);
        const colonIdx = localAddr.lastIndexOf(':');
        if (colonIdx === -1) continue;

        const port = parseInt(localAddr.slice(colonIdx + 1), 10);
        if (isNaN(port) || isNaN(pid) || port === 0) continue;
        if (seen.has(port)) continue;

        // Focus on common dev ports
        if (port >= 1024 && port <= 65535) {
          seen.add(port);
          ports.push({ port, pid });
        }
      }

      // Sort by port and limit
      return ports.sort((a, b) => a.port - b.port).slice(0, 50);
    } catch {
      return [];
    }
  });

  // File watcher for browser auto-refresh
  ipcMain.handle('watcher.start', async (_, params) => {
    paneManager.startFileWatcher(params.paneId, params.projectPath);
  });

  ipcMain.handle('watcher.stop', async (_, params) => {
    paneManager.stopFileWatcher(params.paneId);
  });

  log.info('IPC handlers registered');
}
