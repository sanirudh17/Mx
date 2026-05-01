export const NEW_WORKSPACE_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+N';
export const NEW_WORKSPACE_SHORTCUT_LABEL = 'Ctrl+N';
export const OPEN_PROJECT_SWITCHER_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+O';
export const OPEN_PROJECT_SWITCHER_SHORTCUT_LABEL = 'Ctrl+O';

export const COMMAND_PALETTE_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+Shift+P';
export const COMMAND_PALETTE_SHORTCUT_LABEL = 'Ctrl+Shift+P';

export const TOGGLE_NOTES_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+Shift+N';
export const TOGGLE_NOTES_SHORTCUT_LABEL = 'Ctrl+Shift+N';

export const NEW_TERMINAL_SHORTCUT_LABEL = 'Ctrl+Shift+T';
export const NEW_AGENT_SHORTCUT_LABEL = 'Ctrl+Shift+A';
export const NEW_BROWSER_SHORTCUT_LABEL = 'Ctrl+Shift+B';
export const SPLIT_HORIZONTAL_SHORTCUT_LABEL = 'Ctrl+Shift+H';
export const SPLIT_VERTICAL_SHORTCUT_LABEL = 'Ctrl+Shift+V';
export const SAVE_WORKSPACE_SHORTCUT_LABEL = 'Ctrl+Shift+L';
export const TAKE_SCREENSHOT_SHORTCUT_LABEL = 'Ctrl+Shift+S';
export const CLOSE_PANE_SHORTCUT_LABEL = 'Ctrl+W';
export const NEXT_WORKSPACE_SHORTCUT_LABEL = 'Ctrl+PgDn';
export const PREVIOUS_WORKSPACE_SHORTCUT_LABEL = 'Ctrl+PgUp';
export const TERMINAL_FIND_SHORTCUT_LABEL = 'Ctrl+F';

export const SETTINGS_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+,';
export const SETTINGS_SHORTCUT_LABEL = 'Ctrl+,';
export const RELOAD_APP_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+R';
export const RELOAD_APP_SHORTCUT_LABEL = 'Ctrl+R';
export const FORCE_RELOAD_APP_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+Shift+R';
export const FORCE_RELOAD_APP_SHORTCUT_LABEL = 'Ctrl+Shift+R';
export const TOGGLE_DEVTOOLS_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+Shift+I';
export const TOGGLE_DEVTOOLS_SHORTCUT_LABEL = 'Ctrl+Shift+I';
export const RESET_ZOOM_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+0';
export const RESET_ZOOM_SHORTCUT_LABEL = 'Ctrl+0';
export const ZOOM_IN_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+Plus';
export const ZOOM_IN_SHORTCUT_LABEL = 'Ctrl++';
export const ZOOM_OUT_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+-';
export const ZOOM_OUT_SHORTCUT_LABEL = 'Ctrl+-';
export const TOGGLE_FULLSCREEN_SHORTCUT_ACCELERATOR = 'F11';
export const TOGGLE_FULLSCREEN_SHORTCUT_LABEL = 'F11';

export const TOGGLE_ACTION_BAR_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+Shift+M';
export const TOGGLE_ACTION_BAR_SHORTCUT_LABEL = 'Ctrl+Shift+M';

export const TOGGLE_NOTIFICATIONS_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+Shift+X';
export const TOGGLE_NOTIFICATIONS_SHORTCUT_LABEL = 'Ctrl+Shift+X';
export const CLOSE_WINDOW_SHORTCUT_ACCELERATOR = 'CmdOrCtrl+Shift+W';
export const CLOSE_WINDOW_SHORTCUT_LABEL = 'Ctrl+Shift+W';
export const UNDO_SHORTCUT_LABEL = 'Ctrl+Z';
export const REDO_SHORTCUT_LABEL = 'Ctrl+Y';
export const CUT_SHORTCUT_LABEL = 'Ctrl+X';
export const COPY_SHORTCUT_LABEL = 'Ctrl+C';
export const PASTE_SHORTCUT_LABEL = 'Ctrl+V';

export type ShortcutReferenceSection = {
  id: string;
  label: string;
  items: Array<{
    id: string;
    label: string;
    shortcut: string;
  }>;
};

export const ACTUAL_KEYBOARD_SHORTCUTS: Record<string, string> = {
  'new-workspace': NEW_WORKSPACE_SHORTCUT_LABEL,
  'open-project-switcher': OPEN_PROJECT_SWITCHER_SHORTCUT_LABEL,
  'command-palette': COMMAND_PALETTE_SHORTCUT_LABEL,
  'toggle-notes': TOGGLE_NOTES_SHORTCUT_LABEL,
  'new-terminal': NEW_TERMINAL_SHORTCUT_LABEL,
  'new-agent': NEW_AGENT_SHORTCUT_LABEL,
  'new-browser': NEW_BROWSER_SHORTCUT_LABEL,
  'split-horizontal': SPLIT_HORIZONTAL_SHORTCUT_LABEL,
  'split-vertical': SPLIT_VERTICAL_SHORTCUT_LABEL,
  'save-workspace': SAVE_WORKSPACE_SHORTCUT_LABEL,
  'take-screenshot': TAKE_SCREENSHOT_SHORTCUT_LABEL,
  'close-pane': CLOSE_PANE_SHORTCUT_LABEL,
  'next-workspace': NEXT_WORKSPACE_SHORTCUT_LABEL,
  'previous-workspace': PREVIOUS_WORKSPACE_SHORTCUT_LABEL,
  'terminal-find': TERMINAL_FIND_SHORTCUT_LABEL,
  settings: SETTINGS_SHORTCUT_LABEL,
  'reload-app': RELOAD_APP_SHORTCUT_LABEL,
  'force-reload-app': FORCE_RELOAD_APP_SHORTCUT_LABEL,
  'toggle-devtools': TOGGLE_DEVTOOLS_SHORTCUT_LABEL,
  'reset-zoom': RESET_ZOOM_SHORTCUT_LABEL,
  'zoom-in': ZOOM_IN_SHORTCUT_LABEL,
  'zoom-out': ZOOM_OUT_SHORTCUT_LABEL,
  'toggle-fullscreen': TOGGLE_FULLSCREEN_SHORTCUT_LABEL,
  'toggle-action-bar': TOGGLE_ACTION_BAR_SHORTCUT_LABEL,
  'toggle-notifications': TOGGLE_NOTIFICATIONS_SHORTCUT_LABEL,
  'close-window': CLOSE_WINDOW_SHORTCUT_LABEL,
  undo: UNDO_SHORTCUT_LABEL,
  redo: REDO_SHORTCUT_LABEL,
  cut: CUT_SHORTCUT_LABEL,
  copy: COPY_SHORTCUT_LABEL,
  paste: PASTE_SHORTCUT_LABEL
};

export const KEYBIND_REFERENCE_SECTIONS: ShortcutReferenceSection[] = [
  {
    id: 'file',
    label: 'File',
    items: [
      { id: 'new-workspace', label: 'New Workspace', shortcut: NEW_WORKSPACE_SHORTCUT_LABEL },
      { id: 'open-project-switcher', label: 'Open Project Switcher', shortcut: OPEN_PROJECT_SWITCHER_SHORTCUT_LABEL },
      { id: 'take-screenshot', label: 'Take Screenshot', shortcut: TAKE_SCREENSHOT_SHORTCUT_LABEL },
      { id: 'save-workspace', label: 'Save Layout As Template', shortcut: SAVE_WORKSPACE_SHORTCUT_LABEL },
      { id: 'close-pane', label: 'Close This Pane', shortcut: CLOSE_PANE_SHORTCUT_LABEL }
    ]
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { id: 'undo', label: 'Undo', shortcut: UNDO_SHORTCUT_LABEL },
      { id: 'redo', label: 'Redo', shortcut: REDO_SHORTCUT_LABEL },
      { id: 'cut', label: 'Cut', shortcut: CUT_SHORTCUT_LABEL },
      { id: 'copy', label: 'Copy', shortcut: COPY_SHORTCUT_LABEL },
      { id: 'paste', label: 'Paste', shortcut: PASTE_SHORTCUT_LABEL }
    ]
  },
  {
    id: 'view',
    label: 'View',
    items: [
      { id: 'command-palette', label: 'Command Palette', shortcut: COMMAND_PALETTE_SHORTCUT_LABEL },
      { id: 'toggle-notes', label: 'Toggle Notes Panel', shortcut: TOGGLE_NOTES_SHORTCUT_LABEL },
      { id: 'toggle-action-bar', label: 'Toggle Action Bar', shortcut: TOGGLE_ACTION_BAR_SHORTCUT_LABEL },
      { id: 'toggle-notifications', label: 'Notifications', shortcut: TOGGLE_NOTIFICATIONS_SHORTCUT_LABEL },
      { id: 'settings', label: 'Settings', shortcut: SETTINGS_SHORTCUT_LABEL },
      { id: 'reload-app', label: 'Reload App', shortcut: RELOAD_APP_SHORTCUT_LABEL },
      { id: 'force-reload-app', label: 'Force Reload', shortcut: FORCE_RELOAD_APP_SHORTCUT_LABEL },
      { id: 'toggle-devtools', label: 'Developer Tools', shortcut: TOGGLE_DEVTOOLS_SHORTCUT_LABEL },
      { id: 'reset-zoom', label: 'Reset Zoom', shortcut: RESET_ZOOM_SHORTCUT_LABEL },
      { id: 'zoom-in', label: 'Zoom In', shortcut: ZOOM_IN_SHORTCUT_LABEL },
      { id: 'zoom-out', label: 'Zoom Out', shortcut: ZOOM_OUT_SHORTCUT_LABEL },
      { id: 'toggle-fullscreen', label: 'Toggle Fullscreen', shortcut: TOGGLE_FULLSCREEN_SHORTCUT_LABEL }
    ]
  },
  {
    id: 'terminal-tools',
    label: 'Terminal Tools',
    items: [
      { id: 'new-terminal', label: 'New Terminal', shortcut: NEW_TERMINAL_SHORTCUT_LABEL },
      { id: 'new-agent', label: 'New Agent', shortcut: NEW_AGENT_SHORTCUT_LABEL },
      { id: 'new-browser', label: 'New Browser', shortcut: NEW_BROWSER_SHORTCUT_LABEL },
      { id: 'split-horizontal', label: 'Split Horizontal', shortcut: SPLIT_HORIZONTAL_SHORTCUT_LABEL },
      { id: 'split-vertical', label: 'Split Vertical', shortcut: SPLIT_VERTICAL_SHORTCUT_LABEL },
      { id: 'terminal-find', label: 'Find In Terminal', shortcut: TERMINAL_FIND_SHORTCUT_LABEL }
    ]
  },
  {
    id: 'navigate',
    label: 'Navigate',
    items: [
      { id: 'next-workspace', label: 'Next Workspace', shortcut: NEXT_WORKSPACE_SHORTCUT_LABEL },
      { id: 'previous-workspace', label: 'Previous Workspace', shortcut: PREVIOUS_WORKSPACE_SHORTCUT_LABEL }
    ]
  },
  {
    id: 'window',
    label: 'Window',
    items: [
      { id: 'close-window', label: 'Close Window', shortcut: CLOSE_WINDOW_SHORTCUT_LABEL }
    ]
  }
];
