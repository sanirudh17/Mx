import { app, BrowserWindow, shell, Menu, MenuItemConstructorOptions } from 'electron';
import { join } from 'path';
import log from 'electron-log';
import { setupIpcHandlers } from './ipc-handlers';
import { PresetStore } from './stores/preset-store';
import { WorkspaceStore } from './stores/workspace-store';
import { HistoryStore } from './stores/history-store';
import { PaneManager } from './services/pane-manager';
import {
  COMMAND_PALETTE_SHORTCUT_ACCELERATOR,
  NEW_WORKSPACE_SHORTCUT_ACCELERATOR,
  OPEN_PROJECT_SWITCHER_SHORTCUT_ACCELERATOR,
  SETTINGS_SHORTCUT_ACCELERATOR,
  SETTINGS_SHORTCUT_LABEL,
  TOGGLE_NOTES_SHORTCUT_ACCELERATOR,
  TOGGLE_ACTION_BAR_SHORTCUT_ACCELERATOR,
  TOGGLE_ACTION_BAR_SHORTCUT_LABEL,
  TOGGLE_NOTIFICATIONS_SHORTCUT_ACCELERATOR,
  NEW_TERMINAL_SHORTCUT_LABEL,
  NEW_AGENT_SHORTCUT_LABEL,
  NEW_BROWSER_SHORTCUT_LABEL,
  SPLIT_HORIZONTAL_SHORTCUT_LABEL,
  SPLIT_VERTICAL_SHORTCUT_LABEL,
  SAVE_WORKSPACE_SHORTCUT_LABEL,
  TAKE_SCREENSHOT_SHORTCUT_LABEL,
  CLOSE_PANE_SHORTCUT_LABEL,
  NEXT_WORKSPACE_SHORTCUT_LABEL,
  PREVIOUS_WORKSPACE_SHORTCUT_LABEL,
  TERMINAL_FIND_SHORTCUT_LABEL,
  RELOAD_APP_SHORTCUT_ACCELERATOR,
  FORCE_RELOAD_APP_SHORTCUT_ACCELERATOR,
  TOGGLE_DEVTOOLS_SHORTCUT_ACCELERATOR,
  RESET_ZOOM_SHORTCUT_ACCELERATOR,
  ZOOM_IN_SHORTCUT_ACCELERATOR,
  ZOOM_OUT_SHORTCUT_ACCELERATOR,
  TOGGLE_FULLSCREEN_SHORTCUT_ACCELERATOR,
  CLOSE_WINDOW_SHORTCUT_ACCELERATOR
} from '../common/shortcuts';

log.initialize();
log.info('App starting...');
log.info(`Electron version: ${process.versions.electron}`);
log.info(`Node version: ${process.versions.node}`);

let mainWindow: BrowserWindow | null = null;
export let paneManager: PaneManager;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function sendAppAction(action: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(action);
  }
}

function getToggleActionBarMenuLabel(isVisible: boolean): string {
  return isVisible ? 'Hide Action Bar' : 'Show Action Bar';
}

function createWindow(): void {
  const presetStore = new PresetStore();
  const workspaceStore = new WorkspaceStore();
  const historyStore = new HistoryStore();

  paneManager = new PaneManager();

  const settings = presetStore.getAppSettings();

  mainWindow = new BrowserWindow({
    width: settings.window.width || 1200,
    height: settings.window.height || 800,
    x: settings.window.x,
    y: settings.window.y,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#0d1117',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    },
    autoHideMenuBar: true
  });

  mainWindow.setMenuBarVisibility(false);

  if (settings.window.maximized) {
    mainWindow.maximize();
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
    log.info('Main window shown');
  });

  mainWindow.on('close', () => {
    const latestSettings = presetStore.getAppSettings();

    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      presetStore.saveAppSettings({
        window: {
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
          maximized: mainWindow.isMaximized()
        }
      });
    }

    if (latestSettings.persistSessionOnQuit !== false) {
      log.info('Window close requested, saving state...');
      const state = workspaceStore.getAppState();
      if (state) {
        paneManager.savePaneState(state);
      }
    } else {
      log.info('Window close requested, clearing persisted session state...');
      workspaceStore.clearAppState();
    }

    paneManager.closeAll();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase();

    if (input.control && input.shift && key === 'm') {
      log.info(`Main-process shortcut triggered: ${TOGGLE_ACTION_BAR_SHORTCUT_LABEL}`);
      event.preventDefault();
      sendAppAction('app:toggleQuickActionsBar');
      return;
    }

    if (input.control && input.shift && key === 'x') {
      event.preventDefault();
      sendAppAction('app:toggleNotifications');
      return;
    }

    if (input.control && !input.alt && key === ',') {
      log.info(`Main-process shortcut triggered: ${SETTINGS_SHORTCUT_LABEL}`);
      event.preventDefault();
      sendAppAction('app:openSettings');
    }
  });

  setupIpcHandlers(mainWindow, paneManager, presetStore, workspaceStore, historyStore);

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }


  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New Workspace', accelerator: NEW_WORKSPACE_SHORTCUT_ACCELERATOR, click: () => { sendAppAction('app:newWorkspace'); } },
        { label: 'Open Project Switcher', accelerator: OPEN_PROJECT_SWITCHER_SHORTCUT_ACCELERATOR, click: () => { sendAppAction('app:openProjectSwitcher'); } },
        { type: 'separator' },
        { label: 'Take Screenshot', accelerator: TAKE_SCREENSHOT_SHORTCUT_LABEL.replace('Ctrl', 'CmdOrCtrl'), click: () => { sendAppAction('app:takeFocusedPaneScreenshot'); } },
        { label: 'Save Layout as Template', accelerator: SAVE_WORKSPACE_SHORTCUT_LABEL.replace('Ctrl', 'CmdOrCtrl'), click: () => { sendAppAction('app:saveWorkspace'); } },
        { label: 'Close This Pane', accelerator: CLOSE_PANE_SHORTCUT_LABEL.replace('Ctrl', 'CmdOrCtrl'), click: () => { sendAppAction('app:closePane'); } },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Command Palette', accelerator: COMMAND_PALETTE_SHORTCUT_ACCELERATOR, click: () => { sendAppAction('app:toggleCommandPalette'); } },
        { label: 'Toggle Notes Panel', accelerator: TOGGLE_NOTES_SHORTCUT_ACCELERATOR, click: () => { sendAppAction('app:toggleNotes'); } },
        {
          id: 'view.toggleQuickActionsBar',
          label: getToggleActionBarMenuLabel(settings.quickActionsBar !== false),
          accelerator: TOGGLE_ACTION_BAR_SHORTCUT_ACCELERATOR,
          click: () => { sendAppAction('app:toggleQuickActionsBar'); }
        },
        { label: 'Notifications', accelerator: TOGGLE_NOTIFICATIONS_SHORTCUT_ACCELERATOR, click: () => { sendAppAction('app:toggleNotifications'); } },
        { label: 'Settings', accelerator: SETTINGS_SHORTCUT_ACCELERATOR, click: () => { sendAppAction('app:openSettings'); } },
        { type: 'separator' },
        { role: 'reload', accelerator: RELOAD_APP_SHORTCUT_ACCELERATOR },
        { role: 'forceReload', accelerator: FORCE_RELOAD_APP_SHORTCUT_ACCELERATOR },
        { role: 'toggleDevTools', accelerator: TOGGLE_DEVTOOLS_SHORTCUT_ACCELERATOR },
        { type: 'separator' },
        { role: 'resetZoom', accelerator: RESET_ZOOM_SHORTCUT_ACCELERATOR },
        { role: 'zoomIn', accelerator: ZOOM_IN_SHORTCUT_ACCELERATOR },
        { role: 'zoomOut', accelerator: ZOOM_OUT_SHORTCUT_ACCELERATOR },
        { type: 'separator' },
        { role: 'togglefullscreen', accelerator: TOGGLE_FULLSCREEN_SHORTCUT_ACCELERATOR }
      ]
    },
    {
      label: 'Terminal Tools',
      submenu: [
        { label: 'New Terminal', accelerator: NEW_TERMINAL_SHORTCUT_LABEL.replace('Ctrl', 'CmdOrCtrl'), click: () => { sendAppAction('app:newTerminal'); } },
        { label: 'New Agent', accelerator: NEW_AGENT_SHORTCUT_LABEL.replace('Ctrl', 'CmdOrCtrl'), click: () => { sendAppAction('app:newAgent'); } },
        { label: 'New Browser', accelerator: NEW_BROWSER_SHORTCUT_LABEL.replace('Ctrl', 'CmdOrCtrl'), click: () => { sendAppAction('app:newBrowser'); } },
        { type: 'separator' },
        { label: 'Split Horizontal', accelerator: SPLIT_HORIZONTAL_SHORTCUT_LABEL.replace('Ctrl', 'CmdOrCtrl'), click: () => { sendAppAction('app:splitH'); } },
        { label: 'Split Vertical', accelerator: SPLIT_VERTICAL_SHORTCUT_LABEL.replace('Ctrl', 'CmdOrCtrl'), click: () => { sendAppAction('app:splitV'); } },
        { type: 'separator' },
        { label: 'Find in Terminal', accelerator: TERMINAL_FIND_SHORTCUT_LABEL.replace('Ctrl', 'CmdOrCtrl'), click: () => { sendAppAction('app:openTerminalFind'); } }
      ]
    },
    {
      label: 'Navigate',
      submenu: [
        { label: 'Next Workspace', accelerator: NEXT_WORKSPACE_SHORTCUT_LABEL.replace('Ctrl', 'CmdOrCtrl').replace('PgDn', 'PageDown'), click: () => { sendAppAction('app:nextWorkspace'); } },
        { label: 'Previous Workspace', accelerator: PREVIOUS_WORKSPACE_SHORTCUT_LABEL.replace('Ctrl', 'CmdOrCtrl').replace('PgUp', 'PageUp'), click: () => { sendAppAction('app:previousWorkspace'); } }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { label: 'Close Window', accelerator: CLOSE_WINDOW_SHORTCUT_ACCELERATOR, click: () => { mainWindow?.close() } }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  log.info('Window created and loading content...');
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.mx.app');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  log.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
});
