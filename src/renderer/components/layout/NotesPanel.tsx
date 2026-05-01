import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { Workspace } from '../../types';

interface Props {
  workspace: Workspace;
}

export default function NotesPanel({ workspace }: Props) {
  const { updateWorkspace } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => {
      if (workspace) {
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('toggle-notes', handleToggle);
    window.addEventListener('app:toggleNotes', handleToggle);
    return () => {
      window.removeEventListener('toggle-notes', handleToggle);
      window.removeEventListener('app:toggleNotes', handleToggle);
    };
  }, [workspace]);

  const handleNotesChange = (newNotes: string) => {
    const updated = { ...workspace, notes: newNotes };
    updateWorkspace(updated);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="absolute top-0 right-0 bottom-0 w-[300px] bg-bg-secondary border-l border-border-default/60 z-30 flex flex-col shadow-[−8px_0_24px_rgba(0,0,0,0.3)]"
      style={{ animation: 'slideInRight 0.25s ease-out' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default/50">
        <span className="text-[13px] font-semibold text-gray-300 tracking-wide">Notes</span>
        <button
          onClick={() => setIsOpen(false)}
          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <textarea
        className="flex-1 w-full bg-transparent text-gray-200 p-4 text-[13px] leading-relaxed font-mono resize-none focus:outline-none border-none placeholder-gray-600"
        value={workspace.notes || ''}
        onChange={(e) => handleNotesChange(e.target.value)}
        placeholder="Type your notes here..."
        spellCheck={false}
      />
    </div>
  );
}
