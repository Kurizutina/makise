import React from 'react';
import './OrderCustomerDetails.css';

const OrderCustomerDetails = ({ order }) => (
  <dl className="order-customer-details">
    <div><dt>Customer name</dt><dd>{order.customerName?.trim() || 'Name not provided'}</dd></div>
    <div><dt>Customer contact</dt><dd>{order.customerContact?.trim() || 'Contact not provided'}</dd></div>
    <div><dt>Customer address</dt><dd>{order.customerAddress?.trim() || 'Address not provided'}</dd></div>
  </dl>
);

export default OrderCustomerDetails;
