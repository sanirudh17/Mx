import { useState, useEffect, useCallback } from 'react';
import { Command } from 'cmdk';
import { useAppStore } from '../../stores/useAppStore';
import {
  TerminalSquare, Bot, Compass, Columns, Rows,
  FileText, FolderOpen, Save, Plus, X, RefreshCw,
  Copy, ExternalLink, Layout, Clock, Globe, Zap, Camera, Settings2, PanelTop
} from 'lucide-react';
import { requestPaneScreenshot } from '../../utils/paneScreenshot';
import {
  CLOSE_PANE_SHORTCUT_LABEL,
  NEXT_WORKSPACE_SHORTCUT_LABEL,
  NEW_AGENT_SHORTCUT_LABEL,
  NEW_BROWSER_SHORTCUT_LABEL,
  NEW_TERMINAL_SHORTCUT_LABEL,
  NEW_WORKSPACE_SHORTCUT_LABEL,
  PREVIOUS_WORKSPACE_SHORTCUT_LABEL,
  SAVE_WORKSPACE_SHORTCUT_LABEL,
  SETTINGS_SHORTCUT_LABEL,
  SPLIT_HORIZONTAL_SHORTCUT_LABEL,
  SPLIT_VERTICAL_SHORTCUT_LABEL,
  TAKE_SCREENSHOT_SHORTCUT_LABEL,
  TERMINAL_FIND_SHORTCUT_LABEL,
  TOGGLE_NOTES_SHORTCUT_LABEL,
  TOGGLE_ACTION_BAR_SHORTCUT_LABEL
} from '../../../common/shortcuts';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);

  const {
    workspaces, activeWorkspaceId, focusedPaneId, presets,
    createPane, closePane, splitPane, restartPane,
    setActiveWorkspace, recentCommands, recentUrls,
    focusNextWorkspace, focusPreviousWorkspace
  } = useAppStore();

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const focusedPane = activeWorkspace?.panes.find(p => p.id === focusedPaneId);

  // Listen for toggle event
  useEffect(() => {
    const handler = () => setOpen(prev => !prev);
    window.addEventListener('toggle-command-palette', handler);
    window.addEventListener('app:toggleCommandPalette', handler);
    return () => {
      window.removeEventListener('toggle-command-palette', handler);
      window.removeEventListener('app:toggleCommandPalette', handler);
    };
  }, []);

  // Close command palette
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const runAction = useCallback((fn: () => void) => {
    fn();
    close();
  }, [close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
      <div className="absolute left-1/2 top-[18%] -translate-x-1/2 w-full max-w-[580px] command-palette-enter">
        <Command
          className="bg-bg-elevated border border-border-default/50 rounded-2xl shadow-[0_12px_60px_rgba(0,0,0,0.7)] overflow-hidden"
          loop
        >
          <Command.Input
            className="w-full px-6 py-4.5 bg-transparent text-[14px] text-gray-100 placeholder-gray-500 outline-none border-b border-border-default/50"
            placeholder="Type a command or search..."
            autoFocus
          />
          <Command.List className="max-h-[420px] overflow-y-auto p-2">
            <Command.Empty className="px-6 py-10 text-center text-[13px] text-gray-500">
              No results found.
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading="Quick Actions">
              <PaletteItem
                icon={<TerminalSquare size={14} />}
                label="New Terminal"
                shortcut={NEW_TERMINAL_SHORTCUT_LABEL}
                onSelect={() => runAction(() => activeWorkspaceId && createPane(activeWorkspaceId, 'terminal'))}
              />
              <PaletteItem
                icon={<Bot size={14} />}
                label="New Agent"
                shortcut={NEW_AGENT_SHORTCUT_LABEL}
                onSelect={() => runAction(() => {
                  window.dispatchEvent(new CustomEvent('app:newAgent'));
                })}
              />
              <PaletteItem
                icon={<Compass size={14} />}
                label="New Browser"
                shortcut={NEW_BROWSER_SHORTCUT_LABEL}
                onSelect={() => runAction(() => activeWorkspaceId && createPane(activeWorkspaceId, 'browser', { url: 'https://google.com' }))}
              />
              <PaletteItem
                icon={<Columns size={14} />}
                label="Split Horizontal"
                shortcut={SPLIT_HORIZONTAL_SHORTCUT_LABEL}
                onSelect={() => runAction(() => activeWorkspaceId && focusedPaneId && splitPane(activeWorkspaceId, focusedPaneId, 'horizontal'))}
              />
              <PaletteItem
                icon={<Rows size={14} />}
                label="Split Vertical"
                shortcut={SPLIT_VERTICAL_SHORTCUT_LABEL}
                onSelect={() => runAction(() => activeWorkspaceId && focusedPaneId && splitPane(activeWorkspaceId, focusedPaneId, 'vertical'))}
              />


              <PaletteItem
                icon={<FileText size={14} />}
                label="Toggle Notes Panel"
                shortcut={TOGGLE_NOTES_SHORTCUT_LABEL}
                onSelect={() => runAction(() => window.dispatchEvent(new CustomEvent('app:toggleNotes')))}
              />
              <PaletteItem
                icon={<PanelTop size={14} />}
                label="Toggle Action Bar"
                shortcut={TOGGLE_ACTION_BAR_SHORTCUT_LABEL}
                onSelect={() => runAction(() => window.dispatchEvent(new CustomEvent('app:toggleQuickActionsBar')))}
              />
              <PaletteItem
                icon={<Settings2 size={14} />}
                label="Open Settings"
                shortcut={SETTINGS_SHORTCUT_LABEL}
                onSelect={() => runAction(() => window.dispatchEvent(new CustomEvent('app:openSettings')))}
              />
              <PaletteItem
                icon={<FolderOpen size={14} />}
                label="Open Project Folder"
                onSelect={() => runAction(() => {
                  if (activeWorkspace?.cwd) window.electron.app.openInExplorer({ path: activeWorkspace.cwd });
                })}
              />
              <PaletteItem
                icon={<Save size={14} />}
                label="Save Layout as Template"
                shortcut={SAVE_WORKSPACE_SHORTCUT_LABEL}
                onSelect={() => runAction(() => window.dispatchEvent(new CustomEvent('app:saveWorkspace')))}
              />
            </Command.Group>

            {/* Workspaces */}
            <Command.Group heading="Workspaces">
              {workspaces.map(ws => {
                const running = ws.panes.filter(p => p.status === 'running').length;
                return (
                  <PaletteItem
                    key={ws.id}
                    icon={<Layout size={14} />}
                    label={ws.name}
                    suffix={`${ws.panes.length} panes${running > 0 ? ` - ${running} running` : ''}`}
                    onSelect={() => runAction(() => setActiveWorkspace(ws.id))}
                    active={ws.id === activeWorkspaceId}
                  />
                );
              })}
              <PaletteItem
                icon={<Plus size={14} />}
                label="Create New Workspace"
                shortcut={NEW_WORKSPACE_SHORTCUT_LABEL}
                onSelect={() => runAction(() => {
                  window.dispatchEvent(new CustomEvent('app:newWorkspace'));
                })}
              />
              <PaletteItem
                icon={<Layout size={14} />}
                label="Next Workspace"
                shortcut={NEXT_WORKSPACE_SHORTCUT_LABEL}
                onSelect={() => runAction(() => focusNextWorkspace())}
              />
              <PaletteItem
                icon={<Layout size={14} />}
                label="Previous Workspace"
                shortcut={PREVIOUS_WORKSPACE_SHORTCUT_LABEL}
                onSelect={() => runAction(() => focusPreviousWorkspace())}
              />
            </Command.Group>

            {/* Focused Pane Actions */}
            {focusedPane && (
              <Command.Group heading={`Pane: ${focusedPane.label}`}>
                {(focusedPane.type === 'terminal' || focusedPane.type === 'agent') && (
                  <PaletteItem
                    icon={<RefreshCw size={14} />}
                    label="Restart This Pane"
                    onSelect={() => runAction(() => {
                      if (!activeWorkspaceId) return;
                      restartPane(activeWorkspaceId, focusedPane.id);
                    })}
                  />
                )}
                <PaletteItem
                  icon={<X size={14} />}
                  label="Close This Pane"
                  shortcut={CLOSE_PANE_SHORTCUT_LABEL}
                  onSelect={() => runAction(() => activeWorkspaceId && closePane(activeWorkspaceId, focusedPane.id))}
                />

                {(focusedPane.type === 'terminal' || focusedPane.type === 'agent') && (
                  <PaletteItem
                    icon={<RefreshCw size={14} />}
                    label="Find in Terminal"
                    shortcut={TERMINAL_FIND_SHORTCUT_LABEL}
                    onSelect={() => runAction(() => window.dispatchEvent(new CustomEvent('app:openTerminalFind')))}
                  />
                )}
                <PaletteItem
                  icon={<Copy size={14} />}
                  label="Duplicate This Pane"
                  onSelect={() => runAction(() => {
                    if (!activeWorkspaceId) return;
                    if (focusedPane.type === 'browser') {
                      createPane(activeWorkspaceId, 'browser', { url: (focusedPane as any).url });
                    } else if (focusedPane.type === 'agent') {
                      createPane(activeWorkspaceId, 'agent', { presetId: (focusedPane as any).presetId });
                    } else {
                      createPane(activeWorkspaceId, 'terminal');
                    }
                  })}
                />
                {focusedPane.type === 'browser' && (
                  <PaletteItem
                    icon={<Camera size={14} />}
                    label="Take screenshot"
                    shortcut={TAKE_SCREENSHOT_SHORTCUT_LABEL}
                    onSelect={() => runAction(() => {
                      requestPaneScreenshot(focusedPane.id);
                    })}
                  />
                )}
                {focusedPane.type === 'browser' && (
                  <PaletteItem
                    icon={<ExternalLink size={14} />}
                    label="Open in External Browser"
                    onSelect={() => runAction(() => {
                      window.electron.browser.openExternal({ url: (focusedPane as any).url });
                    })}
                  />
                )}
                {focusedPane.type !== 'browser' && focusedPane.cwd && (
                  <PaletteItem
                    icon={<FolderOpen size={14} />}
                    label="Open Folder in Explorer"
                    onSelect={() => runAction(() => {
                      window.electron.app.openInExplorer({ path: focusedPane.cwd! });
                    })}
                  />
                )}
              </Command.Group>
            )}

            {/* Agent Presets */}
            {presets.length > 0 && (
              <Command.Group heading="Agent Presets">
                {presets.map(preset => (
                  <PaletteItem
                    key={preset.id}
                    icon={preset.icon ? <span className="text-sm">{preset.icon}</span> : <Zap size={14} />}
                    label={preset.name}
                    suffix={preset.type === 'browser' ? 'Browser' : 'Agent'}
                    onSelect={() => runAction(() => {
                      if (!activeWorkspaceId) return;
                      if (preset.type === 'browser') {
                        createPane(activeWorkspaceId, 'browser', { url: preset.targetUrl || 'about:blank' });
                      } else {
                        createPane(activeWorkspaceId, 'agent', { presetId: preset.id });
                      }
                    })}
                  />
                ))}
              </Command.Group>
            )}

            {/* Recent Items */}
            {recentCommands.length > 0 && (
              <Command.Group heading="Recent Commands">
                {recentCommands.slice(0, 8).map(cmd => (
                  <PaletteItem
                    key={cmd.id}
                    icon={<Clock size={14} />}
                    label={cmd.command}
                    suffix={cmd.workspaceId === activeWorkspaceId ? 'Run here' : 'Run in new terminal'}
                    onSelect={() => runAction(() => {
                      if (activeWorkspaceId) createPane(activeWorkspaceId, 'terminal', { command: cmd.command });
                    })}
                  />
                ))}
              </Command.Group>
            )}
            {recentUrls.length > 0 && (
              <Command.Group heading="Recent URLs">
                {recentUrls.slice(0, 8).map(url => (
                  <PaletteItem
                    key={url.id}
                    icon={<Globe size={14} />}
                    label={url.title || url.url}
                    suffix={url.title ? url.url.replace(/^https?:\/\//, '') : 'Open URL'}
                    onSelect={() => runAction(() => {
                      if (activeWorkspaceId) createPane(activeWorkspaceId, 'browser', { url: url.url });
                    })}
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

interface PaletteItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  suffix?: string;
  onSelect: () => void;
  active?: boolean;
}

function PaletteItem({ icon, label, shortcut, suffix, onSelect, active }: PaletteItemProps) {
  return (
    <Command.Item
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] text-gray-300 cursor-pointer data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-white transition-colors group"
      onSelect={onSelect}
      value={label}
    >
      <span className="text-gray-500 group-data-[selected=true]:text-accent-blue flex-shrink-0 w-5 flex items-center justify-center">{icon}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {active && (
        <span className="text-[10px] uppercase tracking-widest bg-accent-blue/15 text-accent-blue px-2 py-0.5 rounded-full font-semibold flex-shrink-0">Active</span>
      )}
      {suffix && !active && (
        <span className="text-[11px] text-gray-500 flex-shrink-0">{suffix}</span>
      )}
      {shortcut && (
        <span className="text-[10px] text-gray-500 bg-bg-primary/60 border border-border-default/40 px-2 py-0.5 rounded-md font-mono flex-shrink-0 tracking-wide">{shortcut}</span>
      )}
    </Command.Item>
  );
}
