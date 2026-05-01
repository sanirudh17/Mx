import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { FolderOpen, Layout, Trash2 } from 'lucide-react';
import { dispatchAppNotification } from '../../utils/notifications';

interface Props {
  onClose: () => void;
}

/* ── Shared form control classes ── */
const inputCls = 'w-full bg-[#22272e] border border-[#3d444d] rounded-lg px-3.5 py-2.5 text-[13px] text-gray-200 placeholder-gray-600 shadow-none outline-none focus:border-accent-blue/60 focus:bg-[#2d333b] transition-all';

const LAYOUT_PREVIEWS = {
  empty: { label: 'Empty', desc: 'Single empty pane' },
  'two-columns': { label: 'Two Columns', desc: 'Side by side panes' },
  'two-rows': { label: 'Two Rows', desc: 'Stacked panes' },
  'big-left': { label: 'Big Left', desc: 'Large left + stacked right' },
  'grid': { label: 'Grid', desc: '2x2 arrangement' }
};

export default function NewWorkspaceModal({ onClose }: Props) {
  const { createWorkspace, settings } = useAppStore();
  const [name, setName] = useState('');
  const [cwd, setCwd] = useState('');
  const [layoutType, setLayoutType] = useState('empty');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const templates = settings?.layoutTemplates || [];
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => {
      if (isMountedRef.current && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 100);
    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    setIsTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const handleInputFocus = () => {
    setIsTyping(true);
  };

  const handleInputBlur = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTimeout(() => setIsTyping(false), 200);
  };

  const handleBrowse = async () => {
    const dir = await window.electron.app.selectDirectory();
    if (dir) {
      setCwd(dir);
      if (!name) {
        const parts = dir.split(/[/\\]/);
        setName(parts[parts.length - 1] || 'Workspace');
      }
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }
    await createWorkspace(name.trim(), cwd.trim(), layoutType, selectedTemplate || undefined);
    dispatchAppNotification({
      title: 'Workspace created',
      body: `"${name.trim()}" is ready to use.`,
      kind: 'success'
    });
    onClose();
  };

  const handleDeleteTemplate = (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation();
    if (confirm('Delete this template?')) {
      const newTemplates = templates.filter(t => t.id !== templateId);
      useAppStore.getState().updateSettings({ layoutTemplates: newTemplates });
      if (selectedTemplate === templateId) {
        setSelectedTemplate(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-bg-elevated border border-[#444c56] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] w-full max-w-[520px] max-h-[85vh] overflow-hidden flex flex-col"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 pt-6 pb-1 bg-transparent flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-100 tracking-tight">New Workspace</h2>
          <button
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#444c56] rounded-md transition-colors"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          {error && (
            <div className="mb-5 px-4 py-2.5 bg-accent-red/10 border border-accent-red/20 rounded-lg text-[13px] text-accent-red flex items-center">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Workspace Name */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-widest">Workspace Name</label>
              <input
                ref={inputRef}
                className={inputCls}
                placeholder="e.g. My Project"
                value={name}
                onChange={handleNameChange}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>

            {/* Project Directory */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-widest">Project Directory</label>
              <div className="flex">
                <input
                  className={`flex-1 bg-[#22272e] border border-[#3d444d] border-r-0 rounded-l-lg px-3.5 py-2.5 text-[13px] text-gray-200 placeholder-gray-600 shadow-none outline-none focus:border-accent-blue/60 focus:bg-[#2d333b] transition-all z-10`}
                  placeholder="Select a folder..."
                  value={cwd}
                  onChange={e => setCwd(e.target.value)}
                />
                <button
                  className="mx-obsidian-pill px-4 py-2.5 rounded-r-lg text-[13px] hover:text-white flex items-center gap-2 transition-colors shadow-none"
                  onClick={handleBrowse}
                >
                  <FolderOpen size={15} />
                  Browse
                </button>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">Optional. Defaults to home directory if not set.</p>
            </div>

            {/* Layout */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-2.5 uppercase tracking-widest">Layout</label>
              <div className="grid grid-cols-5 gap-2.5">
                {Object.entries(LAYOUT_PREVIEWS).map(([key, { label, desc }]) => (
                  <button
                    key={key}
                    onClick={() => { setLayoutType(key); setSelectedTemplate(null); }}
                    className={`p-3 rounded-xl border text-center transition-all duration-150 ${
                      layoutType === key && !selectedTemplate
                        ? 'mx-obsidian-selection shadow-none'
                        : 'border-[#3d444d] hover:border-border-active/70 bg-[#22272e] hover:bg-[#2d333b] shadow-none'
                    }`}
                    title={desc}
                  >
                    <LayoutPreview type={key} active={layoutType === key && !selectedTemplate} />
                    <div className={`text-[10px] mt-2 font-medium ${layoutType === key && !selectedTemplate ? 'text-gray-100' : 'text-gray-500'}`}>{label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Saved Templates */}
            {templates.length > 0 && (
              <div className="pt-3 mt-2 border-t border-[#444c56]">
                <label className="block text-[11px] font-semibold text-gray-500 mb-2.5 uppercase tracking-widest">Saved Templates</label>
                <div className="space-y-2">
                  {templates.map(template => (
                    <div
                      key={template.id}
                      onClick={() => { setSelectedTemplate(template.id); setLayoutType('template'); }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150 ${
                        selectedTemplate === template.id
                          ? 'mx-obsidian-selection shadow-none'
                          : 'border-[#3d444d] hover:border-border-active/70 bg-[#22272e] hover:bg-[#2d333b] shadow-none'
                      }`}
                    >
                      <Layout size={15} className={`${selectedTemplate === template.id ? 'text-[#dbe4f5]' : 'text-gray-500'}`} />
                      <span className={`flex-1 text-[13px] ${selectedTemplate === template.id ? 'text-gray-100 font-medium' : 'text-gray-400'}`}>{template.name}</span>
                      <button
                        onClick={(e) => handleDeleteTemplate(e, template.id)}
                        className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-accent-red hover:bg-accent-red/10 rounded-md transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-[#444c56] bg-transparent flex justify-end gap-3">
          <button
            className="px-5 py-2 text-[13px] font-medium text-gray-400 hover:text-gray-200 hover:bg-[#444c56] rounded-lg transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="mx-obsidian-button px-6 py-2 text-white text-[13px] font-medium rounded-lg shadow-none"
            onClick={handleCreate}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function LayoutPreview({ type, active }: { type: string; active?: boolean }) {
  const borderCls = active ? 'border-[#7084a8]' : 'border-[#6e7681]';
  
  switch (type) {
    case 'empty':
      return (
        <div className="w-full h-10 flex items-center justify-center">
          <div className={`w-8 h-6 border border-dashed ${borderCls} rounded`} />
        </div>
      );
    case 'two-columns':
      return (
        <div className="w-full h-10 flex items-center justify-center gap-0.5">
          <div className={`w-1/2 h-full border ${borderCls} rounded-l`} />
          <div className={`w-1/2 h-full border ${borderCls} rounded-r`} />
        </div>
      );
    case 'two-rows':
      return (
        <div className="w-full h-10 flex flex-col items-center justify-center gap-0.5">
          <div className={`w-full h-1/2 border ${borderCls} rounded-t`} />
          <div className={`w-full h-1/2 border ${borderCls} rounded-b`} />
        </div>
      );
    case 'big-left':
      return (
        <div className="w-full h-10 flex items-center justify-center gap-0.5">
          <div className={`w-3/5 h-full border ${borderCls} rounded-l`} />
          <div className="w-2/5 h-full flex flex-col gap-0.5">
            <div className={`w-full h-1/2 border ${borderCls} rounded-tr`} />
            <div className={`w-full h-1/2 border ${borderCls} rounded-br`} />
          </div>
        </div>
      );
    case 'grid':
      return (
        <div className="w-full h-10 flex flex-col items-center justify-center gap-0.5">
          <div className="w-full flex gap-0.5 h-[18px]">
            <div className={`w-1/2 border ${borderCls} rounded-tl`} />
            <div className={`w-1/2 border ${borderCls} rounded-tr`} />
          </div>
          <div className="w-full flex gap-0.5 h-[18px]">
            <div className={`w-1/2 border ${borderCls} rounded-bl`} />
            <div className={`w-1/2 border ${borderCls} rounded-br`} />
          </div>
        </div>
      );
    default:
      return null;
  }
}
