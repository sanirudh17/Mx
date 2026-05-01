import React, { CSSProperties, useCallback } from 'react';
import type { Pane } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import PaneHeader from './PaneHeader';
import TerminalPane from './TerminalPane';
import BrowserPane from './BrowserPane';
import EmptyPaneChooser from './EmptyPaneChooser';

interface Props {
  pane: Pane;
  workspaceId: string;
  style: CSSProperties;
}

function PaneContainerInner({ pane, workspaceId, style }: Props) {
  const focusedPaneId = useAppStore(state => state.focusedPaneId);
  const setFocusedPane = useAppStore(state => state.setFocusedPane);
  const isFocused = focusedPaneId === pane.id;

  const handleFocus = useCallback(() => {
    setFocusedPane(pane.id);
  }, [pane.id, setFocusedPane]);

  return (
    <div
      style={style}
      className={`relative h-full w-full flex flex-col overflow-hidden bg-bg-primary ${isFocused ? 'pane-focused' : ''}`}
      data-pane-id={pane.id}
      data-pane-type={pane.type}
      tabIndex={-1}
      onMouseDownCapture={handleFocus}
      onFocusCapture={handleFocus}
    >
      <PaneHeader pane={pane} workspaceId={workspaceId} />

      <div className="flex-1 min-h-0 min-w-0 overflow-hidden bg-bg-primary">
        {pane.type === 'browser' ? (
          <BrowserPane pane={pane} workspaceId={workspaceId} />
        ) : pane.type === 'empty' ? (
          <EmptyPaneChooser workspaceId={workspaceId} paneId={pane.id} />
        ) : (
          <TerminalPane pane={pane} workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders when sibling panes change.
// Only re-render when the pane's identity, type, or label actually changes.
const PaneContainer = React.memo(PaneContainerInner, (prevProps, nextProps) => {
  return (
    prevProps.pane.id === nextProps.pane.id &&
    prevProps.pane.type === nextProps.pane.type &&
    prevProps.pane.label === nextProps.pane.label &&
    prevProps.pane.status === nextProps.pane.status &&
    prevProps.workspaceId === nextProps.workspaceId
  );
});

export default PaneContainer;
