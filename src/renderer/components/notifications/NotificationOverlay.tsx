import { useAppStore } from '../../stores/useAppStore';
import NotificationCard from './NotificationCard';

export default function NotificationOverlay() {
  const notifications = useAppStore((state) => state.notifications);

  if (notifications.length === 0) {
    return null;
  }

  const activeNotifications = notifications.slice(0, 3);

  return (
    <div className="pointer-events-none fixed top-3 right-3 z-[250] flex w-[320px] max-w-[calc(100vw-1.5rem)] flex-col gap-2">
      {activeNotifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationCard notification={notification} />
        </div>
      ))}
    </div>
  );
}
