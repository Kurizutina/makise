import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerActivity } from '../../context/CustomerActivityContext';
import './DriverOrders.css';

const nextStatuses = {
  confirmed: ['preparing', 'Start Preparing'],
  preparing: ['out_for_delivery', 'Mark Out for Delivery'],
  out_for_delivery: ['delivered', 'Mark Delivered']
};

const statusLabels = {
  pending_rider: 'Needs decision', confirmed: 'Confirmed', preparing: 'Preparing',
  out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled'
};

const DriverOrders = () => {
  const navigate = useNavigate();
  const { orders, updateOrderStatus } = useCustomerActivity();
  const openOrders = orders.filter((order) => !['delivered', 'cancelled'].includes(order.status));

  return (
    <main className="driver-orders-page">
      <header className="driver-orders-header">
        <div><span>Otu-Zan Rider</span><h1>Order Inbox</h1></div>
        <button type="button" onClick={() => navigate('/login', { replace: true })}><i className="fa-solid fa-arrow-right-from-bracket" /> Log Out</button>
      </header>
      <div className="driver-orders-content">
        <div className="driver-orders-intro"><div><span>Live orders</span><h2>Requests and deliveries</h2><p>Accept or cancel new requests, then update each accepted order as it progresses.</p></div><strong>{openOrders.length} active</strong></div>
        {!orders.length ? (
          <div className="driver-empty-orders"><i className="fa-solid fa-motorcycle" /><h3>No orders yet</h3><p>New customer requests will appear here.</p></div>
        ) : (
          <div className="driver-order-grid">
            {orders.map((order) => (
              <article className={`driver-order-card status-${order.status}`} key={order.id}>
                <div className="driver-order-heading"><div><small>{order.id}</small><h3>{order.label}</h3></div><span>{statusLabels[order.status]}</span></div>
                <p className="driver-order-meta"><i className="fa-solid fa-store" /> {order.source} · {new Date(order.createdAt).toLocaleString()}</p>
                {!!order.items?.length && <div className="driver-order-items"><strong>Order items</strong><ul>{order.items.map((item, index) => <li key={item.cartId || item.id || index}><span>{item.name || `Item ${index + 1}`}</span><b>×{item.quantity || 1}</b></li>)}</ul></div>}
                {order.status === 'pending_rider' && <div className="driver-decision-buttons"><button type="button" className="driver-cancel" onClick={() => updateOrderStatus(order.id, 'cancelled')}>Cancel</button><button type="button" className="driver-accept" onClick={() => updateOrderStatus(order.id, 'confirmed')}>Accept Order</button></div>}
                {nextStatuses[order.status] && <button type="button" className="driver-advance" onClick={() => updateOrderStatus(order.id, nextStatuses[order.status][0])}>{nextStatuses[order.status][1]}</button>}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default DriverOrders;
