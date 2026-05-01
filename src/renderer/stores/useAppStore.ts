import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  Workspace, Pane, TerminalPane, AgentPane, BrowserPane, EmptyPane,
  LayoutNode, AppSettings, AppState, AgentPreset,
  CommandHistoryEntry, RecentUrl, ShellType, PaneType, PaneStatus,
  GlobalNotification
} from '../types';
import {
  ACTUAL_KEYBOARD_SHORTCUTS,
  SETTINGS_SHORTCUT_LABEL,
  TOGGLE_ACTION_BAR_SHORTCUT_LABEL
} from '../../common/shortcuts';

declare global {
  interface Window {
    electron: import('../../preload/index').ElectronAPI;
  }
}

interface AppStore {
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
  settings: AppSettings | null;
  presets: AgentPreset[];
  recentCommands: CommandHistoryEntry[];
  recentUrls: RecentUrl[];
  focusedPaneId: string | null;
  homeDirectory: string;
  notifications: GlobalNotification[];
  notificationHistory: GlobalNotification[];
  isLoading: boolean;

  initialize: () => Promise<void>;
  saveSession: () => Promise<void>;

  createWorkspace: (name: string, cwd?: string | null, layoutType?: string, templateId?: string) => Promise<void>;
  deleteWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  updateWorkspace: (workspace: Workspace) => void;
  addRecentProject: (path: string) => void;
  incrementFontSize: () => void;
  decrementFontSize: () => void;

  createPane: (workspaceId: string, type: PaneType, params?: { presetId?: string; url?: string; command?: string; shell?: ShellType }) => Promise<Pane | null>;
  closePane: (workspaceId: string, paneId: string) => void;
  updatePane: (workspaceId: string, paneId: string, patch: Partial<Pane>) => void;
  setFocusedPane: (paneId: string | null) => void;
  togglePaneZoom: (workspaceId?: string, paneId?: string | null) => void;
  focusNextWorkspace: () => void;
  focusPreviousWorkspace: () => void;
  focusNextPane: () => void;
  focusPreviousPane: () => void;
  syncPaneCwd: (paneId: string, cwd: string) => void;
  updatePaneStatus: (workspaceId: string, paneId: string, status: PaneStatus) => void;
  restartPane: (workspaceId: string, paneId: string) => Promise<void>;

  updateLayout: (workspaceId: string, layout: LayoutNode) => void;
  updatePaneSize: (workspaceId: string, nodeId: string, sizes: number[]) => void;

  splitPane: (workspaceId: string, paneId: string, direction: 'horizontal' | 'vertical') => void;

  convertPane: (workspaceId: string, paneId: string, type: PaneType, params?: { presetId?: string; url?: string; command?: string; shell?: ShellType }) => Promise<Pane | null>;

  loadPresets: () => Promise<void>;
  createPreset: (preset: Omit<AgentPreset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updatePreset: (id: string, patch: Partial<AgentPreset>) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;

  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  recordCommandHistory: (params: { command: string; paneId: string; workspaceId: string }) => Promise<void>;
  recordUrlHistory: (params: { url: string; title?: string }) => Promise<void>;

  pushNotification: (notification: Omit<GlobalNotification, 'id' | 'timestamp'>) => void;
  dismissNotification: (id: string) => void;
  dismissNotificationsByPane: (paneId: string) => void;
  dismissActionNotificationsByPane: (paneId: string) => void;
  dismissNotificationsByWorkspace: (workspaceId: string) => void;
  executeNotificationAction: (notificationId: string, actionId: string) => void;
  clearNotificationHistory: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  window: { width: 1200, height: 800, x: 100, y: 100, maximized: false },
  theme: 'dark',
  shell: 'powershell',
  quickActionsBar: true,
  showStatusDots: true,
  persistSessionOnQuit: true,
  paneHeaderHeight: 32,
  terminalFontSize: 14,
  terminalFontFamily: 'Geist Mono, Consolas, ui-monospace, monospace',
  colorTags: ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#6b7280'],
  keyboardShortcuts: {
    ...ACTUAL_KEYBOARD_SHORTCUTS,
    settings: SETTINGS_SHORTCUT_LABEL,
    'toggle-action-bar': TOGGLE_ACTION_BAR_SHORTCUT_LABEL
  },
  recentProjects: [],
  layoutTemplates: [],
  saveScreenshotsToDisk: false,
  startupBehavior: 'restore',
  verticalTabs: false,
  sidebarCollapsed: false
};

function getInteractivePaneStatus(command?: string): PaneStatus {
  return command && command.trim() ? 'running' : 'idle';
}

function normalizeSizes(sizes: number[], count: number): number[] {
  if (count <= 0) return [];

  const nextSizes = sizes.slice(0, count);
  const sum = nextSizes.reduce((total, size) => total + size, 0);

  if (sum > 0) {
    return nextSizes.map((size) => (size / sum) * 100);
  }

  const equalShare = 100 / count;
  return Array.from({ length: count }, () => equalShare);
}

function resolveWorkspaceCwd(cwd: string | undefined | null, homeDirectory?: string | null): string {
  const nextCwd = cwd?.trim();
  const nextHomeDirectory = homeDirectory?.trim();
  return nextCwd || nextHomeDirectory || 'C:\\';
}

function normalizeLayoutTree(node: LayoutNode): LayoutNode {
  const children = node.children.map((child) =>
    typeof child === 'string' ? child : normalizeLayoutTree(child)
  );

  return {
    ...node,
    children,
    sizes: normalizeSizes(node.sizes, children.length)
  };
}

function normalizePaneForWorkspace<T extends Pane>(pane: T, workspaceCwd: string): T {
  return {
    ...pane,
    cwd: resolveWorkspaceCwd(pane.cwd, workspaceCwd)
  };
}

function normalizeUrlForHistory(url: string): string {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    const pathname = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname.replace(/\/+$/, '');
    const search = parsedUrl.search;
    const hash = parsedUrl.hash;
    return `${parsedUrl.protocol}//${parsedUrl.host.toLowerCase()}${pathname}${search}${hash}`;
  } catch {
    return trimmedUrl.toLowerCase();
  }
}

function getFirstPaneIdFromTree(node: LayoutNode | string | null): string | null {
  if (!node) return null;
  if (typeof node === 'string') return node;

  for (const child of node.children) {
    const paneId = getFirstPaneIdFromTree(child);
    if (paneId) return paneId;
  }

  return null;
}

function getWorkspaceDefaultFocusedPaneId(workspace?: Workspace | null): string | null {
  if (!workspace) return null;
  if (
    workspace.lastFocusedPaneId &&
    workspace.panes.some((pane) => pane.id === workspace.lastFocusedPaneId)
  ) {
    return workspace.lastFocusedPaneId;
  }
  return getFirstPaneIdFromTree(workspace.layout) ?? workspace.panes[0]?.id ?? null;
}

function getPaneIdsInLayoutOrder(node: LayoutNode | string | null): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];

  return node.children.flatMap((child) => getPaneIdsInLayoutOrder(child));
}

function buildLayoutForPaneIds(paneIds: string[]): LayoutNode {
  return {
    id: uuidv4(),
    direction: 'horizontal',
    children: paneIds,
    sizes: normalizeSizes([], paneIds.length)
  };
}

function sanitizeLayoutNode(
  node: LayoutNode | string,
  paneIds: Set<string>
): LayoutNode | string | null {
  if (typeof node === 'string') {
    return paneIds.has(node) ? node : null;
  }

  const nextChildren: (LayoutNode | string)[] = [];
  const nextSizes: number[] = [];

  node.children.forEach((child, index) => {
    const nextChild = sanitizeLayoutNode(child, paneIds);

    if (nextChild !== null) {
      nextChildren.push(nextChild);
      nextSizes.push(node.sizes[index] ?? 0);
    }
  });

  if (nextChildren.length === 0) {
    return null;
  }

  if (nextChildren.length === 1) {
    return nextChildren[0];
  }

  return {
    ...node,
    children: nextChildren,
    sizes: normalizeSizes(nextSizes, nextChildren.length)
  };
}

function normalizeWorkspaceForRestore(workspace: Workspace, homeDirectory: string): Workspace {
  const workspaceCwd = resolveWorkspaceCwd(workspace.cwd, homeDirectory);
  const panes = workspace.panes.map((pane): Pane => {
    const normalizedPane = normalizePaneForWorkspace(pane, workspaceCwd);

    if (pane.type === 'terminal' || pane.type === 'agent') {
      const interactivePane = normalizedPane as TerminalPane | AgentPane;
      const isAgent = pane.type === 'agent';
      const hasPresetId = typeof (interactivePane as AgentPane).presetId === 'string';

      if (isAgent && !hasPresetId) {
        console.warn('Agent pane missing presetId during restore, forcing type to terminal:', { paneId: pane.id, label: pane.label });
        return {
          ...normalizedPane,
          type: 'terminal',
          status: getInteractivePaneStatus(interactivePane.command)
        } as Pane;
      }

      return {
        ...normalizedPane,
        status: getInteractivePaneStatus(interactivePane.command)
      } as Pane;
    }

    if (pane.type === 'browser') {
      const normalizedBrowserPane = normalizedPane as BrowserPane;
      const currentUrl = normalizedBrowserPane.url || 'about:blank';
      const history = Array.isArray(normalizedBrowserPane.history) && normalizedBrowserPane.history.length > 0
        ? normalizedBrowserPane.history
        : [currentUrl];
      const historyIndex = Number.isInteger(normalizedBrowserPane.historyIndex)
        ? Math.min(Math.max(normalizedBrowserPane.historyIndex, 0), history.length - 1)
        : history.length - 1;

      return {
        ...normalizedBrowserPane,
        url: history[historyIndex] || currentUrl,
        history,
        historyIndex,
        status: 'running' as PaneStatus
      };
    }

    return { ...normalizedPane, status: 'idle' as PaneStatus };
  });

  const paneIds = new Set(panes.map((pane) => pane.id));
  const normalizedLayoutTree = normalizeLayoutTree(workspace.layout);
  const sanitizedLayoutTree = sanitizeLayoutNode(normalizedLayoutTree, paneIds);
  const layout =
    sanitizedLayoutTree === null
      ? buildLayoutForPaneIds(panes.map((pane) => pane.id))
      : typeof sanitizedLayoutTree === 'string'
        ? {
          id: normalizedLayoutTree.id || uuidv4(),
          direction: 'horizontal' as const,
          children: [sanitizedLayoutTree],
          sizes: [100]
        }
        : sanitizedLayoutTree;
  const fallbackFocusedPaneId = getFirstPaneIdFromTree(layout) ?? panes[0]?.id ?? null;
  const lastFocusedPaneId =
    workspace.lastFocusedPaneId && paneIds.has(workspace.lastFocusedPaneId)
      ? workspace.lastFocusedPaneId
      : fallbackFocusedPaneId ?? undefined;
  const zoomedPaneId =
    workspace.zoomedPaneId && paneIds.has(workspace.zoomedPaneId)
      ? workspace.zoomedPaneId
      : undefined;

  return {
    ...workspace,
    cwd: workspaceCwd,
    layout,
    panes,
    lastFocusedPaneId,
    zoomedPaneId
  };
}

function getReusableEmptyPaneId(
  workspace: Workspace,
  focusedPaneId: string | null
): string | null {
  const focusedPane = focusedPaneId
    ? workspace.panes.find((pane) => pane.id === focusedPaneId)
    : null;

  if (focusedPane?.type === 'empty') {
    return focusedPane.id;
  }

  if (workspace.panes.length === 1 && workspace.panes[0]?.type === 'empty') {
    return workspace.panes[0].id;
  }

  return null;
}

function resolvePaneContextCwd(
  workspace: Workspace,
  focusedPaneId: string | null,
  homeDirectory?: string | null
): string {
  // Always prefer the workspace's configured project root.
  // Fall back to the focused pane's cwd only if the workspace has no cwd set.
  const workspaceCwd = workspace.cwd?.trim();
  if (workspaceCwd) {
    return workspaceCwd;
  }

  const focusedPane = focusedPaneId
    ? workspace.panes.find((pane) => pane.id === focusedPaneId)
    : null;

  if (focusedPane && (focusedPane.type === 'terminal' || focusedPane.type === 'agent')) {
    return resolveWorkspaceCwd(focusedPane.cwd, homeDirectory);
  }

  return resolveWorkspaceCwd(workspace.cwd, homeDirectory);
}

function resolvePresetPaneCwd(
  preset: AgentPreset | undefined,
  workspace: Workspace,
  homeDirectory?: string | null
): string {
  const workspaceCwd = resolveWorkspaceCwd(workspace.cwd, homeDirectory);

  if (!preset || (preset.type || 'agent') !== 'agent') {
    return workspaceCwd;
  }

  switch (preset.cwdMode) {
    case 'home':
      return resolveWorkspaceCwd(homeDirectory, workspaceCwd);
    case 'custom': {
      const customCwd = preset.cwdCustom?.trim();
      return customCwd || workspaceCwd;
    }
    case 'workspace':
    default:
      return workspaceCwd;
  }
}

function upsertRecentCommand(
  commands: CommandHistoryEntry[],
  entry: CommandHistoryEntry
): CommandHistoryEntry[] {
  return [
    entry,
    ...commands.filter((command) => command.command.trim() !== entry.command.trim())
  ].slice(0, 500);
}

function upsertRecentUrl(
  urls: RecentUrl[],
  entry: RecentUrl
): RecentUrl[] {
  const entryKey = normalizeUrlForHistory(entry.url);
  return [
    entry,
    ...urls.filter((url) => normalizeUrlForHistory(url.url) !== entryKey)
  ].slice(0, 200);
}

function buildInteractivePane(
  paneId: string,
  type: 'terminal' | 'agent',
  cwd: string,
  shell: ShellType,
  command?: string,
  presetId?: string,
  label?: string
): TerminalPane | AgentPane {
  const nextCommand = command || '';
  const basePane = {
    id: paneId,
    type,
    label: label || (type === 'agent' ? 'Agent' : 'Terminal'),
    status: getInteractivePaneStatus(nextCommand),
    cwd,
    command: nextCommand,
    shell,
    startedAt: new Date().toISOString()
  };

  if (type === 'agent') {
    return {
      ...basePane,
      presetId
    } as AgentPane;
  }

  return basePane as TerminalPane;
}

function removePaneFromLayout(node: LayoutNode, targetId: string): LayoutNode | string | null {
  const nextChildren: (LayoutNode | string)[] = [];
  const nextSizes: number[] = [];

  node.children.forEach((child, index) => {
    const nextChild =
      typeof child === 'string'
        ? child === targetId
          ? null
          : child
        : removePaneFromLayout(child, targetId);

    if (nextChild !== null) {
      nextChildren.push(nextChild);
      nextSizes.push(node.sizes[index] ?? 0);
    }
  });

  if (nextChildren.length === 0) {
    return null;
  }



  return {
    ...node,
    children: nextChildren,
    sizes: normalizeSizes(nextSizes, nextChildren.length)
  };
}

function dismissNotificationsByWorkspaceState(
  state: Pick<AppStore, 'notifications' | 'notificationHistory'>,
  workspaceId: string
): Partial<Pick<AppStore, 'notifications' | 'notificationHistory'>> {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return {};
  }

  const removedIds = new Set(
    state.notificationHistory
      .filter((notification) =>
        notification.sourceWorkspaceId === normalizedWorkspaceId && !notification.dismissed
      )
      .map((notification) => notification.id)
  );

  if (removedIds.size === 0) {
    return {};
  }

  return {
    notifications: state.notifications.filter((notification) => !removedIds.has(notification.id)),
    notificationHistory: state.notificationHistory.map((notification) =>
      removedIds.has(notification.id) ? { ...notification, dismissed: true } : notification
    )
  };
}

function dismissNotificationsByPaneState(
  state: Pick<AppStore, 'notifications' | 'notificationHistory'>,
  paneId: string
): Partial<Pick<AppStore, 'notifications' | 'notificationHistory'>> {
  const normalizedPaneId = paneId.trim();
  if (!normalizedPaneId) {
    return {};
  }

  const removedIds = new Set(
    state.notificationHistory
      .filter((notification) =>
        notification.sourcePaneId === normalizedPaneId && !notification.dismissed
      )
      .map((notification) => notification.id)
  );

  if (removedIds.size === 0) {
    return {};
  }

  return {
    notifications: state.notifications.filter((notification) => !removedIds.has(notification.id)),
    notificationHistory: state.notificationHistory.map((notification) =>
      removedIds.has(notification.id) ? { ...notification, dismissed: true } : notification
    )
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  activeWorkspaceId: null,
  workspaces: [],
  settings: null,
  presets: [],
  recentCommands: [],
  recentUrls: [],
  focusedPaneId: null,
  homeDirectory: 'C:\\',
  notifications: [],
  notificationHistory: [],
  isLoading: true,

  incrementFontSize: () => {
    set((state) => ({
      settings: state.settings ? {
        ...state.settings,
        terminalFontSize: Math.min(32, state.settings.terminalFontSize + 1)
      } : null
    }));
    get().saveSession();
  },

  decrementFontSize: () => {
    set((state) => ({
      settings: state.settings ? {
        ...state.settings,
        terminalFontSize: Math.max(8, state.settings.terminalFontSize - 1)
      } : null
    }));
    get().saveSession();
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      const [state, presets, settings, homeDirectory] = await Promise.all([
        window.electron.session.load(),
        window.electron.preset.list(),
        window.electron.settings.get(),
        window.electron.app.getHomeDirectory()
      ]);

      const recentCommands = await window.electron.history.getCommands();
      const recentUrls = await window.electron.history.getUrls();

      const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
      const startupBehavior = mergedSettings.startupBehavior || 'restore';

      const shouldRestore = startupBehavior === 'restore' || startupBehavior === 'specific';

      if (shouldRestore && state && state.workspaces.length > 0) {
        let workspacesToRestore = state.workspaces.map((workspace) =>
          normalizeWorkspaceForRestore(workspace, homeDirectory)
        );
        let activeId = state.activeWorkspaceId || workspacesToRestore[0]?.id || null;

        // If 'specific', only restore that one workspace
        if (startupBehavior === 'specific' && mergedSettings.startupWorkspaceId) {
          const specificWs = workspacesToRestore.find((workspace) => workspace.id === mergedSettings.startupWorkspaceId);
          if (specificWs) {
            workspacesToRestore = [specificWs];
            activeId = specificWs.id;
          }
        }

        if (!workspacesToRestore.some((workspace) => workspace.id === activeId)) {
          activeId = workspacesToRestore[0]?.id || null;
        }

        const activeWorkspace =
          workspacesToRestore.find((workspace) => workspace.id === activeId) ?? workspacesToRestore[0] ?? null;

        set({
          workspaces: workspacesToRestore,
          activeWorkspaceId: activeId,
          focusedPaneId: getWorkspaceDefaultFocusedPaneId(activeWorkspace),
          presets,
          settings: mergedSettings,
          recentCommands,
          recentUrls,
          homeDirectory,
          isLoading: false
        });

        // Respawn all restored PTY panes with a small delay to ensure UI is ready
        setTimeout(() => {
          void (async () => {
            for (const workspace of workspacesToRestore) {
              for (const pane of workspace.panes) {
                if (pane.type !== 'terminal' && pane.type !== 'agent') {
                  continue;
                }

                const interactivePane = pane as TerminalPane | AgentPane;
                const hasPresetId =
                  pane.type === 'agent' && typeof (interactivePane as AgentPane).presetId === 'string';

                if (pane.type === 'agent' && !hasPresetId) {
                  console.error('Attempting to spawn agent pane without presetId:', {
                    paneId: pane.id,
                    label: pane.label,
                    command: pane.command
                  });
                }

                try {
                  const alreadyRunning = await window.electron.pty.isAlive({ paneId: pane.id });
                  if (alreadyRunning) {
                    continue;
                  }

                  await window.electron.pty.spawn({
                    paneId: pane.id,
                    command: interactivePane.command || '',
                    cwd: pane.cwd || '',
                    shell: interactivePane.shell || 'powershell',
                    presetId: hasPresetId ? (interactivePane as AgentPane).presetId : undefined,
                    paneType: pane.type
                  });
                } catch (error) {
                  console.error('Failed to restore interactive pane:', {
                    paneId: pane.id,
                    error
                  });
                }
              }
            }
          })();
        }, 100);
      } else {
        set({ presets, settings: mergedSettings, recentCommands, recentUrls, homeDirectory, isLoading: false });
      }
    } catch (e) {
      console.error('Failed to initialize:', e);
      set({ isLoading: false });
    }
  },

  saveSession: async () => {
    const { activeWorkspaceId, workspaces } = get();
    console.log('saveSession called, workspaces:', workspaces.map(w => ({ id: w.id, panes: w.panes.map(p => ({ id: p.id, type: p.type, label: p.label })) })));

    const validatedWorkspaces = workspaces.map(w => ({
      ...w,
      panes: w.panes.map(p => {
        if (p.type === 'agent') {
          const agentPane = p as AgentPane;
          if (!agentPane.presetId) {
            console.error('INVALID: Agent pane missing presetId during save, converting to terminal:', { paneId: p.id, label: p.label });
            return { ...p, type: 'terminal' as const };
          }
        }
        return p;
      })
    }));

    try {
      await window.electron.session.save({
        state: {
          version: 1,
          activeWorkspaceId: activeWorkspaceId || validatedWorkspaces[0]?.id || null,
          workspaces: validatedWorkspaces,
          recentCommands: get().recentCommands,
          recentUrls: get().recentUrls
        }
      });
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  },

  deleteWorkspace: (id) => {
    set(state => {
      const workspaces = state.workspaces.filter(w => w.id !== id);
      let activeWorkspaceId = state.activeWorkspaceId;
      if (activeWorkspaceId === id) {
        activeWorkspaceId = workspaces[0]?.id || null;
      }
      const nextActiveWorkspace =
        workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0] ?? null;
      const currentFocusStillExists = state.focusedPaneId
        ? nextActiveWorkspace?.panes.some((pane) => pane.id === state.focusedPaneId)
        : false;
      return {
        workspaces,
        activeWorkspaceId,
        focusedPaneId: currentFocusStillExists
          ? state.focusedPaneId
          : getWorkspaceDefaultFocusedPaneId(nextActiveWorkspace)
      };
    });
    get().saveSession();
  },

  setActiveWorkspace: (id) => {
    const workspace = get().workspaces.find(w => w.id === id);
    set((state) => ({
      ...dismissNotificationsByWorkspaceState(state, id),
      activeWorkspaceId: id,
      focusedPaneId: getWorkspaceDefaultFocusedPaneId(workspace)
    }));
    void get().saveSession();
  },

  renameWorkspace: (id, name) => {
    set(state => ({
      workspaces: state.workspaces.map(w =>
        w.id === id ? { ...w, name, updatedAt: new Date().toISOString() } : w
      )
    }));
    get().saveSession();
  },

  updateWorkspace: (workspace) => {
    set(state => ({
      workspaces: state.workspaces.map(w => w.id === workspace.id ? workspace : w)
    }));
  },

  addRecentProject: (path) => {
    const recent = get().settings?.recentProjects || [];
    const filtered = recent.filter(p => p !== path);
    const updated = [path, ...filtered].slice(0, 15);
    get().updateSettings({ recentProjects: updated });
  },

  createWorkspace: async (name, cwd, layoutType = 'empty', templateId?: string) => {
    const state = get();
    const requestedCwd = cwd?.trim() || '';
    const resolvedCwd = resolveWorkspaceCwd(requestedCwd, state.homeDirectory);
    let layout: LayoutNode;
    let panes: Pane[] = [];

    if (templateId && state.settings?.layoutTemplates) {
      const template = state.settings.layoutTemplates.find(t => t.id === templateId);
      if (template) {
        layout = JSON.parse(JSON.stringify(template.layout));
        panes = JSON.parse(JSON.stringify(template.panes));
        panes = panes.map((p: Pane) => ({
          ...p,
          id: uuidv4(),
          cwd: resolveWorkspaceCwd(p.cwd, resolvedCwd),
          status: p.type === 'terminal' || p.type === 'agent'
            ? getInteractivePaneStatus((p as TerminalPane | AgentPane).command)
            : p.type === 'browser'
              ? 'running'
              : 'idle'
        }));
        const updatePaneIds = (node: LayoutNode): LayoutNode => {
          return {
            ...node,
            children: node.children.map(c => {
              if (typeof c === 'string') {
                const oldPane = template.panes.find((tp: Pane) => tp.id === c);
                if (oldPane) {
                  const newPaneId = panes.find(p => p.label === oldPane.label && p.type === oldPane.type)?.id || c;
                  return newPaneId;
                }
                return c;
              }
              return updatePaneIds(c);
            })
          };
        };
        layout = normalizeLayoutTree(updatePaneIds(layout));
      } else {
        layout = { id: uuidv4(), direction: 'horizontal', children: [], sizes: [] };
      }
    } else if (layoutType === 'two-columns') {
      const leftId = uuidv4();
      const rightId = uuidv4();
      layout = {
        id: uuidv4(),
        direction: 'horizontal',
        children: [leftId, rightId],
        sizes: [50, 50]
      };
      panes = [
        { id: leftId, type: 'empty', label: 'Pane', status: 'idle', cwd: resolvedCwd } as EmptyPane,
        { id: rightId, type: 'empty', label: 'Pane', status: 'idle', cwd: resolvedCwd } as EmptyPane
      ];
    } else if (layoutType === 'two-rows') {
      const topId = uuidv4();
      const bottomId = uuidv4();
      layout = {
        id: uuidv4(),
        direction: 'vertical',
        children: [topId, bottomId],
        sizes: [50, 50]
      };
      panes = [
        { id: topId, type: 'empty', label: 'Pane', status: 'idle', cwd: resolvedCwd } as EmptyPane,
        { id: bottomId, type: 'empty', label: 'Pane', status: 'idle', cwd: resolvedCwd } as EmptyPane
      ];
    } else if (layoutType === 'big-left') {
      const bigId = uuidv4();
      const topRightId = uuidv4();
      const bottomRightId = uuidv4();
      const rightNodeId = uuidv4();
      layout = {
        id: uuidv4(),
        direction: 'horizontal',
        children: [
          bigId,
          { id: rightNodeId, direction: 'vertical', children: [topRightId, bottomRightId], sizes: [50, 50] }
        ],
        sizes: [60, 40]
      };
      panes = [
        { id: bigId, type: 'empty', label: 'Pane', status: 'idle', cwd: resolvedCwd } as EmptyPane,
        { id: topRightId, type: 'empty', label: 'Pane', status: 'idle', cwd: resolvedCwd } as EmptyPane,
        { id: bottomRightId, type: 'empty', label: 'Pane', status: 'idle', cwd: resolvedCwd } as EmptyPane
      ];
    } else if (layoutType === 'grid') {
      const tlId = uuidv4();
      const trId = uuidv4();
      const blId = uuidv4();
      const brId = uuidv4();
      const hNodeId = uuidv4();
      const vNodeId = uuidv4();
      layout = {
        id: uuidv4(),
        direction: 'vertical',
        children: [
          { id: hNodeId, direction: 'horizontal', children: [tlId, trId], sizes: [50, 50] },
          { id: vNodeId, direction: 'horizontal', children: [blId, brId], sizes: [50, 50] }
        ],
        sizes: [50, 50]
      };
      panes = [
        { id: tlId, type: 'empty', label: 'Pane', status: 'idle', cwd: resolvedCwd } as EmptyPane,
        { id: trId, type: 'empty', label: 'Pane', status: 'idle', cwd: resolvedCwd } as EmptyPane,
        { id: blId, type: 'empty', label: 'Pane', status: 'idle', cwd: resolvedCwd } as EmptyPane,
        { id: brId, type: 'empty', label: 'Pane', status: 'idle', cwd: resolvedCwd } as EmptyPane
      ];
    } else {
      const emptyId = uuidv4();
      layout = {
        id: uuidv4(),
        direction: 'horizontal',
        children: [emptyId],
        sizes: [100]
      };
      panes = [
        { id: emptyId, type: 'empty', label: 'New Pane', status: 'idle', cwd: resolvedCwd } as EmptyPane
      ];
    }

    const workspace: Workspace = {
      id: uuidv4(),
      name,
      cwd: resolvedCwd,
      layout: normalizeLayoutTree(layout),
      panes,
      lastFocusedPaneId: getFirstPaneIdFromTree(layout) ?? panes[0]?.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    set(state => ({
      workspaces: [...state.workspaces, workspace],
      activeWorkspaceId: workspace.id,
      focusedPaneId: getWorkspaceDefaultFocusedPaneId(workspace)
    }));

    // If restoring from a template, we need to spawn the backend processes for these panes
    if (templateId) {
      for (const pane of panes) {
        if (pane.type === 'terminal' || pane.type === 'agent') {
          window.electron.pty.spawn({
            paneId: pane.id,
            command: (pane as AgentPane | TerminalPane).command || '',
            cwd: pane.cwd || resolvedCwd,
            shell: (pane as AgentPane | TerminalPane).shell || 'powershell',
            presetId: (pane as AgentPane).presetId,
            paneType: pane.type
          });
          if ((pane as AgentPane | TerminalPane).command.trim()) {
            void get().recordCommandHistory({
              command: (pane as AgentPane | TerminalPane).command,
              paneId: pane.id,
              workspaceId: workspace.id
            });
          }
        } else if (pane.type === 'browser') {
          const url = (pane as BrowserPane).url || 'about:blank';
          window.electron.browser.create({ paneId: pane.id, url });
          window.electron.browser.load({ paneId: pane.id, url });
        }
      }
    }

    const recent = state.settings?.recentProjects || [];
    if (requestedCwd && !recent.includes(resolvedCwd)) {
      get().addRecentProject(resolvedCwd);
    }

    await get().saveSession();
  },

  createPane: async (workspaceId, type, params = {}) => {
    const state = get();
    const workspace = state.workspaces.find(w => w.id === workspaceId);
    if (!workspace) return null;

    if (type !== 'empty') {
      const reusablePaneId = getReusableEmptyPaneId(workspace, state.focusedPaneId);
      if (reusablePaneId) {
        return get().convertPane(workspaceId, reusablePaneId, type, params);
      }
    }

    const paneId = uuidv4();
    let pane: Pane;
    const defaultCwd = resolvePaneContextCwd(workspace, state.focusedPaneId, state.homeDirectory);

    if (type === 'browser') {
      const url = params.url || 'about:blank';
      pane = {
        id: paneId, type: 'browser', label: 'Browser',
        status: 'running', cwd: defaultCwd,
        url, history: [url], historyIndex: 0
      } as BrowserPane;
      window.electron.browser.create({ paneId, url });
      window.electron.browser.load({ paneId, url });
    } else {
      const shell = params.shell || state.settings?.shell || 'powershell';
      let command = params.command;
      let cwd = defaultCwd;

      if (type === 'agent' && params.presetId) {
        const preset = state.presets.find(p => p.id === params.presetId);
        command = preset?.command || '';
        cwd = resolvePresetPaneCwd(preset, workspace, state.homeDirectory);
        pane = buildInteractivePane(
          paneId,
          'agent',
          cwd,
          preset?.shell || shell,
          command,
          params.presetId,
          preset?.name || 'Agent'
        );
      } else {
        pane = buildInteractivePane(
          paneId,
          type === 'agent' ? 'agent' : 'terminal',
          cwd,
          shell,
          command,
          undefined,
          type === 'agent' ? 'Agent' : 'Terminal'
        );
      }
    }

    set(state => {
      const freshWorkspace = state.workspaces.find(w => w.id === workspaceId);
      if (!freshWorkspace) return state;

      const freshLayout = { ...freshWorkspace.layout };
      if (freshLayout.children.length === 0) {
        freshLayout.children = [paneId];
        freshLayout.sizes = [100];
      } else {
        const newChildren = [...freshLayout.children, paneId];
        freshLayout.children = newChildren;
        freshLayout.sizes = normalizeSizes([], newChildren.length);
      }

      return {
        workspaces: state.workspaces.map(w =>
          w.id === workspaceId
            ? {
              ...w,
              panes: [...w.panes, pane],
              layout: freshLayout,
              lastFocusedPaneId: paneId,
              updatedAt: new Date().toISOString()
            }
            : w
        ),
        focusedPaneId: paneId
      };
    });

    if (type === 'terminal' || type === 'agent') {
      void window.electron.pty.spawn({
        paneId, command: (pane as TerminalPane | AgentPane).command, cwd: (pane as TerminalPane | AgentPane).cwd || defaultCwd,
        shell: (pane as TerminalPane | AgentPane).shell,
        presetId: params.presetId,
        paneType: type === 'agent' ? 'agent' : 'terminal'
      });

      if ((pane as TerminalPane | AgentPane).command.trim()) {
        void get().recordCommandHistory({
          command: (pane as TerminalPane | AgentPane).command,
          paneId,
          workspaceId
        });
      }
    }

    void get().saveSession();
    return pane;
  },

  convertPane: async (workspaceId, paneId, type, params = {}) => {
    const state = get();
    const workspace = state.workspaces.find(w => w.id === workspaceId);
    if (!workspace) return null;

    const existingPane = workspace.panes.find(p => p.id === paneId);
    if (!existingPane) return null;

    let pane: Pane;
    const defaultCwd = resolvePaneContextCwd(workspace, state.focusedPaneId, state.homeDirectory);

    if (type === 'browser') {
      const url = params.url || 'about:blank';
      pane = {
        id: paneId, type: 'browser', label: 'Browser',
        status: 'running', cwd: defaultCwd,
        url, history: [url], historyIndex: 0
      } as BrowserPane;
      window.electron.browser.create({ paneId, url });
      window.electron.browser.load({ paneId, url });
    } else {
      const shell = params.shell || state.settings?.shell || 'powershell';
      let command = params.command;
      let cwd = defaultCwd;

      if (type === 'agent' && params.presetId) {
        const preset = state.presets.find(p => p.id === params.presetId);
        command = preset?.command || '';
        cwd = resolvePresetPaneCwd(preset, workspace, state.homeDirectory);
        pane = buildInteractivePane(
          paneId,
          'agent',
          cwd,
          preset?.shell || shell,
          command,
          params.presetId,
          preset?.name || 'Agent'
        );
      } else {
        pane = buildInteractivePane(
          paneId,
          type === 'agent' ? 'agent' : 'terminal',
          cwd,
          shell,
          command,
          undefined,
          type === 'agent' ? 'Agent' : 'Terminal'
        );
      }
    }

    set(state => ({
      workspaces: state.workspaces.map(w =>
        w.id === workspaceId
          ? {
            ...w,
            panes: w.panes.map(p => p.id === paneId ? pane : p),
            lastFocusedPaneId: paneId,
            updatedAt: new Date().toISOString()
          }
          : w
      ),
      focusedPaneId: paneId
    }));

    if (type === 'terminal' || type === 'agent') {
      void window.electron.pty.spawn({
        paneId, command: (pane as TerminalPane | AgentPane).command, cwd: (pane as TerminalPane | AgentPane).cwd || defaultCwd,
        shell: (pane as TerminalPane | AgentPane).shell,
        presetId: params.presetId,
        paneType: type === 'agent' ? 'agent' : 'terminal'
      });

      if ((pane as TerminalPane | AgentPane).command.trim()) {
        void get().recordCommandHistory({
          command: (pane as TerminalPane | AgentPane).command,
          paneId,
          workspaceId
        });
      }
    }

    void get().saveSession();
    return pane;
  },

  closePane: (workspaceId, paneId) => {
    const state = get();
    const workspace = state.workspaces.find(w => w.id === workspaceId);
    const paneToClose = workspace?.panes.find(p => p.id === paneId);
    console.log('closePane called:', { workspaceId, paneId, paneType: paneToClose?.type, label: paneToClose?.label, workspacePanes: workspace?.panes.map(p => ({ id: p.id, type: p.type, label: p.label })) });

    window.electron.pane.close({ paneId, workspaceId });

    set(state => {
      const workspace = state.workspaces.find(w => w.id === workspaceId);
      if (!workspace) return state;

      const newPanes = workspace.panes.filter(p => p.id !== paneId);

      function getAllPaneIdsFromLayout(node: LayoutNode | string): string[] {
        if (typeof node === 'string') return [node];
        return node.children.flatMap(child => getAllPaneIdsFromLayout(child));
      }
      const layoutPaneIds = getAllPaneIdsFromLayout(workspace.layout);
      const paneIds = new Set(newPanes.map(p => p.id));
      const orphanedLayoutIds = layoutPaneIds.filter(id => !paneIds.has(id));
      if (orphanedLayoutIds.length > 0) {
        console.error('closePane detected orphaned layout IDs:', { orphanedLayoutIds, newPanes: newPanes.map(p => p.id), layoutPaneIds });
      }

      console.log('closePane updating state:', { closingPaneId: paneId, remainingPanes: newPanes.map(p => ({ id: p.id, type: p.type, label: p.label })) });

      if (newPanes.length === 0) {
        return {
          ...state,
          ...dismissNotificationsByPaneState(state, paneId),
          workspaces: state.workspaces.map(w =>
            w.id === workspaceId
              ? {
                ...w,
                panes: [],
                layout: { id: uuidv4(), direction: 'horizontal', children: [], sizes: [] },
                lastFocusedPaneId: undefined,
                zoomedPaneId: undefined,
                updatedAt: new Date().toISOString()
              }
              : w
          ),
          focusedPaneId: null
        };
      }

      const updatedTree = removePaneFromLayout(workspace.layout, paneId);
      const newLayout: LayoutNode =
        updatedTree === null
          ? { id: workspace.layout.id, direction: 'horizontal', children: [], sizes: [] }
          : typeof updatedTree === 'string'
            ? { id: workspace.layout.id, direction: 'horizontal', children: [updatedTree], sizes: [100] }
            : { ...updatedTree, id: workspace.layout.id };

      const targetIndex = layoutPaneIds.indexOf(paneId);
      let betterFallback: string | null = null;
      if (targetIndex !== -1) {
        if (targetIndex + 1 < layoutPaneIds.length) {
          betterFallback = layoutPaneIds[targetIndex + 1];
        } else if (targetIndex - 1 >= 0) {
          betterFallback = layoutPaneIds[targetIndex - 1];
        }
      }

      const currentFocusStillExists = state.focusedPaneId
        ? newPanes.some((pane) => pane.id === state.focusedPaneId)
        : false;
      const fallbackFocusedPaneId =
        betterFallback ?? getFirstPaneIdFromTree(newLayout) ?? newPanes[0]?.id ?? null;

      return {
        ...dismissNotificationsByPaneState(state, paneId),
        workspaces: state.workspaces.map(w =>
          w.id === workspaceId
            ? {
              ...w,
              panes: newPanes,
              layout: newLayout,
              lastFocusedPaneId:
                state.focusedPaneId === paneId || !currentFocusStillExists
                  ? fallbackFocusedPaneId ?? undefined
                  : w.lastFocusedPaneId === paneId
                    ? fallbackFocusedPaneId ?? undefined
                    : w.lastFocusedPaneId,
              zoomedPaneId: w.zoomedPaneId === paneId ? undefined : w.zoomedPaneId,
              updatedAt: new Date().toISOString()
            }
            : w
        ),
        focusedPaneId:
          state.focusedPaneId === paneId || !currentFocusStillExists
            ? fallbackFocusedPaneId
            : state.focusedPaneId
      };
    });

    get().saveSession();
  },

  updatePane: (workspaceId, paneId, patch) => {
    set(state => ({
      workspaces: state.workspaces.map(w =>
        w.id === workspaceId
          ? { ...w, panes: w.panes.map(p => p.id === paneId ? { ...p, ...patch } as Pane : p), updatedAt: new Date().toISOString() }
          : w
      )
    }));
    get().saveSession();
  },

  setFocusedPane: (paneId) => {
    set((state) => {
      if (!paneId) {
        return { focusedPaneId: null };
      }

      const workspaceForPane = state.workspaces.find((workspace) =>
        workspace.panes.some((pane) => pane.id === paneId)
      );

      if (!workspaceForPane) {
        return { focusedPaneId: paneId };
      }

      return {
        activeWorkspaceId: state.activeWorkspaceId ?? workspaceForPane.id,
        focusedPaneId: paneId,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceForPane.id
            ? { ...workspace, lastFocusedPaneId: paneId }
            : workspace
        )
      };
    });
    if (paneId) {
      window.electron.browser.setFocused({ paneId });
    }
  },

  togglePaneZoom: (workspaceId, paneId) => {
    const state = get();
    const targetWorkspaceId = workspaceId || state.activeWorkspaceId;
    if (!targetWorkspaceId) {
      return;
    }

    const workspace = state.workspaces.find((candidate) => candidate.id === targetWorkspaceId);
    if (!workspace) {
      return;
    }

    const targetPaneId = paneId ?? state.focusedPaneId ?? workspace.lastFocusedPaneId ?? null;
    if (!targetPaneId || !workspace.panes.some((pane) => pane.id === targetPaneId)) {
      return;
    }

    set((current) => ({
      workspaces: current.workspaces.map((candidate) =>
        candidate.id === targetWorkspaceId
          ? {
            ...candidate,
            zoomedPaneId: candidate.zoomedPaneId === targetPaneId ? undefined : targetPaneId,
            lastFocusedPaneId: targetPaneId,
            updatedAt: new Date().toISOString()
          }
          : candidate
      ),
      activeWorkspaceId: targetWorkspaceId,
      focusedPaneId: targetPaneId
    }));

    void get().saveSession();
  },

  focusNextWorkspace: () => {
    const { workspaces, activeWorkspaceId, setActiveWorkspace } = get();
    if (workspaces.length <= 1) {
      return;
    }

    const currentIndex = workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % workspaces.length : 0;
    setActiveWorkspace(workspaces[nextIndex].id);
  },

  focusPreviousWorkspace: () => {
    const { workspaces, activeWorkspaceId, setActiveWorkspace } = get();
    if (workspaces.length <= 1) {
      return;
    }

    const currentIndex = workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId);
    const previousIndex =
      currentIndex >= 0
        ? (currentIndex - 1 + workspaces.length) % workspaces.length
        : Math.max(workspaces.length - 1, 0);
    setActiveWorkspace(workspaces[previousIndex].id);
  },

  focusNextPane: () => {
    const { activeWorkspaceId, workspaces, focusedPaneId, setFocusedPane } = get();
    const workspace = workspaces.find((candidate) => candidate.id === activeWorkspaceId);
    if (!workspace) {
      return;
    }

    const paneIds = getPaneIdsInLayoutOrder(workspace.layout).filter((paneId) =>
      workspace.panes.some((pane) => pane.id === paneId)
    );
    if (paneIds.length <= 1) {
      return;
    }

    const currentPaneId = focusedPaneId ?? workspace.lastFocusedPaneId ?? paneIds[0];
    const currentIndex = paneIds.indexOf(currentPaneId);
    const nextPaneId = paneIds[(currentIndex >= 0 ? currentIndex + 1 : 0) % paneIds.length];
    if (workspace.zoomedPaneId) {
      set((state) => ({
        focusedPaneId: nextPaneId,
        workspaces: state.workspaces.map((candidate) =>
          candidate.id === workspace.id
            ? { ...candidate, lastFocusedPaneId: nextPaneId, zoomedPaneId: nextPaneId }
            : candidate
        )
      }));
      return;
    }
    setFocusedPane(nextPaneId);
  },

  focusPreviousPane: () => {
    const { activeWorkspaceId, workspaces, focusedPaneId, setFocusedPane } = get();
    const workspace = workspaces.find((candidate) => candidate.id === activeWorkspaceId);
    if (!workspace) {
      return;
    }

    const paneIds = getPaneIdsInLayoutOrder(workspace.layout).filter((paneId) =>
      workspace.panes.some((pane) => pane.id === paneId)
    );
    if (paneIds.length <= 1) {
      return;
    }

    const currentPaneId = focusedPaneId ?? workspace.lastFocusedPaneId ?? paneIds[0];
    const currentIndex = paneIds.indexOf(currentPaneId);
    const previousPaneId =
      paneIds[(currentIndex >= 0 ? currentIndex - 1 + paneIds.length : paneIds.length - 1) % paneIds.length];
    if (workspace.zoomedPaneId) {
      set((state) => ({
        focusedPaneId: previousPaneId,
        workspaces: state.workspaces.map((candidate) =>
          candidate.id === workspace.id
            ? { ...candidate, lastFocusedPaneId: previousPaneId, zoomedPaneId: previousPaneId }
            : candidate
        )
      }));
      return;
    }
    setFocusedPane(previousPaneId);
  },

  syncPaneCwd: (paneId, cwd) => {
    const normalizedCwd = cwd.trim();
    if (!normalizedCwd) {
      return;
    }

    set((state) => {
      let hasChanges = false;

      const workspaces = state.workspaces.map((workspace) => {
        const pane = workspace.panes.find((candidate) => candidate.id === paneId);
        if (!pane || pane.cwd === normalizedCwd) {
          return workspace;
        }

        hasChanges = true;
        return {
          ...workspace,
          // Preserve workspace.cwd as the configured project root — don't overwrite
          // it with the focused pane's current working directory. Individual pane cwds
          // are tracked separately so new terminals still inherit the project root.
          panes: workspace.panes.map((candidate) =>
            candidate.id === paneId ? { ...candidate, cwd: normalizedCwd } as Pane : candidate
          ),
          updatedAt: new Date().toISOString()
        };
      });

      return hasChanges ? { workspaces } : state;
    });
  },

  updatePaneStatus: (workspaceId, paneId, status) => {
    const prevState = get();
    const workspace = prevState.workspaces.find(w => w.id === workspaceId);
    const prevPane = workspace?.panes.find(p => p.id === paneId);
    const prevStatus = prevPane?.status;

    set(state => ({
      workspaces: state.workspaces.map(w =>
        w.id === workspaceId
          ? { ...w, panes: w.panes.map(p => p.id === paneId ? { ...p, status } as Pane : p) }
          : w
      )
    }));

    if (prevStatus !== status) {
      window.dispatchEvent(new CustomEvent('pane-status-changed', {
        detail: { paneId, status }
      }));
    }
  },

  restartPane: async (workspaceId, paneId) => {
    const state = get();
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
    const pane = workspace?.panes.find((candidate) => candidate.id === paneId);

    if (!workspace || !pane || (pane.type !== 'terminal' && pane.type !== 'agent')) {
      return;
    }

    const interactivePane = pane as TerminalPane | AgentPane;
    const cwd = resolveWorkspaceCwd(
      interactivePane.cwd,
      workspace.cwd || state.homeDirectory
    );

    await window.electron.pty.kill({ paneId });
    window.dispatchEvent(new CustomEvent(`terminal-reset-${paneId}`));

    set((current) => ({
      workspaces: current.workspaces.map((candidate) =>
        candidate.id === workspaceId
          ? {
            ...candidate,
            panes: candidate.panes.map((currentPane) =>
              currentPane.id === paneId
                ? {
                  ...currentPane,
                  cwd,
                  status: 'running',
                  startedAt: new Date().toISOString()
                } as Pane
                : currentPane
            ),
            updatedAt: new Date().toISOString()
          }
          : candidate
      )
    }));

    await window.electron.pty.spawn({
      paneId,
      command: interactivePane.command || '',
      cwd,
      shell: interactivePane.shell || state.settings?.shell || 'powershell',
      presetId: pane.type === 'agent' ? (interactivePane as AgentPane).presetId : undefined,
      paneType: pane.type
    });

    if (interactivePane.command.trim()) {
      void get().recordCommandHistory({
        command: interactivePane.command,
        paneId,
        workspaceId
      });
    }

    window.dispatchEvent(new CustomEvent(`terminal-refit-${paneId}`));
  },

  updateLayout: (workspaceId, layout) => {
    set(state => ({
      workspaces: state.workspaces.map(w =>
        w.id === workspaceId ? { ...w, layout } : w
      )
    }));
    get().saveSession();
  },

  updatePaneSize: (workspaceId, nodeId, sizes) => {
    set(state => ({
      workspaces: state.workspaces.map(w => {
        if (w.id !== workspaceId) return w;
        function updateNode(node: LayoutNode): LayoutNode {
          if (node.id === nodeId) {
            return { ...node, sizes: normalizeSizes(sizes, node.children.length) };
          }

          const children = node.children.map(c => typeof c !== 'string' ? updateNode(c) : c) as (LayoutNode | string)[];
          return { ...node, children };
        }
        return { ...w, layout: updateNode(w.layout), updatedAt: new Date().toISOString() };
      })
    }));
  },

  splitPane: (workspaceId, paneId, direction) => {
    const { workspaces, homeDirectory } = get();
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;

    const newPaneId = uuidv4();

    function insertIntoLayout(node: LayoutNode, targetId: string): LayoutNode {
      const idx = node.children.findIndex((child) => child === targetId);
      if (idx !== -1) {
        const children = [...node.children];
        children[idx] = {
          id: uuidv4(),
          direction,
          children: [targetId, newPaneId],
          sizes: [50, 50]
        };

        return {
          ...node,
          children: children as (LayoutNode | string)[],
          sizes: normalizeSizes(node.sizes, children.length)
        };
      }

      return {
        ...node,
        children: node.children.map(c => typeof c !== 'string' ? insertIntoLayout(c, targetId) : c) as (LayoutNode | string)[]
      };
    }

    const updatedLayout = normalizeLayoutTree(insertIntoLayout(workspace.layout, paneId));

    const cwd = resolveWorkspaceCwd(workspace.cwd, homeDirectory);
    const emptyPane: EmptyPane = {
      id: newPaneId,
      type: 'empty',
      label: 'New Pane',
      status: 'idle',
      cwd
    };

    set(state => ({
      workspaces: state.workspaces.map(w =>
        w.id === workspaceId
          ? {
            ...w,
            layout: updatedLayout,
            panes: [...w.panes, emptyPane],
            lastFocusedPaneId: newPaneId,
            zoomedPaneId: w.zoomedPaneId === paneId ? newPaneId : w.zoomedPaneId,
            updatedAt: new Date().toISOString()
          }
          : w
      ),
      focusedPaneId: newPaneId
    }));

    get().saveSession();
  },

  loadPresets: async () => {
    const presets = await window.electron.preset.list();
    set({ presets });
  },

  createPreset: async (preset) => {
    const newPreset = await window.electron.preset.create({
      ...preset,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as AgentPreset);
    set(state => ({ presets: [...state.presets, newPreset] }));
  },

  updatePreset: async (id, patch) => {
    const updated = await window.electron.preset.update({ id, patch });
    set(state => ({ presets: state.presets.map(p => p.id === id ? updated : p) }));
  },

  deletePreset: async (id) => {
    await window.electron.preset.delete({ id });
    set(state => ({ presets: state.presets.filter(p => p.id !== id) }));
  },

  loadSettings: async () => {
    const settings = await window.electron.settings.get();
    set({ settings });
  },

  updateSettings: async (patch) => {
    await window.electron.settings.set({ settings: patch });
    set(state => ({ settings: state.settings ? { ...state.settings, ...patch } : null }));
  },

  recordCommandHistory: async ({ command, paneId, workspaceId }) => {
    const normalizedCommand = command.trim();
    if (!normalizedCommand) {
      return;
    }

    const entry: CommandHistoryEntry = {
      id: uuidv4(),
      command: normalizedCommand,
      paneId,
      workspaceId,
      timestamp: new Date().toISOString()
    };

    set((state) => ({
      recentCommands: upsertRecentCommand(state.recentCommands, entry)
    }));

    try {
      await window.electron.history.addCommand(entry);
    } catch (error) {
      console.error('Failed to record command history:', error);
    }
  },

  recordUrlHistory: async ({ url, title }) => {
    const normalizedUrl = normalizeUrlForHistory(url);
    if (!normalizedUrl || normalizedUrl === 'about:blank') {
      return;
    }

    const entry: RecentUrl = {
      id: uuidv4(),
      url: normalizedUrl,
      title: title?.trim() || undefined,
      timestamp: new Date().toISOString()
    };

    set((state) => ({
      recentUrls: upsertRecentUrl(state.recentUrls, entry)
    }));

    try {
      await window.electron.history.addUrl(entry);
    } catch (error) {
      console.error('Failed to record URL history:', error);
    }
  },

  pushNotification: (notification) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: GlobalNotification = {
      ...notification,
      id,
      timestamp: new Date().toISOString()
    };

    set((state) => ({
      notifications: [entry, ...state.notifications].slice(0, 8),
      notificationHistory: [entry, ...state.notificationHistory].slice(0, 50)
    }));

    const autoExpireMs = notification.autoExpireMs ?? (notification.kind === 'action' ? undefined : 6000);
    if (autoExpireMs) {
      window.setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
          notificationHistory: state.notificationHistory.map((n) =>
            n.id === id ? { ...n, dismissed: true } : n
          )
        }));
      }, autoExpireMs);
    }
  },

  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      notificationHistory: state.notificationHistory.map((n) =>
        n.id === id ? { ...n, dismissed: true } : n
      )
    }));
  },

  dismissNotificationsByPane: (paneId) => {
    set((state) => {
      const remainingNotifications = state.notifications.filter((n) => n.sourcePaneId !== paneId);
      const affectedIds = new Set(
        state.notifications.filter((n) => n.sourcePaneId === paneId).map((n) => n.id)
      );

      if (affectedIds.size === 0) return state;

      return {
        notifications: remainingNotifications,
        notificationHistory: state.notificationHistory.map((n) =>
          affectedIds.has(n.id) ? { ...n, dismissed: true } : n
        )
      };
    });
  },

  dismissActionNotificationsByPane: (paneId) => {
    set((state) => {
      const removedNotifications = state.notifications.filter(
        (n) => n.sourcePaneId === paneId && n.kind === 'action'
      );
      if (removedNotifications.length === 0) {
        return state;
      }

      const removedIds = new Set(removedNotifications.map((n) => n.id));

      return {
        notifications: state.notifications.filter((n) => !removedIds.has(n.id)),
        notificationHistory: state.notificationHistory.map((n) =>
          removedIds.has(n.id) ? { ...n, dismissed: true } : n
        )
      };
    });
  },

  dismissNotificationsByWorkspace: (workspaceId) => {
    set((state) => dismissNotificationsByWorkspaceState(state, workspaceId));
  },

  executeNotificationAction: (notificationId, actionId) => {
    const state = get();
    const notification = state.notifications.find((n) => n.id === notificationId);
    if (!notification) return;

    const action = notification.actions?.find((a) => a.id === actionId);
    if (!action) return;

    // Dispatch action event to the originating pane
    if (notification.sourcePaneId) {
      window.dispatchEvent(
        new CustomEvent(`notification-action:${notification.sourcePaneId}`, {
          detail: { notificationId, actionId, action }
        })
      );
    }

    // Dismiss the notification after executing
    get().dismissNotification(notificationId);
  },

  clearNotificationHistory: () => {
    set({ notificationHistory: [] });
  }
}));
