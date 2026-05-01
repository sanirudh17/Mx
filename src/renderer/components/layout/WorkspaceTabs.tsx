import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Plus, X, Save, Pencil, PanelLeft } from 'lucide-react';
import type { Workspace, Pane } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { dispatchAppNotification } from '../../utils/notifications';

interface Props {
  onNewWorkspace: () => void;
  vertical?: boolean;
  sidebarWidth?: number;
}

export default function WorkspaceTabs({ onNewWorkspace, vertical = false, sidebarWidth = 60 }: Props) {
  const {
    workspaces,
    activeWorkspaceId,
    notificationHistory,
    setActiveWorkspace,
    deleteWorkspace,
    renameWorkspace,
    settings,
    updateSettings
  } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ wsId: string; x: number; y: number } | null>(null);
  const [saveTemplateFor, setSaveTemplateFor] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contextMenuItemClass = 'flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] font-medium transition-colors';
  const contextMenuIconClass = 'flex-shrink-0 w-4 h-4 flex items-center justify-center';

  const notificationBadges = notificationHistory.reduce<Record<string, { count: number; hasError: boolean }>>((acc, notification) => {
    if (!notification.sourceWorkspaceId || notification.dismissed) {
      return acc;
    }

    const currentBadge = acc[notification.sourceWorkspaceId] ?? { count: 0, hasError: false };
    acc[notification.sourceWorkspaceId] = {
      count: currentBadge.count + 1,
      hasError: currentBadge.hasError || notification.kind === 'error'
    };
    return acc;
  }, {});

  useEffect(() => {
    const handleGlobalSave = (e: Event) => {
      const customEvent = e as CustomEvent<{ wsId: string }>;
      setSaveTemplateFor(customEvent.detail.wsId);
      setTemplateName(workspaces.find(w => w.id === customEvent.detail.wsId)?.name || 'New Template');
    };
    window.addEventListener('trigger-save-template', handleGlobalSave);
    return () => window.removeEventListener('trigger-save-template', handleGlobalSave);
  }, [workspaces]);

  const handleDoubleClick = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
    setTimeout(() => inputRef.current?.select(), 10);
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      renameWorkspace(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleContextMenu = (e: React.MouseEvent, ws: Workspace) => {
    e.preventDefault();
    setContextMenu({ wsId: ws.id, x: e.clientX, y: e.clientY });
  };

  const handleSaveAsTemplate = () => {
    if (saveTemplateFor) {
      const ws = workspaces.find(w => w.id === saveTemplateFor);
      if (ws && templateName.trim()) {
        const newTemplate = {
          id: uuidv4(),
          name: templateName.trim(),
          layout: JSON.parse(JSON.stringify(ws.layout)),
          panes: JSON.parse(JSON.stringify(ws.panes)),
          createdAt: new Date().toISOString()
        };
        const currentTemplates = settings?.layoutTemplates || [];
        updateSettings({ layoutTemplates: [...currentTemplates, newTemplate] });
        dispatchAppNotification({
          title: 'Template saved',
          body: `"${newTemplate.name}" is now available in layout templates.`,
          kind: 'success'
        });
      }
      setSaveTemplateFor(null);
      setTemplateName('');
    }
  };

  const handleDeleteWorkspace = () => {
    if (contextMenu) {
      const ws = workspaces.find(w => w.id === contextMenu.wsId);
      if (ws && confirm(`Delete workspace "${ws.name}"?`)) {
        deleteWorkspace(contextMenu.wsId);
        dispatchAppNotification({
          title: 'Workspace closed',
          body: `"${ws.name}" has been removed.`,
          kind: 'info'
        });
      }
      setContextMenu(null);
    }
  };

  const handleMouseEnter = (e: React.MouseEvent, ws: Workspace) => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredId(ws.id);
      setHoverPos({ x: e.clientX, y: e.clientY });
    }, 500);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoveredId(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-accent-blue';
      case 'idle': return 'bg-gray-400';
      case 'exited': return 'bg-green-400';
      case 'error': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  const getPaneTypeIcon = (type: string) => {
    switch (type) {
      case 'terminal': return 'T';
      case 'agent': return 'A';
      case 'browser': return 'B';
      case 'empty': return 'E';
      default: return '?';
    }
  };

  const hoveredWorkspace = workspaces.find(w => w.id === hoveredId);

  const handleSelectWorkspace = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
  };

  const renderWorkspaceBadge = (workspaceId: string, compact = false) => {
    const badge = notificationBadges[workspaceId];
    if (!badge) {
      return null;
    }

    const label = badge.count > 9 ? '9+' : `${badge.count}`;
    const toneClass = badge.hasError
      ? 'bg-accent-red shadow-[0_0_10px_rgba(239,68,68,0.35)]'
      : 'bg-accent-blue shadow-[0_0_10px_rgba(139,159,198,0.4)]';

    return (
      <span
        className={`flex items-center justify-center rounded-full text-white font-semibold select-none ${toneClass} ${
          compact
            ? 'min-w-[14px] h-[14px] px-1 text-[8px]'
            : 'min-w-[15px] h-[15px] px-1 text-[9px]'
        }`}
      >
        <span className="leading-none tabular-nums translate-x-[0.25px]">{label}</span>
      </span>
    );
  };

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) setContextMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const renderVerticalTabs = () => (
    <div 
      className="h-full bg-bg-secondary border-r border-border-default/60 flex flex-col flex-shrink-0 overflow-y-auto overflow-x-hidden transition-[width] duration-200 ease-in-out"
      style={{ width: sidebarWidth }}
    >
      {/* Toggle and Add buttons row */}
      <div className="h-11 flex-shrink-0 flex items-center justify-between px-3 border-b border-border-default/40">
        {!settings?.sidebarCollapsed && (
          <span className="text-[12px] font-medium text-gray-500 truncate mr-2 tracking-wide">Workspaces</span>
        )}
        <div className={`flex items-center flex-shrink-0 ${settings?.sidebarCollapsed ? 'w-full justify-center' : 'gap-1'}`}>
          {!settings?.sidebarCollapsed && (
            <button
              className="h-7 w-7 flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-white/5 active:bg-white/10 rounded-md transition-all duration-200"
              onClick={onNewWorkspace}
              title="New Workspace"
            >
              <Plus size={16} />
            </button>
          )}
          <button
            className="h-7 w-7 flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-md transition-colors"
            onClick={() => updateSettings({ sidebarCollapsed: !settings?.sidebarCollapsed })}
            title={settings?.sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
          >
            <PanelLeft size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {workspaces.map(ws => (
          <div
            key={ws.id}
            className={`group relative flex items-center cursor-pointer transition-all duration-150 mx-2 overflow-hidden rounded-lg ${
              settings?.sidebarCollapsed ? 'justify-center py-3' : 'gap-3 px-[15px] py-2.5'
            } ${
              ws.id === activeWorkspaceId
                ? 'bg-bg-primary text-gray-100'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
            onClick={() => handleSelectWorkspace(ws.id)}
            onDoubleClick={() => handleDoubleClick(ws.id, ws.name)}
            onContextMenu={(e) => handleContextMenu(e, ws)}
            title={ws.name}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-accent-blue opacity-70 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(139,159,198,0.45)] flex-shrink-0" />
            {settings?.sidebarCollapsed && notificationBadges[ws.id] ? (
              <div className="absolute top-1.5 right-1.5">
                {renderWorkspaceBadge(ws.id, true)}
              </div>
            ) : null}
            {!settings?.sidebarCollapsed && (
              <>
                {editingId === ws.id ? (
                  <input
                    ref={inputRef}
                    className="flex-1 bg-bg-primary border border-border-default rounded-md px-2 py-1 text-[12px] text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent-blue"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => handleRename(ws.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(ws.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 truncate text-[12px] font-medium">{ws.name}</span>
                )}
                {renderWorkspaceBadge(ws.id)}
                <button
                  className="opacity-0 group-hover:opacity-100 hover:bg-accent-red/20 text-gray-500 hover:text-accent-red rounded-md p-1 transition-all flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete workspace "${ws.name}"?`)) {
                      deleteWorkspace(ws.id);
                      dispatchAppNotification({
                        title: 'Workspace closed',
                        body: `"${ws.name}" has been removed.`,
                        kind: 'info'
                      });
                    }
                  }}
                  title="Close Workspace"
                >
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        ))}
        {settings?.sidebarCollapsed && (
          <div
            className="group flex items-center justify-center py-3 cursor-pointer transition-all duration-150 mx-2 mt-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 opacity-70 hover:opacity-100"
            onClick={onNewWorkspace}
            title="New Workspace"
          >
            <Plus size={16} />
          </div>
        )}
      </div>
    </div>
  );

  const renderHorizontalTabs = () => (
    <div className="h-11 bg-bg-secondary border-b border-border-default/60 flex items-end overflow-x-hidden flex-shrink-0 px-3 relative z-30 shadow-sm scrollbar-hide">
      {/* Show Sidebar toggle - only show when vertical tabs is disabled */}
      {/* Intentionally preserved for horizontal tab mode when vertical tabs are totally disabled! */}

      {!settings?.verticalTabs && workspaces.map(ws => (
        <div
          key={ws.id}
          className={`group flex items-center gap-1.5 px-3.5 py-1.5 cursor-pointer transition-all duration-150 min-w-[120px] max-w-[220px] ${
            ws.id === activeWorkspaceId
              ? 'bg-bg-primary text-gray-100 rounded-t-lg border-t border-l border-r border-border-default/40 border-b-2 border-b-accent-blue -mb-px relative z-40'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-t-lg border border-transparent border-b-2 border-b-transparent mb-0.5'
          }`}
          onClick={() => handleSelectWorkspace(ws.id)}
          onDoubleClick={() => handleDoubleClick(ws.id, ws.name)}
          onContextMenu={(e) => handleContextMenu(e, ws)}
          onMouseEnter={(e) => handleMouseEnter(e, ws)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-accent-blue opacity-70 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(139,159,198,0.45)]" />
          {editingId === ws.id ? (
            <input
              ref={inputRef}
              className="bg-bg-primary border border-border-default rounded-md px-2 py-1 flex-1 w-full text-[13px] text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 transition-all font-medium"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={() => handleRename(ws.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRename(ws.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              onClick={e => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span className="truncate flex-1 font-medium tracking-[0.02em] text-[13px]">{ws.name}</span>
          )}
          {notificationBadges[ws.id] ? (
            <div className="ml-0.5 flex items-center self-center">
              {renderWorkspaceBadge(ws.id)}
            </div>
          ) : null}
          <button
            className="opacity-0 group-hover:opacity-100 hover:bg-accent-red/20 text-gray-500 hover:text-accent-red rounded-md p-0.5 transition-all group-hover:scale-100 scale-95"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete workspace "${ws.name}"?`)) {
                deleteWorkspace(ws.id);
                dispatchAppNotification({
                  title: 'Workspace closed',
                  body: `"${ws.name}" has been removed.`,
                  kind: 'info'
                });
              }
            }}
            title="Close Workspace"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      {!settings?.verticalTabs && workspaces.length > 0 && (
        <button
          className="h-8 w-8 text-gray-500 hover:text-gray-200 hover:bg-white/5 active:bg-white/10 rounded-md transition-colors duration-150 ml-1 mb-0.5 flex items-center justify-center focus:outline-none focus-visible:bg-white/10"
          onClick={onNewWorkspace}
          title="New Workspace"
        >
          <Plus size={16} />
        </button>
      )}
    </div>
  );

  const renderOverlays = () => (
    <>
      {hoveredId && hoveredWorkspace && (
        <div
          className="pointer-events-none fixed z-[100] bg-bg-elevated/95 backdrop-blur-sm border border-border-default/50 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] p-4 min-w-[220px] max-w-[320px] transition-opacity duration-200"
          style={{ 
            left: Math.min(hoverPos.x, window.innerWidth - 320), 
            top: Math.min(hoverPos.y + 20, window.innerHeight - 200)
          }}
        >
          <div className="text-sm font-semibold text-gray-100 mb-3 border-b border-border-default/50 pb-2">
            {hoveredWorkspace.name}
          </div>
          <div className="space-y-2">
            {hoveredWorkspace.panes.map((pane: Pane) => (
              <div key={pane.id} className="flex items-center gap-2.5 text-xs bg-bg-primary/30 p-1.5 rounded-lg border border-border-default/30">
                <div className={`w-2 h-2 rounded-full shadow-inner ${getStatusColor(pane.status)}`} />
                <span className="text-gray-500 font-mono font-bold w-4 text-center">{getPaneTypeIcon(pane.type)}</span>
                <span className="text-gray-300 truncate flex-1 font-medium">{pane.label}</span>
                <span className="text-gray-500 text-[10px] uppercase tracking-wider">{pane.type}</span>
              </div>
            ))}
            {hoveredWorkspace.panes.length === 0 && (
              <div className="text-xs text-gray-500 italic p-2 text-center bg-bg-primary/30 rounded-lg">Empty workspace</div>
            )}
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed z-[100] bg-bg-elevated border border-border-default/50 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] py-1.5 min-w-[200px] dropdown-menu overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const ws = workspaces.find(w => w.id === contextMenu.wsId);
              if (ws) {
                setEditingId(ws.id);
                setEditName(ws.name);
                setTimeout(() => inputRef.current?.select(), 10);
              }
              setContextMenu(null);
            }}
            className={`${contextMenuItemClass} text-gray-300 hover:bg-white/[0.06] hover:text-gray-100 group`}
          >
            <span className={`${contextMenuIconClass}`}>
              <Pencil size={15} className="text-gray-500 transition-colors group-hover:text-gray-300" />
            </span>
            <span className="truncate">Rename</span>
          </button>
          <button
            onClick={() => {
              setSaveTemplateFor(contextMenu.wsId);
              setTemplateName('');
              setContextMenu(null);
            }}
            className={`${contextMenuItemClass} text-gray-300 hover:bg-white/[0.06] hover:text-gray-100 group`}
          >
            <span className={`${contextMenuIconClass}`}>
              <Save size={15} className="text-gray-500 transition-colors group-hover:text-gray-300" />
            </span>
            <span className="truncate">Save Layout as Template</span>
          </button>
          <button
            onClick={handleDeleteWorkspace}
            className={`${contextMenuItemClass} text-accent-red hover:bg-accent-red/10 group`}
          >
            <span className={`${contextMenuIconClass}`}>
              <X size={15} className="text-accent-red/80 transition-colors group-hover:text-accent-red" />
            </span>
            <span className="truncate">Delete Workspace</span>
          </button>
        </div>
      )}

      {saveTemplateFor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center modal-backdrop p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSaveTemplateFor(null)} />
          <div className="relative bg-bg-elevated border border-border-default/40 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] w-full max-w-[400px] p-7 focus:outline-none">
            <h3 className="text-lg font-semibold text-gray-100 mb-1 tracking-tight">Save Layout Template</h3>
            <p className="text-[13px] text-gray-500 mb-5">Name this layout arrangement to re-use it instantly later.</p>
            <input
              className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2.5 text-[13px] text-gray-100 mb-5 placeholder-gray-600 outline-none focus:ring-1 focus:ring-accent-blue/50 focus:border-accent-blue transition-all"
              placeholder="Template name..."
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveAsTemplate();
                if (e.key === 'Escape') setSaveTemplateFor(null);
              }}
              autoFocus
            />
            <div className="flex justify-between gap-3">
               <button
                className="flex-1 flex justify-center px-5 py-2.5 text-[13px] font-medium text-gray-400 hover:text-gray-200 border border-transparent hover:border-border-default hover:bg-bg-primary rounded-md transition-colors"
                onClick={() => setSaveTemplateFor(null)}
              >
                Cancel
              </button>
              <button
                className="flex-1 flex justify-center px-6 py-2.5 text-[13px] font-medium bg-accent-obsidian text-white rounded-md hover:bg-accent-obsidian-hover active:bg-accent-obsidian-active transition-colors shadow-none"
                onClick={handleSaveAsTemplate}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (vertical) {
    return (
      <>
        {renderVerticalTabs()}
        {renderOverlays()}
      </>
    );
  }

  return (
    <>
      {renderHorizontalTabs()}
      {renderOverlays()}
    </>
  );
}
