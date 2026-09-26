// Laravel (config/app.php: 'timezone' => 'UTC') serializes datetime columns
// as naive strings like "2026-09-21 13:45:09" - no 'Z', no offset. Per the
// ECMAScript Date Time String Format spec, a string with no timezone
// designator is parsed as LOCAL time, not UTC - so new Date(...) on a raw
// backend timestamp silently misinterprets it, off by however many hours
// the browser's timezone is from UTC. Found live: a backend-created
// notification sorted *below* an older local one because its timestamp
// looked earlier than it actually was.
//
// Every place that turns a raw backend datetime string into a JS Date
// (order/notification synthesis in the useBackendOrders/useBackendNotifications
// hooks) needs to go through this first.
export const toUtcIso = (naiveDatetime) => (
  naiveDatetime ? `${naiveDatetime.replace(' ', 'T')}Z` : naiveDatetime
);

// The business operates on the Manila calendar, regardless of which
// timezone a rider/customer phone happens to use. Completed transactions
// remain visible for their completion day and are cleared from the active
// views once that Manila day ends.
const manilaDateKey = (value) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(value));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
};

const isDailyTransactionCutoff = (value) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(value));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(byType.hour) === 23 && Number(byType.minute) >= 59;
};

export const remainsVisibleToday = (item, now = Date.now()) => {
  if (!['delivered', 'cancelled'].includes(item.status)) return true;
  return !isDailyTransactionCutoff(now)
    && manilaDateKey(item.updatedAt || item.createdAt) === manilaDateKey(now);
};

export const happenedTodayInManila = (timestamp, now = Date.now()) => (
  !isDailyTransactionCutoff(now) && manilaDateKey(timestamp) === manilaDateKey(now)
);
