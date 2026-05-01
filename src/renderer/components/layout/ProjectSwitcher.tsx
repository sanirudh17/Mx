import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { FolderOpen, Clock, X, Trash2, Layers } from 'lucide-react';

export default function ProjectSwitcher() {
  const { settings, createWorkspace, workspaces, setActiveWorkspace, deleteWorkspace } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const recentProjects = settings?.recentProjects || [];

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(prev => !prev);
    };
    window.addEventListener('open-project-switcher', handleOpen);
    window.addEventListener('app:openProjectSwitcher', handleOpen);
    return () => {
      window.removeEventListener('open-project-switcher', handleOpen);
      window.removeEventListener('app:openProjectSwitcher', handleOpen);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleBrowse = async () => {
    const dir = await window.electron.app.selectDirectory();
    if (dir) {
      const name = dir.split(/[/\\]/).pop() || 'Workspace';
      await createWorkspace(name, dir);
      setIsOpen(false);
    }
  };

  const handleRecentProject = async (path: string) => {
    const name = path.split(/[/\\]/).pop() || 'Workspace';
    await createWorkspace(name, path);
    setIsOpen(false);
  };

  const handleSwitchToWorkspace = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
    setIsOpen(false);
  };

  const handleDeleteWorkspace = (e: React.MouseEvent, workspaceId: string) => {
    e.stopPropagation();
    const ws = workspaces.find(w => w.id === workspaceId);
    if (ws && confirm(`Delete workspace "${ws.name}"?`)) {
      deleteWorkspace(workspaceId);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-bg-elevated border border-border-default/50 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] w-[480px] max-h-[520px] overflow-hidden modal-backdrop"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <span className="text-[15px] font-semibold text-gray-100 tracking-tight">Open Project</span>
          <button
            onClick={() => setIsOpen(false)}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white rounded-md hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[440px] overflow-y-auto">
          {workspaces.length > 0 && (
            <>
              <div className="px-5 py-2 text-[11px] text-gray-500 uppercase tracking-widest font-semibold flex items-center gap-2">
                <Layers size={11} />
                Open Workspaces
              </div>
              <div className="px-2.5 pb-2">
                {workspaces.map(ws => (
                  <div
                    key={ws.id}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg hover:bg-white/[0.04] cursor-pointer group transition-colors"
                    onClick={() => handleSwitchToWorkspace(ws.id)}
                  >
                    <FolderOpen size={16} className="text-accent-blue flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-gray-200 truncate">{ws.name}</div>
                      <div className="text-[11px] text-gray-500 truncate font-mono mt-0.5">{ws.cwd}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] text-gray-500 px-2 py-0.5 bg-bg-primary/50 rounded-full border border-border-default/50">
                        {ws.panes.length} panes
                      </div>
                      <button
                        onClick={(e) => handleDeleteWorkspace(e, ws.id)}
                        className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-accent-red rounded-md opacity-0 group-hover:opacity-100 hover:bg-accent-red/10 transition-all"
                        title="Delete workspace"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border-default/40 mx-4 my-1" />
            </>
          )}

          <div className="px-2.5 py-1">
            <button
              onClick={handleBrowse}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-[13px] font-medium text-gray-300 hover:bg-white/[0.04] hover:text-white rounded-lg transition-colors"
            >
              <FolderOpen size={18} className="text-accent-blue" />
              <span>Browse for folder...</span>
            </button>
          </div>

          {recentProjects.length > 0 && (
            <>
              <div className="border-t border-border-default/40 mx-4 my-1" />
              <div className="px-5 py-2 text-[11px] text-gray-500 uppercase tracking-widest font-semibold flex items-center gap-2">
                <Clock size={11} />
                Recent Projects
              </div>
              <div className="px-2.5 pb-3">
                {recentProjects.map((path) => (
                  <button
                    key={path}
                    onClick={() => handleRecentProject(path)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[13px] text-gray-300 hover:bg-white/[0.04] hover:text-white rounded-lg transition-colors"
                    title={path}
                  >
                    <FolderOpen size={15} className="text-gray-500 flex-shrink-0" />
                    <span className="font-medium truncate">{path.split(/[/\\]/).pop()}</span>
                    <span className="text-[11px] text-gray-600 truncate flex-1 text-left ml-1 font-mono">{path}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {recentProjects.length === 0 && workspaces.length === 0 && (
            <div className="px-6 py-12 text-center text-[13px] text-gray-500">
              No recent projects. Click "Browse for folder" to get started.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
