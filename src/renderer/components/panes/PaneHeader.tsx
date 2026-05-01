import { useEffect, useState } from 'react';
import type { Pane } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import { MoreVertical, X, Circle, RefreshCw, FolderOpen, ExternalLink, Terminal, Camera } from 'lucide-react';
import { requestPaneScreenshot } from '../../utils/paneScreenshot';

interface Props {
  pane: Pane;
  workspaceId: string;
}

export default function PaneHeader({ pane, workspaceId }: Props) {
  const { updatePane, closePane, settings, restartPane } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(pane.label);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleRename = () => {
    if (editLabel.trim()) {
      updatePane(workspaceId, pane.id, { label: editLabel.trim() });
    } else {
      setEditLabel(pane.label);
    }
    setIsEditing(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleOpenInExplorer = () => {
    if (pane.cwd) {
      window.electron.app.openInExplorer({ path: pane.cwd });
    }
    setShowContextMenu(false);
  };

  const handleRestart = async () => {
    await restartPane(workspaceId, pane.id);
    setShowContextMenu(false);
  };

  const handleOpenExternal = async () => {
    if (pane.type === 'browser') {
      await window.electron.browser.openExternal({ url: pane.url });
    }
    setShowContextMenu(false);
  };

  const handleDevTools = () => {
    if (pane.type === 'browser') {
      window.dispatchEvent(new CustomEvent('webview:devtools', { detail: { paneId: pane.id } }));
    }
    setShowContextMenu(false);
  };

  const colorTags = settings?.colorTags || [];

  useEffect(() => {
    if (!showContextMenu) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowContextMenu(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showContextMenu]);

  return (
    <div
      className="flex items-center gap-2 border-b border-border-default/70 bg-bg-secondary px-3 select-none"
      style={{ height: settings?.paneHeaderHeight || 32 }}
      onContextMenu={handleContextMenu}
    >
      {settings?.showStatusDots !== false && (
        <div className={`status-dot ${pane.status}`} title={pane.status} />
      )}

      {pane.colorTag && (
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: pane.colorTag }}
        />
      )}

      {isEditing ? (
        <input
          className="mx-input flex-1 min-w-0 text-[12px]"
          value={editLabel}
          onChange={e => setEditLabel(e.target.value)}
          onBlur={handleRename}
          onKeyDown={e => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') { setEditLabel(pane.label); setIsEditing(false); }
          }}
          autoFocus
        />
      ) : (
        <span
          className="flex-1 truncate text-[12px] leading-none translate-y-[1px] font-medium text-gray-300 cursor-pointer hover:text-white"
          onDoubleClick={() => setIsEditing(true)}
        >
          {pane.label}
        </span>
      )}

      {pane.type === 'browser' && (
        <span className="text-xs text-gray-500 truncate max-w-[150px]" title={pane.url}>
          {pane.url.replace(/^https?:\/\//, '')}
        </span>
      )}

      <div className="flex items-center gap-1">
        {colorTags.length > 0 && (
          <button
            className="flex h-5 w-5 items-center justify-center rounded-sm border border-transparent text-xs transition-colors hover:border-gray-500"
            style={{ backgroundColor: pane.colorTag || 'transparent' }}
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Color tag"
          >
            {!pane.colorTag && <Circle size={10} className="text-gray-500" />}
          </button>
        )}

        <button
          className="flex h-6 w-6 items-center justify-center rounded-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            setContextPos({ x: e.clientX, y: e.clientY });
            setShowContextMenu(true);
          }}
          title="More actions"
        >
          <MoreVertical size={14} />
        </button>

        {pane.type === 'browser' && (
          <button
            className="flex h-6 w-6 items-center justify-center rounded-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              requestPaneScreenshot(pane.id);
            }}
            title="Take screenshot"
          >
            <Camera size={14} />
          </button>
        )}

        <button
          className="flex h-6 w-6 items-center justify-center rounded-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          onClick={() => closePane(workspaceId, pane.id)}
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {showContextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowContextMenu(false)}
          />
          <div
            className="fixed bg-bg-elevated border border-border-default/60 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] z-50 py-1.5 min-w-[200px] dropdown-menu text-[13px] overflow-hidden"
            style={{
              left: Math.min(contextPos.x, window.innerWidth - 220),
              top: Math.min(contextPos.y, window.innerHeight - 350)
            }}
          >
            <button
              className="w-full px-4 py-2 text-left text-gray-300 hover:bg-white/5 hover:text-gray-100 flex items-center gap-2 transition-colors"
              onClick={() => { setIsEditing(true); setShowContextMenu(false); }}
            >
              Rename
            </button>

            {colorTags.length > 0 && (
              <>
                <div className="px-4 pt-2 pb-1 text-[11px] text-gray-500 uppercase tracking-widest font-semibold">Color Tag</div>
                <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
                  <button
                    className="w-5 h-5 rounded border border-gray-600 hover:border-gray-400 flex items-center justify-center transition-all bg-transparent"
                    onClick={() => { updatePane(workspaceId, pane.id, { colorTag: undefined }); setShowContextMenu(false); }}
                    title="None"
                  >
                    <X size={12} className="text-gray-400" />
                  </button>
                  {colorTags.map(color => (
                    <button
                      key={color}
                      className="w-5 h-5 rounded hover:scale-110 transition-transform shadow-sm"
                      style={{ backgroundColor: color }}
                      onClick={() => { updatePane(workspaceId, pane.id, { colorTag: color }); setShowContextMenu(false); }}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="border-t border-border-default/40 my-1 mx-2" />

            {pane.type !== 'browser' && (
              <>
                <button
                  className="w-full px-4 py-2 text-left text-gray-300 hover:bg-white/5 hover:text-gray-100 flex items-center gap-2.5 transition-colors group"
                  onClick={handleOpenInExplorer}
                >
                  <FolderOpen size={14} className="text-gray-500 group-hover:text-gray-400" />
                  Open in Explorer
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-gray-300 hover:bg-white/5 hover:text-gray-100 flex items-center gap-2.5 transition-colors group"
                  onClick={handleRestart}
                >
                  <RefreshCw size={14} className="text-gray-500 group-hover:text-gray-400" />
                  Restart
                </button>
              </>
            )}

            {pane.type === 'browser' && (
              <>
                <button
                  className="w-full px-4 py-2 text-left text-gray-300 hover:bg-white/5 hover:text-gray-100 flex items-center gap-2.5 transition-colors group"
                  onClick={handleOpenExternal}
                >
                  <ExternalLink size={14} className="text-gray-500 group-hover:text-gray-400" />
                  Open Externally
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-gray-300 hover:bg-white/5 hover:text-gray-100 flex items-center gap-2.5 transition-colors group"
                  onClick={handleDevTools}
                >
                  <Terminal size={14} className="text-gray-500 group-hover:text-gray-400" />
                  Developer Tools
                </button>
              </>
            )}

            <button
              className="w-full px-4 py-2 text-left text-accent-red hover:bg-accent-red/10 flex items-center gap-2.5 transition-colors group mt-1"
              onClick={() => { closePane(workspaceId, pane.id); setShowContextMenu(false); }}
            >
              <X size={14} className="text-accent-red/70 group-hover:text-accent-red" />
              Close Pane
            </button>
          </div>
        </>
      )}
    </div>
  );
}
