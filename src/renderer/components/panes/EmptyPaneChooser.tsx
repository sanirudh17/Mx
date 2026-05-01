import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { TerminalSquare, Bot, Compass } from 'lucide-react';
import PresetPicker from '../presets/PresetPicker';

interface Props {
  workspaceId: string;
  paneId: string;
}

export default function EmptyPaneChooser({ workspaceId, paneId }: Props) {
  const { convertPane, presets } = useAppStore();
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [presetType, setPresetType] = useState<'agent' | 'browser'>('agent');

  const handleAgent = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPresetType('agent');
    setShowPresetPicker(true);
  };

  const handleTerminal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await convertPane(workspaceId, paneId, 'terminal');
  };

  const handleBrowser = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPresetType('browser');
    setShowPresetPicker(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPresetPicker(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePresetSelect = async (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset?.type === 'browser' && preset.targetUrl) {
      await convertPane(workspaceId, paneId, 'browser', { url: preset.targetUrl });
    } else {
      await convertPane(workspaceId, paneId, 'agent', { presetId });
    }
    setShowPresetPicker(false);
  };

  if (showPresetPicker) {
    return (
      <div className="w-full h-full min-w-0 min-h-0 flex items-center justify-center bg-bg-primary p-3" onClick={(e) => { if (e.target === e.currentTarget) setShowPresetPicker(false); }}>
        <div className="relative w-full max-w-[420px]">
          <PresetPicker
            workspaceId={workspaceId}
            paneId={paneId}
            type={presetType}
            position={presetType === 'browser' ? 'right' : 'left'}
            onSelect={() => setShowPresetPicker(false)}
            onClose={() => setShowPresetPicker(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full min-w-0 min-h-0 flex flex-col items-center justify-center bg-bg-primary gap-4 p-3 text-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[#9dafcf] text-[12px] font-medium tracking-wide">Choose what to open</div>
      <div className="grid w-full max-w-[420px] gap-3 [grid-template-columns:repeat(auto-fit,minmax(84px,1fr))]">
        <button
          onClick={handleAgent}
          className="mx-obsidian-choice flex min-w-0 flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl group"
        >
          <Bot size={24} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
          <span className="text-[12px] font-medium text-gray-400 group-hover:text-gray-100 transition-colors leading-tight">Agent</span>
        </button>

        <button
          onClick={handleTerminal}
          className="mx-obsidian-choice flex min-w-0 flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl group"
        >
          <TerminalSquare size={24} className="text-green-400 group-hover:text-green-300 transition-colors" />
          <span className="text-[12px] font-medium text-gray-400 group-hover:text-gray-100 transition-colors leading-tight">Terminal</span>
        </button>

        <button
          onClick={handleBrowser}
          className="mx-obsidian-choice flex min-w-0 flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl group"
        >
          <Compass size={24} className="text-accent-blue group-hover:text-[#a6b8db] transition-colors" />
          <span className="text-[12px] font-medium text-gray-400 group-hover:text-gray-100 transition-colors leading-tight">Browser</span>
        </button>
      </div>
    </div>
  );
}
