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
