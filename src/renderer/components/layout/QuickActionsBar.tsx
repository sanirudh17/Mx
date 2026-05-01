import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import PresetPicker from '../presets/PresetPicker';
import { TerminalSquare, Bot, Compass, Columns, Rows, Save, Settings, FileText } from 'lucide-react';
import { SETTINGS_SHORTCUT_LABEL, TOGGLE_NOTES_SHORTCUT_LABEL } from '../../../common/shortcuts';

interface Props {
  workspaceId: string;
  onSettings: () => void;
}

export default function QuickActionsBar({ workspaceId, onSettings }: Props) {
  const { createPane, splitPane, focusedPaneId, saveSession, activeWorkspaceId, workspaces, presets } = useAppStore();
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [showBrowserPicker, setShowBrowserPicker] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState('');
  const agentRef = useRef<HTMLDivElement>(null);
  const browserRef = useRef<HTMLDivElement>(null);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const focusedPane = activeWorkspace?.panes.find(p => p.id === focusedPaneId);
  const hasNotes = activeWorkspace?.notes && activeWorkspace.notes.length > 0;
  const browserPresets = presets.filter(p => (p.type || 'agent') === 'browser');

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (agentRef.current && !agentRef.current.contains(e.target as Node)) {
        setShowPresetPicker(false);
      }
      if (browserRef.current && !browserRef.current.contains(e.target as Node)) {
        setShowBrowserPicker(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPresetPicker(false);
        setShowBrowserPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleNewTerminal = async () => {
    if (terminalCommand.trim()) {
      await createPane(workspaceId, 'terminal', { command: terminalCommand.trim() });
      setTerminalCommand('');
    } else {
      await createPane(workspaceId, 'terminal');
    }
  };


  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSave = async () => {
    setSaveStatus('saving');
    await saveSession();
    window.dispatchEvent(
      new CustomEvent('trigger-save-template', { detail: { wsId: workspaceId } })
    );
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleSplitH = () => {
    if (focusedPaneId) splitPane(workspaceId, focusedPaneId, 'horizontal');
  };

  const handleSplitV = () => {
    if (focusedPaneId) splitPane(workspaceId, focusedPaneId, 'vertical');
  };

  return (
    <div className="relative z-20 flex h-11 flex-shrink-0 items-center gap-2 border-b border-border-default/70 bg-bg-secondary px-4">
      <div className="flex items-center gap-1.5">
        <button
          className="flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px] font-medium text-gray-400 transition-colors duration-150 hover:bg-white/5 hover:text-gray-100 active:bg-white/10 focus:outline-none focus-visible:bg-white/10"
          onClick={() => handleNewTerminal()}
          title="New Terminal (Ctrl+Shift+T)"
        >
          <TerminalSquare size={16} />
          <span className="hidden sm:inline align-middle translate-y-0.48">Terminal</span>
        </button>

        <div className="relative" ref={agentRef}>
          <button
            className="flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px] font-medium text-gray-400 transition-colors duration-150 hover:bg-white/5 hover:text-gray-100 active:bg-white/10 focus:outline-none focus-visible:bg-white/10"
            onClick={() => { setShowPresetPicker(!showPresetPicker); setShowBrowserPicker(false); }}
            title="New Agent (Ctrl+Shift+A)"
          >
            <Bot size={16} />
            <span className="hidden sm:inline align-middle translate-y-0.48">Agent</span>
          </button>
          {showPresetPicker && (
            <PresetPicker
              workspaceId={workspaceId}
              onSelect={() => setShowPresetPicker(false)}
              onClose={() => setShowPresetPicker(false)}
              type="agent"
            />
          )}
        </div>

        <div className="relative" ref={browserRef}>
          <button
            className="flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px] font-medium text-gray-400 transition-colors duration-150 hover:bg-white/5 hover:text-gray-100 active:bg-white/10 focus:outline-none focus-visible:bg-white/10"
            onClick={() => {
              if (browserPresets.length > 0) {
                setShowBrowserPicker(!showBrowserPicker);
                setShowPresetPicker(false);
              } else {
                createPane(workspaceId, 'browser', { url: 'about:blank' });
              }
            }}
            title="New Browser (Ctrl+Shift+B)"
          >
            <Compass size={16} />
            <span className="hidden sm:inline align-middle translate-y-0.48">Browser</span>
          </button>
          {showBrowserPicker && (
            <PresetPicker
              workspaceId={workspaceId}
              type="browser"
              onSelect={() => setShowBrowserPicker(false)}
              onClose={() => setShowBrowserPicker(false)}
            />
          )}
        </div>
      </div>

      <div className="mx-2 h-4 w-px bg-border-default/50" />

      <div className="flex items-center gap-1.5">
        <button
          className="flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px] font-medium text-gray-500 transition-colors duration-150 hover:bg-white/5 hover:text-gray-100 active:bg-white/10 focus:outline-none focus-visible:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          onClick={handleSplitH}
          title="Split Horizontal (Ctrl+Shift+H)"
          disabled={!focusedPaneId}
        >
          <Columns size={16} />
          <span className="hidden sm:inline align-middle translate-y-0.48">Split H</span>
        </button>
        <button
          className="flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px] font-medium text-gray-500 transition-colors duration-150 hover:bg-white/5 hover:text-gray-100 active:bg-white/10 focus:outline-none focus-visible:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
          onClick={handleSplitV}
          title="Split Vertical (Ctrl+Shift+V)"
          disabled={!focusedPaneId}
        >
          <Rows size={16} />
          <span className="hidden sm:inline align-middle translate-y-0.48">Split V</span>
        </button>
        <div className="mx-2 h-4 w-px bg-border-default/50" />
        <button
          className={`flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px] font-medium transition-colors duration-150 hover:bg-white/5 active:bg-white/10 focus:outline-none focus-visible:bg-white/10 ${saveStatus === 'saved' ? 'bg-white/10 text-accent-blue' : 'text-gray-400 hover:text-gray-100'}`}
          onClick={handleSave}
          title="Save Workspace (Ctrl+Shift+L)"
        >
          <Save size={16} />
          <span className="hidden sm:inline align-middle translate-y-0.48">{saveStatus === 'saved' ? 'Saved!' : 'Save'}</span>
        </button>
      </div>

      <div className="flex-1" />

      <button
        className={`flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px] font-medium transition-colors duration-150 hover:bg-white/5 active:bg-white/10 focus:outline-none focus-visible:bg-white/10 ${hasNotes ? 'bg-white/10 text-accent-blue' : 'text-gray-400 hover:text-gray-100'}`}
        onClick={() => {
          window.dispatchEvent(new CustomEvent('toggle-notes'));
        }}
        title={`Notes (${TOGGLE_NOTES_SHORTCUT_LABEL})`}
      >
        <FileText size={16} />
        <span className="hidden sm:inline align-middle translate-y-0.48">Notes</span>
      </button>

      <button
        className="flex items-center justify-center rounded-sm px-2 py-1.5 text-gray-400 transition-colors duration-150 hover:bg-white/5 hover:text-gray-100 active:bg-white/10 focus:outline-none focus-visible:bg-white/10"
        onClick={onSettings}
        title={`Settings (${SETTINGS_SHORTCUT_LABEL})`}
      >
        <Settings size={16} />
      </button>
    </div>
  );
}
