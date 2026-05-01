import type { AppNotification, GlobalNotification } from '../types';
import { useAppStore } from '../stores/useAppStore';

export const APP_NOTIFY_EVENT = 'app:notify';

export interface AppNotificationDetail extends AppNotification {
  workspaceId?: string;
  paneId?: string;
}

function emitLegacyNotificationEvent(notification: {
  title: string;
  body: string;
  kind?: string;
  workspaceId?: string;
  paneId?: string;
}): void {
  window.dispatchEvent(
    new CustomEvent(APP_NOTIFY_EVENT, {
      detail: {
        title: notification.title,
        body: notification.body,
        kind: notification.kind === 'error' ? 'error' : notification.kind === 'success' ? 'success' : 'info',
        workspaceId: notification.workspaceId,
        paneId: notification.paneId
      }
    })
  );
}

/**
 * Push a notification through the new global notification system.
 * This is the preferred method for all new notification dispatches.
 */
export function pushGlobalNotification(
  notification: Omit<GlobalNotification, 'id' | 'timestamp'>
): void {
  useAppStore.getState().pushNotification(notification);
  emitLegacyNotificationEvent({
    title: notification.title,
    body: notification.body,
    kind: notification.kind,
    workspaceId: notification.sourceWorkspaceId,
    paneId: notification.sourcePaneId
  });
}

export async function pushGlobalNotificationWithNativeFallback(
  notification: Omit<GlobalNotification, 'id' | 'timestamp'>,
  showNative: boolean
): Promise<void> {
  pushGlobalNotification(notification);

  if (!showNative) {
    return;
  }

  try {
    await window.electron.app.notify({
      title: notification.title,
      body: notification.body,
      kind:
        notification.kind === 'error'
          ? 'error'
          : notification.kind === 'success'
            ? 'success'
            : 'info'
    });
  } catch (error) {
    console.error('Failed to show native notification:', error);
  }
}

/**
 * Legacy compatibility wrapper. Routes through the new global store.
 */
export function dispatchAppNotification(notification: AppNotificationDetail): void {
  pushGlobalNotification({
    title: notification.title,
    body: notification.body,
    kind: notification.kind || 'info',
    sourcePaneId: notification.paneId,
    sourceWorkspaceId: notification.workspaceId
  });
}

export async function dispatchAppNotificationWithNativeFallback(
  notification: AppNotificationDetail,
  showNative: boolean
): Promise<void> {
  dispatchAppNotification(notification);

  if (!showNative) {
    return;
  }

  try {
    await window.electron.app.notify(notification);
  } catch (error) {
    console.error('Failed to show native notification:', error);
  }
}
