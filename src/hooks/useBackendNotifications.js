import { useEffect, useState } from 'react';
import { toUtcIso } from '../utils/backendTime';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Polls the real backend notification API. Returns [] (safe no-op) if
// there's no session or the request fails - same fallback philosophy as
// useBackendOrders.js.
export const useBackendNotifications = () => {
  const [backendNotifications, setBackendNotifications] = useState([]);

  useEffect(() => {
    const token = sessionStorage.getItem('otuzanAuthenticated');
    if (!token) return undefined;
    const controller = new AbortController();
    const load = () => fetch(`${API_BASE_URL}/api/notifications?per_page=50`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!body?.data) return;
        setBackendNotifications(body.data);
      })
      .catch(() => {});
    load();
    const poll = window.setInterval(load, 30000);
    return () => { controller.abort(); window.clearInterval(poll); };
  }, []);

  return backendNotifications;
};

// Converts a raw backend Notification row into the same shape
// CustomerActivity.jsx already renders for local notifications.
// NotificationMessage carries {title, message, type, orderId} as JSON -
// Notification has no separate title/message columns on the predetermined
// schema, so both ride together in the one text field (see
// OrderController::notifyStatusChange).
export const toLocalNotificationShape = (backend) => {
  let parsed = {};
  try { parsed = JSON.parse(backend.NotificationMessage); } catch { parsed = {}; }
  return {
    id: `BACKEND-NOTIF-${backend.NotificationID}`,
    orderId: parsed.orderId ?? null,
    title: parsed.title || 'Update',
    message: parsed.message || backend.NotificationMessage,
    type: parsed.type || 'status',
    createdAt: toUtcIso(backend.NotificationDate),
    read: Boolean(backend.NotificationSeen)
  };
};
