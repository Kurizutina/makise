# Otu-Zan — Outstanding Work

Consolidated from a full audit (functional, security, and design review against the
system design doc and industry-standard delivery apps). Grouped by priority; check
items off as they land.

## Critical

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
- [ ] **Step 1g** — Wire backend notifications (persisted, not localStorage-only).
- [ ] **Step 1h** — Decide what `localStorage` becomes afterward (fully retired, or
      kept as an offline cache layer).
- [ ] **Mobile cart placement (UX)** — On phone width, the cart panel currently fills
      the entire first screen before any menu item is visible. Every major delivery
      app (Grab, Foodpanda, Uber Eats, DoorDash) shows the menu first and surfaces
      the cart via a floating button/bottom sheet only once items are added. Highest-
      leverage design fix — likely costs real customers on mobile as-is.

## High

- [ ] Real queue system (depends on 1f)
- [ ] Server-driven live status updates / polling (depends on 1c/1d)
- [ ] Backend-persisted notifications (depends on 1g)
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

## Medium

- [ ] **Let customers browse without logging in** (user request, 9/21, noticed while
      browsing foodpanda themselves) — confirmed highly feasible: the backend
      catalog API (`GET /api/catalog`, `GET /api/catalog/brands/{id}/products`) is
      *already* public with zero auth required (verified with a bare `curl` request,
      no token, works fine). The only thing blocking guest browsing today is the
      frontend's `ProtectedRoute` wrapper on `/home`, `/food/*`, and
      `/catalog/brands/:id` — it unconditionally redirects anyone not logged in to
      `/login` before they can see a single menu. Matches how foodpanda/Grab
      actually work: browse everything freely, only prompt login at
      cart/checkout when the customer is ready to place an order. This is one of
      the most well-documented conversion killers in e-commerce UX — forcing
      signup before letting people see what's for sale. Scope: relax the route
      guard for browsing pages only; keep cart placement/checkout gated behind
      login as it already effectively needs to be (orders are tied to a customer
      account).
- [ ] **Sticky category navigation within a menu page** (user request, 9/21,
      noticed on foodpanda) — this is a known, named UX pattern: category "chips"
      (e.g. Chickenjoy, Burgers, Sides) stick below the header once you scroll past
      it, tapping one jumps the page to that section, and the active chip highlights
      as you scroll
      ([Smashing Magazine: Designing Sticky
      Menus](https://www.smashingmagazine.com/2023/05/sticky-menus-ux-guidelines/);
      [example implementation
      discussion](https://github.com/hedonarc/foodio/issues/169)). Directly
      addresses Otu-Zan's long single-scroll category-grouped menus (Jollibee,
      McDonald's, Manuela's, etc.) — customers currently have no way to jump
      straight to "Burgers" without scrolling past everything above it. Technical
      note from the research: use `scroll-padding-top` in CSS so the jump doesn't
      hide the section title behind the sticky chip row. Caveat also noted: skip the
      chips entirely for brands with only one or two categories — the row only
      earns its place when there's somewhere meaningful to jump to.
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
      on register), but it's a loaded gun sitting in the repo.
- [ ] Rate limiting on `/uploads/bill-documents` (no throttle currently, upload spam =
      storage-exhaustion DoS risk).
- [ ] Backend test coverage for order/payment flows (best done once 1b–1e exist).
- [ ] Server-side image compression on admin catalog uploads (mirrors the client-side
      fix already applied to bill-payment uploads).
- [ ] **Login page mobile hero (UX)** — decorative "Welcome Back!" card pushes the
      actual email/password fields below the fold on phone screens.
- [ ] **Inconsistent empty states (UX)** — Admin's Payments tab has a proper
      icon+heading+subtext empty state; Riders/Customers/Brands tables just show flat
      "No X found." text. Apply the good pattern everywhere.
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
- [ ] **More compact brand list layout** (Grab/foodpanda reference, 9/21) — both
      foodpanda and Grab present brand/restaurant options as compact horizontal
      rows (logo + name + ETA) rather than large square tiles, fitting more options
      on screen at once and reducing scrolling. Otu-Zan's current large square tiles
      (`src/Pages/costumer/Home.jsx`) take noticeably more space per brand. Related
      to the mobile-screen-space concerns already flagged under "Mobile cart
      placement" above.
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

- [ ] **Research emerging technologies — Data Analytics** (teammate request, 9/20).
      Note: your team's meeting minutes (Aug 26) had the emerging-tech slot as
      AI-based ETA prediction, later deprioritized in favor of simple status labels.
      Data Analytics looks like the new direction — worth confirming with the team
      before it goes into the paper, since it's a different pivot than what's
      currently documented.
