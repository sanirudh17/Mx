import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import PresetPicker from '../presets/PresetPicker';
import { requestPaneScreenshot } from '../../utils/paneScreenshot';

type PickerState = {
  type: 'agent' | 'browser';
  workspaceId: string;
};

export default function WorkspaceActionCenter() {
  const activeWorkspaceId = useAppStore(state => state.activeWorkspaceId);
  const workspaces = useAppStore(state => state.workspaces);
  const presets = useAppStore(state => state.presets);
  const createPane = useAppStore(state => state.createPane);
  const closePane = useAppStore(state => state.closePane);
  const splitPane = useAppStore(state => state.splitPane);
  const saveSession = useAppStore(state => state.saveSession);
  const [pickerState, setPickerState] = useState<PickerState | null>(null);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId),
    [workspaces, activeWorkspaceId]
  );
  const focusedPane = useMemo(
    () => activeWorkspace?.panes.find((pane) => pane.id === useAppStore.getState().focusedPaneId),
    [activeWorkspace]
  );
  const agentPresets = useMemo(
    () => presets.filter((preset) => (preset.type || 'agent') === 'agent'),
    [presets]
  );
  const browserPresets = useMemo(
    () => presets.filter((preset) => (preset.type || 'agent') === 'browser'),
    [presets]
  );

  useEffect(() => {
    const handleSaveWorkspace = async (workspaceId: string) => {
      await saveSession();
      window.dispatchEvent(
        new CustomEvent('trigger-save-template', { detail: { wsId: workspaceId } })
      );
    };

    const handleAction = (event: Event) => {
      const workspaceId = activeWorkspaceId;

      switch (event.type) {
        case 'app:newTerminal':
          if (workspaceId) {
            void createPane(workspaceId, 'terminal');
          }
          return;
        case 'app:newAgent':
          if (!workspaceId) {
            return;
          }
          if (agentPresets.length === 1) {
            void createPane(workspaceId, 'agent', { presetId: agentPresets[0].id });
            return;
          }
          if (agentPresets.length === 0) {
            void createPane(workspaceId, 'agent');
            return;
          }
          setPickerState({ type: 'agent', workspaceId });
          return;
        case 'app:newBrowser':
          if (!workspaceId) {
            return;
          }
          if (browserPresets.length === 0) {
            void createPane(workspaceId, 'browser', { url: 'about:blank' });
            return;
          }
          setPickerState({ type: 'browser', workspaceId });
          return;
        case 'app:splitH': {
          const storedFocusedPaneId = useAppStore.getState().focusedPaneId;
          if (workspaceId && storedFocusedPaneId) {
            splitPane(workspaceId, storedFocusedPaneId, 'horizontal');
          }
          return;
        }
        case 'app:splitV': {
          const storedFocusedPaneId = useAppStore.getState().focusedPaneId;
          if (workspaceId && storedFocusedPaneId) {
            splitPane(workspaceId, storedFocusedPaneId, 'vertical');
          }
          return;
        }
        case 'app:saveWorkspace':
          if (workspaceId) {
            void handleSaveWorkspace(workspaceId);
          }
          return;
        case 'app:takeFocusedPaneScreenshot':
          if (focusedPane?.type === 'browser') {
            void requestPaneScreenshot(focusedPane.id);
          }
          return;
        case 'app:saveWorkspaceOrScreenshot':
          if (!workspaceId) {
            return;
          }
          if (focusedPane?.type === 'browser') {
            void requestPaneScreenshot(focusedPane.id);
            return;
          }
          void handleSaveWorkspace(workspaceId);
          return;
        case 'app:closePane': {
          const targetFocusedPaneId = useAppStore.getState().focusedPaneId;
          if (workspaceId && targetFocusedPaneId) {
            closePane(workspaceId, targetFocusedPaneId);
          }
          return;
        }
        default:
          return;
      }
    };

    const events = [
      'app:newTerminal',
      'app:newAgent',
      'app:newBrowser',
      'app:splitH',
      'app:splitV',
      'app:saveWorkspace',
      'app:saveWorkspaceOrScreenshot',
      'app:takeFocusedPaneScreenshot',
      'app:closePane'
    ];

    events.forEach((action) => window.addEventListener(action, handleAction));

    return () => {
      events.forEach((action) => window.removeEventListener(action, handleAction));
    };
  }, [
    activeWorkspaceId,
    agentPresets,
    browserPresets,
    closePane,
    createPane,
    focusedPane,
    saveSession,
    splitPane
  ]);

  if (!pickerState) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center modal-backdrop p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setPickerState(null)}
      />
      <PresetPicker
        workspaceId={pickerState.workspaceId}
        type={pickerState.type}
        variant="modal"
        onSelect={() => setPickerState(null)}
        onClose={() => setPickerState(null)}
      />
    </div>
  );
}
