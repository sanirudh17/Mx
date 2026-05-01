import { useEffect } from 'react';
import { useAppStore } from './stores/useAppStore';
import AppShell from './components/layout/AppShell';
import type { AppNotification, Pane } from './types';
import { dispatchAppNotificationWithNativeFallback } from './utils/notifications';

export default function App() {
  const { initialize, isLoading } = useAppStore();

  useEffect(() => {
    initialize();

    const handleBeforeUnload = () => {
      const { settings, saveSession } = useAppStore.getState();
      if (settings?.persistSessionOnQuit !== false) {
        void saveSession();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const unsubData = window.electron.pty.onData((_, { paneId, data }) => {
      window.dispatchEvent(new CustomEvent('pty-data', { detail: { paneId, data } }));
    });

    const unsubExit = window.electron.pty.onExit((_, { paneId, exitCode }) => {
      const { activeWorkspaceId, workspaces, focusedPaneId } = useAppStore.getState();

      let targetWorkspaceId = activeWorkspaceId;
      let targetPane: Pane | null = null;

      for (const ws of workspaces) {
        const pane = ws.panes.find(p => p.id === paneId);
        if (pane) {
          targetPane = pane;
          targetWorkspaceId = ws.id;
          break;
        }
      }

      if (targetWorkspaceId) {
        const newStatus = exitCode === 0 ? 'exited' : 'error';
        useAppStore.getState().updatePaneStatus(targetWorkspaceId, paneId, newStatus);

        // Only notify for actual errors (non-zero exit codes),
        // or when the process finishes in a background workspace.
        // Normal Ctrl+C exits (code 0) in the focused pane are silent.
        if (targetPane && targetPane.type !== 'empty') {
          const ws = workspaces.find(w => w.id === targetWorkspaceId);
          if (ws) {
            const isFocusedPane = paneId === focusedPaneId;
            const isFocusedWorkspace = targetWorkspaceId === activeWorkspaceId;
            const isWindowVisible = document.visibilityState === 'visible' && document.hasFocus();

            // Always notify on errors
            if (exitCode !== 0) {
              const notification: AppNotification = {
                title: 'Process failed',
                body: `${targetPane.label} in ${ws.name} exited with code ${exitCode}`,
                kind: 'error'
              };
              void dispatchAppNotificationWithNativeFallback(
                { ...notification, workspaceId: targetWorkspaceId, paneId },
                !isFocusedWorkspace || !isWindowVisible
              );
            }
            // Notify on success only if it's in a background workspace or the window isn't visible
            else if (!isFocusedWorkspace || !isWindowVisible) {
              const notification: AppNotification = {
                title: 'Process exited',
                body: `${targetPane.label} in ${ws.name} has stopped`,
                kind: 'info'
              };
              void dispatchAppNotificationWithNativeFallback(
                { ...notification, workspaceId: targetWorkspaceId, paneId },
                true
              );
            }
          }
        }
      }
    });

    const unsubCwd = window.electron.pty.onCwd((_, { paneId, cwd }) => {
      useAppStore.getState().syncPaneCwd(paneId, cwd);
    });

    const unsubBrowserLoaded = window.electron.browser.onLoaded((_, { paneId, url }) => {
    });

    const unsubMenu = window.electron.app.onMenuAction((action) => {
      window.dispatchEvent(new CustomEvent(action));
    });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unsubData();
      unsubExit();
      unsubCwd();
      unsubBrowserLoaded();
      unsubMenu();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return <AppShell />;
}
