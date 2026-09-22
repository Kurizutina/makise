# Otu-Zan — Outstanding Work

Consolidated from a full audit (functional, security, and design review against the
system design doc and industry-standard delivery apps). Grouped by priority; check
items off as they land.

## Critical

- [x] **Strict adversarial QA pass (9/21)**, after the 1a-1h backend
      migration and the mobile cart fix — a dedicated round of trying to
      break the system, not just confirm it works. Full results below;
      summary: RBAC/security held up completely, one real bug found and
      fixed.

      **Found and fixed**: none of the three "place order" buttons
      (`RestaurantMenu`'s checkout, `PayBillsForm`, `OthersOrderForm`)
      guarded against rapid repeat clicks. Reproduced live: 3 fast clicks on
      "Place Order" created 3 separate, fully duplicate backend orders (same
      items, same customer, same timestamp) — a customer double-tapping on
      a slow connection would get billed for and receive duplicate
      deliveries. Fixed once, at the source, rather than patching all three
      buttons: `placeOrder`/`placeCartOrder` in `CustomerActivityContext.jsx`
      now go through a `useRef`-based guard (state wouldn't work here — several
      click handlers firing in the same tick all read the same stale value
      before a state update is visible; a ref updates immediately). Verified
      the exact same repro now produces exactly 1 order, not 3. (`3e232a0`)

      **Verified secure, no changes needed** — adversarial testing that came
      back clean:
      - RBAC: customer and driver tokens both correctly get 403 on every
        admin-only endpoint (`/admin/orders`, `/admin/catalog/*`,
        `/admin/accounts/*`, `/riders`); unauthenticated requests get 401
        everywhere.
      - Cross-user manipulation: an unassigned driver cannot update a status
        they're not assigned to (403); a customer cannot self-approve their
        own order (403) or assign a rider to it (403).
      - Mass assignment: a registration/order payload with extra fields
        (`UserID`, `DeliveryStatus`, `TotalPrice` set directly) is fully
        ignored — the server computes/derives every one of those itself.
      - Input validation: negative/zero/huge quantities, a nonexistent
        `ProductID`, an empty items array, a missing delivery address, and a
        duplicate `ProductID` in one order all correctly rejected (422).
      - SQL injection: a `'; DROP TABLE Orders; --` payload in
        `deliveryAddress` was safely stored as literal text (Eloquent's
        parameterized queries) — table intact, nothing executed. No
        `dangerouslySetInnerHTML` anywhere in the frontend either, so stored
        text can't become stored XSS through React's default rendering.
      - Terminal-state protection under genuine concurrent load: fired 10
        truly simultaneous identical "cancel" requests at the same order —
        exactly 1 succeeded, the other 9 correctly got 422. No double-
        processing under real concurrency, not just under sequential
        testing.
      - Duplicate email registration correctly rejected (409), case-
        insensitively. (Initially mis-flagged this as broken during testing
        — turned out to be my own test using an email from the automated
        suite's isolated test-database fixtures, not the real dev database;
        corrected and re-verified properly.)
      - File upload validation: a renamed `.exe` disguised as a document
        upload is rejected (422, MIME/extension check holds).
      - Rate limiting: confirmed active and enforced (429) on repeated
        login attempts.
      - Full mobile E2E smoke test (375×812 viewport): registration → menu
        browsing → Pay Bills submission with real file uploads → backend
        sync, all working together correctly on a real phone-width session.

      Full frontend (20/25) and backend (27/30) test suites re-run clean
      before and after — same pre-existing failures only, already documented
      below, nothing new. All test accounts/orders/tokens/uploads created
      during this pass cleaned up afterward.

- [x] **Full commissioned-quality-bar QA pass (9/22)** — did the entire
      customer → admin → rider round trip live, start to finish, as three
      genuinely separate accounts (a real account created through the actual
      registration form, not a synthetic session), the way a real user
      actually would: registered → browsed as a guest → logged in → added
      real items to cart → placed a real order → admin saw it appear
      cross-device with correct customer info → admin assigned a rider →
      rider confirmed → preparing → out for delivery → delivered → customer's
      notification panel showed the complete, correctly-ordered trail (order
      request sent → accepted → preparing → out for delivery → delivered),
      each with a real timestamp. **Every step of that core loop worked
      correctly, no shortcuts, no synthetic data standing in for the real
      flow.** This is the load-bearing result of this pass: the actual
      product works end-to-end.

      Everything found *wrong* during this pass is written up as its own item
      where it belongs rather than duplicated here: the Revenue-tracking bug
      and the pre-deployment checklist (`APP_DEBUG`, first-admin bootstrap,
      dev-only CORS patterns) are under High/Low below, the dead-code-on-disk
      discovery and the unenforced `StockQuantity` column are under Medium,
      and the admin-table loading-state race is folded into the existing
      "Inconsistent empty states" item. None of it changes the finding above -
      the core transaction loop a real customer/admin/rider depends on is
      solid; what's left is hardening and polish around it, not a broken
      foundation.

- [x] **Admin/rider dashboards only showed orders already in that browser's own
      localStorage — invisible to orders placed on any other device** (found
      9/21 while verifying step 1f's queue positions live). `applyBackendTruth`
      only ever *overlaid* backend truth onto orders a browser already knew
      about locally (`orders.map(...)`) — it never added orders the backend
      had but this browser never locally saw. Every "verified live" test up to
      this point (this session's and, per this file's own history, the team's
      prior ones) happened to use one shared browser/tab set, so admin always
      already had a local copy to overlay onto. In the actual deployment —
      admin at the counter, riders and customers each on their own device —
      an admin or rider who never personally placed or synced that order
      would see **zero** trace of it, no matter how complete the backend's
      data was. Proven live: cleared a browser's `localStorage` entirely
      (`localStorage.clear()`, the closest a single machine can get to a
      genuinely separate device), logged in as a fresh admin who had never
      touched the app before, and found real historical orders from the
      team's own past testing (`BACKEND-5` through `BACKEND-10`, dated 9/20)
      had been invisible in every admin session since — direct evidence of
      how long this was already live, not just a theoretical gap.

      Fixed in `useBackendOrders.js`: `applyBackendTruth` now unions in every
      backend order without a local match, synthesized into the same shape a
      local order has (`toLocalOrderShape`) — customer name/contact/address
      from the eager-loaded `user` relation, brand/section from
      `items.product.brand.service` (added to `OrderController::index`'s and
      `indexAll`'s eager loads), establishment/receipt info decoded from
      `Payment.PaymentNote` for bills. **Known, documented gap**: `serviceFee`
      on a synthesized order is always 0 — delivery fee is computed
      client-side only (`utils/deliveryRates.js`) and was never sent to or
      stored by the backend, so there's nothing to recover it from; revenue
      totals that include cross-device orders will undercount until the
      backend persists it too (not done this session — flagged here, not
      silently left broken).

      Also had to fix the write side, found while verifying the read-side fix:
      `updateOrderStatus`/`assignOrderToRider`/`updatePaymentStatus` looked up
      the target order by id in local storage only, so clicking
      Decline/Assign/Verify on a synthesized order would silently do nothing
      — visible but not actionable, arguably worse than before since staff
      would think the click worked. Fixed by having callers pass the full
      order object instead of just its id; when no local copy exists, these
      functions now call the backend directly using the `backendOrderId`/
      `backendPaymentId` the synthesized object already carries. Backward
      compatible with any caller still passing a raw id string (existing
      tests do, and pass unchanged).

      Verified live end-to-end, admin and rider both, using fresh throwaway
      accounts and orders placed purely via direct API calls (i.e. never
      touched by any browser) to guarantee no local knowledge could exist:
      confirmed the orders were visible after a full `localStorage.clear()`,
      then successfully declined one, assigned a rider to another, verified a
      payment on a third, and — after assigning an order to a fresh test
      rider and clearing storage again to simulate that rider's own separate
      device — confirmed the rider could see it (customer info, brand,
      real queue position, all correct) and successfully confirm it, with the
      real PATCH request landing on the backend each time. All test
      accounts/orders cleaned up after. Backend test suite (`php artisan
      test`) and frontend suite both re-run clean (no new failures) before
      and after via `git stash` comparison.

- [x] **Fix 500 error (with leaked stack trace) on expired/missing auth tokens**
      (found 9/21 while verifying frontend-backend routing health) — pre-existing,
      not introduced this session (confirmed against `/api/auth/me`, a route that
      predates everything done today). Root cause: Laravel's default auth
      middleware tried to redirect to a non-existent "login" route whenever a
      request didn't send `Accept: application/json` — which the frontend's fetch
      calls never do — causing an uncaught exception (500, full stack trace leaked
      to the client) instead of a clean 401. Practical impact: any user whose
      session expired mid-use (2hr tokens) hit a broken error screen instead of
      being logged out, on every protected endpoint. Fixed with
      `redirectGuestsTo(fn () => null)` in `bootstrap/app.php`. Verified via the
      browser's actual `fetch()` before/after, across old and new routes alike.
      (`6c2b9d1`)
- [x] **Step 1a** — Add Eloquent models for Order, OrderItem, Payment, Queue,
      Notification matching the existing (unused) ordering-tables migration. (`841bbf4`)
- [x] **Step 1b** — Backend endpoints: create an order (customer), list own orders
      (customer), list all orders (admin/rider), with real server-side ownership/role
      checks. Also added the missing `AssignedRiderID` column the RBAC matrix
      needs. (`4879613`)
- [x] **Step 1c** — Frontend now also syncs orders to the backend, scoped to
      catalog-backed brands only (Manuela's, McDonald's, Mang Inasal — all route
      through `CatalogBrandMenu`). Jollibee stays localStorage-only until it's
      synced onto the DB catalog (see Medium item below); custom items and bill
      payments stay localStorage-only too, no real product to back them yet.
      `localStorage` is still the source of truth for everything the UI shows -
      this is additive, not a swap. (`f55c138`)
- [x] **Step 1d** — `updateOrderStatus`/`assignOrderToRider` now also sync to
      `PATCH /api/orders/{id}/status` and `/assign`, server-side authorized (admin,
      or the order's actually-assigned rider per `AssignedRiderID` — not trusted from
      the request). Same scoping as 1c: only fires for orders with a `backendOrderId`.
      Verified live through the real admin/rider dashboards, not just tests. (`82dc93e`)
      **Does not by itself close the fraud hole** — see the new Critical item below.
- [x] **Close the client-trust fraud hole (read side)** — rider/admin dashboards now
      poll `GET /api/orders` / `GET /api/admin/orders` and override any locally-stored
      order's status/rider with the backend's version wherever it has a
      `backendOrderId`. Verified with a real exploit attempt: placed an order, edited
      its `localStorage` entry directly to fake `DeliveryStatus: 'delivered'`, confirmed
      the admin dashboard displayed the real "Pending" status instead once the backend
      fetch resolved (~1s). Known limitation: that ~1s window before the fetch resolves
      can still show the tampered value briefly — self-corrects, not a full bypass, but
      not instant. Still only covers orders with a `backendOrderId` (catalog-backed
      brands) — Jollibee/custom items/bills remain fully client-trusted until they're
      migrated too. (`0de0804`)
- [x] **Step 1e** — Migrate payment confirmation to the backend. Pay Bills was
      the last order type still 100% localStorage-trusted (it never even got a
      `backendOrderId` — `syncOrderToBackend` requires real catalog items,
      which bills don't have). Added `PaymentController` (`POST /api/payments`
      creates a real `Orders`+`Payment` pair; `PATCH /api/payments/{id}/status`
      is admin-only, verify/reject, same terminal-state guard pattern as
      `OrderController::updateStatus`). Frontend now syncs bill creation and
      admin verify/reject to the backend, and `applyBackendTruth` overrides
      `paymentStatus` from the server the same way it already overrides
      `DeliveryStatus`/`assignedRider`. Verified live end-to-end through the
      real UI (fresh throwaway test accounts, not real credentials): submitted
      a bill payment with uploaded documents, verified it as admin, then
      tampered localStorage directly to fake it back to "pending" and
      confirmed the admin UI still showed "Verified" — backend truth wins.
      Test data cleaned up after. (`29966b2` backend, `95d5dac` frontend)
- [x] **Step 1f** — Wire the real `Queue` table (position, status) instead of the
      client-side fake wait-time formula (which was just `40 + 2×(itemCount-1)`,
      capped at 50 — same number for everyone regardless of how busy the
      business actually was). Every order now gets a real `Queue` row the
      moment it's created (`Order::booted()` model event, so it applies
      uniformly to `OrderController::store` and `PaymentController::store`
      without duplicating the logic). Position is *computed fresh on every
      request* (count of still-'waiting' Queue rows with an earlier
      `QueueDate`, plus 1) rather than stored/decremented — deliberately, so
      it can't drift out of sync under concurrent orders, which a real
      business will have. `OrderController::updateStatus` marks the queue
      entry 'done' on any transition (confirmed or cancelled both leave the
      line), which naturally shifts everyone behind up on their next fetch
      with zero explicit decrement logic. Customer/rider views now show real
      "N orders ahead of you" instead of the flat formula.

      Verified live: created 3 real orders via the API, confirmed positions
      1/2/3, confirmed order 1 and watched 2/3 shift to 1/2 automatically,
      cancelled the new position-1 order and watched the last one shift to 1
      — all without any stored counter to get out of sync. Also verified
      through the real UI end-to-end.

      **Found and fixed a real pre-existing bug during this verification,
      not caused by this step but exposed by it**: `patchStoredOrder` (used
      by `syncOrderToBackend` since step 1c and now also
      `syncPaymentToBackend`) wrote `backendOrderId`/`backendPaymentId`
      straight to `localStorage` without bumping `updatedAt` and without
      notifying the current tab's React state. Since `updateAll`'s merge
      logic (`mergeById`) keeps whichever copy of an order has the *later*
      timestamp, any ordinary next action in the same tab (opening
      notifications, adding to cart, placing another order) would call
      `updateAll` with the stale React-state copy, tie on timestamp, and
      silently wipe the backend link that steps 1c/1d/1e's fraud-hole fixes
      depend on. Reproduced live: placed a bill payment, opened the
      notifications panel, and watched `backendOrderId` disappear from
      `localStorage`. Fixed by (1) bumping `updatedAt` in the patch so the
      merge correctly recognizes it as newer, and (2) dispatching the
      existing `CUSTOMER_ACTIVITY_CHANGED` event (same mechanism
      `customerProfileSync.js` already uses for this exact class of
      out-of-band write) so the current tab picks it up immediately instead
      of waiting for some unrelated future action. This was silently
      undermining the backend-truth protection since step 1c, not something
      introduced this session — worth knowing given the read-side fraud-hole
      fix in step 1c/1d was tested and marked done before this existed.
- [x] **Step 1g** — Wire backend notifications (persisted, not localStorage-only).
      Order-status and payment-status notifications were the last genuinely
      cross-device gap: admin declines an order or verifies a payment from
      their own console, and the notification was only ever written to
      *their own* browser's localStorage — never to the customer's, on
      whatever device they're actually on. Added `NotificationController`
      (`GET /api/notifications`, `PATCH /api/notifications/read`) and real
      `Notification` row creation inside `OrderController::updateStatus` /
      `PaymentController::updateStatus`, attributed to the order's owning
      customer. The "order request sent" notification stays local/instant on
      purpose — that one's inherently same-device already, so moving it
      server-side would only add poll latency with no gap to justify it.

      **Found and fixed a real timezone bug during verification**: Laravel
      (UTC) serializes datetimes with no `Z`/offset; JS parses that as local
      time, silently off by however many hours local is from UTC. A brand
      new backend notification was sorting *below* an older local one
      because its (mis-parsed) timestamp looked earlier than it actually
      was. Fixed with `utils/backendTime.js` (`toUtcIso`), applied in both
      `useBackendNotifications.js` and `useBackendOrders.js` — the same bug
      silently affected synthesized cross-device orders' displayed dates too
      (step 1f's fix), just less visibly since nothing there compared it
      against a same-device timestamp the way notification sorting does.

      Verified live with two genuinely separate logins on two tabs (no
      shared session): placed a bill payment as one customer, declined it as
      a separate admin, watched the customer's own independent 30s poll
      pick up "Order cancelled" with the correct time and correct sort
      order, confirmed mark-all-read flips `NotificationSeen` server-side.
      Test data cleaned up after. (`a312c03` backend, `75f16dd` frontend)
- [x] **Step 1h** — Decided: `localStorage` stays, deliberately, as an
      optimistic local cache — not a trust boundary. This closes out the
      1a-1h backend migration.

      **Why keep it instead of retiring it:** the actual goal of 1c-1g was
      never "delete localStorage," it was "stop trusting it for anything
      that matters" — and that's done. Orders, payments, queue, and
      notifications are all backend-authoritative now (steps 1c-1g);
      localStorage only ever provides instant UI feedback until each 30s
      poll confirms or overrides it with the server's version. Fully
      retiring it would mean replacing every write path with synchronous
      API calls plus loading/error states everywhere, and losing the
      instant-feedback UX that makes the app feel responsive, for very
      little real benefit — the thing that actually mattered (client trust)
      is already closed.

      **Why it's not even fully possible yet:** the cart and any order type
      that was never migrated onto the real catalog (Jollibee's static
      menu, generic custom "Others" item requests) have no backend model at
      all. Retiring localStorage would require inventing a backend Cart
      concept that was never in the team's schema, on top of finishing the
      already-tracked Jollibee catalog migration (Medium priority, below) -
      separate, larger pieces of work, not part of this decision.

      **Known, accepted gap, not fixed here:** a customer's cart doesn't
      follow them across devices (add on phone, it's not there on laptop).
      Minor UX limitation, not a security/correctness issue like everything
      else this migration closed - reasonable to leave as a future
      nice-to-have rather than block on it.
- [x] **Mobile cart placement (UX)** — Root cause was one CSS rule, not the
      markup: `RestaurantMenu` (the one shared component behind every brand —
      McDonald's, Jollibee, Manuela's, and every catalog-backed brand via
      `CatalogBrandMenu` — no duplicated markup to hunt down) already put the
      menu before the cart in the JSX; `.jollibee-cart-panel { order: -1; }`
      inside the ≤1050px media query was forcing it to the top visually
      anyway. Removed that, and added a real mobile (≤760px) treatment
      matching Grab/Foodpanda/UberEats: cart panel hidden by default, opened
      as a bottom sheet (backdrop, close button) via either the existing
      header cart button or a new floating "N items · View Cart · ₱total"
      bar that only appears once the cart has something in it. Tablet width
      (761-1050px) just gets natural document order — menu, then cart below
      it — no bottom-sheet complexity needed at that size.

      Verified live on a real mobile viewport (375×812): menu is first thing
      visible, floating bar appears correctly on add-to-cart, both entry
      points open the sheet, close button and backdrop-tap both close it,
      placing an order closes it automatically. Desktop/tablet confirmed
      completely unaffected via computed styles at 1440px and 900px, not
      just visually. Full test suite re-run clean (20/25, same 5 pre-existing
      unrelated failures). (`96d0015`)

## High

- [x] Real queue system — delivered in step 1f (Critical, above).
- [x] Server-driven live status updates / polling — delivered in steps
      1c/1d (order status), extended to cover every dashboard's actual
      visibility in the cross-device order-visibility fix (Critical, above).
- [x] Backend-persisted notifications — delivered in step 1g (Critical,
      above).
- [x] **Let customers cancel their own order before it's confirmed** (user
      request, 9/21) — previously a customer had zero way to cancel, even
      seconds after placing an order, even though admin hadn't touched it
      yet. Real cost both ways: the business ends up preparing/assigning a
      rider to something nobody wants delivered, and the customer has no
      way to stop it. Added a `window.confirm`-guarded "Cancel Order"
      button, and a narrowly-scoped backend allowance
      (`OrderController::updateStatus`): the order's own customer can set
      it to `cancelled`, and only that status, and only while still
      `pending_rider` — the moment admin confirms it, that window closes.
      Also fixed a wording bug this would have made actively misleading:
      the cancelled state hardcoded "Cancelled by rider" regardless of who
      actually cancelled it; now just "Cancelled," accurate either way.
      Verified live end-to-end (real cancel succeeds, another customer
      blocked, the owning customer can't use this to *confirm* their own
      order, and the window correctly closes once admin confirms it).
      (`efc639f` backend, `5b7dd9e` frontend)
- [x] **Redundant per-item CTAs (UX)** — every product card had both "Add to Cart"
      and "Place Order." Confirmed this was a real, not just theoretical, problem —
      walked through it live on 9/21: user wanted to order 2 items together, got
      confused about why they couldn't combine them, root cause was clicking
      per-item "Place Order" instead of "Add to Cart." External validation (web
      search, 9/21): published UX guidance recommends exactly one solid-color
      primary action per product card, specifically to avoid this kind of confusion
      — [Toptal: Keep It Tasteful, A Guide to Food App
      Design](https://www.toptal.com/designers/ux/food-app-design). Fixed: removed
      the per-item "Place Order" button (and its now-dead handler code); "Add to
      Cart" is now the one full-width, solid-styled action per card. Applies to
      every brand — Food and Item Delivery both, since they share the same
      `RestaurantMenu` component. (`1ecc172`)
- [ ] **Customer–rider communication** (teammate request, 9/20) — no chat/messaging
      exists between customer and rider today. Real feature, not a quick fix; needs
      its own design pass (in-app chat vs. just exposing contact numbers, etc.)
      before implementation.
- [ ] **Admin "Revenue" tab is not actually tracking revenue — it's silently
      capped at the 50 most recent orders, ever** (user testing, 9/22, reported as
      "revenue resets every day"). Traced the actual cause before writing this up:
      there is no revenue table and no date-based aggregation anywhere in the
      backend - `RevenueTab` (`DeliveryAdminDashboard.jsx`) just sums whatever
      `orders` happen to be loaded in the browser, and those come from
      `useBackendOrders('/api/admin/orders?per_page=50')` - page 1 only, never
      paginated further, and `OrderController::indexAll` defaults/caps at that
      same 50. Once total order volume passes 50, older orders (and their
      revenue) silently fall out of view entirely. That will look exactly like
      "revenue resetting" without being a UTC/midnight bug at all - it's data
      being dropped from what admin can see, not mis-dated.

      The right fix is the one already proposed: persist revenue server-side
      instead of computing it from whatever page of orders the browser happens
      to have. Scope: (1) a `DailyRevenue` (or similar) table keyed by calendar
      date in the business's actual local timezone (not raw UTC boundaries -
      confirm the intended timezone with the team, likely Asia/Manila/UTC+8,
      since a UTC-midnight boundary would flip revenue between days mid-afternoon
      local time), (2) compute/insert it from real order data on order
      completion or via a daily aggregation job - either works, pick based on
      whether "today so far" needs to be live or can be end-of-day only, (3) a
      dedicated `GET /api/admin/revenue?range=...` endpoint the dashboard queries
      instead of deriving totals from the capped orders list. Also fixes the
      already-known undercounting gap where a synthesized cross-device order's
      `serviceFee` is always 0 (documented in the cross-device-visibility Critical
      item above) - persisting the fee at order-creation time on the backend
      closes that gap too, for free. Directly enables the Data Analytics section
      below, which needs this same historical data as its foundation.

## Medium

- [x] **Let customers browse without logging in** (user request, 9/21, noticed while
      browsing foodpanda themselves) — the backend catalog API was already public;
      the only blocker was the frontend's `ProtectedRoute` wrapper on `/home`,
      `/food/*`, and `/catalog/brands/:id` unconditionally redirecting guests to
      `/login`. Replaced it with a new `CustomerBrowseRoute` on those routes -
      lets a guest through, still bounces an already-logged-in admin/driver back
      to their own dashboard if stale browser history lands them here (same
      `getDashboardPath` logic `ProtectedRoute` already used).

      Login is gated at the actual order-placement step instead, not the page.
      Found and fixed **four** real checkout entry points, not the one expected:
      `RestaurantMenu`'s shared `checkoutCart` (the actual primary path every
      catalog-backed brand uses), the header's global cart `confirmCart`, and
      Home.jsx's two `placeOrder` calls for bill payments/custom "Others" orders
      (also gated at brand-selection, before the guest invests effort filling out
      a form - `PayBillsForm` starts uploading receipts to an authenticated
      endpoint as soon as a file is picked, so waiting until submit would be too
      late anyway). Added a backstop guard directly in
      `CustomerActivityContext`'s `guardOrderPlacement` too: without a session,
      it now returns `null` before creating anything, so even a future call site
      that forgets the check can't create a local-only order that
      `syncOrderToBackend`/`syncPaymentToBackend` would then silently never sync
      (both already no-op without an auth token) - would have looked like a
      success to the guest while being completely invisible to admin/rider.

      **Found and fixed a real pre-existing bug while adding this**:
      `checkoutCart` showed "Order placed with N items" and closed the cart
      unconditionally, even when `placeCartOrder` returned `null` (e.g. the
      existing duplicate-click guard blocking a second rapid click) - a false
      success message. Now checks the return value first.

      `CustomerMenu`'s account icon sends a guest straight to `/login` instead of
      opening a popover that would 401 on every action (edit profile, etc.).

      Verified live end-to-end as a real guest (cleared storage, no session):
      browsed Home and the Jollibee catalog page freely, added an item to cart,
      confirmed clicking "Place Order" redirected to `/login` with **zero**
      backend order created (checked `GET /api/orders` directly) instead of a
      false success message. Logged in with the same browser (cart survived,
      it's independent of session) and placed the same order for real - landed
      on the backend correctly, then cancelled it via the self-cancel feature to
      clean up test data. Separately verified an authenticated non-customer
      (admin) session still gets bounced away from `/home` to their own
      dashboard, not let through. Full frontend suite re-run clean (20/25, same
      5 pre-existing unrelated failures - one test fixture in
      `CustomerMenu.test.jsx` needed updating since it only seeded half of what
      a real login sets, which happened to not matter before this change).
      Backend suite unaffected (27/30, same pre-existing failures, no backend
      files touched). (`d6a5685`)

      **Follow-up found by the user immediately after (9/22)**: the routing/
      checkout-gating fix above was real but incomplete - nothing on the actual
      entry point (the login screen at `/`) ever told a guest that browsing
      without an account was possible, or linked them to `/home`. Landing on the
      site still looked and felt fully locked behind login, just with dead code
      underneath that only worked if you already knew to type `/home` directly.
      Added a "Browse the menu without an account" link to `AuthCard` (login mode
      only), navigating straight to `/home`. Verified live: clicking it from a
      cleared/guest session lands on the real catalog, no redirect back to login.
      Full frontend suite re-run clean (20/25, same 5 pre-existing failures).
      (`daf77c2`)

      **Second follow-up (9/22)**: still felt fully gated even with the above -
      the user pointed at foodpanda specifically: opening their site shows the
      whole catalog immediately, with an explicit "Login/Sign Up" button in the
      header, not a login wall you have to escape from. Made `/` itself redirect
      straight to `/home` (through the same `CustomerBrowseRoute` guard, so an
      already-signed-in admin/driver still lands on their own dashboard, not the
      guest catalog) instead of rendering `<Login />`. Made `CustomerMenu`
      guest-aware: a guest now sees an explicit white "Log In / Sign Up" pill
      button in the header (matching Grab/foodpanda's pattern) instead of the
      plain account icon that only redirected once clicked. Verified live: root
      URL with no session shows the catalog immediately with the header button
      visible; logged-in customer visiting `/` still sees the normal account
      icon and popover (Edit Profile/Log Out), unaffected. Full frontend suite
      re-run clean (20/25, same 5 pre-existing failures). (`6dd1b93`)
- [x] **Sticky category navigation within a menu page** (user request, 9/21,
      noticed on foodpanda) — implemented in the shared `RestaurantMenu` component
      (`McDonaldsMenu.jsx`), so every catalog-backed brand gets it automatically
      (Jollibee, McDonald's, Manuela's, Mang Inasal, etc.) with zero duplicated
      markup. Chips stick below the page header (`position: sticky; top: 78px`),
      clicking one smooth-scrolls that category into view, and the active chip
      updates via `IntersectionObserver` as the customer scrolls manually too - not
      just on click. Used `scroll-margin-top` on each category section (the modern
      equivalent of the researched `scroll-padding-top` approach - sets the offset
      on the target instead of the scroll container, which is more robust here
      since the page scrolls at the document level, not a wrapped container).
      Caveat from the research applied as specified: `categories.length > 2` gates
      whether the nav renders at all.

      Verified live at both desktop (961px) and mobile (375×812) viewports:
      clicking a chip scrolls smoothly with the heading fully clear of the sticky
      bars, the correct chip highlights, and manually scrolling (not clicking)
      also updates the active chip correctly and auto-scrolls the chip row to keep
      it visible on mobile's narrower width. Full frontend suite re-run clean
      (20/25, same 5 pre-existing failures, no new ones). (`3dd5a61`)
- [ ] **"Similar brands" section before the footer** (user request, 9/21, noticed on
      foodpanda) — a discovery/cross-sell section at the bottom of a brand's menu
      page suggesting other brands in the same category (e.g. viewing Jollibee
      suggests McDonald's, Mang Inasal — other Food Delivery brands). Standard
      pattern across delivery and e-commerce apps generally. Lower priority than the
      two items above — more of a "keep browsing" nudge than something blocking an
      order, and needs a "same service/category" grouping rule decided first.
- [x] Make the customer contact number visible on both the Admin and Rider
      dashboards (teammate request, 9/20) — already done this session before the
      request came in (`9cc3ac0`).
- [ ] **Rider name visible in customer notifications** (teammate request, 9/20) —
      confirmed gap: no customer-facing component currently reads `assignedRider`
      at all, so a customer never sees who's delivering their order.
- [x] **Design system overhaul — typography, color tokens, brand tiles** (user
      request, 9/22, comparing against a classmate's project + live reference
      against GrabFood, Uber Eats, and foodpanda.ph) — landed in stages as the
      user reacted to each one live:

      **Stage 1**: swapped the body font from `Tahoma` (a dated Windows-era
      font `App.css` was silently forcing over `index.css`'s own modern
      system-font stack) to Poppins via Google Fonts. Added `:root` design
      tokens in `index.css` for the color palette/radius/card-shadow -
      available repo-wide now, applied to the components touched this pass
      (not a full repo-wide rewrite; still the documented prerequisite for
      "Dark mode" below when that gets picked up). Redesigned `BrandCard` from
      a boxed white card to a bare circular tile + label matching
      Grab/foodpanda's cuisine-tile pattern, and tightened `FoodandItemsSection`'s
      grid to match - closes the "more compact brand list layout" item below
      too (7 brands now fit one row on desktop instead of a wrapping 4-wide
      card grid). (`9ae9095`)

      **Stage 2 (guest-browsing entry point, same conversation)**: the initial
      route-guard fix left the actual entry point (`/`) still showing Login
      first with no visible way off it - see the "Let customers browse without
      logging in" item's two follow-up notes above for the full history
      (`daf77c2`, `6dd1b93`). Landed a proper Grab/foodpanda-style entry point:
      `/` opens straight into the catalog, and a guest sees an explicit white
      "Log In / Sign Up" pill button in the header instead of a hidden icon.

      Not done in this pass (deliberately deferred, still open items below):
      a floating-card-over-photo hero (would need real photography/stock
      assets this project doesn't have), and applying the new tokens to the
      remaining ~16 CSS files that still use raw hex literals directly (that's
      what "Dark mode" below is blocked on, not this item).
- [ ] **Mobile brand grid should be a fixed 2 columns** (user testing, 9/22) —
      currently `auto-fit, minmax(min(78px,100%), 84px)` at ≤767px, which packs
      3+ narrow columns instead. Straightforward CSS change
      (`FoodandItemsSection.css`).
- [ ] **Best-selling products on the customer-facing home page** (user request,
      9/22) — needs a backend aggregation (top products by order count/quantity,
      likely windowed to a recent period so it reflects current demand, not
      all-time). Pairs naturally with the Revenue-tracking fix above once that
      exists, and is one of the concrete outputs the Data Analytics plan below
      calls for anyway - worth building once, not twice.
- [ ] **"Newly added" indicator when browsing a brand's menu** (user request,
      9/22) — needs confirming `Product` actually has a reliable creation
      timestamp to key off (Eloquent's default `created_at` likely already
      exists but hasn't been checked), then a badge/section for items added
      within some recency window.
- [ ] **FAQ / static answers for the most commonly asked questions about the
      system** (user request, 9/22) — pure content, no backend. Cheap to add,
      genuine value for a public-facing site with no support staff behind it.
- [ ] **Category selection when adding a product (admin)** (user request, 9/22;
      traced 9/22 during a full QA pass) — cheaper to finish than to build: the
      backend already has `GET /api/admin/catalog/categories?brand_id=X`
      (returns that brand's existing categories), and `CatalogTab`
      (`DeliveryAdminDashboard.jsx`) already fetches it into a `categories`
      state and even computes a merged `categoryOptions` list - but nothing
      ever renders it. The product Add/Edit form has Brand, Price, Image, and
      Description fields only; no category field at all, dead code sitting
      right next to where it's needed. Just needs a `<select>` wired to
      `form.category` (confirm the exact `Product` column name) added to the
      existing product-form JSX using the `categoryOptions` that's already
      computed. Avoids typo'd near-duplicate categories fragmenting the sticky
      category-nav chips added above.
- [ ] **"Remember me" on login** (user request, 9/22) — remember the email (or
      extend the session token's persistence via an explicit opt-in,
      `sessionStorage` → `localStorage`), never the password. Caching a raw
      password client-side for autofill convenience is a credential-exposure
      risk, not a UX nice-to-have - out of scope regardless of how it's asked
      for.
- [ ] **Reject disposable/mass-produced emails at signup** (user request, 9/22)
      — two tiers, needs a decision on which: (a) cheap, no infra - block
      registration against a maintained disposable-email-domain list
      (mailinator.com, guerrillamail.com, etc.); (b) proper - real email
      verification (send a confirmation link via Laravel Mail, block login
      until clicked), which requires wiring up an actual SMTP sender (Gmail/
      Mailtrap) for local dev, since nothing sends mail today. Recommend
      starting with (a); treat (b) as a stretch goal since capstone
      environments rarely have a real mail server configured.
- [ ] *(Needs clarification before scoping)* **"Make it OOP"** (user request,
      9/22) — as stated this doesn't map to a concrete change. The Laravel
      backend already is OOP (Eloquent models, controller classes) - nothing to
      change there. If this means converting React function components back to
      class components, that's a step backward from current React best practice
      and not recommended. If it means extracting business logic out of fat
      controllers into dedicated Service classes, that's a legitimate
      maintainability refactor, but it's internal-architecture-only (no visible
      behavior change) and refactors like that are exactly where regressions
      hide close to a deadline - confirm which is actually meant (and whether
      it's coming from a specific rubric requirement) before touching anything.
- [ ] *(Needs a decision before scoping)* **OpenLeaflet map for delivery
      location** (user request, 9/22) — the biggest/riskiest item raised this
      round, not a quick add. Today's delivery-fee system
      (`utils/deliveryRates.js`) is keyed off fixed named zones (CLSU Main
      Campus, Bagong Sikat, etc.) with a flat fee per zone. A real map means
      arbitrary lat/lng pins, which doesn't map onto that fee model without
      deciding: (a) snap-to-nearest-zone - keeps current pricing logic, the map
      is just a nicer picker than a dropdown, or (b) real distance-based
      pricing - a bigger change, and needs a geocoding call (Nominatim for
      OpenStreetMap, free but rate-limited, usage-policy compliance required)
      to turn a picked point into an address. Needs (a) vs (b) decided before
      any implementation starts.
- [ ] *(Needs specifics)* **"Make the header better"** (user request, 9/22) —
      too vague to scope as stated. Either point at a specific reference site's
      header the way foodpanda/Deliveroo were used for the entry-point and hero
      work above, or describe concretely what's not working about the current
      one.
- [ ] **Sync Jollibee onto the database-driven catalog** (teammate request, 9/20,
      "add the Jollibee menu") — Jollibee's 30 products already exist in the DB
      catalog (`Product` table, BrandID 1) via the admin Brand & Service Catalog
      manager, but the customer-facing `/food/jollibee` page is hardcoded to a
      static file (`jollibeeMenuData.js`) instead of pulling from that catalog the
      way Manuela's does. Admin edits to Jollibee's catalog currently have zero
      effect on what customers see. Likely fix: route Jollibee through the same
      dynamic `CatalogBrandMenu` component the database-driven brands already use.
- [ ] Delete dead Express backend (`backend/`) + hardcoded access codes in
      `src/config/roles.js` — not currently exploitable (Laravel ignores role/accessCode
      on register), but it's a loaded gun sitting in the repo. **Half-done on disk
      already (9/22, found during this session, not done by me)**: the `backend/`
      directory is gone from the working tree but the deletion is uncommitted
      and `git status` still shows those files - if that was intentional,
      commit it; if not, `git checkout` will bring them back. `src/config/roles.js`
      still exists untouched either way.
- [ ] **`Product.StockQuantity` exists in the schema but is completely
      unenforced** (found during the full QA pass, 9/22) - every product in
      the live catalog reads `StockQuantity: 0`, and grepping the entire
      backend turns up zero references to that column outside the migration
      itself. Nothing validates it, decrements it, or blocks ordering an
      item that's actually out of stock - a customer can order any quantity
      of anything regardless of real availability. Not urgent for a capstone
      demo, but worth a decision: either wire it up for real (validate on
      order, decrement on confirm) or remove the unused column so the schema
      doesn't imply inventory tracking that doesn't exist.
- [ ] Rate limiting on `/uploads/bill-documents` (no throttle currently, upload spam =
      storage-exhaustion DoS risk).
- [ ] Backend test coverage for order/payment flows (best done once 1b–1e exist).
- [ ] Server-side image compression on admin catalog uploads (mirrors the client-side
      fix already applied to bill-payment uploads).
- [ ] **Login page mobile hero (UX)** — decorative "Welcome Back!" card pushes the
      actual email/password fields below the fold on phone screens.
- [ ] **Inconsistent empty states (UX)** — Admin's Payments tab has a proper
      icon+heading+subtext empty state; Riders/Customers/Brands tables just show flat
      "No X found." text. Apply the good pattern everywhere. **Confirmed this is worse
      than cosmetic during a full QA pass (9/22)**: the Brands tab genuinely flashed
      "No brands found." on a real page load with 16 real brands in the database -
      `CatalogTab` has no loading state at all, so the empty-table render and the
      "still fetching" state are visually identical. An admin landing on a
      slower connection has no way to tell "empty" from "not done loading yet."
- [ ] Add `laravel/public/uploads/` to `.gitignore` — found 4 untracked test-upload
      images sitting in the repo; user-generated uploads shouldn't be tracked.

## Low

- [ ] **Show estimated time on the brand-selection screen** (Grab/foodpanda
      reference, 9/21) — live-checked foodpanda.ph and GrabFood's web apps for
      comparison. foodpanda's "Top brands" section shows a delivery-time estimate
      (e.g. "5 min") right on the brand tile, before the customer even opens the
      menu. Otu-Zan's Home.jsx brand grid shows only logo + name — no timing context
      up front. Would need real prep-time data per brand/service to be honest, not
      just decorative (tie to `calculateEstimatedWaitMinutes`, already used inside
      each menu page, just not surfaced one level up).
- [x] **More compact brand list layout** (Grab/foodpanda reference, 9/21) —
      closed as part of the design system pass above (`9ae9095`): `BrandCard`
      is now a bare circular tile instead of a large boxed square card, and the
      grid packs noticeably tighter. Went with a denser wrapping grid rather
      than Grab/foodpanda's horizontal-scroll row - Otu-Zan's own research note
      below (carousel discoverability) argues against introducing horizontal
      scroll/carousel patterns without a clear need, and a wrapping grid gets
      the same "more options, less scrolling" benefit without that tradeoff.
      No per-brand ETA added (separate item below, needs real prep-time data
      first).
- [ ] *(Research note)* Couldn't get live reference for foodpanda's actual menu/
      cart/checkout screens — hit a reCAPTCHA wall navigating into a restaurant page,
      did not attempt to bypass it. GrabFood gates restaurant browsing behind login.
      Followed up with web search instead (below) since direct browsing hit walls.
- [ ] **Products without photos hurt conversion** (web research, 9/21) — this is a
      recognized, documented UX problem, not just an aesthetic nitpick: a 2018
      GrabFood UX case study quotes a user directly — *"Food photos are important
      for me. It's hard imagining what they look like when the app doesn't provide
      their photos"* — and lists missing menu photos as one of the top pain points
      driving users away
      ([source](https://uxdesign.cc/ux-ui-case-study-grabfood-ab2faa0512ec)).
      Directly relevant: Manuela's 185 products have zero individual photos (all
      show the brand logo instead) — same root issue this research flags. This is a
      content/photography task (someone needs to actually photograph the dishes),
      not a code fix — but worth prioritizing over purely cosmetic items given it's
      shown to affect whether people order at all.
- [ ] **"Back to top" control on long menu pages** (web research, 9/21) — GrabFood's
      menu pages use continuous scrolling through many categories with no way back
      to the top except manually scrolling up, flagged as a usability gap in a UX
      pattern analysis
      ([source](https://rubienguyen.medium.com/grabfood-patterns-and-flows-63f7153f039f)).
      Otu-Zan's menu pages (Jollibee, McDonald's, Manuela's, etc.) have the exact
      same structure — multiple category sections in one long scroll, no back-to-top
      button. Small, low-risk, easy fix.
- [ ] *(Research note)* The same GrabFood UX analysis flags carousel-style browsing
      (swipeable cards) as having low discoverability per NNGroup research — most
      users stop swiping after 3-4 cards. Otu-Zan's category-grouped list layout
      (not carousels) is actually the safer choice here, not a gap — noting this so
      nobody "fixes" it into a carousel later assuming that's more modern.
- [ ] **Dark mode** (teammate/user request, 9/21) — technically possible, nothing
      architecturally blocks it, but it's a real chunk of work, not a quick toggle:
      checked the codebase and found 545 hardcoded hex color values across 17 of the
      19 CSS files, zero use of CSS custom properties anywhere. Doing it properly
      means (1) refactoring those into CSS variables first, (2) designing an actual
      dark palette — a judgment call, not just inverting colors, since the brand's
      pink/magenta needs to still read as "Otu-Zan" on a dark background, (3) a
      toggle + persisted preference, (4) checking every page (login, customer menus,
      cart, rider dashboard, admin dashboard) for contrast/legibility in both modes.
      Reasonable nice-to-have; not something to start before the higher-priority
      items above are done.
- [ ] Clean up stale "jayson deguzman" hardcoded filter in
      `CustomerActivityContext.jsx` (4 places) — verify no live bad data still depends
      on it first.
- [ ] Align order status labels with the team's documented decision (meeting
      minutes: Prepared → Packaging → Delivering) — currently uses different wording
      (`pending_rider`, `confirmed`, `preparing`, etc.).
- [ ] Automate the Security test cases already promised in the QA plan (TC-020
      session expiry, TC-021 RBAC restriction, TC-022 SQL injection) — most
      meaningful once 1b–1d exist.
- [ ] Mobile/responsive verification pass on remaining customer-facing pages beyond
      what's already been spot-checked.
- [ ] **Set up hosting** (teammate request, 9/20) — design doc specifies Vercel,
      which doesn't natively run a persistent Laravel backend. Decide:
      Vercel-for-frontend + different host for Laravel, or reconsider hosting —
      then actually deploy.
- [ ] **Pre-deployment checklist** (found during a full end-to-end QA pass, 9/22 -
      customer/admin/rider order lifecycle tested live start to finish and works
      correctly; these are separate, real gaps found alongside that, specifically
      about going live safely, not about correctness of the flows themselves):
      - **`APP_DEBUG=true` must become `false` in the production `.env`.**
        Confirmed live: any unhandled backend error currently returns a full
        stack trace, including real server file paths
        (`C:\xampp\htdocs\Otu-Zan\laravel\vendor\...`), to the raw HTTP
        response. Fine for local dev (`APP_ENV=local` is correctly set that
        way right now) - a real, well-known Laravel misconfiguration if it
        ships to production unchanged, since it leaks internal structure to
        anyone who trips an error.
      - **No documented way to create the very first admin account.**
        `AuthController::register` hardcodes every signup to `role: customer`
        (by design - not a bug, already covered by the QA pass above) and
        `DatabaseSeeder` deliberately seeds no accounts. `POST
        /api/admin/accounts/{role}` exists and works for an *already-logged-in*
        admin to create more staff accounts - but nothing bootstraps the first
        one on a fresh deployment. Needs either a documented `php artisan
        tinker` snippet (what this session used for testing) or a dedicated
        `artisan make:admin` command in the deployment runbook, so whoever
        stands this up for real isn't stuck.
      - **Dev-only CORS origin patterns should come out before going live**
        (`laravel/config/cors.php`'s `allowed_origins_patterns` permits any
        `localhost`/`127.0.0.1` port, intentionally, for local dev convenience).
        Not a live vulnerability - production traffic won't arrive from
        "localhost" - but it's dev scaffolding that should be removed as part
        of a real deploy, not left in "just in case."
      - Confirm `laravel/.env` is never committed (already correctly
        gitignored; `.env.example` exists as the template) - just re-verify
        this before every deploy, since it's the one file that would leak
        real database credentials if it ever slipped in.
- [ ] **Admin table loading state (UX)** — no spinner/skeleton distinguishes "still
      loading" from "genuinely empty," so switching tabs can briefly show a false
      "No X found."
- [ ] **Flaky time-of-day-dependent test** — `OrderWorkflow.test.jsx` ("direct and
      cart orders retain the signed-in customer account ID") calls `placeOrder`
      without freezing time, and `calculateDeliveryFee` defaults to real wall-clock
      time. Fails whenever the suite runs late at night (night surcharge kicks in
      and the expected `serviceFee` no longer matches). Fix: pass an explicit
      `orderTime` in the test instead of relying on `new Date()`. Pre-existing,
      unrelated to any work this session.
- [ ] **6 more pre-existing, stale test failures found 9/21** (via `git stash`
      comparison while verifying steps 1e/1f/the cross-device fix — confirmed
      unrelated to this session's changes, not fixed, just newly documented so
      they don't get mistaken for something this session broke):
      - `Login.test.jsx` — "rider login keeps the backend token..." and
        "failed login does not grant access..." both fail looking for a
        role-selector button (`getByRole('button', { name: 'Rider' })`) that
        doesn't exist on the current login page (email/password only, no
        role picker) — the test wasn't updated when that UI changed.
      - `ManuelasMenu.test.jsx` — both tests fail with "Unable to fire a
        change event - please provide a DOM element", `getAllByRole('combobox')`
        returning fewer serving-size dropdowns than the test expects.
      - `laravel/tests/Feature/AuthApiTest.php` — 3 failures (registration
        returns 422 instead of 201; a login expected to fail with wrong
        credentials succeeds; a rider's forced-password-change flag isn't
        set) — the test payloads pass a `role` field that
        `AuthController::register`/`login` don't read at all (registration
        always hardcodes `customer`; role comes from the account itself, not
        the request), so these look like they were written against an older
        API shape.
- [ ] **Test-suite teardown warning** — since step 1d, `npx react-scripts test` prints
      "A worker process has failed to exit gracefully... tests leaking due to
      improper teardown" (confirmed via `git stash` that it didn't happen before).
      Caused by the fire-and-forget backend-sync `fetch` calls (`syncOrderToBackend`,
      `syncStatusToBackend`, `syncAssignmentToBackend`) not being awaited or mocked
      per-test, so their promise chains can still be in flight at teardown. All test
      assertions still pass — this is a harmless warning, not a failure — but worth
      cleaning up (e.g. mock `fetch` more precisely per test, or expose a way to flush
      pending syncs in tests) so real leaks don't get lost in the noise later.
- [ ] **Add `.gitignore` entry for test artifacts** — 4 stray images sit untracked in
      `laravel/public/uploads/bill-documents/` from earlier live-testing this session.
      Same fix as the existing `.gitignore` item above; just a reminder they're still
      there.

## Non-code / academic

- [ ] **Research emerging technologies — Data Analytics** (teammate request, 9/20;
      researched 9/22). Note: your team's meeting minutes (Aug 26) had the
      emerging-tech slot as AI-based ETA prediction, later deprioritized in favor
      of simple status labels. Data Analytics is a different pivot from what's
      currently documented - **still confirm the switch with your instructor/team
      before it goes into the paper**, but here's a concrete, achievable plan to
      bring to that conversation instead of an open question.

      Researched how real delivery platforms and e-commerce systems apply data
      analytics, and grounded the plan in what Otu-Zan's schema already collects
      (Orders, OrderItems, Products, Payments, Queue, Users) rather than proposing
      something that needs data the system doesn't have. Three layers, each a
      real, citable analytics technique - not just "we made some charts":

      1. **Descriptive** (what happened) - daily/weekly revenue trends, best-selling
         products, and peak-ordering-time patterns (hour-of-day / day-of-week).
         This tier is a hard dependency on the Revenue-tracking fix above - you
         cannot report a revenue *trend* from a system that doesn't persist
         revenue by date yet. Best-sellers and peak-time heatmaps are already
         separately requested above; this is the same underlying work framed as
         the paper's analytics chapter instead of a UX feature. Dashboard design
         research consistently recommends keeping each view to a handful of
         KPIs with a clear primary metric, not a wall of numbers
         ([Improvado: Dashboard Design Best
         Practices](https://improvado.io/blog/dashboard-design-guide)).

      2. **Diagnostic — RFM customer segmentation** (who, and why they matter) -
         a well-established framework scoring each customer on Recency (days
         since last order), Frequency (order count), and Monetary value (total
         spend) to classify customers into segments like loyal/at-risk/new
         ([CleverTap: RFM Analysis for Customer
         Segmentation](https://clevertap.com/blog/rfm-analysis/);
         [ScienceDirect/JTAER: Customer Segmentation Using an Extended RFM Model
         and Clustering Algorithms in
         E-Commerce](https://doi.org/10.3390/jtaer21050142)). Genuinely
         achievable with plain SQL aggregation over the existing `Orders` table -
         no machine-learning library needed, and it gives the paper a named,
         citable methodology instead of "we counted things."

      3. **Predictive (lightweight)** - a simple demand forecast (e.g. a rolling
         average or day-of-week seasonal average of past order volume) to project
         expected orders for the next day/hour, framed as informing rider
         staffing. Real platforms do this with full ML pipelines analyzing
         historical sales, seasonality, and local events
         ([Kody Technolab: Predictive Analytics in
         Delivery](https://kodytechnolab.com/blog/predictive-analytics-in-delivery/);
         [Deliverect: How Data Analytics is Revolutionizing Online Food
         Ordering](https://www.deliverect.com/en-us/blog/trending/how-data-analytics-is-revolutionizing-the-online-food-ordering-industry)) -
         a capstone timeline doesn't support that, but a moving-average forecast
         computed in plain PHP/SQL is still legitimately "predictive analytics"
         for the paper without needing an ML stack Otu-Zan doesn't have anywhere
         else in its architecture.

      Recommended order: layer 1 first (blocked on the revenue fix landing
      anyway), layer 2 next (cheapest of the three - it's a query, not a
      feature), layer 3 last and only if time allows - it's the most
      "emerging-tech-sounding" for the paper but the least load-bearing for the
      actual system.

      **Validated this is mainstream industry practice, not speculative
      (9/22)**, using primary sources - each company's *own* engineering blog,
      not a third-party summary: DoorDash's engineering team publishes exactly
      the demand-forecasting approach in layer 3
      ([doordash.engineering: Managing Supply and Demand Balance Through
      Machine Learning](https://doordash.engineering/2021/06/29/managing-supply-and-demand-balance-through-machine-learning/);
      [How DoorDash Built an Ensemble Model for Time Series
      Forecasting](https://careersatdoordash.com/blog/how-doordash-built-an-ensemble-learning-model-for-time-series-forecasting/)).
      Uber's own blog documents DeepETA, and Uber Eats specifically improved
      delivery-time-estimate accuracy by 26% using ML on historical trip data
      ([uber.com: DeepETA — How Uber Predicts Arrival
      Times](https://www.uber.com/en-CA/blog/deepeta-how-uber-predicts-arrival-times/);
      [bestpractice.ai case
      study](https://www.bestpractice.ai/ai-case-study-best-practice/uber_eats_improves_estimated_time_of_delivery_information_accuracy_by_26%25_using_machine_learning_algorithms)).
      RFM (layer 2) isn't niche either - it's a decades-old technique now a
      built-in feature of mainstream CRM/marketing platforms (Salesforce,
      HubSpot, Klaviyo, CleverTap all ship it out of the box), which is exactly
      why it's citable as an industry-standard method rather than something
      invented for this paper. And adoption is broad, not just tech giants:
      Gartner's own 2025 research puts 81% of organizations using analytics or
      AI for key business decisions, with 89% of executives planning to
      increase analytics investment
      ([Gartner: Top Data & Analytics Predictions
      2025](https://www.gartner.com/en/newsroom/press-releases/2025-06-17-gartner-announces-top-data-and-analytics-predictions)).
