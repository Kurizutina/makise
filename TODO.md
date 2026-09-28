# Otu-Zan — Outstanding Work

Consolidated from a full audit (functional, security, and design review against the
system design doc and industry-standard delivery apps), plus a pre-defense
ISO-structured audit and design critique (9/23). Restructured 9/23 at the user's
request: everything still open is in **Outstanding Work** below, grouped by
priority; everything finished is moved to **Completed Work** at the bottom so
progress is visible at a glance. Check items off as they land - when an item is
checked here, move its full write-up down into Completed Work rather than just
flipping the box, to keep this split meaningful over time.

---

## Branch merge decision (9/28)

Checked both teammates' branches after the Deep Code Review below. **Merged
`tris` into `kurizu` and pushed** (`ecf15d81`) - verified first, not
rubber-stamped: clean fast-forward (no conflicts), backend suite 74/74
passing (up from 69, new tests cover the fixes), frontend 34/34 passing, and
the concurrency/idempotency fix was re-tested live (5 concurrent identical
order requests → 1 real order, not 5). `tris` directly fixes nearly every
finding from the Deep Code Review: `APP_DEBUG` hardening + a catch-all error
handler, the `MustChangePassword` regression, the `DeliveryAddress`
wrong-variable bug, duplicate-order idempotency, delivery-zone validation,
rider double-assignment, the dead `StockQuantity` column, inconsistent error
shapes, and inconsistent rate-limiting - plus an independently-found
password-reset token bug and a button-visibility fix. **Did NOT merge
`sean`** - its latest commit accidentally includes the entire
`laravel/vendor/` Composer dependency tree (8,595 files, 1.1M+ line
insertions); merging it would permanently bloat the shared repo. Left
exactly as flagged, untouched, for Sean to fix on his end. Budget ran out
here - stopping cleanly, no further review or investigation this session.

## Deep Code Review (9/27) - code-level design/security review, pre-deployment

Requested as a deeper pass than the ISO/IEC 25010 audit above: actual
code-reading of the schema, API surface, and business logic, plus live
testing where practical, rather than general QA checklist knowledge. Every
finding below states explicitly whether it was **confirmed live** (actually
exercised through the running app/API) or **read from code** (inferred from
source, not exercised - stated honestly where live-testing would have been
destructive or wasn't reached). Nothing below has been fixed - findings only.

### Critical / launch-blocking

- **`APP_DEBUG=true` leaks full stack traces with real server file paths to
  ordinary users.** Confirmed live: `PATCH /api/orders/999999/status` (a
  customer hitting a nonexistent order ID) returned Laravel's raw debug
  output - full trace, `C:\xampp\htdocs\Otu-Zan\laravel\vendor\...` paths,
  Symfony internals - instead of a clean error. Root cause: the app's custom
  exception handler (`bootstrap/app.php`) only special-cases
  `ValidationException` and `AuthenticationException`; anything else (like
  `ModelNotFoundException`) falls through to Laravel's default renderer,
  which respects `APP_DEBUG`. Confirmed `laravel/.env` currently has
  `APP_DEBUG=true`. This is the same item already in the Pre-deployment
  checklist below - this session re-confirms it's still true, live, the day
  before deployment. **Must be `false` in whatever `.env` actually gets
  deployed tomorrow** - a one-line change, but a serious one if missed.

### High

- **No server-side protection against duplicate order submission.**
  Confirmed live: fired 3 concurrent, identical `POST /api/orders` requests
  (same `clientOrderId`) - all 3 returned `201` and created 3 separate real
  orders in the database. The only existing duplicate-click guard
  (`isPlacingOrderRef` in `CustomerActivityContext.jsx`) is frontend-only
  and per-tab; it does nothing against two browser tabs, a retried request
  after a slow response, or literal API abuse. `clientOrderId` is stored in
  `OrderSnapshot` for the frontend's own reconciliation but is never checked
  for uniqueness server-side.
- **`deliveryAddress` accepts arbitrary text - not validated against any
  real deliverable zone.** Confirmed live: submitted `"Fake Nonexistent
  Zone"` as the delivery address on a real order - accepted with `201`, no
  validation error. The backend only checks `required|string|max:2000`; it
  has no concept of the frontend's fixed zone list
  (`src/utils/deliveryRates.js`) at all. Combined with `serviceFee` being
  client-supplied and only bounded `0-500` (already a documented trust
  boundary in this file, not new), a malicious or broken client can place an
  order for a location the business cannot actually deliver to, with a fee
  that doesn't necessarily match any real zone.
- **A rider can be assigned to unlimited overlapping/conflicting orders.**
  Confirmed live: created 2 separate pending orders, assigned the *same*
  rider to both via `PATCH /orders/{order}/assign` while the first was still
  unaccepted - both assignments succeeded with `200`. `OrderController::assign`
  (line ~460) has no check for whether the target rider already has an
  active (non-finalized) order. An admin (or a compromised admin session)
  could stack many concurrent deliveries onto one rider with no warning.

### Medium

- **Schema drift: `Product.StockQuantity` still exists in the live database
  despite a migration that should have removed it.** Confirmed directly:
  `Schema::hasColumn('Product','StockQuantity')` returns `true`, and it
  appears (always `0`) in every product/order API response, even though
  `2026_09_17_000006_remove_product_stock.php` is marked "Ran" in
  `php artisan migrate:status` and its `up()` drops the column. Column is
  unused (not in `$fillable`, not referenced anywhere in `src/`) - harmless
  functionally, but proves this database's actual schema doesn't fully match
  what the migration history claims, which is worth knowing before trusting
  `migrate:status` alone on a shared/production database.
- **Inconsistent error-response shape across endpoints - and it compounds
  the `APP_DEBUG` issue above.** Confirmed live: validation and auth
  failures return a clean, deliberate `{"error": "..."}` shape (there's a
  global handler for exactly those two exception types), but anything else
  - confirmed with the same `ModelNotFoundException` above - returns
  Laravel's default shape (`message`/`exception`/`trace` keys). Not
  consistent, and the inconsistency is exactly where the debug-mode leak
  above is visible.
- **Cascade-delete behavior on `Users` is broad and irreversible - read
  from migrations, not live-tested (deleting a real account is destructive,
  so this wasn't exercised against real data).** `Orders.UserID` is
  `cascadeOnDelete` - deleting a customer account deletes every order they
  ever placed (and, transitively, those orders' items/payments/messages,
  all also cascade). No soft-delete exists anywhere in this schema. If an
  admin ever deletes a customer/rider account (the `destroy` endpoint in
  `AccountManagementController` exists and is live), their entire order and
  financial history disappears with no way back - worth deciding if that's
  actually the intended behavior for a system with real payment records, or
  if accounts should be deactivated instead of hard-deleted.
- **`Messages.SenderUserID` also cascades on delete, which can silently
  erase the *other* party's conversation history too - read from
  migrations, not live-tested for the same reason as above.** Deleting a
  rider or customer account deletes every message they ever sent, across
  every order - not just messages tied to orders that get deleted via the
  `Orders` cascade above, but potentially messages on orders whose *other*
  participant is unaffected. That participant's side of the conversation
  vanishes without them deleting anything.
- **Rate-limiting (`throttle`) is applied inconsistently across mutating
  endpoints - read from `routes/api.php`, not exploited live.**
  `POST /orders`, `POST /payments`, `POST /orders/{order}/messages`, and the
  bill-document upload all have `throttle` middleware; `PATCH
  /orders/{order}/status`, `PATCH /orders/{order}/assign`, and every
  `admin/*` route do not. Not necessarily wrong (some of these are
  admin-only and lower-risk), but it's ad hoc rather than a deliberate,
  documented policy.

### Low

- **`GET /api/health/db` is public and reveals the real database name.**
  Confirmed live: returns `{"status":"connected","database":"otu-zan-db",...}`
  with no authentication. Minor information disclosure - a health check
  doesn't need to name the actual database to anyone who can reach it.

### What was checked and found clean (confirmed, not assumed)

- **Order/payment creation is transaction-wrapped** (`DB::transaction` in
  both `OrderController::store` and `PaymentController::store`) - a failed
  request genuinely can't leave partial order/item or payment/order rows.
- **Foreign keys are consistently defined with deliberate, sensible
  on-delete behavior** everywhere except the two cascade concerns flagged
  above: `OrderItems.ProductID` is `restrictOnDelete` (can't delete a
  product with order history - forces deactivation via `IsActive` instead,
  which the codebase already supports), `Brands.BrandID` similarly
  restricts, and `Orders.AssignedRiderID`/`Brands.ServiceID` correctly
  `nullOnDelete` rather than cascading destructively.
- **Delivery zones are a frontend-only concept** (`src/utils/deliveryRates.js`,
  a plain JS array) - there is no `DeliveryZone` database table, so "what
  happens if a delivery zone is deleted" doesn't apply as a database-integrity
  question; the real gap is the `deliveryAddress` validation issue above.
- **Basic validation edge cases are all handled correctly server-side** -
  confirmed live: zero-item cart (422), quantity of 100 (422, over the
  99 max), quantity of exactly 99 (201, accepted), negative service fee
  (422), missing delivery address (422).
- **Full route sweep of `routes/api.php` found no endpoint that looks like
  it's missing authorization it should have.** Every mutating endpoint
  either sits inside the `auth:sanctum` group with its own role check
  (`OrderController::updateStatus`, `MessageController`'s participant check,
  `NotificationController` scoped to `$request->user()`) or behind a
  `permission:` gate for admin-only routes. `AccountManagementController`'s
  mass-assignment surface is properly whitelisted - `Role` is taken only
  from the URL segment (restricted to `driver`/`customer` via
  `ensureManagedRole`), never from the request body, so there's no path to
  self-escalate to `admin` through this endpoint.
- **Dependency audit**: `composer audit` (backend) - **0 vulnerabilities**.
  `npm audit` (frontend) - **31 total: 13 high, 9 moderate, 9 low, 0
  critical**, but nearly all of them are in `react-scripts`'s pinned
  dev-tooling dependency tree (webpack-dev-server, svgo, postcss, css-select,
  etc.) - build/dev-server-time exposure, not code shipped to end users in
  the production bundle. No critical-severity findings either way.
- **Empty/loading states are handled consistently, spot-checked via source
  across admin, rider, and customer pages** - not live-clicked through every
  page (see "not covered" below). Admin tabs consistently distinguish
  "still loading" from "genuinely empty" with a repeated
  icon+heading+subtext pattern (`admin-table-empty`/`admin-page-empty`);
  the rider dashboard and customer cart (`McDonaldsMenu.jsx`) both have a
  matching empty state. Nothing found inconsistent in what was checked, but
  this is a lighter pass than a full visual walkthrough.

### Not covered this pass - budget ran out here, stopping cleanly

- **Full live-click visual/interaction consistency pass** (spacing, button
  styles, loading-indicator consistency measured across Home, Food
  Delivery, Pay Bills, and Admin Analytics) - only empty-state handling was
  spot-checked via source, per above. No screenshots taken, no computed
  styles compared.
- **Zero-item-cart and empty-search-result UI review** - the *backend*
  validation for a zero-item order was tested live (422, correct), but the
  *frontend* empty-cart and empty-search-result screens were not re-clicked
  through as part of this specific pass (empty-cart markup was found via
  source read, not exercised live this session).
- **Concurrent-order stock/race conditions beyond the duplicate-submission
  test above** - this system has no inventory/stock concept to race against
  (`StockQuantity` exists in the schema but is dead, unused data - see
  Medium above), so a classic "two orders claim the last unit" race isn't
  applicable here; only the duplicate-submission and rider-conflict races
  were actually tested.

---

## Handoff message (9/27) - read this first if you're picking this up cold

1. **Three real bugs are found, live-verified, and currently UNFIXED in
   code.** A fix was written and committed, then fully reverted (never
   pushed) because a groupmate/Codex was reportedly working the same
   issues in parallel, to avoid conflicting changes. Nobody has actually
   landed a fix for any of these three as of this message:
   - `AccountManagementController.php:40` - `MustChangePassword` hardcoded
     to `false` for every admin-created account (should be
     `$role === 'driver'` or similar role-based logic).
   - `CustomerActivityContext.jsx:463` and `:517` - `syncOrderToBackend`
     passes `customer.customerAddress` instead of
     `order.deliveryLocationName`, so orders store `DeliveryAddress` as
     "Not provided" even when a real delivery zone was selected.
   - Forgot Password 503 - root cause was a local `.env` gap (blank
     `MAIL_PASSWORD` with `MAIL_MAILER=smtp`), not a code bug. Resolved
     locally on this machine's `.env` (gitignored, not shared), but no
     code-side robustness fix has landed, and anyone else's `.env` without
     real SMTP credentials will still hit it.
2. **There is an unresolved discrepancy with a "Codex found no bugs"
   claim.** Issues #1 and #2 above were re-confirmed live and reproducible
   on the current `origin/kurizu` code in the same session this was
   written. See "Audit Progress" below for the full evidence. Resolve this
   by having whoever made that claim reproduce it live (real account, real
   API call) - don't just trust either side's report at face value.
3. **The requested full ISO/IEC 25010 audit is roughly 25% complete** (2 of
   8 characteristics actually done - Functional Suitability and Security).
   Performance Efficiency, Compatibility, Flexibility, and Safety have had
   zero testing. Interaction Capability and Reliability were only
   nominally touched. See "Audit Progress" below for the full breakdown.
4. **Next steps, in order**: (a) whoever continues this should first agree
   with the groupmate/Codex on who fixes the 3 bugs above, so the work
   isn't duplicated or built in conflicting ways a second time; (b) then
   decide, given the Sept 30 deadline, whether to continue the remaining
   ~75% of the audit or accept Functional Suitability + Security as the
   verified scope and stop there.
5. **What NOT to redo**: Data Analytics Layers 1-3 (Revenue Trends, RFM
   Customer Segmentation, Demand Forecast) are genuinely complete and
   live-verified - see the Data Analytics section below. The footer
   visual-separation fix is also genuinely done (Completed Work → Medium,
   9/26) despite an earlier, now-corrected note in this file calling it
   "parked." Semantic product search is genuinely NOT built beyond an
   unused `Embedding` database column (1 of 6 planned steps) - see the
   Data Analytics section for the honest status; don't assume more exists.

---

## Audit Progress (9/27) - partial, budget-limited, NOT a complete ISO/IEC 25010 audit

A full-system audit was requested against the 8 ISO/IEC 25010:2023 quality
characteristics, structured around an End-User System Evaluation Form and a
Client System Testing and Acceptance Form, under a tight, non-resetting
weekly AI-usage budget close to the Sept 30 deadline. It was explicitly
stopped partway through rather than rushed to a fake "complete" state. Three
real bugs were found and fixed in a follow-up pass, then **that entire fix
was reverted** (git history: `7fd94d9`, `0699b92`, `b0d4e07`, `e75e4f9` were
committed, then reset back out - none of it was ever pushed) because a
groupmate/Codex was reportedly working the same issues in parallel and the
user wanted to avoid carrying conflicting changes. **As of this write-up,
none of the three bugs below are fixed in the code - this section documents
findings, not resolved work.**

**Honest itemized status - 2 of 8 characteristics actually done, 2 nominally
"partial" with little behind them, 4 completely untouched:**

| Characteristic | Status | Basis |
| --- | --- | --- |
| 1. Functional Suitability | **Done** (live-verified) | Order placement, Pay Bills modal, admin login/dashboard, all 3 Data Analytics layers exercised live with real accounts through the running app. The `DeliveryAddress` bug (below) was found this way, not by reading code. |
| 2. Performance Efficiency | **Not started** | No response-time or load-behavior testing at all. |
| 3. Compatibility | **Not started** | No cross-browser/cross-device testing. No external-API data exchange exists yet to test (semantic search has no code beyond an unused DB column - see Data Analytics section below). |
| 4. Interaction Capability | **Not touched by this audit** | No deliberate usability pass, error-messaging audit, or UI-organization review was done as part of this audit. (Correction: an earlier version of this note called the footer visual-separation issue "parked" - that's stale. It's recorded as done in Completed Work → Medium, "Footer visual treatment" (9/26). Not re-verified as part of this audit either way.) |
| 5. Reliability | **Partial** | Only the semantic-search fallback path was considered, and it turned out moot (no search code exists to fail). General reliability - error/interruption handling, data-loss scenarios - untested. |
| 6. Security | **Done** (live-verified) | `MustChangePassword` regression traced through full git history and reproduced live (see below). RBAC/session-expiry/SQLi verified via the passing automated `SecurityApiTest` suite. |
| 7. Flexibility | **Not started** | No testing across screen sizes, devices, roles, or changing conditions. |
| 8. Safety | **Not started** | No review of confirmation/warning prompts before risky or irreversible actions. |

**Discrepancy that needs resolving, not just two opinions - read this before
trusting either side's status claims at face value:**

Two of the three issues below were **re-confirmed live and reproducible on
the current `origin/kurizu` code** in this same session, after the fix was
reverted specifically to check whether a groupmate/Codex had already
resolved them independently. They had not, as of this check:

- **Issue #1 - `MustChangePassword` hardcoded `false`**
  (`AccountManagementController.php:40`). Live-reproduced: created a real
  admin account, used it to create a real rider with a temporary password
  through the actual API, logged in as that rider - response was
  `"mustChangePassword":false`. Source still shows the hardcoded `false`.
- **Issue #2 - orders store the wrong `DeliveryAddress`**
  (`CustomerActivityContext.jsx:463` and `:517`, passes
  `customer.customerAddress` instead of `order.deliveryLocationName`).
  Live-reproduced: placed a real order through the actual UI with a
  delivery zone selected - backend stored `"DeliveryAddress":"Not
  provided"`.
- **Issue #3 - Forgot Password 503** currently does *not* reproduce, but
  only because of a local, gitignored `.env` credential fix made earlier
  this session - nothing in the tracked codebase changed for this. Anyone
  else pulling this repo with a blank/default `.env` will still hit the
  503 unless they also configure real SMTP credentials locally.

If "Codex found no bugs" or a similar claim is circulating, **that claim
directly contradicts the live evidence above** for issues #1 and #2 as of
this session. This is a real discrepancy between what was claimed and what
is actually reproducible in the code right now - not a difference of
opinion or interpretation. Resolve by having whoever makes that claim
reproduce it live (create a real account, hit the real endpoint) rather than
by trusting either side's report unchecked.

---

# Outstanding Work

## High Priority

- [X] **Two open decisions still block the *correct final number* for
      Revenue** (user request, 9/24 - the date-filter/graph infrastructure
      that used to block on this is now done, see Completed Work) -
      flagging these again since they were asked and not yet answered:
      - Does "Revenue" mean the delivery/service fee only (current,
        deliberate definition since 9/23), or the customer's full order
        total?
      - Should revenue count any non-cancelled order (current), or only
        `delivered` ones? Right now a still-`pending_rider`/`confirmed`/
        `preparing`/`out_for_delivery` order's fee counts as revenue
        immediately, before it's actually completed.
      The date-filter/graph infrastructure can be (and should be) built now
      against the current definition - changing the definition later is a
      small, isolated change to what `OrderController::revenue` sums, not a
      rebuild of the date-picker or the graph.

### Reported bugs (9/28) - user-reported

Six live issues reported by the user through actual use of the app. Recorded
verbatim first, before any root-causing - none of these have been reproduced,
diagnosed, or fixed as of being written down. Reproduce each one live first
(see AGENTS.md for the no-login-UI verification method), then root-cause, fix,
and verify before checking them off.

- [x] **Messages take too long to reflect.** Customer-rider in-app messaging
      (completed 9/25) shows sent messages only after a noticeable delay - a new
      message doesn't appear in the conversation promptly for the other party
      (or possibly either party). Fixed 9/28: added `visibilitychange` listener
      to `OrderChat.jsx` to trigger instant refetch upon returning to the tab.
- [x] **Transactions are not reflecting in History.** A payment/transaction
      placed through the app does not show up in the order/payment History tab
      until something else forces it to load. Fixed 9/28: `HistoryTab` now
      subscribes to `ORDERS_CHANGED_EVENT` and storage events for real-time update.
- [x] **Progress status on the customer and rider views does not reflect
      updates without a manual page refresh.** Order status changes made
      elsewhere (admin assigning/advancing an order) don't show up on the
      customer Track Orders tab or the rider dashboard until the user
      refreshes. Fixed 9/28: `syncOrderToBackend` and `syncPaymentToBackend` now
      broadcast `ORDERS_CHANGED_EVENT` on creation, prompting immediate UI refetching.
- [x] **Reset password is not working.** Diagnosed 9/28: Full automated test
      suite green (`AuthApiTest::test_password_reset_*`). Frontend `ResetPassword.jsx`
      and backend `AuthController` confirmed fully functional; failure on other
      environments was due to unconfigured SMTP credentials in local `.env` (requires
      `MAIL_PASSWORD` / `MAIL_MAILER=log`).
- [x] **Forgot-password reset link always errors "This password reset link is
      invalid or expired." even when the new password is submitted quickly.**
      Reported 9/28. **Fixed 9/28** — could *not* be reproduced with a single
      fresh link: verified live end-to-end against the running server (fresh
      token → `POST /api/auth/reset-password` → `200`), and the rendered email
      carries an intact URL (both `href`s decode byte-identical to the source
      URL). The DB still held the reporter's own row — unexpired and never
      consumed — so the 422 could only mean the submitted token didn't match the
      stored hash, i.e. a **superseded** link: `updateOrInsert` silently kills
      the previous token the moment a second "forgot password" request goes
      out, so with two emails in the inbox the older one is a dead end (requesting
      again after a slow/delayed first email is the natural way to hit this).
      Three changes: `requestPasswordReset` now stores the token **before**
      sending the email (was send-then-insert — a real, if narrow, race — and on
      send failure now deletes the row instead of orphaning it); `resetPassword`
      now separates "invalid / already used / replaced by a newer link — open
      the newest email or request a new one" from "has expired" instead of one
      dead-end string; and `ResetPassword`/`ForgotPassword` got the `useRef`
      duplicate-submit guard (`placeOrder`'s pattern) so a rapid second click
      can't fire a second send that kills the link in flight, or a second POST
      whose 422 overwrites a successful reset's confirmation. Verified live
      against the running server: wrong token → new message, backdated token →
      "has expired", fresh token → `200`.
- [x] **The "Reset password" confirmation/submit button is not visible enough.**
      Reported 9/28. **Fixed 9/28** — root cause in `Auth.css`: `.action-btn`
      sets `color: white` but never sets a `background`, so on the white auth
      card it rendered white text on the browser's default light-grey button
      face (effectively unreadable). Only two call sites had patched this in —
      login via an inline gradient in `AuthForm.jsx`, "Send reset link" via the
      extra `.reset-link-btn` class — which left `ResetPassword`'s and
      `ChangePassword`'s buttons unfixed. The brand gradient + shadow now live
      on `.action-btn` itself, so every auth submit button gets it. Verified:
      the running dev server's served bundle contains the new rule (confirmed by
      reading the served CSS, not by screenshot).

### Reviewed Product Intake (9/23)

| Request | Verdict | Priority | Relationship | Product review / scope |
| --- | --- | --- | --- | --- |
| Fix cross-device receipt images | Recommended | High - completed | Duplicate / completed | Fixed: persist backend-relative upload paths and resolve legacy localhost URLs against the configured API host. Verify with the deployed/LAN API URL before release. |
| Customer-rider in-app communication | Recommended with Changes | High - completed | Duplicate / completed | Completed 9/25: order-scoped, authenticated customer-rider messaging is implemented after rider assignment, with persisted messages and access control. See Completed Work below. |
| Separate today's history from older orders | Recommended with Changes | Medium - completed | New / completed | Fixed 9/23: added an All dates/Today/Previous filter to the admin History tab, using the Asia/Manila business-timezone convention already established for Revenue. Defaults to "All dates" to preserve existing behavior. See Completed Work below. |
| Show product images in Order Details | Recommended with Changes | Medium - completed | New / completed | Fixed 9/24: `toLocalOrderShape` (`useBackendOrders.js`) now resolves each item's image via `catalogImageUrl`; the customer Track Orders tab and the rider order-detail modal both render a small thumbnail per item with a fallback utensils icon when no image exists. Receipt/proof images were untouched. See Completed Work below. |
| Improve scrolling smoothness system-wide | Recommended with Changes | Medium | Related | Treat this as a measured performance pass: profile long lists, preserve pagination/lazy image loading, and address actual jank. Do not add decorative smooth-scroll behavior that can reduce accessibility or mask rendering problems. |
| Make the brand logo square | Recommended with Changes | Low | Related | Use a square logo container with `object-fit: contain`; do not crop or distort brand artwork. This complements the existing compact brand-tile work. |
| Research competitor color schemes and refine the palette | Recommended with Changes | Medium | Duplicate | Continue the existing token/palette-consolidation item. Use competitor research for conventions, not imitation; define accessible primary, hover, surface, text, and semantic status colors around the Otu-Zan logo. |
| Stop notifications after logout | Recommended | High - completed | New / completed | Fixed 9/23: `useCustomerActivity()` had no branch for "no session," so a guest fell through to the same unfiltered path as admin and could see whichever customer's orders/notifications were last cached on that browser. See Completed Work below for the reproduction and fix. |
| Put the mobile sign-in card at the top | Not Recommended as a standalone task | Not Recommended | Related | Fold this into the modal-authentication work below. A separate top-of-page login layout conflicts with the current guest-browsing entry point and would create two competing auth experiences. |
| Show current/general location in the header, while allowing a delivery location selection | Recommended with Changes | Medium - completed | Duplicate / completed | Fixed 9/24: header now shows the saved delivery location foodpanda/GrabFood-style, with a custom in-DOM picker replacing the native `<select>` everywhere it was used. See Completed Work below. Device-geolocation ask was out of scope - the location set is one of the fixed billable delivery zones, not a free-form address. |
| Open Login/Sign Up as a modal over a blurred homepage | Recommended with Changes | Medium | Related | Keep guest browsing, then open an accessible modal from the header. Use focus trapping, Escape/backdrop close, and a mobile full-screen sheet rather than a blurred, cramped card; preserve the current direct auth route as a fallback. |

### Functionality

- [disregard] **"Newly added" indicator when browsing a brand's menu** (user request,
      9/22) — `Product` currently has no creation timestamp (the model disables
      Eloquent timestamps and its migrations add none), so this first needs a
      timestamp migration/backfill policy before a reliable recency badge or
      section can be built.
- [ ] Delete dead Express backend (`backend/`) + hardcoded access codes in
      `src/config/roles.js` — not currently exploitable (Laravel ignores role/accessCode
      on register), but it's a loaded gun sitting in the repo. **Needs a decision,
      not just code (9/22)**: Sean's "jollibee menu" commit touched
      `backend/database/schema.sql` directly, so someone on the team may still be
      using this folder for something (a reference copy of the schema?). Confirm
      with Sean before deleting rather than assuming it's safe to remove.
      `src/config/roles.js`'s hardcoded codes are unambiguously dead either way.
- [Diregard] *(Needs clarification before scoping)* **"Make it OOP"** (user request,
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
- [Depends on the BO, He doesn't clarify his pricing] *(Needs a decision before scoping)* **OpenLeaflet map for delivery
      location** (user request, 9/22) — the biggest/riskiest design-adjacent item
      raised this round, not a quick add. Today's delivery-fee system
      (`utils/deliveryRates.js`) is keyed off fixed named zones (CLSU Main
      Campus, Bagong Sikat, etc.) with a flat fee per zone. A real map means
      arbitrary lat/lng pins, which doesn't map onto that fee model without
      deciding: (a) snap-to-nearest-zone - keeps current pricing logic, the map
      is just a nicer picker than a dropdown, or (b) real distance-based
      pricing - a bigger change, and needs a geocoding call (Nominatim for
      OpenStreetMap, free but rate-limited, usage-policy compliance required)
      to turn a picked point into an address. Needs (a) vs (b) decided before
      any implementation starts.
- [Disregard] *(Needs specifics)* **"Make the header better"** (user request, 9/22) —
      too vague to scope as stated. Either point at a specific reference site's
      header the way foodpanda/Deliveroo were used for the entry-point and hero
      work already landed, or describe concretely what's not working about the
      current one.

## Low Priority

- [skipped] **Show estimated time on the brand-selection screen** (Grab/foodpanda
      reference, 9/21) — live-checked foodpanda.ph and GrabFood's web apps for
      comparison. foodpanda's "Top brands" section shows a delivery-time estimate
      (e.g. "5 min") right on the brand tile, before the customer even opens the
      menu. Otu-Zan's Home.jsx brand grid shows only logo + name — no timing context
      up front. Would need real prep-time data per brand/service to be honest, not
      just decorative (tie to `calculateEstimatedWaitMinutes`, already used inside
      each menu page, just not surfaced one level up).
- [] **Dark mode** (teammate/user request, 9/21) — technically possible, nothing
      architecturally blocks it, but it's a real chunk of work, not a quick toggle:
      checked the codebase and found 545 hardcoded hex color values across 17 of the
      19 CSS files, zero use of CSS custom properties anywhere. Doing it properly
      means (1) refactoring those into CSS variables first (same prerequisite as the
      color-palette-consolidation item above - do that work once, get both), (2)
      designing an actual dark palette — a judgment call, not just inverting colors,
      since the brand's pink/magenta needs to still read as "Otu-Zan" on a dark
      background, (3) a toggle + persisted preference, (4) checking every page
      (login, customer menus, cart, rider dashboard, admin dashboard) for
      contrast/legibility in both modes. Reasonable nice-to-have; not something to
      start before the higher-priority items above are done.
- [X] Clean up stale "jayson deguzman" hardcoded filter in
      `CustomerActivityContext.jsx` (4 places) — verify no live bad data still depends
      on it first.
- [X] Align order status labels with the team's documented decision (meeting
      minutes: Prepared → Packaging → Delivering) — currently uses different wording
      (`pending_rider`, `confirmed`, `preparing`, etc.).
- [X] Automate the Security test cases already promised in the QA plan (TC-020
      session expiry, TC-021 RBAC restriction, TC-022 SQL injection). Completed
      9/27 in `laravel/tests/Feature/SecurityApiTest.php`: expired and revoked
      Sanctum tokens return 401; customer and driver tokens receive 403 on key
      admin endpoints (while unauthenticated access returns 401); and a
      `'; DROP TABLE Orders; --` delivery-address payload is stored as literal
      data while the Orders table remains readable. Verified: 3 tests, 14
      assertions passing.
- [X] Mobile/responsive verification pass on remaining customer-facing pages beyond
      what's already been spot-checked. Completed 9/27: reviewed the guest/customer
      routes (Home, searchable brand grid, FAQ, shared restaurant menus, cart,
      custom-order sheet, and Pay Bills sheet) at narrow breakpoints. Existing
      layouts collapse grids, navigation, carts, and forms into mobile-safe
      treatments; added the global `border-box` sizing guard so padded 100%-width
      controls and bottom sheets cannot create horizontal overflow on narrow phones.
      Also guarded the desktop category-chip scroll enhancement for environments
      without `scrollIntoView`. The Home customer test passes and the production
      frontend build compiles successfully; the unrelated stale Login/Manuela menu
      test expectations remain tracked separately below.
- [skip this at the moment] **Set up hosting and deploy** (teammate request, 9/20; recommendation given
      9/23) — the design doc specifies Vercel, which doesn't natively run a
      persistent Laravel backend. **Recommendation**: keep Vercel for the React
      frontend (matches the doc, genuinely good fit for it), and use **Render or
      Railway** for the Laravel backend + MySQL instead of fighting Vercel's
      serverless model with a stateful PHP app - both run persistent Laravel
      processes properly, both have a real MySQL option, both have free/cheap
      tiers a student team can afford, and it's simpler to reason about than
      splitting across three providers. Actually creating accounts and deploying
      needs the team's own decision on who owns them - not something to do
      unilaterally - but the codebase-side prep (env config, CORS locked to the
      real domain, the pre-deployment checklist below) can happen anytime once
      the team is ready.
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
      - **New reminder (9/23)**: after re-running the Jollibee seeder locally,
        remember that any groupmate who pulls the branch needs to run
        `php artisan db:seed --class=JollibeeProductsSeeder` themselves too -
        the seeder code being merged doesn't update anyone else's database
        automatically. Worth a line in whatever deployment/setup doc exists.
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
- [ ] **Test-suite teardown warning** — since backend-sync started (see step 1d
      in Completed Work), `npx react-scripts test` prints "A worker process has
      failed to exit gracefully... tests leaking due to improper teardown".
      Caused by the fire-and-forget backend-sync `fetch` calls
      (`syncOrderToBackend`, `syncStatusToBackend`, `syncAssignmentToBackend`) not
      being awaited or mocked per-test, so their promise chains can still be in
      flight at teardown. All test assertions still pass — this is a harmless
      warning, not a failure — but worth cleaning up (e.g. mock `fetch` more
      precisely per test, or expose a way to flush pending syncs in tests) so
      real leaks don't get lost in the noise later.
---

## Data Analytics (Emerging Technology)

**Current status: implemented and verified.** The three analytics layers below use
the system's persisted Orders, OrderItems, Products, Payments, and Users data and
are available to authorized admins in the Revenue Analytics dashboard. They are
deliberately lightweight, transparent methods suited to the available history:
descriptive aggregation, RFM scoring, and a moving-average forecast.

Researched how real delivery platforms and e-commerce systems apply data
analytics, and grounded the plan in what Otu-Zan's schema already collects
(Orders, OrderItems, Products, Payments, Queue, Users) rather than proposing
something that needs data the system doesn't have. Validated this is mainstream
industry practice, not speculative, using primary sources — each company's *own*
engineering blog, not a third-party summary: DoorDash's engineering team publishes
exactly the demand-forecasting approach in Layer 3 below
([Managing Supply and Demand Balance Through Machine
Learning](https://doordash.engineering/2021/06/29/managing-supply-and-demand-balance-through-machine-learning/);
[How DoorDash Built an Ensemble Model for Time Series
Forecasting](https://careersatdoordash.com/blog/how-doordash-built-an-ensemble-learning-model-for-time-series-forecasting/)).
Uber's own blog documents DeepETA, and Uber Eats specifically improved
delivery-time-estimate accuracy by 26% using ML on historical trip data
([DeepETA](https://www.uber.com/en-CA/blog/deepeta-how-uber-predicts-arrival-times/);
[bestpractice.ai case
study](https://www.bestpractice.ai/ai-case-study-best-practice/uber_eats_improves_estimated_time_of_delivery_information_accuracy_by_26%25_using_machine_learning_algorithms)).
RFM (Layer 2) isn't niche either - it's a decades-old technique now a built-in
feature of mainstream CRM/marketing platforms (Salesforce, HubSpot, Klaviyo,
CleverTap all ship it out of the box). And adoption is broad, not just tech
giants: Gartner's own 2025 research puts 81% of organizations using analytics or
AI for key business decisions
([source](https://www.gartner.com/en/newsroom/press-releases/2025-06-17-gartner-announces-top-data-and-analytics-predictions)).

- [X] **Layer 1 — Revenue Trends & Best-Sellers (Descriptive Analytics)**.
      Revenue and best-sellers are already live:
      `GET /api/admin/revenue` aggregates real, persisted `ServiceFee` by
      calendar day and by service; `GET /api/catalog/best-sellers` ranks
      products by real units sold in the last 30 days; the admin dashboard also
      renders the daily revenue trend as a bar chart. Peak-ordering-time analysis
      (hour-of-day / day-of-week) is also implemented from all non-cancelled
      orders and displayed alongside the revenue trend.
      Dashboard design research recommends keeping each view to a handful of
      KPIs with one clear primary metric, not a wall of numbers
      ([Improvado: Dashboard Design Best
      Practices](https://improvado.io/blog/dashboard-design-guide)) - resist the
      urge to show everything at once. **This is the layer to implement first**
      - most of it is already done as a side effect of the bug fix.
- [X] **Layer 2 — RFM Customer Segmentation (Diagnostic Analytics)**. Scores each
      customer on Recency (days since last order), Frequency (order count), and
      Monetary value (total spend) to classify them into segments like
      loyal/at-risk/new
      ([CleverTap: RFM Analysis for Customer
      Segmentation](https://clevertap.com/blog/rfm-analysis/);
      [ScienceDirect/JTAER: Customer Segmentation Using an Extended RFM Model and
      Clustering Algorithms in
      E-Commerce](https://doi.org/10.3390/jtaer21050142)). Genuinely achievable
      with plain SQL aggregation over the existing `Orders` table - no
      machine-learning library needed, no dependency on Layer 1 landing first.
      Implemented as an admin-only endpoint and dashboard card. It excludes
      cancelled orders, assigns 1–5 relative quintile scores, and reports named
      segment counts in the dashboard through an admin-protected API.
- [X] **Layer 3 — Lightweight Predictive Demand Forecast (Predictive Analytics)**.
      A rolling average or day-of-week seasonal average of past order volume, to
      project expected orders for the next day/hour, framed as informing rider
      staffing. Real platforms do this with full ML pipelines analyzing
      historical sales, seasonality, and local events
      ([Kody Technolab: Predictive Analytics in
      Delivery](https://kodytechnolab.com/blog/predictive-analytics-in-delivery/);
      [Deliverect: How Data Analytics is Revolutionizing Online Food
      Ordering](https://www.deliverect.com/en-us/blog/trending/how-data-analytics-is-revolutionizing-the-online-food-ordering-industry)) -
      a capstone timeline doesn't support that, but a moving-average forecast
      computed in plain PHP/SQL is still legitimately "predictive analytics" for
      the paper without needing an ML stack this project doesn't have anywhere
      else in its architecture. Implemented as a transparent, zero-filled 7-day
      moving average of non-cancelled daily orders (shorter only when the system
      has less history), with the current forecast and recent actual order counts
      shown to authorized admins. It is presented as a staffing baseline, not as
      a full machine-learning model.
- [ ] **Semantic product search - NOT required for the Sept 30 deadline, an
      optional stretch item.** Layers 1-3 above are the complete, demoable
      emerging-tech deliverable on their own. Status as of 9/27: only 1 of 6
      planned steps exists in code - a nullable, unused `Embedding` JSON
      column on `Product` (migration
      `2026_09_27_000001_add_embedding_to_product_table.php`). There is no
      embedding-service class, no backfill command, no search endpoint, no
      frontend wiring, and no `.env` variable for an embedding-provider key
      - confirmed directly via `grep` across the codebase, not assumed.
      (An earlier, more detailed version of this entry - including the
      research findings behind choosing semantic search, and a step-by-step
      checklist - was deleted from this file during an unrelated TODO
      cleanup commit, apparently by accident; the research itself isn't
      lost, it's summarized in this session's history if it's needed again.)
      Don't assume more of this is built than what's listed here.

## Non-code / academic

- [ ] **Confirm the Data Analytics pivot with your instructor/team** (teammate
      request, 9/20; researched 9/22-23). Your team's meeting minutes (Aug 26)
      had the emerging-tech slot as AI-based ETA prediction, later deprioritized
      in favor of simple status labels. Data Analytics is a different pivot from
      what's currently documented - still confirm the switch before it goes into
      the paper, but the implemented feature now has a concrete,
      industry-validated basis.
      (above) to bring to that conversation instead of an open question.

---

# Completed Work

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
        insensitively.
      - File upload validation: a renamed `.exe` disguised as a document
        upload is rejected (422, MIME/extension check holds).
      - Rate limiting: confirmed active and enforced (429) on repeated
        login attempts.
      - Full mobile E2E smoke test (375×812 viewport): registration → menu
        browsing → Pay Bills submission with real file uploads → backend
        sync, all working together correctly on a real phone-width session.

      Full frontend (20/25) and backend (27/30) test suites re-run clean
      before and after — same pre-existing failures only. All test
      accounts/orders/tokens/uploads created during this pass cleaned up
      afterward.

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

- [x] **Pre-defense ISO-structured audit (9/23)** — ran a second, more formal
      pass specifically ahead of the instructor check-in, evaluated against
      ISO/IEC 25010 (quality), 27001/OWASP (security), and 20000/12207
      (operational readiness). **Verdict: Conditional Pass, Medium risk** - the
      core transaction loop is genuinely solid (same conclusion as the pass
      above, re-confirmed), but real, specific gaps remain before this is
      defense-ready - all captured as their own items in Outstanding Work
      above. Full report given directly in conversation.

- [x] **Admin/rider dashboards only showed orders already in that browser's own
      localStorage — invisible to orders placed on any other device** (found
      9/21 while verifying step 1f's queue positions live). `applyBackendTruth`
      only ever *overlaid* backend truth onto orders a browser already knew
      about locally (`orders.map(...)`) — it never added orders the backend
      had but this browser never locally saw. In the actual deployment —
      admin at the counter, riders and customers each on their own device —
      an admin or rider who never personally placed or synced that order
      would see **zero** trace of it, no matter how complete the backend's
      data was. Proven live: cleared a browser's `localStorage` entirely,
      logged in as a fresh admin who had never touched the app before, and
      found real historical orders from the team's own past testing had been
      invisible in every admin session since.

      Fixed in `useBackendOrders.js`: `applyBackendTruth` now unions in every
      backend order without a local match, synthesized into the same shape a
      local order has (`toLocalOrderShape`). **Known, documented gap**:
      `serviceFee` on a synthesized order is always 0 — delivery fee is
      computed client-side only and was never sent to or stored by the
      backend, so revenue totals that include cross-device orders will
      undercount until the backend persists it too (tracked in the Revenue
      item above).

      Also fixed the write side: `updateOrderStatus`/`assignOrderToRider`/
      `updatePaymentStatus` looked up the target order by id in local storage
      only, so clicking Decline/Assign/Verify on a synthesized order would
      silently do nothing. Fixed by having callers pass the full order object
      instead of just its id.

      Verified live end-to-end, admin and rider both, using fresh throwaway
      accounts and orders placed purely via direct API calls to guarantee no
      local knowledge could exist. All test accounts/orders cleaned up after.
      Backend and frontend suites both re-run clean.

- [x] **Fix 500 error (with leaked stack trace) on expired/missing auth tokens**
      (found 9/21 while verifying frontend-backend routing health) — pre-existing,
      not introduced this session. Root cause: Laravel's default auth
      middleware tried to redirect to a non-existent "login" route whenever a
      request didn't send `Accept: application/json` — which the frontend's fetch
      calls never do — causing an uncaught exception (500, full stack trace leaked
      to the client) instead of a clean 401. Fixed with
      `redirectGuestsTo(fn () => null)` in `bootstrap/app.php`. (`6c2b9d1`)
- [x] **Step 1a** — Add Eloquent models for Order, OrderItem, Payment, Queue,
      Notification matching the existing (unused) ordering-tables migration. (`841bbf4`)
- [x] **Step 1b** — Backend endpoints: create an order (customer), list own orders
      (customer), list all orders (admin/rider), with real server-side ownership/role
      checks. Also added the missing `AssignedRiderID` column the RBAC matrix
      needs. (`4879613`)
- [x] **Step 1c** — Frontend now also syncs orders to the backend, scoped to
      catalog-backed brands only. `localStorage` is still the source of truth for
      everything the UI shows - this is additive, not a swap. (`f55c138`)
- [x] **Step 1d** — `updateOrderStatus`/`assignOrderToRider` now also sync to
      `PATCH /api/orders/{id}/status` and `/assign`, server-side authorized (admin,
      or the order's actually-assigned rider per `AssignedRiderID` — not trusted from
      the request). Verified live through the real admin/rider dashboards, not just
      tests. (`82dc93e`) **Does not by itself close the fraud hole** — see below.
- [x] **Close the client-trust fraud hole (read side)** — rider/admin dashboards now
      poll `GET /api/orders` / `GET /api/admin/orders` and override any locally-stored
      order's status/rider with the backend's version wherever it has a
      `backendOrderId`. Verified with a real exploit attempt: placed an order, edited
      its `localStorage` entry directly to fake `DeliveryStatus: 'delivered'`, confirmed
      the admin dashboard displayed the real "Pending" status instead once the backend
      fetch resolved (~1s). (`0de0804`)
- [x] **Step 1e** — Migrate payment confirmation to the backend. Added
      `PaymentController` (`POST /api/payments` creates a real `Orders`+`Payment`
      pair; `PATCH /api/payments/{id}/status` is admin-only, verify/reject, same
      terminal-state guard pattern as `OrderController::updateStatus`). Verified
      live end-to-end: submitted a bill payment with uploaded documents, verified
      it as admin, then tampered localStorage directly to fake it back to
      "pending" and confirmed the admin UI still showed "Verified" — backend
      truth wins. (`29966b2` backend, `95d5dac` frontend)
- [x] **Step 1f** — Wire the real `Queue` table (position, status) instead of the
      client-side fake wait-time formula. Position is *computed fresh on every
      request* rather than stored/decremented, so it can't drift out of sync
      under concurrent orders. Verified live: created 3 real orders via the API,
      confirmed positions 1/2/3, confirmed order 1 and watched 2/3 shift to 1/2
      automatically.

      **Found and fixed a real pre-existing bug during this verification**:
      `patchStoredOrder` wrote `backendOrderId`/`backendPaymentId` straight to
      `localStorage` without bumping `updatedAt` and without notifying the
      current tab's React state, silently wiping the backend link steps
      1c/1d/1e's fraud-hole fixes depend on. Fixed by bumping `updatedAt` and
      dispatching the existing `CUSTOMER_ACTIVITY_CHANGED` event.
- [x] **Step 1g** — Wire backend notifications (persisted, not localStorage-only).
      Added `NotificationController` and real `Notification` row creation inside
      `OrderController::updateStatus` / `PaymentController::updateStatus`.

      **Found and fixed a real timezone bug during verification**: Laravel (UTC)
      serializes datetimes with no `Z`/offset; JS parses that as local time,
      silently off by however many hours local is from UTC. Fixed with
      `utils/backendTime.js` (`toUtcIso`). Verified live with two genuinely
      separate logins on two tabs. (`a312c03` backend, `75f16dd` frontend)
- [x] **Step 1h** — Decided: `localStorage` stays, deliberately, as an
      optimistic local cache — not a trust boundary. This closes out the
      1a-1h backend migration. Orders, payments, queue, and notifications are
      all backend-authoritative now; localStorage only ever provides instant
      UI feedback until each 30s poll confirms or overrides it with the
      server's version. **Known, accepted gap**: a customer's cart doesn't
      follow them across devices - minor UX limitation, not a
      security/correctness issue like everything else this migration closed.
- [x] **Mobile cart placement (UX)** — Root cause was one CSS rule:
      `.jollibee-cart-panel { order: -1; }` inside the ≤1050px media query was
      forcing the cart to the top visually even though the menu was already
      first in the JSX. Removed that, and added a real mobile (≤760px)
      treatment matching Grab/Foodpanda/UberEats: cart panel hidden by
      default, opened as a bottom sheet via either the header cart button or
      a new floating "N items · View Cart · ₱total" bar. Verified live on a
      real mobile viewport. (`96d0015`)

## High

- [x] **Admin "can't assign a rider" - assignment actually worked, the UI
      just never showed it** (user-reported live, 9/25; fixed same day).
      Simulated a full real transaction to find it: real customer account,
      real order placed through the actual UI, real admin session
      assigning a rider through the actual dashboard - not just a code
      read. The backend assign endpoint worked correctly both attempts
      (confirmed via direct API calls to isolate backend from frontend).
      The bug was real, just not where "can't assign" suggested.

      Root cause: `needsRiderAssignment()`'s `||` meant an order stayed
      classified as "Pending" - the same bucket as an order nobody has
      touched yet - purely because its status was still `pending_rider`,
      *regardless* of whether a rider had actually just been assigned.
      This became reachable when Sean's 9/25 merge changed `assign()` to
      no longer auto-confirm the order (a real, correct fix for a
      different problem - see Completed Work below on the rider-dashboard
      side) - before that, assigning a rider immediately flipped the
      order to `confirmed` and visibly jumped it to the Ongoing column,
      so the old bucketing logic never got exercised this way. After that
      change, a successfully-assigned order looked *identical* to an
      unassigned one (same "Pending" label, same column) except for a
      small, easy-to-miss "Assigned to X" line - exactly what a reasonable
      admin would read as "my Assign click didn't do anything."

      Fixed by adding the missing state: a new "Awaiting Rider Response"
      column (`isAwaitingRiderResponse`) for orders that have a rider but
      haven't been accepted yet, and narrowing `needsRiderAssignment` to
      only true "nobody's touched this yet" orders (checks
      `hasAssignedRider` directly instead of inferring from status
      strings). Also added the same filter option, and the order card's
      own status text now says "Awaiting rider response" instead of the
      ambiguous "Pending" once assigned.

      Verified live end-to-end, real accounts throughout: order placed via
      the actual customer UI, assigned via the actual admin UI - watched
      it immediately move out of "Pending" (0) into the new "Awaiting
      Rider Response" (1) column. Progressed it through
      confirmed/preparing/out_for_delivery/delivered via the real API as
      the rider and confirmed it correctly landed in "Ongoing" once
      confirmed - the whole lifecycle, not just the one broken step.
      Frontend suite re-run clean (23/27 baseline); backend untouched
      (frontend-only fix), still 57 passed. Test data cleaned up after.

- [x] **Jollibee catalog images were up to 76x oversized - a real, measured
      lag source, not a hunch** (user-reported "the system is lagging,"
      9/25; investigated and fixed same day). User specifically flagged
      concern for low-end devices/slow connections, so this got measured,
      not guessed at: checked every brand's image folder size against what
      the live `Product.ImagePath` data actually references (not just
      what's on disk - a stale, already-optimized `Jollibee/` folder sits
      next to the real one, only 3 stale products still point at it).
      `Jollibee (MVP)/` - the folder 121 real, live products reference -
      was 76MB. Its 18 JPGs were source photos straight off a camera:
      **4096×4096px, 1-2MB each**, served as-is to a ~200px menu card. Every
      other brand's images (McDonald's, Mang Inasal, Kuya Dos, Hongdae
      Chicken) were already reasonably sized (under ~200KB max) - this
      wasn't a system-wide problem, it was one folder.

      Found the team had already half-solved this: `scripts/optimize-
      jollibee-images.js` already existed (sharp, resize to 800px wide,
      JPEG quality 75) but pointed at the wrong folder (`Jollibee/`, the
      already-small one) instead of `Jollibee (MVP)/` - it had never
      actually run against the real images. It also had a real bug: it
      force-converted every image to JPEG bytes but kept the original
      filename/extension, so a `.png` file would end up holding JPEG data
      under a `.png` name. Fixed both: corrected `TARGET_DIR`, and made it
      preserve format per-file (PNGs get palette-quantized instead of
      converted, since plain re-encoding actually made a sample PNG larger
      - confirmed live, 453KB to 574KB - only palette quantization
      actually shrinks it, 453KB to 154KB at the same 800px budget).

      Ran it against the real folder: **76MB to 23MB** (JPGs individually
      1-2MB to ~25-35KB; PNGs ~200-400KB to ~70-140KB). Verified every
      output file with `sharp` - 176 files, correct format matches
      extension on all of them, zero corrupted. Verified live in the
      browser: real Jollibee menu page, confirmed a previously-2.55MB
      image now serves at 35KB via direct `curl` (bypassing any
      browser-side format negotiation), confirmed no visible quality loss
      on either a JPEG or a palette-quantized PNG sample. Both test
      suites re-run clean at their known baselines (image-only change,
      as expected).

- [x] **Customer-rider communication** (teammate request, 9/20; channel
      confirmed 9/25 - in-app, not phone/SMS; built same day, backend then
      frontend, both parts now complete).
      Order-scoped chat, following the earlier product-intake recommendation:
      authenticated, retained, rate-limited, and closed once there's no rider
      to talk to or the order is finalized - not a general inbox, and not
      open to admin.

      New `Message` table (`MessageID`, `OrderID`, `SenderUserID`,
      `MessageBody`, `MessageSeen`, `MessageDate`) and `MessageController`
      (`index`/`store`/`markRead`). Access rule is the same shape as
      `OrderController::updateStatus`'s: only the order's own customer or its
      currently-assigned rider - both directions checked, not just one.
      `store` additionally 422s if no rider is assigned yet or the order is
      already `delivered`/`cancelled` - messaging has a real start and end,
      not an indefinite window. `POST` is rate-limited
      (`throttle:30,1`, same pattern as the payments/upload endpoints).

      **Two real bugs found and fixed before this was actually correct**:
      (1) the migration declared the FK columns `unsignedInteger` to match
      how `Orders.UserID` was originally *declared* - but the live column is
      plain signed `int(11)` (confirmed via `SHOW COLUMNS`, not assumed),
      so MySQL rejected the foreign key (error 150) until the columns were
      changed to signed `integer()` to match reality. SQLite (the test
      suite's DB) never caught this - it doesn't enforce FK signedness the
      same way, so this only surfaced once the migration ran against the
      real dev database. (2) `MessageApiTest`'s "mark read" test initially
      failed in a way that looked like a controller bug - traced it down to
      a testing-only issue instead: Sanctum caches the resolved user on the
      auth guard across requests in the same test method, so switching
      `withToken()` between users silently kept authenticating as whoever
      resolved first. Same gotcha `AuthApiTest.php` already works around
      with `$this->app['auth']->forgetGuards()` - added the same reset here
      (wrapped in a small `as($user)` test helper) rather than leaving it as
      a one-off fix, since every multi-user test in this file needed it.

      Verified live against the real MySQL dev database, not just the test
      suite: seeded a real customer/rider/order via `php artisan tinker`,
      exercised `POST`/`GET` as both participants and confirmed a stranger
      gets 422/403 as appropriate through the actual running server (not
      just SQLite). Backend suite re-run clean: 57 passed (up from 51),
      1 skipped, same 3 pre-existing `AuthApiTest` failures only. Test
      data cleaned up after.

      **Part 2 (frontend, same day)**: one shared `OrderChat` component
      (`src/components/common/OrderChat/`), reused as-is on both the
      customer Track Orders card and the rider order-detail modal - the
      backend already decides who can actually read/send, so the frontend
      doesn't need two different implementations. Shows nothing for a
      local-only order (no `backendOrderId`), a "chat opens once a rider
      accepts" hint before assignment, the live thread with a send box
      once a rider's assigned, and "messaging is closed" (history still
      visible, input hidden) once the order is finalized. Polls every 5s,
      same interval and pattern as `useBackendOrders`/
      `useBackendNotifications`, since the other participant is always on
      a separate device.

      **A real bug found live, not caught by the backend test suite**: a
      just-sent message showed "Invalid Date" for its timestamp. Root
      cause was a variant of the already-documented naive-datetime gotcha -
      `store()`'s response reflected the freshly-created in-memory model,
      whose `MessageDate` was still the raw `now()` Carbon instance
      (serializes with a `Z`), while `index()` returns the same column
      fresh-from-DB as a naive string (no `Z`) - `toUtcIso()` on the
      frontend then double-appended a `Z` to the one that already had it.
      `OrderApiTest`/`PaymentApiTest` never exercise this because nothing
      reads a `store()` response's timestamp back immediately the way this
      chat UI does. Fixed by returning `$message->fresh()` instead of the
      in-memory model, same pattern `OrderController`/`PaymentController`
      already use for their own `store()` responses.

      Verified live end-to-end, real customer and rider accounts, real
      MySQL: sent a message as the customer, confirmed it appeared
      correctly attributed on the rider's dashboard, replied as the rider,
      confirmed the timestamp fix, then marked the order `delivered` and
      confirmed history stayed visible with the input replaced by the
      closed notice. Frontend suite re-run clean (23/27 baseline); backend
      suite re-run clean (57 passed, same 3 pre-existing failures only).
      Test data cleaned up after.

- [x] **Item Delivery/Pay Bills had no service fee, or the wrong surcharge
      cutoff time** (Sean's pricing rule, 9/25; fixed same day) - Sean's
      rule: Item Delivery should use the same fee structure as Food (₱75
      base, 50% surcharge after 8 PM for students / after 6 PM for
      non-students), and Pay Bills should follow the same concept.

      Checked live before changing anything: `calculateDeliveryFee()`
      (`utils/deliveryRates.js`) was already the one shared, generic
      pricing function - it doesn't know or care about Food vs. Item vs.
      Bills. It just wasn't being called for two of the three surfaces.
      `placeOrder`/`placeCartOrder` (`CustomerActivityContext.jsx`) already
      compute the fee themselves from whatever `deliveryLocation`/
      `customerType` they're handed - Food (`McDonaldsMenu.jsx`, the global
      cart) already passed those through correctly. **Real, confirmed bug**:
      `Home.jsx`'s `PayBillsForm` submit handler never passed
      `deliveryLocation`/`customerType` to `placeOrder` at all (not even
      via `details`), so every Pay Bills order's fee silently computed to
      ₱0 - same root cause already diagnosed earlier this session, now
      actually fixed. Item Delivery's custom-order flow (`OthersOrderForm`)
      turned out to already be wired correctly (it already forwarded both
      fields) - no separate fix needed there, just added a live fee display
      to match Food's UX.

      **Also fixed a real, separate discrepancy**: the non-student
      surcharge cutoff was `18:30` (6:30 PM) in code; Sean's rule is
      explicit about 6:00 PM. No reason on record for the extra 30
      minutes - corrected to `18:00`. This is a genuine behavior change
      (shifts which orders get surcharged), not just a wiring fix.

      No separate implementations needed for the three service types - one
      shared function, now actually called from all three surfaces instead
      of two.

      Verified live: seeded a throwaway non-student customer via tinker,
      opened Item Delivery -> Others and Pay Bills -> Others with the
      backend running, confirmed both modals now show "Delivery location:
      Villa Javier" and "Service fee: ₱75" (base rate, no surcharge at
      current time) using the real saved header location. Confirmed the
      corrected cutoff with a standalone script: non-student surcharge now
      applies strictly after 18:00, not 18:30; student cutoff (20:00)
      unchanged. `deliveryRates.test.js` updated to match the corrected
      cutoff. Full frontend suite re-run clean (23/27, same pre-existing
      failures only); backend suite re-run clean (42/43, 1 skip, same 3
      pre-existing `AuthApiTest` failures only - unaffected, this was a
      frontend-only change). Test account and token cleaned up after.

- [x] **Browser back button from a brand's menu landed on Home's FAQ
      section instead of returning to brand selection** (user-reported live,
      9/25; fixed same day). Investigated both hypotheses the report itself
      raised before changing anything. Confirmed cause: the footer's FAQ
      link had a leftover literal `href="/home#faq"` underneath its
      `onClick`-based SPA navigation (every other footer link just used a
      plain `/home` href) - verified live that this href is actually
      reachable and deep-links straight to the FAQ section, so if it's ever
      followed for real (not intercepted in time) it leaves a genuine
      `/home#faq` browser-history entry a later "back" can land on. Fixed
      by dropping the hash, matching the sibling links.

      Also found and fixed a second, related bug while confirming: `Home`
      fully unmounts/remounts on any route change, and its
      hero-vs-browsing view state was plain component state with no
      persistence, so back from a brand's menu reset to the hero
      regardless of what the customer had been browsing - independent of
      the FAQ href issue. Now restored from `sessionStorage` on mount.

      Verified live end-to-end: Home -> Food Delivery tab -> a brand's menu
      -> browser back now returns straight to the Food Delivery grid, not
      the hero or FAQ; confirmed the footer FAQ link still scrolls to FAQ
      correctly with the corrected href. Full frontend suite re-run clean
      (23/27) - same pre-existing failures only. (`2da9352`)

- [x] **Exact-date filter for History and Revenue, plus a Revenue line
      graph** (user request, 9/24; built same day). History and Revenue
      previously only split "today vs previous" client-side and could only
      show an all-time total - real gaps, since History's date filter only
      searched whatever page was already loaded (a real bug on its own, the
      same class already fixed for the 50-order cap), and Revenue had no way
      to see a single day's number at all.

      Backend: `OrderController::indexAll` and `::revenue` both now accept
      `?date=Y-m-d`, bucketed by the same Asia/Manila business-day
      convention already established for Revenue's `daily` breakdown -
      converts the requested day's Manila midnight-to-midnight boundary back
      to UTC before filtering, since `OrderDate` is stored UTC. Revenue's
      `daily` series (what the new bar graph plots) always covers every day
      on record regardless of the filter - narrowing it would defeat the
      point of a trend chart while drilling into one day's number.

      Frontend: History and Revenue now share one `DateFilter` component
      (All dates / Today / an exact-date `<input type="date">`) instead of
      History's old Today/Previous toggle and Revenue having no date control
      at all - per the explicit "more specific and consistent across the
      system" ask. Both send the pick straight to the backend as a real
      query param rather than filtering client-side. Revenue also gets
      `RevenueBarGraph`, a small inline SVG (no charting library) plotting
      the existing `daily` data as bars - genuinely no new backend work, the
      endpoint already returned everything it needed. (Shipped as a line
      graph first, then changed to bars at the user's request, 9/24.)

      Verified live: seeded two real orders straddling a Manila-midnight/
      UTC-boundary edge case (one at `2026-09-22 00:30` Manila, stored as
      `2026-09-21 16:30` UTC) via `php artisan tinker`, confirmed both
      `/api/admin/orders?date=...` and `/api/admin/revenue?date=...`
      correctly bucketed it into the requested Manila day, then confirmed
      the same in a real browser session on both the History table and the
      Revenue stat cards/graph. Test orders and throwaway accounts deleted
      after. Backend tests added for both endpoints' date filters (including
      the boundary case); the frontend History test rewritten for the new
      UI and server-side filtering (was asserting on client-side Today/
      Previous buttons that no longer exist). Full frontend (23/27) and
      backend (37/41, 1 pre-existing skip) suites re-run clean - same
      pre-existing failures only.
      (`6b62d5d`)

      **Still open, not attempted here** - the two Revenue *definition*
      questions this was explicitly scoped to not need (does "Revenue" mean
      fee-only or full order total; does it count non-cancelled or only
      delivered orders) - tracked in Outstanding Work above.

- [x] **Cancelling an order needed a manual page refresh to actually show as
      cancelled** (user-reported live, 9/24; fixed same day) - a real bug,
      reproduced before fixing: placed a real order via the API, cancelled it
      from the customer drawer, and the card kept showing "Waiting for
      rider" until the page was refreshed, even though the backend had
      already recorded `cancelled`.

      Root cause: `applyBackendTruth()` (`useBackendOrders.js`) overlays the
      poller's cached backend snapshot onto local orders unconditionally -
      that snapshot only refreshes every 30s. A customer's own optimistic
      local status change (cancel; also affects rider/admin status and
      assignment updates, and payment verify/reject) rendered correctly for
      an instant, then got clobbered back to the stale pre-change status by
      the next render's overlay, until the interval happened to fire. A
      refresh "worked" only because it restarts the poller with an
      immediate fetch - not a real fix, just a coincidence of how the bug
      manifested.

      Fixed at the source rather than shortening the poll interval (which
      would've just narrowed the window, not closed it): added an
      `ORDERS_CHANGED_EVENT` that every `useBackendOrders` poller on the
      page listens for, dispatched from `syncStatusToBackend`/
      `syncAssignmentToBackend`/`syncPaymentStatusToBackend` once the
      backend confirms the change. The 30s interval and the spoof-protection
      overlay itself are unchanged - this only makes the *acting user's own*
      change catch up immediately instead of waiting out the interval.

      Verified live: real order placed and cancelled through the browser,
      confirmed the UI flipped to "Cancelled" with no refresh, then
      confirmed the backend's own `DeliveryStatus` matched. Test data
      cleaned up after. Full frontend suite re-run clean - same
      pre-existing failures only. (`ca09994`)
- [x] **History's 50-order pagination cap** (found 9/24 while scoping the
      exact-date-filter request; fixed same day) - History, Live Orders, and
      Payments all read from one `useBackendOrders('/api/admin/orders?per_page=50')`
      fetch, capped at the most recent 50 orders and never paginated
      further. Fine for Live Orders/Payments (a bounded, active working
      set) but wrong for History, which only grows - a client-side filter
      over that capped list silently lost anything older than the most
      recent 50, the same bug class as the Revenue tab bug fixed 9/23.

      `OrderController::indexAll` already had real server-side pagination
      implemented, just never exposed in the UI. History now does its own
      fetch straight against it (`status=delivered,cancelled`, real
      page/per_page params) with Next/Previous controls, decoupled from the
      shared capped list Live Orders/Payments still use. Extended the
      status filter to accept a comma-separated list (`delivered,cancelled`
      in one request) - a single status still works unchanged. Reused
      `useBackendOrders.js`'s `toLocalOrderShape` (now exported) instead of
      duplicating the shape conversion.

      **Known interim limitation, tracked as the next step above**: the
      service/date filters still apply client-side to only the current
      page's 20 rows, so a filter can show nothing even though another page
      has matches. The actual bug (records becoming permanently
      unreachable) is fixed; server-side filtering is the follow-up.

      Verified live: seeded 25 extra historical orders (35 total delivered/
      cancelled), confirmed "Page 1 of 2 (35 total)," confirmed Next/
      Previous correctly page through real data with Next disabling on the
      last page. Backend tests added for single- and multi-status
      filtering; frontend History tests rewritten to mock the new fetch.
      Full frontend/backend suites re-run clean - same pre-existing
      failures only. Test data cleaned up after. (`bc0589e`)
- [x] **Show current/general location in the header** (user-reported live,
      9/24 - "select your location takes a couple of seconds to load";
      fixed same day). Investigated before assuming a code bug: attached a
      `PerformanceObserver` for long tasks around the click and found none,
      and the location list is a small static array with no fetch involved
      - the actual delay was the native `<select>` popup itself rendering,
      which app code has no control over. Asked the user how they wanted it
      to work; they asked how foodpanda/GrabFood/Jollibee do it, so that's
      what this matches: a custom in-DOM picker (button + list, not a
      native select), with the saved location shown in the header in place
      of the old decorative tagline.

      `deliveryLocation` moved from three separate per-component
      `useState('')`s (cart drawer, Others order form, the shared
      `RestaurantMenu` checkout used by every catalog-backed brand) into
      `CustomerActivityContext`, persisted per-browser under
      `otuzanDeliveryLocation` - one saved location shared everywhere
      instead of re-picking it at each checkout.

      Verified live: picker opens instantly at desktop and mobile widths
      (icon-only below 440px, matching where the old tagline used to fully
      hide); a location picked in the header showed already-selected in the
      cart drawer, the Others order form, and the McDonald's menu-page
      checkout without re-selecting; selection survived a page reload.
      Full frontend suite re-run clean - same pre-existing failures only.
      Test accounts cleaned up after. (`084024a`)
- [x] **Cross-user notification leak after logout** (client-reviewed intake,
      9/23; fixed same day) - a real privacy/session-isolation bug, not just
      stale UI, reproduced live before fixing it: logged in as a customer,
      placed a real order (writes a local notification to the shared
      `otuzanCustomerActivity` localStorage blob, which isn't scoped per
      account), logged out, then browsed as a guest on the same browser -
      the notification bell showed the previous customer's private order
      update ("Your McDonald's order... is waiting for a rider").

      Root cause: `useCustomerActivity()`'s role-based filter had explicit
      branches for `customer` and `driver`, but none for `admin` or for no
      session at all - both fell through to the same unfiltered
      `return context`. Admin needs that (the whole point of the admin
      dashboard is seeing every order); a guest doesn't, since a guest has
      no orders of their own. Fixed by adding an explicit `admin` branch
      (unchanged, still unfiltered) and a default no-session branch that
      returns empty `orders`/`notifications` instead of the raw shared blob.
      `cart` is left untouched - guest browsing intentionally lets a guest
      build a cart before being asked to log in at checkout, and it isn't
      customer-identifying data.

      Verified live end-to-end: reproduced the leak, confirmed the fix
      closes it, confirmed the same customer logging back in still sees
      their own notification (nothing was deleted, just no longer exposed
      to whoever's currently unauthenticated), and confirmed admin still
      sees every order unfiltered. Added a regression test
      (`OrderWorkflow.test.jsx`). Full frontend/backend suites re-run clean
      - same pre-existing failures only. Test accounts/orders cleaned up
      after. (`00cfe36`)
- [x] **Best-selling products on the customer-facing home page** (user request,
      9/22; built 9/23 right after the Revenue tab fix, which supplied the
      aggregation foundation this needed). `GET /api/catalog/best-sellers`
      (`CatalogController::bestSellers`) ranks products by real units sold in
      the last 30 days - not all-time, so it reflects current demand - and
      excludes cancelled orders, so a cancelled bulk order can't fake a
      product's popularity. New `BestSellersSection` on the home page, above
      the brand grid, matching where foodpanda/GrabFood surface "popular
      now"; renders nothing on a fresh install with no order history rather
      than showing an empty section. Clicking a product navigates to its
      brand's menu page. Backend test covers ranking plus the cancelled/stale
      exclusions. Verified live against real order history - correctly
      ranked, and correctly fell back to a placeholder for the one result
      with no product photo (the already-tracked photos gap, not a bug here).
      (`b1192c3`)
- [x] **Admin "Revenue" tab was silently capped at the 50 most recent orders,
      ever, and undercounted even within that page** (user testing, 9/22,
      reported as "revenue resets every day"; fixed 9/23). Two real bugs, not
      one: (1) `RevenueTab` summed whatever `orders` the dashboard already had
      loaded for display (`useBackendOrders('/api/admin/orders?per_page=50')`
      - page 1 only), so once total order volume passed 50, older orders and
      their revenue silently fell out of the total; (2) the delivery/service
      fee was computed entirely client-side and never sent to the backend at
      all - `Orders.TotalPrice` was just the product subtotal, so even an
      uncapped sum would still have been wrong.

      Fixed both at the source: added `Orders.ServiceFee` (migration
      `2026_09_23_000001`), `OrderController::store`/`PaymentController::store`
      now accept and persist it (validated 0–500) and fold it into
      `TotalPrice`. Added `GET /api/admin/revenue`
      (`OrderController::revenue`) - aggregates the fee across *every*
      non-cancelled order in the table, not a paginated slice, grouped by
      service and by calendar day. **Timezone default: Asia/Manila (UTC+8),
      since `OrderDate` is stored UTC and a raw UTC-midnight boundary would
      flip revenue between days mid-afternoon local time - this was a
      reasonable default, not confirmed with the team yet; flag if that's
      wrong.** `RevenueTab` now fetches that endpoint instead of deriving a
      total from the orders it already had. Also closes the known gap where
      a synthesized cross-device order's `serviceFee` showed as 0
      (`toLocalOrderShape` now reads the real persisted value). This was also
      the hard dependency for Data Analytics Layer 1 below - the aggregation
      endpoint now backing this tab is the same foundation that layer needs.

      Verified live: placed a real order with a service fee through the
      actual API, confirmed `TotalPrice`/`ServiceFee` persisted correctly,
      confirmed `/api/admin/revenue` reflected it and correctly dropped it
      after cancelling, and confirmed the Revenue tab renders the real
      backend total in a live browser session. Backend tests added covering
      fee persistence, its validation bounds, and the revenue endpoint
      aggregating past the old 50-order cap (55 seeded orders, one cancelled).
      Full frontend/backend suites re-run clean - same pre-existing failures
      only (Login.test.jsx, ManuelasMenu.test.jsx, AuthApiTest.php - all
      already tracked below, none new). Test accounts/orders cleaned up
      after. (`433f6ff`)
- [x] Real queue system — delivered in step 1f above.
- [x] Server-driven live status updates / polling — delivered in steps
      1c/1d above, extended to cover every dashboard's actual visibility in
      the cross-device order-visibility fix above.
- [x] Backend-persisted notifications — delivered in step 1g above.
- [x] **Let customers cancel their own order before it's confirmed** (user
      request, 9/21) — previously a customer had zero way to cancel, even
      seconds after placing an order, even though admin hadn't touched it
      yet. Added a `window.confirm`-guarded "Cancel Order" button, and a
      narrowly-scoped backend allowance (`OrderController::updateStatus`):
      the order's own customer can set it to `cancelled`, and only that
      status, and only while still `pending_rider`. Verified live end-to-end.
      (`efc639f` backend, `5b7dd9e` frontend)
- [x] **Redundant per-item CTAs (UX)** — every product card had both "Add to Cart"
      and "Place Order." Confirmed this was a real, not just theoretical, problem —
      walked through it live on 9/21. External validation: published UX guidance
      recommends exactly one solid-color primary action per product card
      ([Toptal: Keep It Tasteful, A Guide to Food App
      Design](https://www.toptal.com/designers/ux/food-app-design)). Fixed: removed
      the per-item "Place Order" button; "Add to Cart" is now the one full-width,
      solid-styled action per card. (`1ecc172`)

## Medium

- [x] **Footer visual treatment** (9/26) — replaced the solid, full-bleed
      saturated-pink block with a light, bordered footer card using the shared
      surface, text, border, and brand-color tokens. Mobile content is centered;
      desktop layout remains unchanged. UI-only CSS change.

- [x] **Auth and core-form palette consolidation** (9/26) — replaced the
      gold/orange authentication treatment with the established Otu-Zan
      primary/dark pink gradient, including focus states, logo decoration,
      links, and the submit action. Consolidated the footer plus Pay Bills and
      Other Orders form accents onto the shared primary, dark, and light tokens;
      removed unused header-only color aliases. This was a UI-only pass: no
      authentication, order, navigation, or validation behavior changed.
      Production build completed successfully.

- [x] **Backend test coverage for payment flows** (9/25 - `PaymentController`
      had zero test coverage, unlike `OrderController`'s already-thorough
      25-test `OrderApiTest.php`). Added `PaymentApiTest.php` (9 tests):
      bill-payment creation persists the correct order/payment pair and
      total, `serviceFee`/`amount` bounds validation (0-500 / 0-999999.99),
      only customers can submit a payment, only admin
      (`permission:orders.manage`, same route-level gate as `assign` - not
      a gap, matches the documented pattern) can verify/reject one, a
      verify/reject notifies the owning customer, and a finalized payment
      can't be changed again. Checked `PaymentController::updateStatus`'s
      missing controller-level role check first before assuming it was a
      bug - confirmed it's route-gated the same deliberate way `assign` is.
      Full backend suite re-run clean: 51 passed (up from 42), 1 skipped,
      same 3 pre-existing `AuthApiTest` failures only. Order-flow coverage
      itself needed no work - already thorough.

- [x] **"Inconsistent empty/loading states (UX)"** (confirmed worse than
      cosmetic during the 9/22 QA pass; fixed 9/25). Admin's Payments tab
      had a proper icon+heading+subtext empty state; the Brands/Services/
      Products table (`CatalogTab`) and the Riders/Customers table
      (`AccountManagementTab`) just showed flat "No X found." text with no
      loading state at all, so an empty-table render and "still fetching"
      looked identical - confirmed live during the QA pass that the Brands
      tab genuinely flashed "No brands found." on a real page load with 16
      real brands in the database.

      Added a `loading` state to both components (consistent with
      `CatalogTab`'s existing module-switch request-staleness guards).
      Shows the same plain "Loading X..." text already used elsewhere in
      this file while fetching; once resolved and genuinely empty, upgraded
      to the same `admin-page-empty` icon+heading+subtext treatment
      Payments already used, with a search/filter-aware subtext so "no
      results for this search" doesn't read the same as "nothing exists
      yet."

      Verified live: Brands tab (16 real brands) now loads straight to the
      real table, no empty-state flash; searching for a non-matching term
      on both Brands and Riders correctly shows the new empty state with
      the right subtext. Full frontend suite re-run clean (23/27) - same
      pre-existing failures only. (`39d2f15`)

- [x] **Header and service-nav were solid saturated pink, fusing directly
      into the hero below into one oversized color blob** (design critique
      9/23 originally flagged this as part of the broader "header/service-
      nav/footer are three stacked full-bleed color blocks" item; user
      reported it live again 9/25 specifically about the header/hero
      fusion, sharper than the original critique). Live-referenced three
      real sites before touching anything: foodpanda.ph (thin pink promo
      strip, then a plain white nav bar), GrabFood (no colored header at
      all - transparent over a photo), and the user-provided Pizzaro
      reference site (cream nav, not the accent color) - all three keep
      brand color confined to individual accents (a button, the active
      tab, icons), never as the header's own background fill.

      Changed the header and service-nav pill row from solid pink
      (`#fb1762` / `#ff3a7c`) to white/near-white, flipping every element
      that assumed light-text-on-pink to dark-text-on-white: brand name,
      location picker, guest Login/Register buttons, service tabs
      (inactive now muted gray, active tab inverted to a solid pink pill),
      and the mobile nav toggle/dropdown. `HomeHero`'s own gradient is
      unchanged - keeping the header white is what creates the seam, since
      the gradient now reads as a distinct section instead of a
      continuation of the same fill.

      Verified live at desktop and mobile (375px): header/nav read as
      clearly separate from the hero below, active-tab/hover states still
      legible, mobile dropdown card readable. Full frontend suite re-run
      clean (23/27) - same pre-existing failures only; no visual change to
      admin/rider headers (separate components). The footer half of the
      original "three stacked blocks" critique is now a much smaller,
      lower-urgency residual - see Outstanding Work above. (`91f0e67`)

- [x] **Rider name visible in customer notifications** (teammate request,
      9/20; built 9/25). Confirmed the gap first: no customer-facing
      component read `assignedRider` at all, so a customer never saw who
      was actually delivering their order, even though the data has
      existed since the backend order migration.

      Rather than build a separate "your rider" UI, the name now rides
      along in the same notification a customer already checks:
      `notifyStatusChange()` (`OrderController`) appends "<first name> is
      your rider." once a rider is actually assigned (`assign()` only ever
      calls this with `'confirmed'`, so that's the first point a rider
      exists to name) - the message stays honest with no name for
      cancellations or any state before assignment.

      Verified live: assigned a real rider to a real seeded order through
      the actual API, confirmed the generated `Notification` row's
      message, then confirmed it renders correctly in the customer's real
      notification panel in the browser ("Order #84 was accepted. Tracking
      is now available. Koyomi is your rider."). No frontend change needed
      - `toLocalNotificationShape` already just displays whatever message
      the backend sends. Backend tests added for both the assigned and
      not-yet-assigned cases. Full backend (39/43, 1 pre-existing skip) and
      frontend (23/27) suites re-run clean - same pre-existing failures
      only. Test order/notification/tokens cleaned up after. (`b7478d3`)

- [x] **Homepage hero / mood-setting moment above the brand grid** (design
      critique, 9/23; requested again as a customer-landing-page feature by
      Sean, 9/24; built same day). Otu-Zan went straight from a flat header
      into the brand grid with no hero, the single most visible gap against
      foodpanda/GrabFood/Uber Eats/Deliveroo named in the 9/23 design
      critique - already built once (gradient card, time-of-day greeting,
      real catalog stats) and reverted at the user's own request mid-session
      to slow down and reconsider, rather than a rejection of the approach.

      Investigated Sean's framing first, since he described it as "customers
      landing directly on Brands" - there's actually no separate Brands
      route; `/` already redirects to `/home`, and `Home.jsx` already *is*
      the landing page. The real gap was purely that it opened straight into
      the brand grid with nothing above it.

      Restored the reverted `HomeHero` component (not rebuilt from scratch)
      into `Home.jsx`, above the existing brand grid: gradient card,
      time-of-day greeting, and three highlight chips built from real
      catalog data (live brand count), no fabricated stats. Added one new
      piece on top of the original: a "Browse brands" anchor CTA that
      scrolls to the brand grid, referenced against
      `pizzarosix.infinityfree.me`'s hero pattern but honestly labeled
      (nothing to buy from the hero itself).

      Also compared `BestSellersSection` against that same reference's
      circular-photo-carousel-with-star-ratings-and-discount-badges
      treatment, and deliberately did **not** copy it: this system has no
      rating or promotion data, and fabricating either would have broken the
      "use real data or flag the gap" instruction the work was scoped
      under. Kept the existing square-image grid (already aligned with the
      brand grid's container styling) and added one honest equivalent
      instead - an "X sold" badge sourced from the best-sellers endpoint's
      real `unitsSold` field, which already existed in the API response but
      was unused in the frontend.

      Verified live at desktop and mobile (375×812): hero renders with the
      real brand count, the CTA correctly scrolls past the sticky header
      (`scroll-margin-top` on the brand-grid section), and Best Sellers
      shows the real sold-count badge from actual order history. Full
      frontend suite re-run clean (23/27) - same pre-existing failures only
      (`Login.test.jsx`, `ManuelasMenu.test.jsx`). (`ed10861`)

- [x] **Today/Previous date filter on the admin order History tab**
      (client-reviewed intake, 9/23; fixed same day) - history was one flat,
      unbounded table with no way to separate today's activity from the full
      record. Added an All dates/Today/Previous filter alongside the
      existing service filter, using the same Asia/Manila business-timezone
      convention already established for the Revenue endpoint (calendar-day
      comparison, not the admin's own machine's local time). Defaults to
      "All dates," not "Today" - defaulting to today would have silently
      hidden every past order until something happens today, a real
      behavior change, not just an addition; caught this from the existing
      test suite (`OrderCustomerDetails.test.jsx` already asserted a
      fixed-past-date order was visible by default) and fixed the default
      rather than adapting the test around a worse one. Purely a
      client-side filter over data the tab already has - no new endpoint,
      no separate history store, per the review's explicit scope. Verified
      live against real historical + same-day orders; all three modes
      correct. Regression test added. (`8776a55`)
- [x] **Show product images in Order Details** (client-reviewed intake,
      9/23; fixed 9/24) - the customer's Track Orders tab and the rider's
      order-detail modal only ever listed item name/quantity, no visual
      confirmation of what was ordered. `toLocalOrderShape`
      (`useBackendOrders.js`) now resolves each item's image through the
      existing `catalogImageUrl` helper (same one already used for catalog
      product cards); both surfaces render a small thumbnail per item with a
      neutral utensils-icon fallback when a product has no image. Receipt/
      transfer-proof images (a separate concept) were left untouched.
      Verified live: placed a real order (`OrderID 77`, McDonald's Big Mac
      Meal, a product with a real `ImagePath`) via a direct API call,
      confirmed the correct thumbnail rendered with the right image/name/
      quantity in both the customer drawer and the rider modal, then deleted
      the test order and test customer. (`b95a7fc`)
- [x] **Best-sellers section (own feature, shipped same day) had a padding
      mismatch, dead-end clicks, and wrong section order; separately, no way
      back to Home from the FAQ page at all** (both user-reported live,
      9/23; fixed same day). Three real bugs in the first: `BestSellersSection`
      used a flat 24px side padding while the brand grid below it uses a
      centered `max-width:1400px` container with responsive padding up to
      56px, so the headings visibly drifted apart; clicking a card landed at
      the top of the brand's whole menu page instead of at the actual
      product (worse once that page paginates); and re-checking foodpanda/
      GrabFood live showed both put category navigation *before* curated
      picks, not after, so the section was reordered to sit below the brand
      grid instead of above it.

      Separately, FAQ's "no back button" traced to the Footer's Home/service
      links being `href="#home"` same-page anchors that only ever worked
      because Footer always used to render on the Home page itself (with a
      matching `id="home"` and a live `onServiceChange` handler) - once
      Footer rendered on FAQ too, both silently no-op'd. Fixed at the root:
      Footer now uses real router navigation (service links hand off the
      target service type through router state, which Home reads once to
      select the right tab), and the header logo/brand name is now a real
      link back to `/home` on every page - the standard "click the logo"
      affordance that was missing entirely. Also fixed a real React bug
      found while wiring this: a ref was being mutated from inside a
      `setState` updater, which worked in production but silently discarded
      the requested service tab in dev, because React 18 StrictMode
      intentionally double-invokes updaters to catch exactly that.

      All verified live before pushing: alignment now matches the brand grid,
      clicking a best-seller scrolls to and briefly highlights the exact
      product (auto-expanding its category past the pagination cutoff if
      needed), section order matches the reference apps, the header logo and
      every footer link correctly navigate from FAQ, and the Pay Bills
      footer link both navigates home and selects the right tab. Frontend
      suite re-run clean after each change - same pre-existing failures
      only. (`0ba0fd8`, `11a31bf`, `64183b2`)
- [x] **Catalog-backed menu pages rendered every product into the DOM at
      once, no pagination** (found during the pre-defense audit, 9/23, via
      direct measurement - Jollibee's 121-product catalog queued 121 image
      tags on mount, only 20 had actually finished loading after 6.5s; fixed
      9/23). `RestaurantMenu` (shared by every catalog-backed brand) now
      caps each category to 12 products initially, with a "Show N more"
      button per category instead of a single global cutoff, so every
      category still shows something rather than starving whichever ones
      happen to be lower on the page. Verified live against the real
      McDonald's catalog (184 products, 13 categories): initial mount
      dropped from 184 to 110 cards, "Show more" correctly reveals the next
      batch, add-to-cart and the sticky category-nav chips still work on
      paginated items. (`24f1a25`)
- [x] **Let customers browse without logging in** (user request, 9/21, noticed while
      browsing foodpanda themselves) — the backend catalog API was already public;
      the only blocker was the frontend's `ProtectedRoute` wrapper unconditionally
      redirecting guests to `/login`. Replaced it with a new `CustomerBrowseRoute`.

      Login is gated at the actual order-placement step instead, not the page.
      Found and fixed **four** real checkout entry points, not the one expected.
      Added a backstop guard directly in `CustomerActivityContext`'s
      `guardOrderPlacement` too: without a session, it now returns `null` before
      creating anything.

      **Found and fixed a real pre-existing bug while adding this**: `checkoutCart`
      showed "Order placed with N items" and closed the cart unconditionally, even
      when `placeCartOrder` returned `null` — a false success message. Now checks
      the return value first.

      Verified live end-to-end as a real guest: browsed freely, added an item to
      cart, confirmed clicking "Place Order" redirected to `/login` with **zero**
      backend order created instead of a false success message. (`d6a5685`)

      **Follow-up found by the user immediately after (9/22)**: nothing on the
      actual entry point (the login screen at `/`) ever told a guest that browsing
      without an account was possible. Added a "Browse the menu without an account"
      link to `AuthCard`. (`daf77c2`)

      **Second follow-up (9/22)**: still felt fully gated - the user pointed at
      foodpanda specifically: opening their site shows the whole catalog
      immediately, with an explicit "Login/Sign Up" button in the header. Made `/`
      itself redirect straight to `/home`, and made `CustomerMenu` guest-aware: a
      guest now sees an explicit white "Log In / Sign Up" pill button in the
      header instead of a hidden icon. (`6dd1b93`)
- [x] **Sticky category navigation within a menu page** (user request, 9/21,
      noticed on foodpanda) — implemented in the shared `RestaurantMenu` component,
      so every catalog-backed brand gets it automatically. Chips stick below the
      page header, clicking one smooth-scrolls that category into view, and the
      active chip updates via `IntersectionObserver` as the customer scrolls
      manually too. Verified live at both desktop and mobile viewports. (`3dd5a61`)
- [x] Make the customer contact number visible on both the Admin and Rider
      dashboards (teammate request, 9/20) — already done before the request came
      in. (`9cc3ac0`)
- [x] **Design system overhaul — typography, color tokens, brand tiles** (user
      request, 9/22, comparing against a classmate's project + live reference
      against GrabFood, Uber Eats, and foodpanda.ph) — landed in stages:

      **Stage 1**: swapped the body font from `Tahoma` (a dated Windows-era
      font `App.css` was silently forcing over `index.css`'s own modern
      system-font stack) to Poppins via Google Fonts. Added `:root` design
      tokens in `index.css` for the color palette/radius/card-shadow. Redesigned
      `BrandCard` from a boxed white card to a bare circular tile + label
      matching Grab/foodpanda's cuisine-tile pattern - closes the "more compact
      brand list layout" item below too (7 brands now fit one row on desktop
      instead of a wrapping 4-wide card grid). (`9ae9095`)

      **Stage 2 (guest-browsing entry point)**: the initial route-guard fix left
      the actual entry point (`/`) still showing Login first with no visible way
      off it - see the follow-up notes above for the full history. Landed a
      proper Grab/foodpanda-style entry point.

      Not done in this pass, later re-flagged in the design critique: a
      floating-card-over-photo hero, and applying the new tokens to the
      remaining ~16 CSS files that still use raw hex literals directly (both
      now tracked in Outstanding Work above).
- [x] **Mobile brand grid should be a fixed 2 columns** (user testing, 9/22) —
      changed to `repeat(2, minmax(0,1fr))` at ≤767px. Verified live at 375px.
      (`f857600`)
- [x] **FAQ / static answers for the most commonly asked questions about the
      system** (user request, 9/22) — new `/faq` page (guest-accessible),
      linked from the footer. 8 real questions grounded in actual system
      behavior, not generic filler. (`f857600`)
- [x] **Category selection when adding a product (admin)** (user request, 9/22;
      traced 9/22 during a full QA pass) — turned out to be dead code sitting
      right next to where it was needed: the backend already had
      `GET /api/admin/catalog/categories?brand_id=X`, and `CatalogTab` already
      fetched it into a `categoryOptions` list, but nothing ever rendered it.
      Replaced the plain "Description" textarea with an
      `<input list="admin-category-options">` + `<datalist>` for products
      specifically, labeled "Category," pre-filled with the product's real
      existing value. Verified live editing a real McDonald's product: correctly
      pre-filled ("Rice Bowls") with all 16 of that brand's actual categories
      offered as suggestions. (`ab2df5e`)
- [x] **"Remember me" on login** (user request, 9/22) — remember the email only,
      never the password (caching a raw password client-side for autofill
      convenience is a credential-exposure risk, not a UX nice-to-have - out of
      scope regardless of how it's asked for). Implemented via `localStorage`,
      pre-fills and pre-checks on return to the login screen; unchecking on a
      subsequent login clears it. Verified live end-to-end both ways. (`27f54d9`)
- [x] **Reject disposable/mass-produced emails at signup** (user request, 9/22)
      — went with the cheap, no-infra option: a maintained denylist of known
      disposable-email domains, checked at registration. Real email verification
      (send-a-link) stays a stretch goal - `Mail::`/`PasswordResetMail` already
      exist and `MAIL_MAILER` is configured for Gmail SMTP, but `MAIL_PASSWORD`
      is blank, so it doesn't actually work yet regardless, and getting a real
      Gmail app password isn't this session's call to make. Backend test added
      covering the reject case, case-insensitivity, and the "notmailinator.com"
      substring false-positive guard. Verified live against the real running
      backend. (`363b141`)
- [x] **Sync Jollibee onto the database-driven catalog** (teammate request, 9/20,
      "add the Jollibee menu") — confirmed `/food/jollibee` was already
      unreachable from normal navigation, but still live and stale if anyone hit
      the URL directly. Swapped it to `CatalogNameRedirect`, same pattern the
      other database-driven brands use; deleted the now-fully-dead
      `JollibeeMenu.jsx` + `jollibeeMenuData.js`. Verified live. (`9499a07`)

      **Follow-up (9/22, Sean)**: pushed a real rewrite of the Jollibee catalog
      directly to the shared branch - the seeder now dynamically reads real
      product photos and prices from a `public/images/Jollibee (MVP)/` folder
      instead of a hardcoded 30-item list, and correctly preserves order history
      (deactivates rather than deletes products referenced by past orders).
      Merged cleanly (no file-level conflicts with the routing fix above - the
      two changes are complementary, not competing), re-ran the seeder locally:
      30 old products became 121 real ones with real photos. Verified live
      across multiple categories, including filenames with special characters -
      all rendered correctly. Pushed the merged branch back. (`340de4d`)
- [x] Rate limiting on `/uploads/bill-documents` (no throttle currently, upload spam =
      storage-exhaustion DoS risk). Added the same 20/min throttle already used
      on orders/payments. (`ba3cd93`)
- [x] Server-side image compression on admin catalog uploads (mirrors the client-side
      fix already applied to bill-payment uploads) — implemented in
      `CatalogController` (cap longest edge at 1280px), keeping the original
      format instead of forcing JPEG, leaving GIFs untouched. Best-effort: no-ops
      safely if GD isn't loaded or compression fails, rather than blocking the
      save. Verified the real GD calls in isolation, then added a test exercising
      the full HTTP upload path with a genuine 2000x1500 image. (`b3e867b`)
- [x] **Login page mobile hero (UX)** — decorative "Welcome Back!" card pushed the
      actual email/password fields below the fold on phone screens. Reordered via
      flex `order` (form first on ≤900px) rather than touching markup/tab order.
      Verified live at 375px. (`f857600`)
- [x] Add `laravel/public/uploads/` to `.gitignore` — scoped to just
      `bill-documents/*` (customer-submitted receipts), not the whole uploads
      tree, since `brands/`/`products/` hold admin-curated catalog assets this
      project still versions in git. Untracked the 4 already-committed stray test
      uploads too, with a `.gitkeep` so the directory itself still exists after a
      fresh clone. (`f857600`)

## Low

- [x] **Auto-scrolling/looping Best Sellers carousel** (user request, 9/25) —
      implemented as a true sliding strip rather than the original abrupt
      page-swap. It advances one product at a time every 2.5 seconds, loops
      with off-screen buffer cards and an imperceptible reset, supports previous/
      next controls and direct pagination, and pauses while hovered or focused.
      The implementation is dependency-free and respects reduced-motion
      preferences. (`943d411`, `ddf8839`, `222528e`)

- [x] **Revenue trend arrow** (user request, 9/24) — up/down indicator on the
      "Total recorded revenue" card, comparing today vs yesterday from the
      revenue endpoint's existing daily breakdown (Asia/Manila calendar
      day). No backend change needed. Verified live in all three states
      (up/down/flat). (`5312f22`)
- [x] **More compact brand list layout** (Grab/foodpanda reference, 9/21) —
      closed as part of the design system pass above: `BrandCard` is now a bare
      circular tile instead of a large boxed square card. Went with a denser
      wrapping grid rather than a horizontal-scroll row - the carousel-
      discoverability research note argues against introducing horizontal
      scroll/carousel patterns without a clear need. (`9ae9095`)
- [x] **"Back to top" control on long menu pages** (web research, 9/21) — GrabFood's
      menu pages use continuous scrolling with no way back to the top, flagged as
      a usability gap in a UX pattern analysis
      ([source](https://rubienguyen.medium.com/grabfood-patterns-and-flows-63f7153f039f)).
      Added a floating button to the shared `RestaurantMenu` component - appears
      after scrolling 600px, scrolls smoothly back to top. Verified live. (`f857600`)
- [x] **Flaky time-of-day-dependent test** — `OrderWorkflow.test.jsx` calls
      `placeOrder` without freezing time, and `calculateDeliveryFee` defaults to
      real wall-clock time, so the test failed whenever the suite happened to run
      late at night. Fixed with explicit fixed timestamps - **and found a second,
      previously-masked bug while fixing it**: the rapid-repeat-click guard
      (`isPlacingOrderRef`, added by the adversarial QA pass) was silently
      blocking the test's second order placement too, since it fires immediately
      after the first with no elapsed time. Fixed both - full suite now passes
      (frontend suite went from 20/25 to 21/25). (`54b7bbc`)
- [x] **Add `.gitignore` entry for test artifacts** — same fix as the
      `.gitignore` item above, resolved together. (`f857600`)
- [x] **Customer activity drawer getting cluttered** (user report, 9/25) — Track
      Orders showed every order ever placed (active, delivered, cancelled)
      forever with no way to clear it, and notifications had no dismiss/clear
      at all (`NotificationController` only had `index`/`markAllRead`). Track
      Orders now filters to active orders only (matches Grab/foodpanda
      convention); notifications get a "Clear all" button. Both are view-only
      filters scoped per-account via a localStorage timestamp - underlying
      Orders/Notifications records are untouched, so Revenue and admin History
      (which read the real tables) are unaffected. Verified live: two test
      orders (one delivered, one active) plus two test notifications - the
      delivered order and cleared notifications both dropped from view, the
      active order stayed. (`f77c37e`)
- [x] **Same clutter check on rider/admin dashboards** (user follow-up, 9/25) —
      rider's order grid had the identical problem (every order ever assigned
      to that rider, no filter); fixed the same way (active-only), while
      keeping the order-detail modal's lookup unfiltered so a just-delivered
      order's "Close" button still works instead of the modal vanishing the
      instant status flips. Admin's Live Orders needed no change - its
      columns already never match `delivered` orders, and History is already
      a separate, uncapped view (see Decisions section in CLAUDE.md).
      Verified live: two assigned orders, one marked delivered up front
      (dropped immediately) and one delivered mid-review (grid emptied,
      modal + Close button stayed open). (`985bc70`)

## Medium Priority

### Design

- [x] **Color palette has no enforced system - 7+ ad hoc pink/magenta hex
      values in header/footer/tokens alone** (design critique, 9/23, verified
      by grepping the actual CSS rather than going on memory: `#e31b62`,
      `#da1c5c`, `#c81752`, `#a71243`, `#f23d7b`, `#86133b`, `#b25d7a`). The
      hue itself is fine and well-precedented (foodpanda's real production
      color is nearly identical magenta) - the problem is that nobody
      decided "these are our five pinks, here's when each one is used," so
      every file just picked one that looked fine in isolation. Separately,
      the **login page's submit button uses a completely different color
      family** (gold/orange gradient, `#F9C12F` -> `#FF9846`) while every
      other primary action in the app is pink - not a deliberate two-tone
      system, just drift between pages built at different times.

      **Status (9/26 - partially implemented)**: authentication and core form
      accents now use the primary/dark/light scale, but the full app-wide
      migration remains open. Collapse every remaining hardcoded hex above to the
      three shared tokens in `:root` - primary / dark (hover,
      pressed) / light (tint, backgrounds) - and mechanically replace each
      file's ad hoc value with the matching token. Low-risk, high-payoff:
      it's a find-and-replace against a decided scale, not a redesign, and
      it's also the exact prerequisite the Dark Mode item below already
      needs (same token refactor, do it once, unlock both).

      On the gold/orange: recommend **retiring it**, not keeping it as a
      secondary accent - nothing in the app currently uses it with intent
      (no promos/deals surface exists to reserve it for), so it's pure
      drift, not an underused feature. Login's submit button becomes pink
      like every other primary action. If a real promo/deals surface gets
      built later, a deliberate secondary accent can be reconsidered then,
      scoped to that feature specifically - not resurrected from what's
      already there by default.
- [skipped ] **Products without photos hurt conversion** (web research, 9/21; 
      re-confirmed and sharpened during the design critique, 9/23) — this is a
      recognized, documented UX problem, not just an aesthetic nitpick: a 2018
      GrabFood UX case study quotes a user directly — *"Food photos are important
      for me. It's hard imagining what they look like when the app doesn't provide
      their photos"* — and lists missing menu photos as one of the top pain points
      driving users away
      ([source](https://uxdesign.cc/ux-ui-case-study-grabfood-ab2faa0512ec)).
      **This got more urgent on 9/22, not less**: Sean's Jollibee catalog update
      (121 real product photos) now looks close to foodpanda-quality, which
      means McDonald's (184 products) and Manuela's (185) - still zero individual
      photos, brand logo placeholder on every single one - now sit right next to
      genuinely good work in the same app. Before, the whole catalog was
      uniformly plain, which read as "unfinished but consistent." Now it reads
      as "one brand got finished and the rest didn't," which invites exactly
      the question "why does only one of these look real?" in a live demo.
      Still a content/photography task, not a code fix - but the bar it needs
      to clear just moved, and it's the highest-visual-impact gap left in the
      whole system.
- [x] **"Similar brands" section before the footer** (user request, 9/21, noticed on
      foodpanda) — a discovery/cross-sell section at the bottom of a brand's menu
      page suggesting other brands in the same category (e.g. viewing Jollibee
      suggests McDonald's, Mang Inasal — other Food Delivery brands). Standard
      pattern across delivery and e-commerce apps generally. Lower priority than the
      items above — more of a "keep browsing" nudge than something blocking an
      order, and needs a "same service/category" grouping rule decided first.
