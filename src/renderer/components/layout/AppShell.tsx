import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import type { Workspace, ListeningPort } from '../../types';
import WorkspaceTabs from './WorkspaceTabs';
import QuickActionsBar from './QuickActionsBar';
import SplitLayout from '../split/SplitLayout';
import NewWorkspaceModal from '../dialogs/NewWorkspaceModal';
import SettingsModal from '../settings/SettingsModal';
import WelcomeScreen from './WelcomeScreen';
import NotesPanel from './NotesPanel';
import ProjectSwitcher from './ProjectSwitcher';
import CommandPalette from './CommandPalette';
import WorkspaceActionCenter from './WorkspaceActionCenter';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useStreamScanner } from '../../hooks/useStreamScanner';
import NotificationOverlay from '../notifications/NotificationOverlay';
import NotificationPanel from '../notifications/NotificationPanel';
import { Radio } from 'lucide-react';

export default function AppShell() {
  const { activeWorkspaceId, workspaces, settings, updateSettings } = useAppStore();

  useKeyboardShortcuts();
  useStreamScanner();
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const lastQuickActionsToggleAtRef = useRef(0);
  const hasWorkspaces = workspaces.length > 0;
  const quickActionsBarVisible = settings?.quickActionsBar !== false;
  const verticalTabsEnabled = settings?.verticalTabs === true;
  const sidebarCollapsed = settings?.sidebarCollapsed === true;
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  useEffect(() => {
    const handler = () => setShowNewWorkspace(true);
    window.addEventListener('open-new-workspace', handler);
    window.addEventListener('app:newWorkspace', handler);
    return () => {
      window.removeEventListener('open-new-workspace', handler);
      window.removeEventListener('app:newWorkspace', handler);
    };
  }, []);

  useEffect(() => {
    const openSettings = () => setShowSettings(true);
    const toggleQuickActionsBar = () => {
      const now = Date.now();
      if (now - lastQuickActionsToggleAtRef.current < 150) {
        return;
      }

      lastQuickActionsToggleAtRef.current = now;
      const currentVisible = useAppStore.getState().settings?.quickActionsBar !== false;
      void updateSettings({ quickActionsBar: !currentVisible });
    };

    window.addEventListener('app:openSettings', openSettings);
    window.addEventListener('app:toggleQuickActionsBar', toggleQuickActionsBar);

    return () => {
      window.removeEventListener('app:openSettings', openSettings);
      window.removeEventListener('app:toggleQuickActionsBar', toggleQuickActionsBar);
    };
  }, [updateSettings]);

  useEffect(() => {
    void window.electron.app.setQuickActionsBarVisible({ visible: quickActionsBarVisible });
  }, [quickActionsBarVisible]);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      activeWorkspace.panes.forEach((pane) => {
        if (pane.type === 'terminal' || pane.type === 'agent') {
          window.dispatchEvent(new CustomEvent(`terminal-refit-${pane.id}`));
        }
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeWorkspace, quickActionsBarVisible]);

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-primary text-gray-100 overflow-hidden">
      {hasWorkspaces ? (
        <div className="flex h-full">
          {verticalTabsEnabled && (
            <WorkspaceTabs 
              onNewWorkspace={() => setShowNewWorkspace(true)} 
              vertical={true}
              sidebarWidth={sidebarCollapsed ? 56 : 200}
            />
          )}
          <div className="flex-1 flex flex-col min-w-0">
            {!verticalTabsEnabled && <WorkspaceTabs onNewWorkspace={() => setShowNewWorkspace(true)} />}

            <div className="flex-1 flex flex-col min-w-0">
              {quickActionsBarVisible && (
                <QuickActionsBar
                  workspaceId={activeWorkspaceId!}
                  onSettings={() => setShowSettings(true)}
                />
              )}
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
                {workspaces.map((workspace) => {
                  const isActive = workspace.id === activeWorkspaceId;

                  return (
                    <div
                      key={workspace.id}
                      className={`absolute inset-0 min-h-0 min-w-0 ${
                        isActive ? 'block z-10' : 'hidden pointer-events-none z-0'
                      }`}
                      aria-hidden={!isActive}
                    >
                      <SplitLayout workspace={workspace} />
                      <NotesPanel workspace={workspace} />
                    </div>
                  );
                })}
              </div>

              <StatusBar activeWorkspace={activeWorkspace} />
            </div>
          </div>
        </div>
      ) : (
        <WelcomeScreen onCreateWorkspace={() => setShowNewWorkspace(true)} />
      )}

      {showNewWorkspace && (
        <NewWorkspaceModal onClose={() => setShowNewWorkspace(false)} />
      )}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
      <WorkspaceActionCenter />
      <ProjectSwitcher />
      <CommandPalette />
      <NotificationOverlay />
    </div>
  );
}

function StatusBar({ activeWorkspace }: { activeWorkspace?: Workspace }) {
  const [elapsed, setElapsed] = useState('0h 0m');
  const [listeningPorts, setListeningPorts] = useState<ListeningPort[]>([]);
  const [showPortsDropdown, setShowPortsDropdown] = useState(false);
  const portsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const diff = Date.now() - start;
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setElapsed(`${hrs}h ${mins}m`);
    };

    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchPorts = async () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      try {
        const ports = await window.electron.system.getListeningPorts();
        if (cancelled) {
          return;
        }

        const devPorts = ports.filter((entry) => {
          const { port } = entry;
          return (
            (port >= 3000 && port <= 3999) ||
            (port >= 4000 && port <= 4999) ||
            (port >= 5000 && port <= 5999) ||
            (port >= 8000 && port <= 8999) ||
            (port >= 9000 && port <= 9999) ||
            port === 1234 ||
            port === 1337 ||
            port === 2222
          );
        });

        setListeningPorts(devPorts.slice(0, 12));
      } catch {
        if (!cancelled) {
          setListeningPorts([]);
        }
      }
    };

    void fetchPorts();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchPorts();
      }
    };

    const interval = setInterval(fetchPorts, 5000);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!showPortsDropdown) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (portsDropdownRef.current?.contains(target)) {
        return;
      }

      setShowPortsDropdown(false);
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, [showPortsDropdown]);

  const runningCount = activeWorkspace?.panes.filter((pane) => pane.status === 'running').length || 0;
  const totalCount = activeWorkspace?.panes.length || 0;

  const handlePortClick = async (port: number) => {
    await window.electron.browser.openExternal({ url: `http://localhost:${port}` });
    setShowPortsDropdown(false);
  };

  return (
    <div className="h-8 bg-bg-secondary border-t border-border-default/60 flex items-center px-4 text-[12px] text-gray-500 flex-shrink-0 gap-0">
      {activeWorkspace ? (
        <>
          <span className="text-gray-300 font-medium">{activeWorkspace.name}</span>
          <span className="mx-3 w-px h-3.5 bg-border-default/60" />
          <span>{totalCount} pane{totalCount !== 1 ? 's' : ''}</span>
          {runningCount > 0 && (
            <span className="ml-1.5 text-accent-blue font-medium">({runningCount} running)</span>
          )}

          {listeningPorts.length > 0 && (
            <>
              <span className="mx-3 w-px h-3.5 bg-border-default/60" />
              <div className="relative" ref={portsDropdownRef}>
                <button
                  className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowPortsDropdown((current) => !current);
                  }}
                  title="Listening ports"
                >
                  <Radio size={12} />
                  <span className="font-mono text-[11px]">
                    {listeningPorts.length <= 3
                      ? listeningPorts.map((entry) => entry.port).join(', ')
                      : `${listeningPorts
                          .slice(0, 2)
                          .map((entry) => entry.port)
                          .join(', ')} +${listeningPorts.length - 2}`}
                  </span>
                </button>
                {showPortsDropdown && (
                  <div
                    className="absolute bottom-full left-0 mb-2 bg-bg-elevated border border-border-default/50 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] py-1.5 min-w-[160px] dropdown-menu z-[100]"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="px-3 py-1.5 text-[11px] text-gray-500 uppercase tracking-wider font-semibold">
                      Listening Ports
                    </div>
                    {listeningPorts.map((entry) => (
                      <button
                        key={entry.port}
                        className="w-full px-3 py-1.5 text-left text-[12px] text-gray-300 hover:bg-white/5 hover:text-gray-100 flex items-center gap-2 transition-colors font-mono"
                        onClick={() => {
                          void handlePortClick(entry.port);
                        }}
                        title={`Open localhost:${entry.port}`}
                      >
                        <Radio size={10} className="text-accent-green" />
                        :{entry.port}
                        <span className="text-[10px] text-gray-600 ml-auto">PID {entry.pid}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <span className="mx-3 w-px h-3.5 bg-border-default/60" />
          <span
            className="opacity-50 truncate max-w-[350px] font-mono text-[11px]"
            title={activeWorkspace.cwd}
          >
            {activeWorkspace.cwd}
          </span>
        </>
      ) : (
        <span className="text-gray-500">No workspace selected</span>
      )}
      <span className="flex-1" />
      <span className="text-gray-500/60 font-mono text-[11px] mr-3" title="Session duration">
        {elapsed}
      </span>
      <NotificationPanel />
    </div>
  );
}
