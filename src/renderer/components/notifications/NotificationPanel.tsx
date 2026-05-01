import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { TOGGLE_NOTIFICATIONS_SHORTCUT_LABEL } from '../../../common/shortcuts';
import { Bell, X, Trash2 } from 'lucide-react';
import NotificationCard from './NotificationCard';

export default function NotificationPanel() {
  const { notificationHistory, clearNotificationHistory, notifications } = useAppStore();
  const [panelOpen, setPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSeenCount, setLastSeenCount] = useState(0);

  // Track unread count based on new notifications arriving
  useEffect(() => {
    const currentTotalCount = notificationHistory.length;
    if (currentTotalCount > lastSeenCount && !panelOpen) {
      setUnreadCount((prev) => prev + (currentTotalCount - lastSeenCount));
    }
    setLastSeenCount(currentTotalCount);
  }, [notificationHistory.length, panelOpen, lastSeenCount]);

  // Listen for Ctrl+Shift+X toggle event
  useEffect(() => {
    const handleToggle = () => {
      setPanelOpen((prev) => {
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
    setPanelOpen((prev) => {
      if (!prev) {
        setUnreadCount(0);
      }
      return !prev;
    });
  };

  const handleClearHistory = () => {
    clearNotificationHistory();
    setUnreadCount(0);
  };

  return (
    <>
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
          <div className="fixed top-0 right-0 bottom-0 w-[400px] max-w-[90vw] z-[201] bg-bg-secondary border-l border-border-default/60 shadow-[-16px_0_40px_rgba(0,0,0,0.4)] notification-panel-enter flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border-default/40">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-accent-blue" />
                <span className="text-sm font-semibold text-gray-200">Notifications</span>
                {notificationHistory.length > 0 && (
                  <span className="text-[11px] text-gray-500 font-mono">({notificationHistory.length})</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notificationHistory.length > 0 && (
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
              {notificationHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2 p-8">
                  <Bell size={32} className="opacity-30" />
                  <span>No notifications yet</span>
                  <span className="text-[11px] text-gray-600">Agent events and errors will appear here</span>
                </div>
              ) : (
                <div className="p-2.5 space-y-2">
                  {notificationHistory.map((item) => (
                    <NotificationCard key={item.id} notification={item} compact />
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
