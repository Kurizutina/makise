import React, { useState } from 'react';
import { useCustomerActivity } from '../../../../context/CustomerActivityContext';
import './CustomerActivity.css';

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

const CustomerActivity = () => {
  const {
    cart,
    orders,
    notifications,
    updateCartQuantity,
    placeCartOrder,
    markNotificationsRead
  } = useCustomerActivity();
  const [openPanel, setOpenPanel] = useState(null);
  const [activityTab, setActivityTab] = useState('notifications');
  const unreadCount = notifications.filter((item) => !item.read).length;
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + (item.price || 0) * item.quantity, 0);

  const openActivity = () => {
    setOpenPanel('activity');
    setActivityTab('notifications');
    markNotificationsRead();
  };

  const confirmCart = () => {
    const order = placeCartOrder();
    if (order) {
      setOpenPanel('activity');
      setActivityTab('orders');
    }
  };

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
                        <div className="tracking-card-heading"><div><small>{order.id}</small><strong>{order.label}</strong></div><span>{statusLabels[order.status] || 'Confirmed'}</span></div>
                        <p>{order.source} · {new Date(order.createdAt).toLocaleString()}</p>

                        {!!order.items?.length && (
                          <details className="tracking-order-items">
                            <summary>View ordered items ({order.items.reduce((total, item) => total + (item.quantity || 1), 0)})</summary>
                            <ul>{order.items.map((item, index) => <li key={item.cartId || item.id || index}><span>{item.name || `Item ${index + 1}`}</span><strong>×{item.quantity || 1}</strong></li>)}</ul>
                          </details>
                        )}

                        {order.status === 'pending_rider' && (
                          <div className="rider-decision-state"><i className="fa-solid fa-clock" aria-hidden="true" /><div><strong>Waiting for a rider</strong><span>Tracking will begin after a rider accepts your order.</span></div></div>
                        )}

                        {order.status === 'cancelled' && (
                          <div className="rider-decision-state cancelled"><i className="fa-solid fa-circle-xmark" aria-hidden="true" /><div><strong>Cancelled by rider</strong><span>This order will not proceed to delivery.</span></div></div>
                        )}

                        {!['pending_rider', 'cancelled'].includes(order.status) && (
                          <div className="tracking-progress">
                            {progressSteps.map((step, index) => {
                              const currentIndex = statusIndexes[order.status] ?? 0;
                              const isComplete = index <= currentIndex;
                              return <div className={`${isComplete ? 'complete' : ''} ${index === currentIndex ? 'current' : ''}`} key={step}><i className={isComplete ? 'fa-solid fa-check' : ''}>{isComplete ? '' : index + 1}</i><span>{step}</span></div>;
                            })}
                          </div>
                        )}
                      </article>
                    )) : <EmptyState icon="fa-route" title="No active orders" message="Placed orders will be tracked here." />
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
                    <button className="global-cart-place" type="button" onClick={confirmCart}>Place Order</button>
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
