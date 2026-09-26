import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerActivity } from '../../context/CustomerActivityContext';
import './DeliveryAdminDashboard.css';
import OrderCustomerDetails from '../../components/common/OrderCustomerDetails/OrderCustomerDetails';
import { apiAssetUrl, catalogImageUrl } from '../../utils/catalog';
import { clearSession } from '../../utils/session';
import { applyBackendTruth, toLocalOrderShape, useBackendOrders } from '../../hooks/useBackendOrders';

const SERVICE_META = {
  food: { label: 'Food Delivery', icon: 'fa-utensils', color: 'var(--color-warning)' },
  item: { label: 'Item Delivery', icon: 'fa-box', color: 'var(--color-primary-dark)' },
  bills: { label: 'Pay Bills', icon: 'fa-file-invoice-dollar', color: 'var(--color-primary)' }
};

const STATUS_LABELS = {
  pending_rider: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered', cancelled: 'Cancelled',
  pending: 'Pending', to_be_assigned: 'Pending assignment', to_be_assign: 'Pending assignment', unassigned: 'Pending assignment'
};

const NAV_ITEMS = [
  { key: 'live', label: 'Live Orders', title: 'Ongoing, Pending & Cancelled', icon: 'fa-list-check' },
  { key: 'history', label: 'History', title: 'Order Transaction History', icon: 'fa-clock-rotate-left' },
  { key: 'revenue', label: 'Revenue', title: 'Revenue Analytics', icon: 'fa-chart-column' },
  { key: 'payments', label: 'Payments', title: 'Pending Payment Requests', icon: 'fa-wallet' },
  { key: 'catalog', label: 'Brands', title: 'Brand & Service Catalog', icon: 'fa-store' },
  { key: 'riders', label: 'Riders', title: 'Rider Management', icon: 'fa-motorcycle' },
  { key: 'customers', label: 'Customers', title: 'Customer Management', icon: 'fa-users' }
];

const ACTIVE_STATUSES = ['confirmed', 'preparing', 'out_for_delivery'];
const FINAL_STATUSES = ['delivered', 'cancelled'];
const hasAssignedRider = (order) => Boolean(order.assignedRider?.id);
// An order needs an admin to pick a rider only until one is actually
// assigned - assigning no longer flips the order's own status (see
// OrderController::assign: "reserves the order for a rider, but is not
// acceptance"), so `order.status` alone can't tell "still needs a rider"
// apart from "assigned, waiting on the rider to accept." Checking
// hasAssignedRider directly is what actually distinguishes them. Before
// this, a successfully-assigned order stayed stuck showing as "Pending"
// with no visible change - which is exactly what read as "I can't assign
// a rider" (reported live, 9/25) even though the assignment itself worked.
const needsRiderAssignment = (order) => !FINAL_STATUSES.includes(order.status) && !hasAssignedRider(order);
const isAwaitingRiderResponse = (order) => (
  !FINAL_STATUSES.includes(order.status) && hasAssignedRider(order) && !ACTIVE_STATUSES.includes(order.status)
);

const inferService = (order) => {
  if (order.section && SERVICE_META[order.section]) return order.section;
  if (/bill payment/i.test(order.label || '')) return 'bills';
  return order.details?.serviceType === 'item' ? 'item' : 'food';
};

const getOrderTotal = (order) => (order.items || []).reduce(
  (total, item) => total + ((Number(item.price) || 0) * (Number(item.quantity) || 1)),
  0
);

const getItemSummary = (order) => {
  if (!order.items?.length) return order.details?.billReceiptName || 'Bill payment request';
  return order.items.map((item) => `${item.quantity || 1}× ${item.name || 'Custom item'}`).join(', ');
};

const formatCurrency = (amount) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 2
}).format(amount || 0);

const ServiceBadge = ({ service }) => {
  const meta = SERVICE_META[service];
  return <span className="admin-service-badge" style={{ '--service-color': meta.color }}><i className={`fa-solid ${meta.icon}`} />{meta.label}</span>;
};

const OrderCard = ({ order, onAssign, onStatus, riders }) => {
  const service = inferService(order);
  const meta = SERVICE_META[service];
  const assignedRiderId = String(order.assignedRider?.id || '');
  const [selectedRiderId, setSelectedRiderId] = useState(assignedRiderId);
  useEffect(() => setSelectedRiderId(assignedRiderId), [assignedRiderId]);
  const selectedRider = riders.find((rider) => String(rider.id) === selectedRiderId);
  const canAssign = !['delivered', 'cancelled'].includes(order.status);
  const nextAction = {
    confirmed: ['preparing', 'Start preparing'],
    preparing: ['out_for_delivery', 'Out for delivery'],
    out_for_delivery: ['delivered', 'Mark delivered']
  }[order.status];

  return (
    <article className="admin-order-card" style={{ '--service-color': meta.color }}>
      <div className="admin-order-card-heading">
        <div><strong>{order.id}</strong><small>{new Date(order.createdAt).toLocaleString()}</small></div>
        <ServiceBadge service={service} />
      </div>
      <OrderCustomerDetails order={order} />
      <span className="admin-order-source">{order.source}</span>
      <p>{getItemSummary(order)}</p>
      <div className="admin-order-total"><span>Order total</span><strong>{formatCurrency(getOrderTotal(order))}</strong></div>

      {canAssign && (
        <label className="admin-rider-select">
          <span>Assigned rider</span>
          <select value={selectedRiderId} onChange={(event) => setSelectedRiderId(event.target.value)}>
            <option value="">Select a rider</option>
            {order.assignedRider && !riders.some((rider) => String(rider.id) === String(order.assignedRider.id)) && <option value={order.assignedRider.id}>{order.assignedRider.name} (reassign to a registered rider)</option>}
            {riders.map((rider) => <option value={rider.id} key={rider.id}>{rider.name}</option>)}
          </select>
        </label>
      )}

      <p className="admin-order-status">{isAwaitingRiderResponse(order) ? 'Awaiting rider response' : (STATUS_LABELS[order.status] || 'Pending assignment')}</p>
      {canAssign && order.assignedRider && riders.some((rider) => String(rider.id) === assignedRiderId) && <p role="status">Assigned to {order.assignedRider.name}</p>}
      <div className="admin-order-actions">
        {order.status === 'pending_rider' && <button type="button" onClick={() => onStatus(order, 'cancelled')}>Decline</button>}
        {canAssign && <button className="primary" type="button" disabled={!selectedRider || selectedRiderId === assignedRiderId} onClick={() => onAssign(order, selectedRider)}>Assign</button>}
        {service === 'bills' && nextAction && <button className="primary" type="button" onClick={() => onStatus(order, nextAction[0])}>{nextAction[1]}</button>}
        {order.status === 'cancelled' && <span className="admin-cancelled-state"><i className="fa-solid fa-circle-xmark" /> Cancelled</span>}
      </div>
    </article>
  );
};

const LiveOrdersTab = ({ orders, onAssign, onStatus, riders }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const columns = [
    { key: 'pending', label: 'Pending', color: 'var(--color-warning)', matches: needsRiderAssignment },
    { key: 'awaiting', label: 'Awaiting Rider Response', color: '#3d9be9', matches: isAwaitingRiderResponse },
    { key: 'ongoing', label: 'Ongoing', color: '#34b875', matches: (order) => ACTIVE_STATUSES.includes(order.status) && hasAssignedRider(order) },
    { key: 'cancelled', label: 'Cancelled', color: '#f15a29', matches: (order) => order.status === 'cancelled' }
  ];
  const visibleColumns = statusFilter === 'all' ? columns : columns.filter((column) => column.key === statusFilter);

  return <section className="admin-live-orders">
    <div className="admin-live-toolbar">
      <label>
        <span>Filter orders</span>
        <select aria-label="Filter live orders by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All Orders</option>
          <option value="pending">Pending Orders</option>
          <option value="awaiting">Awaiting Rider Response</option>
          <option value="ongoing">Ongoing Orders</option>
          <option value="cancelled">Cancelled Orders</option>
        </select>
      </label>
    </div>
    <div className="admin-order-columns">{visibleColumns.map((column) => {
      const list = orders.filter(column.matches);
      return <section className="admin-order-column" key={column.key}>
        <div className="admin-column-heading"><i style={{ background: column.color }} /><h2>{column.label}</h2><span>{list.length}</span></div>
        <div className="admin-column-list">{list.length
          ? list.map((order) => <OrderCard order={order} onAssign={onAssign} onStatus={onStatus} riders={riders} key={order.id} />)
          : <div className="admin-empty-column">No {column.label.toLowerCase()} orders</div>}
        </div>
      </section>;
    })}</div>
  </section>;
};

// Business calendar date (Asia/Manila), not the browser's own local
// timezone - matches the convention OrderController::revenue already uses
// server-side, so "today" means the same day here as it does on the admin's
// Revenue tab, regardless of what timezone the admin's own machine is set
// to. en-CA formats as YYYY-MM-DD, which sorts/compares correctly as a
// plain string.
const manilaDateString = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(value));

// One shared date-filter control for History and Revenue, per the request
// that both use "one consistent date-filter UI pattern" rather than two
// different pickers. `value` is '' (all dates), 'today', or an exact
// Y-m-d string typed/picked in the date input - all three are sent to the
// backend as a real query param (`date=...`) rather than filtered
// client-side, so results aren't limited to whatever page is already loaded.
const DateFilter = ({ value, onChange, today }) => (
  <div className="admin-filter-row admin-date-filter">
    <button type="button" className={value === '' ? 'active' : ''} onClick={() => onChange('')}>All dates</button>
    <button type="button" className={value === today ? 'active' : ''} onClick={() => onChange(today)}>Today</button>
    <input
      type="date"
      aria-label="Pick an exact date"
      value={value && value !== today ? value : ''}
      max={today}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const HISTORY_PAGE_SIZE = 20;

// History used to read from the same 50-order-capped fetch Live Orders and
// Payments use (useBackendOrders + applyBackendTruth), which is fine for
// those - a bounded "what's active right now" working set - but wrong for
// History, which only grows over the business's lifetime. A client-side
// filter over that capped list would silently lose anything older than the
// most recent 50 orders (the exact bug the Revenue tab had, found 9/23).
// History now does its own fetch straight against indexAll's real server-
// side pagination (already implemented, just never exposed in the UI) so
// every order is actually reachable, just a page away rather than gone.
const HistoryTab = () => {
  const [serviceFilter, setServiceFilter] = useState('all');
  // '' (all dates) is the default rather than 'today' - defaulting to today
  // would silently hide every past order the moment nothing has happened
  // yet today, which is a real behavior change on top of just adding the
  // option (an admin's first instinct on an empty-looking History tab
  // shouldn't be "is something broken"). An exact date is an explicit pick.
  // Sent to the backend as a real `date` query param (OrderController::
  // indexAll) rather than filtered client-side, so picking a date reaches
  // every matching order, not just whatever's on the current page.
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const today = useMemo(() => manilaDateString(Date.now()), []);

  useEffect(() => { setPage(1); }, [dateFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const api = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const params = new URLSearchParams({ status: 'delivered,cancelled', per_page: String(HISTORY_PAGE_SIZE), page: String(page) });
    if (dateFilter) params.set('date', dateFilter);
    fetch(`${api}/api/admin/orders?${params}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('otuzanAuthenticated')}` },
      signal: controller.signal
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setResult)
      .catch(() => { if (!controller.signal.aborted) setError('Unable to load history right now. Try again shortly.'); });
    return () => controller.abort();
  }, [page, dateFilter]);

  if (error) return <section><div className="admin-table-empty">{error}</div></section>;
  if (!result) return <section><div className="admin-table-empty">Loading history…</div></section>;

  const orders = result.data.map(toLocalOrderShape);
  const rows = orders.filter((order) => serviceFilter === 'all' || inferService(order) === serviceFilter);
  return <section>
    <DateFilter value={dateFilter} onChange={setDateFilter} today={today} />
    <div className="admin-filter-row">{['all', 'food', 'item', 'bills'].map((key) => <button className={serviceFilter === key ? 'active' : ''} type="button" onClick={() => setServiceFilter(key)} key={key}>{key === 'all' ? 'All services' : SERVICE_META[key].label}</button>)}</div>
    <div className="admin-table-wrap"><table><thead><tr><th>Order ID</th><th>Service</th><th>Customer</th><th>Date</th><th>Total</th><th>Rider</th><th>Status</th></tr></thead><tbody>{rows.map((order) => <tr key={order.id}><td>{order.id}</td><td><ServiceBadge service={inferService(order)} /></td><td><OrderCustomerDetails order={order} /></td><td>{new Date(order.createdAt).toLocaleString()}</td><td>{formatCurrency(getOrderTotal(order))}</td><td>{order.assignedRider?.name || '—'}</td><td><span className={`admin-history-status ${order.status}`}>{order.status}</span></td></tr>)}</tbody></table>{!rows.length && <div className="admin-table-empty">{dateFilter ? 'No completed transactions on that date.' : 'No completed transactions on this page.'}</div>}</div>
    {result.last_page > 1 && (
      <div className="admin-pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>← Previous</button>
        <span>Page {result.current_page} of {result.last_page} ({result.total} total)</span>
        <button type="button" disabled={page >= result.last_page} onClick={() => setPage((current) => current + 1)}>Next →</button>
      </div>
    )}
  </section>;
};

// Revenue used to be derived by summing whatever page of `orders` the
// dashboard already had loaded for display - correct-looking, but silently
// wrong once total order volume passed the 50-per-page cap that list is
// fetched with. This now calls the dedicated backend endpoint
// (OrderController::revenue) that aggregates over every non-cancelled order
// in the table, not just the ones currently in view.
const RevenueTab = () => {
  // '' (all dates) is the default - matches the pre-existing "all-time
  // total" behavior exactly, an exact date narrows the stat cards below to
  // just that day via OrderController::revenue's `date` param. The `daily`
  // series behind the line graph is always all-time regardless of this
  // filter - see the backend's own comment for why.
  const [dateFilter, setDateFilter] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const today = useMemo(() => manilaDateString(Date.now()), []);
  useEffect(() => {
    const controller = new AbortController();
    const api = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const params = new URLSearchParams(dateFilter ? { date: dateFilter } : {});
    fetch(`${api}/api/admin/revenue?${params}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('otuzanAuthenticated')}` },
      signal: controller.signal
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setData)
      .catch(() => { if (!controller.signal.aborted) setError('Unable to load revenue right now. Try again shortly.'); });
    return () => controller.abort();
  }, [dateFilter]);

  if (error) return <section><div className="admin-table-empty">{error}</div></section>;
  if (!data) return <section><div className="admin-table-empty">Loading revenue…</div></section>;

  const totals = data.byService || {};
  const grandTotal = data.total || 0;
  const maximum = Math.max(...Object.values(totals), 1);

  // Trend arrow compares today's revenue-so-far against yesterday's - both
  // read straight from the same `daily` breakdown the line-graph data would
  // use, bucketed by Asia/Manila calendar day (matches the History filter's
  // convention). A day with no orders at all just isn't in `daily`, so a
  // missing entry means 0, not "no data" - a day that earned nothing really
  // did earn less than a day that earned something.
  const dailyByDate = Object.fromEntries((data.daily || []).map((day) => [day.date, day.revenue]));
  const todayKey = manilaDateString(Date.now());
  const yesterdayKey = manilaDateString(Date.now() - 24 * 60 * 60 * 1000);
  const todayRevenue = dailyByDate[todayKey] || 0;
  const yesterdayRevenue = dailyByDate[yesterdayKey] || 0;
  const trend = todayRevenue > yesterdayRevenue ? 'up' : todayRevenue < yesterdayRevenue ? 'down' : 'flat';
  const trendIcon = { up: 'fa-arrow-trend-up', down: 'fa-arrow-trend-down', flat: 'fa-minus' }[trend];
  const trendLabel = {
    up: `Up from ${formatCurrency(yesterdayRevenue)} yesterday`,
    down: `Down from ${formatCurrency(yesterdayRevenue)} yesterday`,
    flat: `Same as yesterday (${formatCurrency(yesterdayRevenue)})`
  }[trend];

  return <section>
    <DateFilter value={dateFilter} onChange={setDateFilter} today={today} />
    <div className="admin-stat-grid">
      <div className="admin-stat-card featured">
        <span>{dateFilter ? `Revenue on ${dateFilter}` : 'Total recorded revenue'}</span>
        <strong>{formatCurrency(grandTotal)}</strong>
        {!dateFilter && <span className={`admin-revenue-trend admin-revenue-trend-${trend}`} title={trendLabel}>
          <i className={`fa-solid ${trendIcon}`} aria-hidden="true" /> {trendLabel}
        </span>}
      </div>
      {Object.entries(SERVICE_META).map(([key, meta]) => <div className="admin-stat-card" key={key}><span>{meta.label}</span><strong style={{ color: meta.color }}>{formatCurrency(totals[key] || 0)}</strong></div>)}
    </div>
    <div className="admin-analytics-card"><h2>Revenue over time</h2><p>Daily total across every day on record - unaffected by the date filter above, so the trend stays visible while you drill into a single day's numbers.</p><RevenueBarGraph daily={data.daily || []} /></div>
    <div className="admin-analytics-card"><h2>Revenue by service</h2><p>Calculated from the delivery or service fee on every non-cancelled order{dateFilter ? ' on the selected date' : ' on record, not just what\'s currently loaded'}.</p><div className="admin-revenue-bars">{Object.entries(SERVICE_META).map(([key, meta]) => <div key={key}><span>{meta.label}</span><div><i style={{ width: `${((totals[key] || 0) / maximum) * 100}%`, background: meta.color }} /></div><strong>{formatCurrency(totals[key] || 0)}</strong></div>)}</div></div>
  </section>;
};

// Plain inline SVG bar chart - the `daily` breakdown OrderController::
// revenue already returns is exactly the series this needs, so no new
// backend work, no charting library. Renders nothing (rather than an empty/
// broken chart) with no days at all; a single day still draws one bar fine,
// unlike the line chart this replaced which needed at least two points.
const RevenueBarGraph = ({ daily }) => {
  const width = 640;
  const height = 180;
  const padding = 28;
  if (!daily.length) {
    return <div className="admin-table-empty">Not enough daily history yet to plot a trend.</div>;
  }
  const maxRevenue = Math.max(...daily.map((day) => day.revenue), 1);
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const gap = 6;
  const barWidth = Math.max((plotWidth - gap * (daily.length - 1)) / daily.length, 1);
  const bars = daily.map((day, index) => {
    const barHeight = (day.revenue / maxRevenue) * plotHeight;
    const x = padding + index * (barWidth + gap);
    const y = height - padding - barHeight;
    return { x, y, barHeight, day };
  });
  const labelEvery = Math.ceil(daily.length / 6);

  return <svg className="admin-revenue-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily revenue trend">
    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="admin-revenue-graph-axis" />
    {bars.map((bar) => <rect
      x={bar.x} y={bar.y} width={barWidth} height={bar.barHeight}
      rx="3" className="admin-revenue-graph-bar" key={bar.day.date}
    >
      <title>{`${bar.day.date}: ${formatCurrency(bar.day.revenue)}`}</title>
    </rect>)}
    {bars.filter((_, index) => index % labelEvery === 0 || index === bars.length - 1).map((bar) => (
      <text x={bar.x + barWidth / 2} y={height - padding + 16} className="admin-revenue-graph-label" textAnchor="middle" key={bar.day.date}>
        {bar.day.date.slice(5)}
      </text>
    ))}
  </svg>;
};

const PaymentsTab = ({ orders, onPaymentStatus }) => {
  const [zoomedImage, setZoomedImage] = useState(null);
  useEffect(() => {
    if (!zoomedImage) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setZoomedImage(null); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [zoomedImage]);
  const payments = orders.filter((order) => inferService(order) === 'bills');
  return <>
    <div className="admin-payment-list">{payments.map((order) => <article className="admin-payment-card" key={order.id}>
      <div><small>{order.id}</small><OrderCustomerDetails order={order} /><span>{order.source}</span></div>
      <div><small>Uploaded bill</small><strong>{order.details?.billReceiptName || 'No receipt uploaded'}</strong><span>{order.details?.transferProofName || 'No transfer proof'}</span><div className="admin-payment-documents">{order.details?.billReceiptUrl && <button type="button" className="admin-payment-thumb" onClick={() => setZoomedImage({ url: apiAssetUrl(order.details.billReceiptUrl), alt: 'Uploaded bill receipt' })}><img src={apiAssetUrl(order.details.billReceiptUrl)} alt="Uploaded bill receipt" /><span>View receipt</span></button>}{order.details?.transferProofUrl && <button type="button" className="admin-payment-thumb" onClick={() => setZoomedImage({ url: apiAssetUrl(order.details.transferProofUrl), alt: 'Uploaded proof of payment' })}><img src={apiAssetUrl(order.details.transferProofUrl)} alt="Uploaded proof of payment" /><span>View proof</span></button>}</div></div>
      <span className={`admin-payment-status ${order.details?.paymentStatus || 'pending'}`}>{order.details?.paymentStatus || 'pending'}</span>
      {(order.details?.paymentStatus || 'pending') === 'pending' && <div className="admin-payment-actions"><button className="primary" type="button" onClick={() => onPaymentStatus(order, 'verified')}>Verify</button><button type="button" onClick={() => onPaymentStatus(order, 'rejected')}>Reject</button></div>}
    </article>)}{!payments.length && <div className="admin-page-empty"><i className="fa-solid fa-file-invoice" /><h2>No payment requests</h2><p>Customer bill-payment submissions will appear here.</p></div>}</div>

    {zoomedImage && (
      <div className="admin-image-zoom-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setZoomedImage(null); }}>
        <button type="button" className="admin-image-zoom-close" onClick={() => setZoomedImage(null)} aria-label="Close">×</button>
        <img src={zoomedImage.url} alt={zoomedImage.alt} />
      </div>
    )}
  </>;
};

const CatalogTab = () => {
  const api = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const [module, setModule] = useState('brands');
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Distinguishes "still fetching" from "genuinely empty" - confirmed live
  // (9/22 QA pass) that without this, the Brands tab flashed "No brands
  // found." on a real page load with 16 real brands in the database, since
  // `items` starts as [] and looked identical to an actually-empty result
  // until the fetch resolved.
  const [loading, setLoading] = useState(true);
  const activeModule = useRef(module);
  const latestCatalogRequest = useRef(0);
  const blank = useCallback(() => module === 'services' ? { ServiceName: '', ServiceType: 'item', Description: '', IsActive: true } : module === 'brands' ? { BrandName: '', ServiceID: '', Description: '', IsActive: true } : { ProductName: '', BrandID: '', ProductPrice: '', Description: '', IsActive: true }, [module]);
  const [form, setForm] = useState(blank());
  const [logoFile, setLogoFile] = useState(null);
  const [productImageFile, setProductImageFile] = useState(null);
  const request = useCallback(async (path, options = {}) => {
    const isFormData = options.body instanceof FormData;
    const response = await fetch(`${api}/api/admin/catalog/${path}`, { ...options, headers: { Authorization: `Bearer ${sessionStorage.getItem('otuzanAuthenticated')}`, ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || Object.values(body.errors || {}).flat()[0] || 'Unable to save catalog changes.');
    return body;
  }, [api]);
  const loadOptions = useCallback(async () => {
    try {
      const data = await request('options');
      setServices(data.services); setBrands(data.brands);
    } catch (e) { setError(e.message); }
  }, [request]);
  const load = useCallback(async () => {
    const requestedModule = module;
    const requestId = ++latestCatalogRequest.current;
    setLoading(true);
    try {
      setError('');
      const params = new URLSearchParams({ page, per_page: 10 });
      if (search.trim()) params.set('search', search.trim());
      if (filter) params.set(module === 'products' ? 'brand_id' : 'service_id', filter);
      const data = await request(`${module}?${params}`);
      // A request for a previously selected tab may finish after the user has
      // switched tabs. Do not render those records in the current table.
      if (activeModule.current !== requestedModule || requestId !== latestCatalogRequest.current) return;
      setItems(data.data); setMeta(data);
    } catch (e) { if (activeModule.current === requestedModule && requestId === latestCatalogRequest.current) setError(e.message); }
    finally { if (activeModule.current === requestedModule && requestId === latestCatalogRequest.current) setLoading(false); }
  }, [filter, module, page, request, search]);
  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => {
    if (module !== 'products' || !form.BrandID) { setCategories([]); return undefined; }
    let active = true;
    request(`categories?brand_id=${form.BrandID}`).then((data) => {
      if (active) setCategories(data.categories || []);
    }).catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, [form.BrandID, module, request]);
  useEffect(() => { setPage(1); setItems([]); setLoading(true); setEditing(null); setLogoFile(null); setProductImageFile(null); setForm(blank()); }, [blank, module]);
  useEffect(() => { load(); }, [load]);
  const key = module === 'services' ? 'ServiceID' : module === 'brands' ? 'BrandID' : 'ProductID';
  const nameKey = module === 'services' ? 'ServiceName' : module === 'brands' ? 'BrandName' : 'ProductName';
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, IsActive: form.IsActive ? 1 : 0, ...(module === 'brands' && !form.ServiceID ? { ServiceID: null } : {}) };
      const hasUpload = module === 'brands' || module === 'products';
      const body = hasUpload ? (() => { const data = new FormData(); const fields = module === 'brands' ? ['BrandName', 'ServiceID', 'Description', 'IsActive'] : ['ProductName', 'BrandID', 'ProductPrice', 'Description', 'IsActive']; fields.forEach((name) => data.append(name, payload[name] ?? '')); if (module === 'brands' && logoFile) data.append('Logo', logoFile); if (module === 'products' && productImageFile) data.append('Image', productImageFile); if (editing?.[key]) data.append('_method', 'PUT'); return data; })() : JSON.stringify(payload);
      await request(editing?.[key] ? `${module}/${editing[key]}` : module, { method: hasUpload ? 'POST' : editing?.[key] ? 'PUT' : 'POST', body });
      setEditing(null); setLogoFile(null); setProductImageFile(null); setForm(blank()); await loadOptions(); if (page !== 1) setPage(1); else await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const remove = async (item) => {
    if (!window.confirm(`Delete ${item[nameKey]}? This cannot be undone.`)) return;
    try { await request(`${module}/${item[key]}`, { method: 'DELETE' }); await loadOptions(); if (page > 1 && items.length === 1) setPage(page - 1); else await load(); } catch (e) { setError(e.message); }
  };
  const beginEdit = (item) => { setEditing(item); setLogoFile(null); setProductImageFile(null); setForm({ ...blank(), ...item, ServiceID: item.ServiceID || '', BrandID: item.BrandID || '' }); };
  const filterOptions = module === 'products' ? brands : services;
  const switchModule = (value) => { activeModule.current = value; latestCatalogRequest.current += 1; setModule(value); setFilter(''); };
  const categoryOptions = [...new Set([...categories, 'Food', 'Beverages', 'Desserts', 'Rice Meals', 'Snacks'])].sort();
  return <section className="admin-catalog-manager"><div className="admin-catalog-tabs">{[['brands', 'Brands'], ['services', 'Services'], ['products', 'Products']].map(([value, label]) => <button type="button" className={module === value ? 'active' : ''} onClick={() => switchModule(value)} key={value}>{label}</button>)}</div>
    <div className="admin-catalog-toolbar"><input aria-label="Search catalog" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${module}...`} />{module !== 'services' && <select aria-label="Filter catalog" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}><option value="">All {module === 'products' ? 'brands' : 'services'}</option>{filterOptions.map((item) => <option key={item[module === 'products' ? 'BrandID' : 'ServiceID']} value={item[module === 'products' ? 'BrandID' : 'ServiceID']}>{item[module === 'products' ? 'BrandName' : 'ServiceName']}</option>)}</select>}<button type="button" className="primary" onClick={() => { setEditing({}); setLogoFile(null); setProductImageFile(null); setForm(blank()); }}>+ Add {module.slice(0, -1)}</button></div>
    {error && <p className="admin-catalog-error" role="alert">{error}</p>}
    <div className="admin-catalog-layout"><div className="admin-table-wrap"><table><thead><tr><th>{module === 'products' ? 'Product' : module.slice(0, -1)}</th>{module === 'products' && <><th>Brand</th><th>Price</th></>}{module === 'brands' && <th>Service</th>}<th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item[key]}><td><div className="admin-catalog-name">{module !== 'services' && item.ImagePath && <img src={catalogImageUrl(item.ImagePath)} alt="" loading="lazy" />}<strong>{item[nameKey]}</strong></div>{item.Description && <small className="admin-description">{item.Description}</small>}</td>{module === 'products' && <><td>{item.brand?.BrandName || 'Unassigned legacy item'}</td><td>{formatCurrency(item.ProductPrice)}</td></>}{module === 'brands' && <td>{item.service?.ServiceName || 'No service'}</td>}<td>{item.IsActive ? 'Active' : 'Hidden'}</td><td><button className="admin-edit-link" type="button" onClick={() => beginEdit(item)}>Edit</button><button className="admin-delete-link" type="button" onClick={() => remove(item)}>Delete</button></td></tr>)}</tbody></table>{loading ? <div className="admin-table-empty">Loading {module}…</div> : !items.length && <div className="admin-page-empty"><i className="fa-solid fa-box-open" /><h2>No {module} found</h2><p>{search || filter ? 'Nothing matches the current search or filter.' : `${module === 'products' ? 'Products' : module === 'brands' ? 'Brands' : 'Services'} you add will show up here.`}</p></div>}<div className="admin-pagination"><span>{meta.total} total</span><button disabled={page <= 1} type="button" onClick={() => setPage(page - 1)}>Previous</button><span>Page {meta.current_page} of {meta.last_page}</span><button disabled={page >= meta.last_page} type="button" onClick={() => setPage(page + 1)}>Next</button></div></div>
      <form className="admin-catalog-form" onSubmit={save}><div className="admin-form-heading"><div><span>{module.slice(0, -1)} management</span><h2>{editing ? `${editing[key] ? 'Edit' : 'Add'} ${module.slice(0, -1)}` : 'Catalog editor'}</h2></div></div>{editing ? <><label>Name<input required maxLength="150" value={form[nameKey]} onChange={(e) => setForm({ ...form, [nameKey]: e.target.value })} /></label>{module === 'services' && <label>Service category<select value={form.ServiceType || 'item'} onChange={(e) => setForm({ ...form, ServiceType: e.target.value })}><option value="food">Food delivery</option><option value="item">Item delivery</option><option value="bills">Bill payment</option></select></label>}{module === 'brands' && <><label>Service<select required value={form.ServiceID} onChange={(e) => setForm({ ...form, ServiceID: e.target.value })}><option value="">Choose service</option>{services.map((item) => <option value={item.ServiceID} key={item.ServiceID}>{item.ServiceName}</option>)}</select></label><label>Brand logo<input accept="image/png,image/jpeg,image/webp,image/gif" type="file" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />{logoFile ? <small className="admin-upload-note">Selected: {logoFile.name}</small> : form.ImagePath ? <small className="admin-upload-note">Current logo is kept until you select a replacement.</small> : <small className="admin-upload-note">PNG, JPG, WebP, or GIF — up to 20 MB.</small>}</label></>}{module === 'products' && <><label>Brand<select required value={form.BrandID} onChange={(e) => setForm({ ...form, BrandID: e.target.value })}><option value="">Choose a brand</option>{brands.map((item) => <option value={item.BrandID} key={item.BrandID}>{item.BrandName}</option>)}</select></label><label>Price<input required min="0" step="0.01" type="number" value={form.ProductPrice} onChange={(e) => setForm({ ...form, ProductPrice: e.target.value })} /></label><label>Product image<input accept="image/png,image/jpeg,image/webp,image/gif" type="file" onChange={(e) => setProductImageFile(e.target.files?.[0] || null)} />{productImageFile ? <small className="admin-upload-note">Selected: {productImageFile.name}</small> : form.ImagePath ? <small className="admin-upload-note">Current image is kept until you select a replacement.</small> : <small className="admin-upload-note">PNG, JPG, WebP, or GIF — up to 20 MB.</small>}</label></>}<label>{module === 'products' ? 'Category' : 'Description'}{module === 'products' ? <><input list="admin-category-options" maxLength="500" placeholder="Pick an existing category or type a new one" value={form.Description || ''} onChange={(e) => setForm({ ...form, Description: e.target.value })} /><datalist id="admin-category-options">{categoryOptions.map((option) => <option value={option} key={option} />)}</datalist><small className="admin-upload-note">Groups this product under a category on the customer menu (also drives the category chips there) - pick an existing one to avoid near-duplicates.</small></> : <textarea maxLength="500" value={form.Description || ''} onChange={(e) => setForm({ ...form, Description: e.target.value })} />}</label><label className="admin-toggle"><input type="checkbox" checked={Boolean(form.IsActive)} onChange={(e) => setForm({ ...form, IsActive: e.target.checked })} /> Visible to customers</label><div className="admin-form-actions"><button className="primary" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save'}</button><button type="button" onClick={() => { setEditing(null); setLogoFile(null); setProductImageFile(null); }}>Cancel</button></div></> : <p>Create and maintain the services, brands, and products shown in your customer catalog.</p>}</form>
    </div></section>;
};

const AccountManagementTab = ({ role, onAccountsChanged }) => {
  const api = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const label = role === 'driver' ? 'Rider' : 'Customer';
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ UserName: '', Email: '', Contact: '', Address: '', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Same "still fetching" vs. "genuinely empty" distinction as CatalogTab -
  // this table had the identical gap (no loading state at all).
  const [loading, setLoading] = useState(true);
  const request = useCallback(async (path, options = {}) => {
    const token = sessionStorage.getItem('otuzanAuthenticated');
    if (!token) throw new Error('Your admin session has expired. Sign in again.');
    const requestUrl = `${api}/api/admin/accounts/${path}`;
    const response = await fetch(requestUrl, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
      const validationError = body?.errors ? Object.values(body.errors).flat()[0] : null;
      if (response.status === 401) throw new Error('Your admin session has expired. Sign in again.');
      const responseText = body ? '' : (await response.text()).slice(0, 160).replace(/\s+/g, ' ').trim();
      throw new Error(body?.error || validationError || `Server returned HTTP ${response.status} for ${requestUrl}.${responseText ? ` Response: ${responseText}` : ''}`);
    }
    return body;
  }, [api]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError('');
      const params = new URLSearchParams({ page, per_page: 10 });
      if (search.trim()) params.set('search', search.trim());
      const data = await request(`${role}?${params}`);
      setItems(data.data); setMeta(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [page, request, role, search]);
  useEffect(() => { load(); }, [load]);
  const resetForm = () => { setEditing(null); setForm({ UserName: '', Email: '', Contact: '', Address: '', password: '' }); };
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form };
      const isEditing = Boolean(editing?.UserID);
      if (isEditing && !payload.password) delete payload.password;
      await request(isEditing ? `${role}/${editing.UserID}` : role, { method: isEditing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      resetForm(); onAccountsChanged?.();
      if (page !== 1) setPage(1); else await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const remove = async (account) => {
    if (!window.confirm(`Delete ${account.UserName}? This cannot be undone.`)) return;
    try {
      await request(`${role}/${account.UserID}`, { method: 'DELETE' }); onAccountsChanged?.();
      if (page > 1 && items.length === 1) setPage(page - 1); else await load();
    } catch (e) { setError(e.message); }
  };
  const beginEdit = (account) => { setEditing(account); setForm({ UserName: account.UserName || '', Email: account.Email || '', Contact: account.Contact || '', Address: account.Address || '', password: '' }); };
  return <section className="admin-catalog-manager">
    <div className="admin-catalog-toolbar"><input aria-label={`Search ${label.toLowerCase()}s`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={`Search ${label.toLowerCase()}s...`} /><button type="button" className="primary" onClick={() => { resetForm(); setEditing({}); }}>+ Add {label}</button></div>
    {error && <p className="admin-catalog-error" role="alert">{error}</p>}
    <div className="admin-catalog-layout"><div className="admin-table-wrap"><table><thead><tr><th>{label}</th><th>Email</th><th>Contact</th><th>Address</th><th>Actions</th></tr></thead><tbody>{items.map((account) => <tr key={account.UserID}><td><strong>{account.UserName}</strong></td><td>{account.Email}</td><td>{account.Contact || '—'}</td><td><small className="admin-description">{account.Address || '—'}</small></td><td><button className="admin-edit-link" type="button" onClick={() => beginEdit(account)}>Edit</button><button className="admin-delete-link" type="button" onClick={() => remove(account)}>Delete</button></td></tr>)}</tbody></table>{loading ? <div className="admin-table-empty">Loading {label.toLowerCase()}s…</div> : !items.length && <div className="admin-page-empty"><i className="fa-solid fa-users" /><h2>No {label.toLowerCase()}s found</h2><p>{search ? 'Nothing matches the current search.' : `${label} accounts will show up here.`}</p></div>}<div className="admin-pagination"><span>{meta.total} total</span><button disabled={page <= 1} type="button" onClick={() => setPage(page - 1)}>Previous</button><span>Page {meta.current_page} of {meta.last_page}</span><button disabled={page >= meta.last_page} type="button" onClick={() => setPage(page + 1)}>Next</button></div></div>
      <form className="admin-catalog-form" onSubmit={save}><div className="admin-form-heading"><div><span>{label} management</span><h2>{editing ? `${editing.UserID ? 'Edit' : 'Add'} ${label}` : `${label} accounts`}</h2></div></div>{editing ? <><label>Full name<input required maxLength="100" value={form.UserName} onChange={(e) => setForm({ ...form, UserName: e.target.value })} /></label><label>Email<input required type="email" maxLength="255" value={form.Email} onChange={(e) => setForm({ ...form, Email: e.target.value })} /></label><label>Contact number<input required maxLength="50" value={form.Contact} onChange={(e) => setForm({ ...form, Contact: e.target.value })} /></label><label>Address<textarea maxLength="2000" value={form.Address} onChange={(e) => setForm({ ...form, Address: e.target.value })} /></label><label>{editing.UserID ? 'New password (optional)' : 'Password'}<input required={!editing.UserID} minLength="6" maxLength="72" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><div className="admin-form-actions"><button className="primary" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save'}</button><button type="button" onClick={resetForm}>Cancel</button></div></> : <p>Create, update, search, and remove {label.toLowerCase()} accounts.</p>}</form>
    </div>
  </section>;
};

const DeliveryAdminDashboard = () => {
  const navigate = useNavigate();
  const { orders: localOrders, updateOrderStatus, assignOrderToRider, updatePaymentStatus } = useCustomerActivity();
  const backendOrdersById = useBackendOrders('/api/admin/orders?per_page=50');
  const orders = useMemo(() => applyBackendTruth(localOrders, backendOrdersById), [localOrders, backendOrdersById]);
  const [activeTab, setActiveTab] = useState('live');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [riders, setRiders] = useState([]);
  const [riderError, setRiderError] = useState('');
  const [riderRefresh, setRiderRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const loadRiders = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/riders`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('otuzanAuthenticated')}` },
          signal: controller.signal
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load riders');
        setRiders(result.riders);
      } catch (error) {
        if (!controller.signal.aborted) setRiderError('Unable to load registered riders. Sign in again or check the backend connection.');
      }
    };
    loadRiders();
    return () => controller.abort();
  }, [riderRefresh]);
  const pendingCount = orders.filter(needsRiderAssignment).length;
  const activeNav = useMemo(() => NAV_ITEMS.find((item) => item.key === activeTab), [activeTab]);

  const logout = () => { clearSession(); navigate('/login', { replace: true }); };
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return <main className="admin-dashboard-page">
    <aside className={`admin-sidebar ${isMobileMenuOpen ? 'menu-open' : ''}`}>
      <div className="admin-brand">
        <img src="/images/otu-zan-logo.jpg" alt="Otu-Zan" />
        <div><strong>Otu-Zan</strong><span>Admin Console</span></div>
        <button
          className="admin-menu-toggle"
          type="button"
          aria-label={isMobileMenuOpen ? 'Close admin navigation' : 'Open admin navigation'}
          aria-controls="admin-navigation"
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((open) => !open)}
        >
          <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`} />
        </button>
      </div>
      <div className="admin-sidebar-menu" id="admin-navigation">
        <nav>{NAV_ITEMS.map((item) => <button className={activeTab === item.key ? 'active' : ''} type="button" onClick={() => handleTabChange(item.key)} key={item.key}><i className={`fa-solid ${item.icon}`} /><span>{item.label}</span>{item.key === 'live' && pendingCount > 0 && <b>{pendingCount}</b>}</button>)}</nav>
        <div className="admin-account"><span>OA</span><div><strong>Operations Admin</strong><small>Otu-Zan management</small></div></div>
        <button className="admin-logout" type="button" onClick={logout}><i className="fa-solid fa-arrow-right-from-bracket" /> Log Out</button>
      </div>
    </aside>

    <section className="admin-main">
      <header className="admin-page-header"><div><span>Otu-Zan Management</span><h1>{activeNav.title}</h1><p>{new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div>{activeTab === 'live' && <div className="admin-header-services">{Object.keys(SERVICE_META).map((service) => <ServiceBadge service={service} key={service} />)}</div>}</header>
      {riderError && <p role="alert">{riderError}</p>}
      {activeTab === 'live' && <LiveOrdersTab orders={orders} onAssign={assignOrderToRider} onStatus={updateOrderStatus} riders={riders} />}
      {activeTab === 'history' && <HistoryTab />}
      {activeTab === 'revenue' && <RevenueTab />}
      {activeTab === 'payments' && <PaymentsTab orders={orders} onPaymentStatus={updatePaymentStatus} />}
      {activeTab === 'catalog' && <CatalogTab />}
      {activeTab === 'riders' && <AccountManagementTab role="driver" onAccountsChanged={() => setRiderRefresh((count) => count + 1)} />}
      {activeTab === 'customers' && <AccountManagementTab role="customer" />}
    </section>
  </main>;
};

export default DeliveryAdminDashboard;
