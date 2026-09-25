import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  calculateEstimatedWaitMinutes,
  getOrderDisplayLabel,
  useCustomerActivity
} from '../../../../context/CustomerActivityContext';
import './CustomerActivity.css';
import { calculateDeliveryFee, findDeliveryLocation } from '../../../../utils/deliveryRates';
import LocationPicker from '../LocationPicker/LocationPicker';
import { getSessionUser } from '../../../../utils/session';
import { applyBackendTruth, useBackendOrders } from '../../../../hooks/useBackendOrders';
import { toLocalNotificationShape, useBackendNotifications } from '../../../../hooks/useBackendNotifications';
import OrderChat from '../../../common/OrderChat/OrderChat';
import { happenedTodayInManila, remainsVisibleToday } from '../../../../utils/backendTime';

const NotificationIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" />
  </svg>
);

const CartIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="20" r="1" /><circle cx="19" cy="20" r="1" /><path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6" />
  </svg>
);

const formatPrice = (price) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 2
}).format(price);

const progressSteps = ['Confirmed', 'Preparing', 'Out for delivery', 'Delivered'];
const statusLabels = {
  pending_rider: 'Waiting for rider',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};
const statusIndexes = { confirmed: 0, preparing: 1, out_for_delivery: 2, delivered: 3 };

const formatEstimatedWait = (order, now) => {
  const estimatedMinutes = order.estimatedWaitMinutes
    || calculateEstimatedWaitMinutes(order.items);

  if (order.status === 'pending_rider') {
    // queuePosition is the order's real, live rank among every order still
    // waiting backend-wide (see useBackendOrders.js) - only present once the
    // backend actually knows about this order. Falls back to the flat
    // per-order formula for order types that aren't backend-synced yet.
    if (Number.isInteger(order.queuePosition)) {
      const ahead = order.queuePosition - 1;
      return ahead > 0
        ? `${ahead} order${ahead === 1 ? '' : 's'} ahead of you • ~${estimatedMinutes} min after confirmation`
        : `You're next • ~${estimatedMinutes} min after confirmation`;
    }
    return `${estimatedMinutes} min after confirmation`;
  }
  if (order.status === 'cancelled') return 'Order cancelled';
  if (order.status === 'delivered') return 'Completed';

  const startedAt = Date.parse(order.confirmedAt || order.updatedAt || order.createdAt);
  const completionAt = Date.parse(order.estimatedCompletionAt)
    || (startedAt + (estimatedMinutes * 60 * 1000));
  const remainingSeconds = Math.max(0, Math.ceil((completionAt - now) / 1000));

  if (!remainingSeconds) return 'Due now';
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = String(remainingSeconds % 60).padStart(2, '0');
  return `${minutes}m ${seconds}s remaining`;
};

const EstimatedWait = ({ order, now }) => (
  <div className="estimated-wait-row">
    <span className="estimated-wait-label">Estimated Wait Time</span>
    <div className={`estimated-wait-time ${order.status === 'cancelled' ? 'cancelled' : ''}`}>
      <i className="fa-regular fa-clock" aria-hidden="true" />
      <strong>{formatEstimatedWait(order, now)}</strong>
    </div>
  </div>
);

const CustomerActivity = () => {
  const navigate = useNavigate();
  const {
    cart,
    orders: localOrders,
    notifications: localNotifications,
    deliveryLocation,
    updateCartQuantity,
    placeCartOrder,
    markNotificationsRead,
    updateOrderStatus
  } = useCustomerActivity();
  const backendOrdersById = useBackendOrders('/api/orders?per_page=50');
  const allOrders = useMemo(() => applyBackendTruth(localOrders, backendOrdersById), [localOrders, backendOrdersById]);
  const [now, setNow] = useState(Date.now());
  // Completed orders stay available for the rest of the Manila business day
  // in both customer tracking and the rider dashboard.
  const orders = useMemo(() => allOrders.filter((order) => remainsVisibleToday(order, now)), [allOrders, now]);
  const backendNotifications = useBackendNotifications();
  // Local notifications only ever cover "order request sent" (instant,
  // same-device - see placeOrder/placeCartOrder). Everything admin/rider
  // triggers (status changes, payment verify/reject) is backend-only now
  // (step 1g) since it has to reach whatever device the customer checks
  // from next, not just the browser that placed the order. Disjoint event
  // sources by design, so this union never needs deduping.
  const sessionUserId = getSessionUser()?.id;
  const clearedAtKey = sessionUserId ? `otuzanNotificationsClearedAt:${sessionUserId}` : null;
  const [clearedAt, setClearedAt] = useState(() => {
    try { return clearedAtKey ? Number(localStorage.getItem(clearedAtKey)) || 0 : 0; } catch { return 0; }
  });
  const notifications = useMemo(() => (
    [...localNotifications, ...backendNotifications.map(toLocalNotificationShape)]
      .filter((item) => Date.parse(item.createdAt) > clearedAt)
      .filter((item) => happenedTodayInManila(item.createdAt, now))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  ), [localNotifications, backendNotifications, clearedAt, now]);
  const clearAllNotifications = () => {
    const clearTimestamp = Date.now();
    try { if (clearedAtKey) localStorage.setItem(clearedAtKey, String(clearTimestamp)); } catch { /* ignore */ }
    setClearedAt(clearTimestamp);
  };
  const [openPanel, setOpenPanel] = useState(null);
  const [activityTab, setActivityTab] = useState('notifications');
  const customerType = getSessionUser()?.userType || 'non_student';
  const unreadCount = notifications.filter((item) => !item.read).length;
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + (item.price || 0) * item.quantity, 0);

  useEffect(() => {
    const countdown = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(countdown);
  }, []);

  const openActivity = () => {
    setOpenPanel('activity');
    setActivityTab('notifications');
    markNotificationsRead();
  };

  const confirmCart = () => {
    if (!deliveryLocation) return;
    if (!getSessionUser()) {
      navigate('/login');
      return;
    }
    const order = placeCartOrder(null, deliveryLocation, customerType);
    if (order) {
      setOpenPanel('activity');
      setActivityTab('orders');
    }
  };
  const selectedLocation = findDeliveryLocation(deliveryLocation);
  const deliveryFee = customerType
    ? calculateDeliveryFee(selectedLocation, customerType)
    : { serviceFee: selectedLocation?.fee || 0, surchargeApplied: false };

  return (
    <>
      <button className="header-action-button activity-trigger" type="button" aria-label="View notifications" onClick={openActivity}>
        <NotificationIcon />
        {unreadCount > 0 && <span className="activity-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      <button className="header-action-button activity-trigger" type="button" aria-label="View cart" onClick={() => setOpenPanel('cart')}>
        <CartIcon />
        {cartCount > 0 && <span className="activity-badge">{cartCount > 9 ? '9+' : cartCount}</span>}
      </button>

      {openPanel && (
        <div className="activity-drawer-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpenPanel(null);
        }}>
          <aside className="activity-drawer" aria-label={openPanel === 'cart' ? 'Shopping cart' : 'Customer activity'}>
            <div className="activity-drawer-header">
              <div>
                <span>My account</span>
                <h2>{openPanel === 'cart' ? 'Shopping Cart' : 'Notifications & Orders'}</h2>
              </div>
              <button type="button" onClick={() => setOpenPanel(null)} aria-label="Close panel">×</button>
            </div>

            {openPanel === 'activity' ? (
              <>
                <div className="activity-tabs" role="tablist">
                  <button className={activityTab === 'notifications' ? 'active' : ''} type="button" onClick={() => setActivityTab('notifications')}>Notifications</button>
                  <button className={activityTab === 'orders' ? 'active' : ''} type="button" onClick={() => setActivityTab('orders')}>Track Orders</button>
                </div>

                {activityTab === 'notifications' && notifications.length > 0 && (
                  <button type="button" className="activity-clear-all" onClick={clearAllNotifications}>Clear all</button>
                )}

                <div className="activity-drawer-body">
                  {activityTab === 'notifications' && (
                    notifications.length ? notifications.map((notification) => (
                      <article className="notification-card" key={notification.id}>
                        <span className={notification.type === 'cancelled' ? 'cancelled' : ''}><i className={`fa-solid ${notification.type === 'cancelled' ? 'fa-circle-xmark' : 'fa-circle-check'}`} aria-hidden="true" /></span>
                        <div><strong>{notification.title}</strong><p>{notification.message}</p><small>{new Date(notification.createdAt).toLocaleString()}</small></div>
                      </article>
                    )) : <EmptyState icon="fa-bell" title="No notifications yet" message="Order confirmations will appear here." />
                  )}

                  {activityTab === 'orders' && (
                    orders.length ? orders.map((order) => (
                      <article className={`order-tracking-card order-status-${order.status}`} key={order.id}>
                        <div className="tracking-card-heading"><div><small>{order.id}</small><strong>{getOrderDisplayLabel(order)}</strong></div><span>{statusLabels[order.status] || 'Confirmed'}</span></div>
                        <p>{order.source} · {new Date(order.createdAt).toLocaleString()}</p>

                        {!!order.items?.length && (
                          <details className="tracking-order-items">
                            <summary>View ordered items ({order.items.reduce((total, item) => total + (item.quantity || 1), 0)})</summary>
                            <ul>{order.items.map((item, index) => <li key={item.cartId || item.id || index}><span className="order-item-row"><span className="order-item-thumb">{item.image ? <img src={item.image} alt="" loading="lazy" /> : <i className="fa-solid fa-utensils" aria-hidden="true" />}</span><span>{item.name || `Item ${index + 1}`}</span></span><strong>×{item.quantity || 1}</strong></li>)}</ul>
                          </details>
                        )}

                        {(['pending_rider', 'cancelled'].includes(order.status) && !order.assignedRider) && (
                          <EstimatedWait order={order} now={now} />
                        )}

                        {order.status === 'pending_rider' && (
                          <div className="rider-decision-state">
                            <i className="fa-solid fa-clock" aria-hidden="true" /><div><strong>Waiting for a rider</strong><span>Tracking will begin after a rider accepts your order.</span></div>
                          </div>
                        )}

                        {order.status === 'pending_rider' && (
                          <button
                            type="button"
                            className="order-cancel-button"
                            onClick={() => window.confirm('Cancel this order? This cannot be undone.') && updateOrderStatus(order, 'cancelled')}
                          >
                            Cancel Order
                          </button>
                        )}

                        {order.status === 'cancelled' && (
                          <div className="rider-decision-state cancelled"><i className="fa-solid fa-circle-xmark" aria-hidden="true" /><div><strong>Cancelled</strong><span>This order will not proceed to delivery.</span></div></div>
                        )}

                        {!['pending_rider', 'cancelled'].includes(order.status) && (
                          <div className="tracking-progress-with-wait">
                            <div className="tracking-progress">
                              {progressSteps.map((step, index) => {
                                const currentIndex = statusIndexes[order.status] ?? 0;
                                const isComplete = index <= currentIndex;
                                return <div className={`${isComplete ? 'complete' : ''} ${index === currentIndex ? 'current' : ''}`} key={step}><i className={isComplete ? 'fa-solid fa-check' : ''}>{isComplete ? '' : index + 1}</i><span>{step}</span></div>;
                              })}
                            </div>
                            <EstimatedWait order={order} now={now} />
                          </div>
                        )}

                        <OrderChat order={order} />
                      </article>
                    )) : <EmptyState icon="fa-route" title="No active orders" message="Placed orders will be tracked here until they're delivered or cancelled." />
                  )}
                </div>
              </>
            ) : (
              <div className="activity-drawer-body cart-drawer-body">
                {!cart.length ? <EmptyState icon="fa-cart-shopping" title="Your cart is empty" message="Items you add will appear here." /> : (
                  <>
                    <div className="global-cart-items">
                      {cart.map((item) => (
                        <article className="global-cart-item" key={item.cartId}>
                          <div className="global-cart-item-copy"><small>{item.source}</small><strong>{item.name}</strong>{item.selectedOption && <span>{item.selectedOption}</span>}{item.price ? <span>{formatPrice(item.price * item.quantity)}</span> : <span>Price to be confirmed</span>}</div>
                          <div className="global-cart-quantity"><button type="button" onClick={() => updateCartQuantity(item.cartId, -1)}>−</button><output>{item.quantity}</output><button type="button" onClick={() => updateCartQuantity(item.cartId, 1)}>＋</button></div>
                        </article>
                      ))}
                    </div>
                    <div className="global-cart-summary"><span>Priced subtotal</span><strong>{formatPrice(cartTotal)}</strong></div>
                    {selectedLocation && <div className="global-cart-service-fee"><span>Service fee{deliveryFee.surchargeApplied ? ' (includes night surcharge)' : ''}</span><strong>{formatPrice(deliveryFee.serviceFee)}</strong></div>}
                    <div className="global-cart-location"><span>Delivery location</span><LocationPicker variant="inline" /></div>
                    <button className="global-cart-place" type="button" disabled={!deliveryLocation} onClick={confirmCart}>Place Order</button>
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
};

const EmptyState = ({ icon, title, message }) => (
  <div className="activity-empty"><i className={`fa-solid ${icon}`} aria-hidden="true" /><strong>{title}</strong><p>{message}</p></div>
);

export default CustomerActivity;
