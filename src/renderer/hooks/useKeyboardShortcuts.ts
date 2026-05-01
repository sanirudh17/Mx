import { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { Pane } from '../types';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function getFocusedInteractivePane(): Pane | null {
  const { activeWorkspaceId, workspaces, focusedPaneId } = useAppStore.getState();
  const workspace = workspaces.find((candidate) => candidate.id === activeWorkspaceId);
  if (!workspace) {
    return null;
  }

  return workspace.panes.find((pane) => pane.id === focusedPaneId) ?? null;
}

function dispatchTerminalFindAction(action: 'open' | 'next' | 'previous' | 'close'): void {
  const pane = getFocusedInteractivePane();
  if (!pane || (pane.type !== 'terminal' && pane.type !== 'agent')) {
    return;
  }

  window.dispatchEvent(new CustomEvent(`terminal-find-${action}-${pane.id}`));
}



export function useKeyboardShortcuts() {
  useEffect(() => {
    const runAction = (action: string) => {
      const store = useAppStore.getState();

      switch (action) {
        case 'app:nextWorkspace':
          store.focusNextWorkspace();
          return;
        case 'app:previousWorkspace':
          store.focusPreviousWorkspace();
          return;
        case 'app:openTerminalFind':
          dispatchTerminalFindAction('open');
          return;
        case 'app:closeTerminalFind':
          dispatchTerminalFindAction('close');
          return;
        default:
          return;
      }
    };

    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const alt = e.altKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();

      if (ctrl && shift && key === 'm') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('app:toggleQuickActionsBar'));
        return;
      }

      if (ctrl && key === ',') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('app:openSettings'));
        return;
      }

      if (ctrl && !alt && !shift && (key === '=' || key === '+')) {
        e.preventDefault();
        useAppStore.getState().incrementFontSize();
        return;
      }

      if (ctrl && !alt && !shift && (key === '-' || key === '_')) {
        e.preventDefault();
        useAppStore.getState().decrementFontSize();
        return;
      }

      if (ctrl && shift && key === 'x') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('app:toggleNotifications'));
        return;
      }

      if (e.key === 'Escape') {
        runAction('app:closeTerminalFind');
      }

      if (isEditableTarget(e.target)) {
        return;
      }
    };

    const actionEvents = [
      'app:nextWorkspace',
      'app:previousWorkspace',
      'app:openTerminalFind',
      'app:closeTerminalFind'
    ] as const;

    const customEventHandlers = actionEvents.map((action) => {
      const listener = () => runAction(action);
      window.addEventListener(action, listener);
      return () => window.removeEventListener(action, listener);
    });

    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('keydown', handler);
      customEventHandlers.forEach((cleanup) => cleanup());
    };
  }, []);
}
