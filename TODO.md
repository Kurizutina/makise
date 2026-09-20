# Otu-Zan — Outstanding Work

Consolidated from a full audit (functional, security, and design review against the
system design doc and industry-standard delivery apps). Grouped by priority; check
items off as they land.

## Critical

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
- [ ] **Step 1e** — Migrate payment confirmation to the backend.
- [ ] **Step 1f** — Wire the real `Queue` table (position, status) instead of the
      client-side fake wait-time formula.
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
- [ ] **Redundant per-item CTAs (UX)** — every product card has both "Add to Cart"
      and "Place Order." Standard apps have one action per item (add); checkout only
      happens at the cart level. Drop the per-item "Place Order."
- [ ] **Customer–rider communication** (teammate request, 9/20) — no chat/messaging
      exists between customer and rider today. Real feature, not a quick fix; needs
      its own design pass (in-app chat vs. just exposing contact numbers, etc.)
      before implementation.

## Medium

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
