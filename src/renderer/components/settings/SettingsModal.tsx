import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { AgentPreset, AppSettings, ShellType } from '../../types';
import { KEYBIND_REFERENCE_SECTIONS } from '../../../common/shortcuts';

interface Props {
  onClose: () => void;
}

type SettingsSectionId =
  | 'general'
  | 'terminal'
  | 'agents'
  | 'appearance'
  | 'keybinds'
  | 'advanced';

const SECTION_ITEMS: Array<{
  id: SettingsSectionId;
  label: string;
  description: string;
}> = [
  { id: 'general', label: 'General', description: 'Workspace startup and defaults' },
  { id: 'terminal', label: 'Terminal', description: 'Typeface and shell behavior' },
  { id: 'agents', label: 'Agents', description: 'Presets and launch profiles' },
  { id: 'appearance', label: 'Appearance', description: 'Layout chrome and density' },
  { id: 'keybinds', label: 'Keybinds', description: 'Current shortcuts reference' },
  { id: 'advanced', label: 'Advanced', description: 'Templates and app actions' }
];

const shellOptions: Array<{ value: ShellType; label: string }> = [
  { value: 'powershell', label: 'PowerShell' },
  { value: 'cmd', label: 'CMD' },
  { value: 'wsl', label: 'WSL' }
];

const terminalFontOptions = [
  'Geist Mono, Consolas, ui-monospace, monospace',
  'Cascadia Code, Consolas, monospace',
  'Fira Code, monospace',
  'JetBrains Mono, monospace',
  'Source Code Pro, monospace',
  'Ubuntu Mono, monospace',
  'Consolas, monospace'
];

function normalizePresetDraft(editingPreset: Partial<AgentPreset>) {
  const type = editingPreset.type || 'agent';
  const cwdMode =
    type === 'browser'
      ? undefined
      : (editingPreset.cwdMode as 'workspace' | 'home' | 'custom' | undefined) || 'workspace';
  const icon = editingPreset.icon?.trim();
  const cwdCustom = editingPreset.cwdCustom?.trim();

  return {
    name: editingPreset.name?.trim() || '',
    type,
    command: type === 'browser' ? undefined : editingPreset.command?.trim() || undefined,
    targetUrl: type === 'browser' ? editingPreset.targetUrl?.trim() || undefined : undefined,
    shell: type === 'browser' ? undefined : ((editingPreset.shell as ShellType) || 'powershell'),
    cwdMode,
    cwdCustom: type === 'browser' || cwdMode !== 'custom' ? undefined : cwdCustom || undefined,
    colorTag: editingPreset.colorTag || '#3b82f6',
    icon: icon || undefined
  };
}

function getPresetValidationError(editingPreset: Partial<AgentPreset> | null): string | null {
  if (!editingPreset) {
    return null;
  }

  const normalized = normalizePresetDraft(editingPreset);

  if (!normalized.name) {
    return 'Preset name is required.';
  }

  if (normalized.type === 'browser' && !normalized.targetUrl) {
    return 'Browser presets need a URL.';
  }

  if (normalized.type === 'agent' && normalized.cwdMode === 'custom' && !normalized.cwdCustom) {
    return 'Custom working directory presets need a path.';
  }

  return null;
}

function SectionShell({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="mx-kicker text-gray-500">{eyebrow}</div>
        <div className="mx-section-title text-gray-100">{title}</div>
        {description ? <p className="max-w-2xl text-[12px] leading-5 text-gray-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function FieldStack({
  label,
  description,
  children
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="mx-kicker text-gray-500">{label}</label>
        {description ? <p className="mt-2 text-[12px] leading-5 text-gray-400">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onToggle
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border-default/70 bg-bg-primary/70 px-3 py-3">
      <div className="space-y-1 pr-4">
        <div className="text-[12px] font-medium text-gray-100">{label}</div>
        <div className="text-[12px] leading-5 text-gray-400">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-checked={checked}
        className="mx-toggle mt-1"
        onClick={onToggle}
      >
        <span className="mx-toggle-thumb" />
      </button>
    </div>
  );
}

function NavItem({
  active,
  label,
  description,
  onClick
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
        active
          ? 'bg-white/10 text-gray-100 shadow-sm'
          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
      }`}
      onClick={onClick}
    >
      <div className="text-[12px] font-medium leading-none">{label}</div>
      <div className="mt-1.5 text-[10px] leading-snug text-gray-500">{description}</div>
    </button>
  );
}

export default function SettingsModal({ onClose }: Props) {
  const {
    presets,
    createPreset,
    updatePreset,
    deletePreset,
    settings,
    updateSettings,
    createWorkspace,
    workspaces,
    saveSession
  } = useAppStore();

  const [activeSection, setActiveSection] = useState<SettingsSectionId>('general');
  const [editingPreset, setEditingPreset] = useState<Partial<AgentPreset> | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; name: string } | null>(null);
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(settings);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const presetNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  useLayoutEffect(() => {
    if (activeSection !== 'agents' || editingPreset === null) {
      return;
    }

    let cancelled = false;
    const focusInput = () => {
      if (cancelled) {
        return;
      }

      presetNameInputRef.current?.focus();
      presetNameInputRef.current?.select();
    };

    const frameId = window.requestAnimationFrame(focusInput);
    const timeoutId = window.setTimeout(focusInput, 40);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [activeSection, editingPreset?.id, editingPreset]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const updateEditingPreset = (patch: Partial<AgentPreset>) => {
    setEditingPreset((current) => (current ? { ...current, ...patch } : current));
  };

  const presetValidationError = getPresetValidationError(editingPreset);
  const canSavePreset = editingPreset !== null && !presetValidationError && !isSavingPreset;
  const handleSavePreset = async () => {
    if (!editingPreset || presetValidationError || isSavingPreset) {
      return;
    }

    const normalizedPreset = normalizePresetDraft(editingPreset);
    setIsSavingPreset(true);

    try {
      if (editingPreset.id) {
        await updatePreset(editingPreset.id, normalizedPreset);
      } else {
        await createPreset(normalizedPreset);
      }
      setEditingPreset(null);
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (confirm('Delete this preset?')) {
      await deletePreset(id);
    }
  };

  const handleSettingChange = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocalSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    await updateSettings({ [key]: value } as Partial<AppSettings>);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('Delete this saved workspace template?')) {
      const templates = localSettings?.layoutTemplates?.filter((template) => template.id !== id) || [];
      await handleSettingChange('layoutTemplates', templates);
    }
  };

  const handleRenameTemplate = async () => {
    if (editingTemplate && editingTemplate.name.trim()) {
      const templates =
        localSettings?.layoutTemplates?.map((template) =>
          template.id === editingTemplate.id ? { ...template, name: editingTemplate.name.trim() } : template
        ) || [];
      await handleSettingChange('layoutTemplates', templates);
    }
    setEditingTemplate(null);
  };

  const handleLaunchTemplate = async (templateId: string, templateName: string) => {
    const dir = await window.electron.app.selectDirectory();
    if (dir) {
      await createWorkspace(templateName, dir, 'empty', templateId);
      onClose();
    }
  };

  const handleReloadApp = async (force = false) => {
    await saveSession();
    if (force) {
      await window.electron.app.forceReload();
      return;
    }
    await window.electron.app.reload();
  };

  const renderGeneral = () => {
    if (!localSettings) {
      return null;
    }

    return (
      <SectionShell
        eyebrow="General"
        title="Workspace defaults"
        description="Core startup and workspace behaviors for Mx."
      >
        <div className="grid gap-4">
          <FieldStack label="Default shell" description="The shell used when a terminal or agent pane launches without an explicit override.">
            <select
              className="mx-select"
              value={localSettings.shell}
              onChange={(event) => void handleSettingChange('shell', event.target.value as ShellType)}
            >
              {shellOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldStack>

          <FieldStack label="Startup behavior" description="Choose what the app should restore when it opens.">
            <div className="grid gap-3">
              <select
                className="mx-select"
                value={localSettings.startupBehavior || 'restore'}
                onChange={(event) =>
                  void handleSettingChange(
                    'startupBehavior',
                    event.target.value as AppSettings['startupBehavior']
                  )
                }
              >
                <option value="restore">Restore last session</option>
                <option value="empty">Start empty</option>
                <option value="specific">Open specific workspace</option>
              </select>
              {localSettings.startupBehavior === 'specific' ? (
                <select
                  className="mx-select"
                  value={localSettings.startupWorkspaceId || ''}
                  onChange={(event) => void handleSettingChange('startupWorkspaceId', event.target.value)}
                >
                  <option value="" disabled>
                    Select workspace...
                  </option>
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </FieldStack>
        </div>
      </SectionShell>
    );
  };

  const renderTerminal = () => {
    if (!localSettings) {
      return null;
    }

    return (
      <SectionShell
        eyebrow="Terminal"
        title="Terminal typography"
        description="Use Geist Mono for terminal and agent content while keeping the shell behavior unchanged."
      >
        <div className="grid gap-4">
          <FieldStack label="Terminal font size" description="Sets the mono text size used by terminals and agent panes.">
            <input
              type="number"
              className="mx-input"
              value={localSettings.terminalFontSize}
              onChange={(event) =>
                void handleSettingChange('terminalFontSize', (parseInt(event.target.value, 10) || 14) as AppSettings['terminalFontSize'])
              }
              min={8}
              max={32}
            />
          </FieldStack>

          <FieldStack label="Terminal font family" description="Choose from the built-in mono stacks or define your own font family string.">
            <div className="grid gap-3">
              <select
                className="mx-select"
                value={
                  terminalFontOptions.includes(localSettings.terminalFontFamily)
                    ? localSettings.terminalFontFamily
                    : 'custom'
                }
                onChange={(event) => {
                  if (event.target.value !== 'custom') {
                    void handleSettingChange('terminalFontFamily', event.target.value);
                  }
                }}
              >
                {terminalFontOptions.map((fontFamily) => (
                  <option key={fontFamily} value={fontFamily}>
                    {fontFamily.split(',')[0]}
                  </option>
                ))}
                <option value="custom">Custom...</option>
              </select>
              <input
                className="mx-input"
                placeholder="Custom font family string"
                value={localSettings.terminalFontFamily}
                onChange={(event) => void handleSettingChange('terminalFontFamily', event.target.value)}
              />
            </div>
          </FieldStack>

          <ToggleRow
            label="Show status dots"
            description="Display pane state indicators in each pane header."
            checked={localSettings.showStatusDots}
            onToggle={() => void handleSettingChange('showStatusDots', !localSettings.showStatusDots)}
          />
        </div>
      </SectionShell>
    );
  };

  const renderAgents = () => (
    <SectionShell
      eyebrow="Agents"
      title="Agent presets"
      description="Manage the commands and browser targets that appear throughout Mx."
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-[12px] leading-5 text-gray-400">Presets define reusable agent and browser launches without changing how panes work.</p>
        <button
          className="mx-button-primary text-[12px] font-medium"
          onClick={() =>
            setEditingPreset({ name: '', type: 'agent', command: '', shell: 'powershell', cwdMode: 'workspace' })
          }
        >
          Add preset
        </button>
      </div>

      {editingPreset ? (
        <div className="mx-panel space-y-5 p-4">
          <div className="space-y-1">
            <div className="mx-kicker text-gray-500">Preset editor</div>
            <div className="mx-subheading text-gray-100">{editingPreset.id ? 'Edit preset' : 'New preset'}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input
              ref={presetNameInputRef}
              className="mx-input"
              placeholder="Name"
              value={editingPreset.name || ''}
              onChange={(event) => updateEditingPreset({ name: event.target.value })}
              autoFocus
            />
            <select
              className="mx-select"
              value={editingPreset.type || 'agent'}
              onChange={(event) => updateEditingPreset({ type: event.target.value as 'agent' | 'browser' })}
            >
              <option value="agent">Agent</option>
              <option value="browser">Browser</option>
            </select>

            {editingPreset.type === 'browser' ? (
              <input
                className="mx-input col-span-2"
                placeholder="Target URL"
                value={editingPreset.targetUrl || ''}
                onChange={(event) => updateEditingPreset({ targetUrl: event.target.value })}
              />
            ) : (
              <>
                <input
                  className="mx-input"
                  placeholder="Command"
                  value={editingPreset.command || ''}
                  onChange={(event) => updateEditingPreset({ command: event.target.value })}
                />
                <select
                  className="mx-select"
                  value={editingPreset.shell || 'powershell'}
                  onChange={(event) => updateEditingPreset({ shell: event.target.value as ShellType })}
                >
                  {shellOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="mx-select"
                  value={editingPreset.cwdMode || 'workspace'}
                  onChange={(event) =>
                    updateEditingPreset({ cwdMode: event.target.value as 'workspace' | 'home' | 'custom' })
                  }
                >
                  <option value="workspace">Workspace root</option>
                  <option value="home">Home directory</option>
                  <option value="custom">Custom path</option>
                </select>
                {(editingPreset.cwdMode || 'workspace') === 'custom' ? (
                  <input
                    className="mx-input col-span-2"
                    placeholder="Custom working directory"
                    value={editingPreset.cwdCustom || ''}
                    onChange={(event) => updateEditingPreset({ cwdCustom: event.target.value })}
                  />
                ) : null}
              </>
            )}

            <input
              className="mx-input"
              placeholder="Icon"
              value={editingPreset.icon || ''}
              onChange={(event) => updateEditingPreset({ icon: event.target.value })}
            />

            <div className="flex items-center gap-3 rounded-md border border-border-default/70 bg-bg-primary/70 px-3 py-2">
              <div className="text-[12px] text-gray-300">Accent</div>
              <div className="relative h-8 w-8 overflow-hidden rounded-md border border-border-default">
                <input
                  className="absolute -left-2 -top-2 h-14 w-14 cursor-pointer"
                  type="color"
                  value={editingPreset.colorTag || '#3b82f6'}
                  onChange={(event) => updateEditingPreset({ colorTag: event.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {presetValidationError ? (
              <div className="mr-auto text-[11px] text-amber-300">{presetValidationError}</div>
            ) : (
              <div className="mr-auto text-[11px] text-gray-500">Presets only change launch defaults. Pane behavior stays the same.</div>
            )}
            <button className="mx-button-secondary text-[12px] font-medium" onClick={() => setEditingPreset(null)}>
              Cancel
            </button>
            <button
              className="mx-button-primary text-[12px] font-medium disabled:opacity-50"
              onClick={() => void handleSavePreset()}
              disabled={!canSavePreset}
            >
              {isSavingPreset ? 'Saving...' : 'Save preset'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {presets.length === 0 ? (
          <div className="mx-panel p-5 text-center text-[12px] text-gray-500">No presets yet. Add one to create reusable agent and browser launches.</div>
        ) : (
          presets.map((preset) => (
            <div key={preset.id} className="mx-panel flex items-center gap-4 px-3 py-3">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-border-default/70 bg-bg-primary/70"
                style={preset.colorTag ? {
                  borderColor: preset.colorTag,
                  backgroundColor: `${preset.colorTag}15`
                } : undefined}
              >
                {preset.icon ? <span className="text-lg leading-none">{preset.icon}</span> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-[12px] font-medium text-gray-100">{preset.name}</div>
                  <span className="rounded-full border border-border-default/70 bg-bg-primary/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-gray-400">
                    {preset.type === 'browser' ? 'Browser' : 'Agent'}
                  </span>
                </div>
                <div className="mt-1 truncate text-[12px] text-gray-500 font-mono">
                  {preset.type === 'browser' ? preset.targetUrl : preset.command || 'Interactive shell'}
                </div>
              </div>
              {preset.colorTag ? (
                <div className="h-3 w-3 rounded-full border border-white/10" style={{ backgroundColor: preset.colorTag }} />
              ) : null}
              <button className="mx-button-secondary text-[12px] font-medium" onClick={() => setEditingPreset({ ...preset })}>
                Edit
              </button>
              <button className="mx-button-danger text-[12px] font-medium" onClick={() => void handleDeletePreset(preset.id)}>
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </SectionShell>
  );

  const renderAppearance = () => {
    if (!localSettings) {
      return null;
    }

    return (
      <SectionShell
        eyebrow="Appearance"
        title="Workspace chrome"
        description="Apply the tighter layout, cleaner borders, and navigation density consistently."
      >
        <div className="grid gap-4">
          <ToggleRow
            label="Vertical workspace tabs"
            description="Show workspaces in the left rail instead of the top tab strip."
            checked={localSettings.verticalTabs}
            onToggle={() => void handleSettingChange('verticalTabs', !localSettings.verticalTabs)}
          />
          <ToggleRow
            label="Quick actions bar"
            description="Keep the quick launcher visible above the current workspace."
            checked={localSettings.quickActionsBar}
            onToggle={() => void handleSettingChange('quickActionsBar', !localSettings.quickActionsBar)}
          />
          <FieldStack label="Pane header height" description="Adjust the compactness of pane headers across terminals, agents, and browsers.">
            <input
              type="number"
              className="mx-input"
              value={localSettings.paneHeaderHeight}
              min={28}
              max={48}
              onChange={(event) =>
                void handleSettingChange('paneHeaderHeight', (parseInt(event.target.value, 10) || 32) as AppSettings['paneHeaderHeight'])
              }
            />
          </FieldStack>
        </div>
      </SectionShell>
    );
  };

  const renderKeybinds = () => (
    <SectionShell
      eyebrow="Keybinds"
      title="Shortcut reference"
      description="A categorized read-only view of the active shortcut map that used to live in the top menu bar."
    >
      <div className="grid gap-5">
        {KEYBIND_REFERENCE_SECTIONS.map((section) => (
          <div key={section.id} className="mx-panel overflow-hidden">
            <div className="border-b border-border-default/70 bg-bg-primary/70 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                {section.label}
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_160px] border-b border-border-default/60 px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-gray-500">
              <span>Action</span>
              <span className="text-right">Shortcut</span>
            </div>
            <div className="divide-y divide-border-default/60">
              {section.items.map((item) => (
                <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_160px] items-center gap-4 px-4 py-3">
                  <div className="text-[12px] font-medium text-gray-200">{item.label}</div>
                  <div className="text-right font-mono text-[12px] text-gray-400">{item.shortcut}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-border-default/70 bg-bg-primary/50 px-4 py-3 text-[12px] leading-5 text-gray-500">
          Menu shortcuts remain active even though the native menu bar is hidden.
        </div>
      </div>
    </SectionShell>
  );

  const renderAdvanced = () => {
    if (!localSettings) {
      return null;
    }

    return (
      <SectionShell
        eyebrow="Advanced"
        title="Workspace templates and app actions"
        description="Manage saved layouts and maintenance actions without changing routing or behavior."
      >
        <div className="grid gap-4">
          <ToggleRow
            label="Save screenshots to disk"
            description="Also persist pane screenshots to your project folder when capture is used."
            checked={localSettings.saveScreenshotsToDisk}
            onToggle={() => void handleSettingChange('saveScreenshotsToDisk', !localSettings.saveScreenshotsToDisk)}
          />

          <div className="space-y-3">
            <div>
              <div className="mx-kicker text-gray-500">Templates</div>
              <div className="mt-2 text-[12px] leading-5 text-gray-400">Saved workspace layouts can be launched from any directory and renamed here.</div>
            </div>
            {localSettings.layoutTemplates.length === 0 ? (
              <div className="mx-panel p-5 text-center text-[12px] text-gray-500">No workspace templates saved yet.</div>
            ) : (
              localSettings.layoutTemplates.map((template) => (
                <div key={template.id} className="mx-panel flex flex-col gap-4 px-3 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      {editingTemplate?.id === template.id ? (
                        <input
                          className="mx-input"
                          value={editingTemplate.name}
                          onChange={(event) =>
                            setEditingTemplate((current) => (current ? { ...current, name: event.target.value } : null))
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              void handleRenameTemplate();
                            }
                            if (event.key === 'Escape') {
                              setEditingTemplate(null);
                            }
                          }}
                          onBlur={() => void handleRenameTemplate()}
                          autoFocus
                        />
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="text-[12px] font-medium text-gray-100">{template.name}</div>
                            <span className="rounded-full border border-border-default/70 bg-bg-primary/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-gray-400">
                              {template.panes?.length || 0} panes
                            </span>
                          </div>
                          <div className="mt-1 text-[12px] text-gray-500">Saved {new Date(template.createdAt).toLocaleString()}</div>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="mx-button-secondary text-[12px] font-medium"
                        onClick={() => setEditingTemplate({ id: template.id, name: template.name })}
                      >
                        Rename
                      </button>
                      <button className="mx-button-danger text-[12px] font-medium" onClick={() => void handleDeleteTemplate(template.id)}>
                        Delete
                      </button>
                      <button
                        className="mx-button-primary text-[12px] font-medium"
                        onClick={() => void handleLaunchTemplate(template.id, template.name)}
                      >
                        Launch workspace
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mx-panel space-y-4 p-4">
            <div className="space-y-1">
              <div className="mx-kicker text-gray-500">Application actions</div>
              <div className="text-[12px] leading-5 text-gray-400">
                Reload preserves your current session and refreshes the renderer. Force reload also bypasses cache.
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="mx-button-primary text-[12px] font-medium" onClick={() => void handleReloadApp(false)}>
                Reload app
              </button>
              <button className="mx-button-secondary text-[12px] font-medium" onClick={() => void handleReloadApp(true)}>
                Force reload
              </button>
            </div>
          </div>
        </div>
      </SectionShell>
    );
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneral();
      case 'terminal':
        return renderTerminal();
      case 'agents':
        return renderAgents();
      case 'appearance':
        return renderAppearance();
      case 'keybinds':
        return renderKeybinds();
      case 'advanced':
        return renderAdvanced();
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex max-h-[88vh] w-full max-w-[1120px] overflow-hidden rounded-xl border border-border-default/80 bg-bg-secondary shadow-[0_24px_60px_rgba(0,0,0,0.52)]"
        onKeyDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="w-[260px] flex-shrink-0 border-r border-border-default/70 bg-[#121820] px-5 py-5">
          <div className="flex items-start justify-between gap-3 border-b border-border-default/60 pb-5">
            <div className="space-y-1">
              <div className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">Settings</div>
              <div className="text-[16px] font-medium text-gray-100">Mx</div>
              <p className="text-[11px] leading-normal text-gray-400 pt-1">Typography, layout density, presets, and workspace behavior.</p>
            </div>
            <button
              className="flex shrink-0 h-7 w-7 items-center justify-center rounded-md border border-transparent text-gray-500 transition-colors hover:border-border-default/70 hover:bg-bg-primary/70 hover:text-gray-200"
              onClick={onClose}
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {SECTION_ITEMS.map((section) => (
              <NavItem
                key={section.id}
                active={activeSection === section.id}
                label={section.label}
                description={section.description}
                onClick={() => setActiveSection(section.id)}
              />
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-bg-secondary">
          <div className="border-b border-border-default/70 px-8 py-5">
            <div className="mx-kicker text-gray-500">{SECTION_ITEMS.find((section) => section.id === activeSection)?.label}</div>
            <div className="mt-2 text-[12px] leading-5 text-gray-400">
              {SECTION_ITEMS.find((section) => section.id === activeSection)?.description}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
            <div className="mx-auto max-w-[760px] space-y-8">{renderSection()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
