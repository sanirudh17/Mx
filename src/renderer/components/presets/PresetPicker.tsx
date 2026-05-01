import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Plus, X } from 'lucide-react';

interface Props {
  workspaceId: string;
  paneId?: string;
  type?: 'agent' | 'browser';
  position?: 'left' | 'right';
  variant?: 'dropdown' | 'modal';
  onSelect: () => void;
  onClose: () => void;
}

export default function PresetPicker({
  workspaceId,
  paneId,
  type = 'agent',
  position = 'left',
  variant = 'dropdown',
  onSelect,
  onClose
}: Props) {
  const { presets, createPane, convertPane } = useAppStore();
  const [showCustom, setShowCustom] = useState(false);
  const [customCommand, setCustomCommand] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!showCustom) {
      return;
    }

    let cancelled = false;
    const focusInput = () => {
      if (cancelled) {
        return;
      }

      inputRef.current?.focus();
      inputRef.current?.select();
    };

    const frameId = window.requestAnimationFrame(focusInput);
    const timeoutId = window.setTimeout(focusInput, 40);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [showCustom]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handlePresetClick = async (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (paneId) {
      if (preset?.type === 'browser') {
        await convertPane(workspaceId, paneId, 'browser', { url: preset.targetUrl || 'about:blank' });
      } else {
        await convertPane(workspaceId, paneId, 'agent', { presetId });
      }
    } else {
      if (preset?.type === 'browser') {
        await createPane(workspaceId, 'browser', { url: preset.targetUrl || 'about:blank' });
      } else {
        await createPane(workspaceId, 'agent', { presetId });
      }
    }
    onSelect();
  };

  const handleCustomCommand = async () => {
    const value = customCommand.trim();
    if (value) {
      if (type === 'browser') {
        if (paneId) {
          await convertPane(workspaceId, paneId, 'browser', { url: value });
        } else {
          await createPane(workspaceId, 'browser', { url: value });
        }
      } else {
        if (paneId) {
          await convertPane(workspaceId, paneId, 'agent', { command: value });
        } else {
          await createPane(workspaceId, 'agent', { command: value });
        }
      }
      setCustomCommand('');
      onSelect();
    }
  };

  const filteredPresets = presets.filter(p => {
    const presetType = p.type || 'agent';
    return !type || presetType === type;
  });

  return (
    <div 
      ref={containerRef}
      className={`bg-bg-elevated border border-border-default/60 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] z-50 dropdown-menu overflow-hidden flex flex-col py-1.5 ${
        variant === 'modal'
          ? 'relative w-full max-w-[420px]'
          : `absolute top-full mt-1 w-72 ${position === 'right' ? 'right-0 left-auto' : 'left-0'}`
      }`}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3.5 pt-2 pb-1.5">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
          {type === 'browser' ? 'Browser Presets' : 'Agent Presets'}
        </span>
        <button
          className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-300 rounded-md hover:bg-white/5 transition-colors"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
          <X size={14} />
        </button>
      </div>
      
      {filteredPresets.length === 0 ? (
        <div className="text-[13px] text-gray-500 px-3.5 py-3 italic">
          No presets yet. Go to Settings to create one.
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto px-1.5">
          {filteredPresets.map(preset => (
            <button
              key={preset.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-left transition-colors group"
              onClick={() => handlePresetClick(preset.id)}
            >
              {preset.icon && <span className="text-base">{preset.icon}</span>}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-gray-100 truncate flex items-center">
                  <span className="font-medium mr-2">{preset.name}</span>
                  {preset.type === 'browser' ? (
                    <span className="mx-obsidian-pill text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-medium">Browser</span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider bg-purple-500/10 text-purple-400 px-2.5 py-0.5 rounded-full font-medium">Agent</span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 font-mono truncate mt-0.5 group-hover:text-gray-400 transition-colors">
                  {preset.type === 'browser' ? preset.targetUrl : preset.command}
                </div>
              </div>
              {preset.colorTag && (
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 opacity-80"
                  style={{ backgroundColor: preset.colorTag }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border-default/40 my-1 mx-2" />

      {showCustom ? (
        <div className="px-2 pb-1 relative">
          <input
            ref={inputRef}
            className="w-full bg-bg-primary border border-border-default/80 rounded-md px-3 py-2 text-[13px] cursor-text text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-accent-blue/50 focus:border-accent-blue transition-all"
            placeholder={type === 'browser' ? "https://..." : "Type any command..."}
            value={customCommand}
            onChange={e => setCustomCommand(e.target.value)}
            onMouseDown={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCustomCommand();
              if (e.key === 'Escape') { setShowCustom(false); setCustomCommand(''); }
            }}
          />
          <div className="flex gap-2 mt-2">
            <button
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-100 hover:bg-bg-primary rounded-md transition-colors"
              onClick={() => { setShowCustom(false); setCustomCommand(''); }}
            >
              Cancel
            </button>
            <button
              className="mx-obsidian-button flex-1 px-3 py-1.5 text-white text-xs font-medium rounded-md"
              onClick={handleCustomCommand}
            >
              {type === 'browser' ? 'Go' : 'Run Command'}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-1.5">
          <button
            className="w-full px-3 py-2.5 text-[13px] font-medium text-gray-400 hover:text-gray-100 hover:bg-white/5 text-left flex items-center gap-2.5 rounded-lg transition-colors"
            onClick={() => setShowCustom(true)}
          >
            <Plus size={16} className="text-[#dbe4f5]" />
            <span>{type === 'browser' ? 'Custom URL...' : 'Custom Command...'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
