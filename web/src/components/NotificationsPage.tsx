import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { ArrowLeft, Bell } from 'lucide-react';

export default function NotificationsPage() {
  const { notifications, loadNotifications } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleClick = async (n: typeof notifications[0]) => {
    if (!n.read) {
      await api.markNotificationRead(n.id);
      loadNotifications();
    }
    if (n.page_id) {
      navigate(`/page/${n.page_id}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-2xl mx-auto w-full">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-warm-gray hover:text-charcoal mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-2xl font-bold text-charcoal mb-6 flex items-center gap-2">
        <Bell className="w-6 h-6" /> Notifications
      </h1>

      {notifications.length === 0 ? (
        <div className="text-center py-12 text-mid-gray">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left card-surface p-4 transition-colors hover:bg-linen/50 ${!n.read ? 'border-l-4 border-forest' : ''}`}
            >
              <div className="font-medium text-sm">{n.title}</div>
              {n.body && <div className="text-sm text-warm-gray mt-1">{n.body}</div>}
              <div className="text-xs text-mid-gray mt-2">
                {new Date(n.created_at * 1000).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
