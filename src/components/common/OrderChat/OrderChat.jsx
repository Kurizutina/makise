import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../../utils/catalog';
import { getSessionUser } from '../../../utils/session';
import { toUtcIso } from '../../../utils/backendTime';
import './OrderChat.css';

const authHeaders = () => {
  const token = sessionStorage.getItem('otuzanAuthenticated');
  return token ? { Authorization: `Bearer ${token}` } : null;
};

// Order-scoped chat between a customer and their assigned rider - reused as
// the same component on both the customer Track Orders card and the rider
// order-detail modal, since the backend already enforces who can actually
// read/send (see MessageController). Only renders anything once the order
// has a real backend id (`backendOrderId`) - a local-only order (never
// synced) has nothing to chat against.
const OrderChat = ({ order }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const backendOrderId = order?.backendOrderId;
  const viewerId = getSessionUser()?.id;
  const viewerRole = getSessionUser()?.role;
  const hasRider = Boolean(order?.assignedRider);
  const isClosed = ['delivered', 'cancelled'].includes(order?.status);

  useEffect(() => {
    if (!backendOrderId || !hasRider) return undefined;
    const headers = authHeaders();
    if (!headers) return undefined;
    let active = true;
    const load = () => fetch(`${API_BASE_URL}/api/orders/${backendOrderId}/messages`, { headers })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (active && body?.messages) setMessages(body.messages); })
      .catch(() => {});
    load();
    // Best-effort, matches the fire-and-forget pattern already used for
    // backend syncs elsewhere - a failed read-receipt shouldn't block
    // anything the customer/rider actually sees.
    fetch(`${API_BASE_URL}/api/orders/${backendOrderId}/messages/read`, { method: 'PATCH', headers }).catch(() => {});
    // Same 5s interval as useBackendOrders/useBackendNotifications - the
    // other participant is always on a separate device, so there's no
    // local event to react to instead.
    const poll = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(poll); };
  }, [backendOrderId, hasRider]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const headers = authHeaders();
      const response = await fetch(`${API_BASE_URL}/api/orders/${backendOrderId}/messages`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body })
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setMessages((current) => [...current, data.message]);
      setDraft('');
    } catch {
      setError('Message could not be sent. Try again.');
    } finally {
      setSending(false);
    }
  };

  if (!backendOrderId) return null;

  if (!hasRider) {
    return (
      <div className="order-chat order-chat-empty">
        <i className="fa-solid fa-comments" aria-hidden="true" />
        <p>Chat opens once a rider accepts this order.</p>
      </div>
    );
  }

  return (
    <div className="order-chat">
      <div className="order-chat-messages" ref={listRef} aria-live="polite">
        {messages.length ? messages.map((message) => (
          <div key={message.MessageID} className={`order-chat-bubble${message.SenderUserID === viewerId ? ' mine' : ''}`}>
            <span className="order-chat-sender">{message.SenderUserID === viewerId ? 'You' : message.sender?.UserName || 'Them'}</span>
            <p>{message.MessageBody}</p>
            <time>{new Date(toUtcIso(message.MessageDate)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
          </div>
        )) : (
          <p className="order-chat-hint">Say hello - messages here go straight to your {viewerRole === 'customer' ? 'rider' : 'customer'}.</p>
        )}
      </div>
      {isClosed ? (
        <p className="order-chat-closed">This order is finalized - messaging is closed.</p>
      ) : (
        <form className="order-chat-form" onSubmit={send}>
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message..."
            maxLength={1000}
            aria-label="Message"
          />
          <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message">
            <i className="fa-solid fa-paper-plane" aria-hidden="true" />
          </button>
        </form>
      )}
      {error && <small className="order-chat-error">{error}</small>}
    </div>
  );
};

export default OrderChat;
