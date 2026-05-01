import { useEffect, useState, useCallback } from 'react';
import type { AppNotification, NotificationHistoryItem } from '../../types';
import { APP_NOTIFY_EVENT } from '../../utils/notifications';
import { useAppStore } from '../../stores/useAppStore';
import { TOGGLE_NOTIFICATIONS_SHORTCUT_LABEL } from '../../../common/shortcuts';
import { Bell, X, ChevronRight, Trash2 } from 'lucide-react';

type Toast = AppNotification & {
  id: string;
};

const MAX_HISTORY = 50;

export default function NotificationCenter() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const { setActiveWorkspace, setFocusedPane } = useAppStore();

  const addToHistory = useCallback((notification: AppNotification, wsId?: string, paneId?: string) => {
    const ws = wsId ? useAppStore.getState().workspaces.find(w => w.id === wsId) : undefined;
    const pane = ws && paneId ? ws.panes.find(p => p.id === paneId) : undefined;

    const item: NotificationHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: notification.title,
      body: notification.body,
      kind: notification.kind || 'info',
      timestamp: new Date().toISOString(),
      workspaceId: wsId,
      workspaceName: ws?.name,
      paneId,
      paneLabel: pane?.label
    };

    setHistory(prev => [item, ...prev].slice(0, MAX_HISTORY));
    if (!panelOpen) {
      setUnreadCount(prev => prev + 1);
    }
  }, [panelOpen]);

  useEffect(() => {
    const handleNotify = (event: Event) => {
      console.log('[NotificationCenter] handleNotify received event:', event);
      const { detail } = event as CustomEvent<AppNotification & { workspaceId?: string; paneId?: string }>;
      console.log('[NotificationCenter] handleNotify detail:', detail);
      const toast: Toast = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: detail.kind || 'info',
        ...detail
      };

      setToasts((current) => [...current, toast].slice(-4));
      addToHistory(detail, (detail as any).workspaceId, (detail as any).paneId);

      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 10000);
    };

    window.addEventListener(APP_NOTIFY_EVENT, handleNotify);
    return () => window.removeEventListener(APP_NOTIFY_EVENT, handleNotify);
  }, [addToHistory]);

  // Listen for Ctrl+Shift+X toggle event
  useEffect(() => {
    const handleToggle = () => {
      setPanelOpen(prev => {
        if (!prev) {
          setUnreadCount(0);
        }
        return !prev;
      });
    };

    window.addEventListener('app:toggleNotifications', handleToggle);
    return () => window.removeEventListener('app:toggleNotifications', handleToggle);
  }, []);

  const handleTogglePanel = () => {
    setPanelOpen(prev => {
      if (!prev) {
        setUnreadCount(0);
      }
      return !prev;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    setUnreadCount(0);
  };

  const handleJumpTo = (item: NotificationHistoryItem) => {
    if (item.workspaceId) {
      setActiveWorkspace(item.workspaceId);
      if (item.paneId) {
        setTimeout(() => setFocusedPane(item.paneId!), 50);
      }
    }
    setPanelOpen(false);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  };

  const getKindColor = (kind: string) => {
    switch (kind) {
      case 'success': return 'bg-accent-green';
      case 'error': return 'bg-accent-red';
      default: return 'bg-accent-blue';
    }
  };

  return (
    <>
      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed top-4 right-4 z-[250] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="notification-toast-enter rounded-xl border border-[#3d444d] bg-[#22272e]/95 backdrop-blur-sm px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${getKindColor(toast.kind || 'info')} shadow-[0_0_6px_currentColor]`} />
                <div className="text-[13px] font-semibold tracking-[0.01em] text-gray-200">{toast.title}</div>
              </div>
              <div className="mt-1 text-[12px] leading-relaxed text-gray-400 pl-[18px]">{toast.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* Bell button in status bar */}
      <button
        className="relative flex items-center justify-center w-7 h-7 text-gray-500 hover:text-gray-300 transition-colors rounded hover:bg-white/5"
        onClick={handleTogglePanel}
        title={`Notification history (${TOGGLE_NOTIFICATIONS_SHORTCUT_LABEL})`}
        id="notification-bell"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-accent-blue text-white text-[8px] flex items-center justify-center font-bold shadow-[0_0_6px_rgba(139,159,198,0.5)] notification-badge-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Persistent notification panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setPanelOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-[380px] max-w-[90vw] z-[201] bg-bg-secondary border-l border-border-default/60 shadow-[-16px_0_40px_rgba(0,0,0,0.4)] notification-panel-enter flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border-default/40">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-accent-blue" />
                <span className="text-sm font-semibold text-gray-200">Notifications</span>
                {history.length > 0 && (
                  <span className="text-[11px] text-gray-500 font-mono">({history.length})</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {history.length > 0 && (
                  <button
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded transition-colors"
                    onClick={handleClearHistory}
                    title="Clear all"
                  >
                    <Trash2 size={12} />
                    Clear
                  </button>
                )}
                <button
                  className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded transition-colors"
                  onClick={() => setPanelOpen(false)}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2 p-8">
                  <Bell size={32} className="opacity-30" />
                  <span>No notifications yet</span>
                  <span className="text-[11px] text-gray-600">Process completions and errors will appear here</span>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {history.map(item => (
                    <div
                      key={item.id}
                      className="group flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer"
                      onClick={() => handleJumpTo(item)}
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getKindColor(item.kind)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-gray-300 truncate">{item.title}</div>
                        <div className="text-[11px] text-gray-500 leading-relaxed mt-0.5 line-clamp-2">{item.body}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-600">{formatTime(item.timestamp)}</span>
                          {item.workspaceName && (
                            <span className="text-[10px] text-gray-600 truncate max-w-[120px]">
                              · {item.workspaceName}
                            </span>
                          )}
                          {item.paneLabel && (
                            <span className="text-[10px] text-gray-600 truncate max-w-[80px]">
                              · {item.paneLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      {item.workspaceId && (
                        <ChevronRight size={12} className="text-gray-600 opacity-0 group-hover:opacity-100 mt-1 flex-shrink-0 transition-opacity" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
