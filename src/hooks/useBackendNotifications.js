import { useEffect, useState } from 'react';
import { toUtcIso } from '../utils/backendTime';
import { ORDERS_CHANGED_EVENT, ORDER_PROGRESS_CHANGED_STORAGE_KEY } from './useBackendOrders';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const ACTIVE_NOTIFICATION_REFRESH_MS = 2000;

// Polls the real backend notification API. Returns [] (safe no-op) if
// there's no session or the request fails - same fallback philosophy as
// useBackendOrders.js.
export const useBackendNotifications = () => {
  const [backendNotifications, setBackendNotifications] = useState([]);

  useEffect(() => {
    const token = sessionStorage.getItem('otuzanAuthenticated');
    if (!token) return undefined;
    const controller = new AbortController();
    let inFlight = false;
    // A rider update can arrive just as the previous notification request is
    // finishing. Keep that refresh instead of dropping it, otherwise the
    // customer can continue seeing the earlier status until the next poll.
    let refreshQueued = false;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      if (inFlight) {
        refreshQueued = true;
        return;
      }
      inFlight = true;
      fetch(`${API_BASE_URL}/api/notifications?per_page=50`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!body?.data) return;
        setBackendNotifications(body.data);
      })
      .catch(() => {})
      .finally(() => {
        inFlight = false;
        if (refreshQueued) {
          refreshQueued = false;
          load();
        }
      });
    };
    load();
    // Rider status changes happen on a different device, so there is no
    // browser event to carry the update to the customer. Poll frequently
    // enough for delivery notifications to feel connected, and always
    // refresh immediately when the customer returns to the tab.
    const poll = window.setInterval(load, ACTIVE_NOTIFICATION_REFRESH_MS);
    // A status update made in this browser (for example while testing the
    // rider and customer accounts in separate tabs) has already been
    // accepted by the server when ORDERS_CHANGED_EVENT fires. Refresh the
    // notification feed then instead of leaving the customer to wait for
    // the next polling interval. Other devices remain covered by polling
    // and the visibility refresh below.
    window.addEventListener(ORDERS_CHANGED_EVENT, load);
    const refreshFromAnotherTab = (event) => {
      if (event.key === ORDER_PROGRESS_CHANGED_STORAGE_KEY) load();
    };
    window.addEventListener('storage', refreshFromAnotherTab);
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      controller.abort();
      window.clearInterval(poll);
      window.removeEventListener(ORDERS_CHANGED_EVENT, load);
      window.removeEventListener('storage', refreshFromAnotherTab);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
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
