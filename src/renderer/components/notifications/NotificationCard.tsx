import type { GlobalNotification } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import { X } from 'lucide-react';

interface Props {
  notification: GlobalNotification;
  compact?: boolean;
}

export default function NotificationCard({ notification, compact = false }: Props) {
  const { dismissNotification, executeNotificationAction, setActiveWorkspace, setFocusedPane } = useAppStore();

  const getKindAccent = (kind: string) => {
    switch (kind) {
      case 'error': return '#f85149';
      case 'action': return '#d29922';
      case 'success': return '#3fb950';
      default: return '#8b9fc6';
    }
  };

  const renderDot = () => {
    if (notification.kind === 'error') {
      return <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-[#f85149] shadow-[0_0_8px_rgba(248,81,73,0.6)]" />;
    }
    if (notification.kind === 'success') {
      return <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-[#3fb950] shadow-[0_0_8px_rgba(63,185,80,0.6)]" />;
    }
    if (notification.kind === 'action') {
      return <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-[#d29922] shadow-[0_0_8px_rgba(210,153,34,0.6)] animate-pulse" />;
    }
    if (notification.kind === 'info') {
      return <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-[#8b9fc6] shadow-[0_0_8px_rgba(139,159,198,0.35)]" />;
    }
    return null;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
  };

  const handleJumpToSource = () => {
    if (notification.sourceWorkspaceId) {
      setActiveWorkspace(notification.sourceWorkspaceId);
      if (notification.sourcePaneId) {
        setTimeout(() => setFocusedPane(notification.sourcePaneId!), 50);
      }
    }
  };

  const kindAccent = getKindAccent(notification.kind);

  return (
    <div
      className="notification-card-enter rounded-lg border border-[#30363d]/80 bg-[#1c2128] overflow-hidden group transition-all duration-200 hover:border-[#3d444d]"
      style={{ cursor: notification.sourceWorkspaceId ? 'pointer' : 'default' }}
      onClick={compact ? handleJumpToSource : undefined}
    >
      <div className={compact ? 'px-3 py-2' : 'px-3.5 py-2.5'}>
        {/* Header: title + timestamp + dismiss */}
        <div className="flex items-start gap-2.5">
          {renderDot()}
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-gray-200 leading-snug">
              {notification.title}
            </div>
            {notification.body && (
              <div className="text-[11px] text-gray-500 leading-relaxed mt-0.5 line-clamp-2">
                {notification.body}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 pt-px">
            <span className="text-[10px] text-gray-600">
              {formatTime(notification.timestamp)}
            </span>
            {!compact && (
              <button
                className="w-4 h-4 flex items-center justify-center text-gray-600 hover:text-gray-300 rounded transition-colors opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); dismissNotification(notification.id); }}
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {notification.actions && notification.actions.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-white/[0.04]">
            {notification.actions.map((action) => (
              <button
                key={action.id}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 ${
                  action.variant === 'primary'
                    ? 'mx-obsidian-button text-white'
                    : action.variant === 'danger'
                      ? 'text-[#f85149] hover:bg-[#f85149]/10 border border-[#f85149]/20'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-white/[0.06]'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  executeNotificationAction(notification.id, action.id);
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
