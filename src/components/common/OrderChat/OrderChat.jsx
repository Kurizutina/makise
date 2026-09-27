import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../../utils/catalog';
import { getSessionUser } from '../../../utils/session';
import { toUtcIso } from '../../../utils/backendTime';
import './OrderChat.css';

// Chat is only mounted for an open, assigned delivery, so it can refresh at
// a more conversational cadence without polling every order in the app.
const CHAT_REFRESH_MS = 1000;
const CHAT_CHANNEL = 'otuzan-order-chat';

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
  const channelRef = useRef(null);
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
    let inFlight = false;
    const load = () => {
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      fetch(`${API_BASE_URL}/api/orders/${backendOrderId}/messages`, { headers })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (active && body?.messages) setMessages(body.messages); })
      .catch(() => {})
      .finally(() => { inFlight = false; });
    };
    load();
    // Best-effort, matches the fire-and-forget pattern already used for
    // backend syncs elsewhere - a failed read-receipt shouldn't block
    // anything the customer/rider actually sees.
    fetch(`${API_BASE_URL}/api/orders/${backendOrderId}/messages/read`, { method: 'PATCH', headers }).catch(() => {});
    // Separate devices do not share browser events. Refresh an open chat
    // every second; skipped overlapping/hidden-tab requests keep this cheap.
    const poll = window.setInterval(load, CHAT_REFRESH_MS);
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [backendOrderId, hasRider]);

  // Browser tabs do not share window events, but BroadcastChannel does.
  // This makes a customer/rider pair being demonstrated on the same device
  // reflect a successfully sent message immediately; the one-second API
  // refresh above remains the cross-device fallback.
  useEffect(() => {
    if (!backendOrderId || !window.BroadcastChannel) return undefined;
    const channel = new BroadcastChannel(CHAT_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (event) => {
      const update = event.data;
      if (update?.type !== 'message' || String(update.orderId) !== String(backendOrderId) || !update.message) return;
      setMessages((current) => current.some((message) => String(message.MessageID) === String(update.message.MessageID))
        ? current
        : [...current, update.message]);
    };
    return () => {
      channel.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [backendOrderId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    const temporaryId = `sending-${Date.now()}-${Math.random()}`;
    const optimisticMessage = {
      MessageID: temporaryId,
      SenderUserID: viewerId,
      MessageBody: body,
      MessageDate: new Date().toISOString(),
      sender: { UserName: 'You' }
    };
    setSending(true);
    setError('');
    // Never make the sender wait on a round-trip before seeing their own
    // message. A failed request removes this temporary bubble and restores
    // the draft so it is not lost.
    setMessages((current) => [...current, optimisticMessage]);
    setDraft('');
    try {
      const headers = authHeaders();
      const response = await fetch(`${API_BASE_URL}/api/orders/${backendOrderId}/messages`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body })
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setMessages((current) => {
        const hadOptimisticMessage = current.some((message) => message.MessageID === temporaryId);
        const withoutOptimisticMessage = current.map((message) => message.MessageID === temporaryId ? data.message : message);
        return hadOptimisticMessage || withoutOptimisticMessage.some((message) => String(message.MessageID) === String(data.message.MessageID))
          ? withoutOptimisticMessage
          : [...withoutOptimisticMessage, data.message];
      });
      channelRef.current?.postMessage({ type: 'message', orderId: backendOrderId, message: data.message });
    } catch {
      setMessages((current) => current.filter((message) => message.MessageID !== temporaryId));
      setDraft(body);
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
          <div key={message.MessageID} className={`order-chat-bubble${String(message.SenderUserID) === String(viewerId) ? ' mine' : ''}`}>
            <span className="order-chat-sender">{String(message.SenderUserID) === String(viewerId) ? 'You' : message.sender?.UserName || 'Them'}</span>
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
