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

# Outstanding Work

## High Priority

- [ ] **Customer–rider communication** (teammate request, 9/20) — no chat/messaging
      exists between customer and rider today. Real feature, not a quick fix; needs
      its own design pass (in-app chat vs. just exposing contact numbers, etc.)
      before implementation.

### Reviewed Product Intake (9/23)

| Request | Verdict | Priority | Relationship | Product review / scope |
| --- | --- | --- | --- | --- |
| Fix cross-device receipt images | Recommended | High - completed | Duplicate / completed | Fixed: persist backend-relative upload paths and resolve legacy localhost URLs against the configured API host. Verify with the deployed/LAN API URL before release. |
| Customer-rider in-app communication | Recommended with Changes | High | Duplicate | Build order-scoped, authenticated messaging only after a rider is assigned; retain messages, rate-limit them, and close messaging after delivery/cancellation. Do not expose personal phone numbers. |
| Separate today's history from older orders | Recommended with Changes | Medium | New | Add Today and Previous tabs/filters to the existing history, using the business timezone and keeping search/filter access. Do not duplicate order records or create a separate history store. |
| Show product images in Order Details | Recommended with Changes | Medium | New | Show small lazy-loaded product thumbnails where an image exists, with a clean fallback. Keep receipt/proof images separate from order-item media and avoid loading full-size images in long lists. |
| Improve scrolling smoothness system-wide | Recommended with Changes | Medium | Related | Treat this as a measured performance pass: profile long lists, preserve pagination/lazy image loading, and address actual jank. Do not add decorative smooth-scroll behavior that can reduce accessibility or mask rendering problems. |
| Make the brand logo square | Recommended with Changes | Low | Related | Use a square logo container with `object-fit: contain`; do not crop or distort brand artwork. This complements the existing compact brand-tile work. |
| Research competitor color schemes and refine the palette | Recommended with Changes | Medium | Duplicate | Continue the existing token/palette-consolidation item. Use competitor research for conventions, not imitation; define accessible primary, hover, surface, text, and semantic status colors around the Otu-Zan logo. |
| Stop notifications after logout | Recommended | High | New | Treat as a privacy/session-isolation bug: clear in-memory notification state, cancel polling, and prevent stale local notifications from appearing for a subsequent or logged-out user. |
| Put the mobile sign-in card at the top | Not Recommended as a standalone task | Not Recommended | Related | Fold this into the modal-authentication work below. A separate top-of-page login layout conflicts with the current guest-browsing entry point and would create two competing auth experiences. |
| Show current/general location in the header, while allowing a delivery location selection | Recommended with Changes | Medium | Duplicate | Surface the saved delivery zone in the header with a clear change action. Ask for device location only with consent and provide a manual fallback; the selected billable delivery zone remains the source of truth for fees. |
| Open Login/Sign Up as a modal over a blurred homepage | Recommended with Changes | Medium | Related | Keep guest browsing, then open an accessible modal from the header. Use focus trapping, Escape/backdrop close, and a mobile full-screen sheet rather than a blurred, cramped card; preserve the current direct auth route as a fallback. |

## Medium Priority

### Design

- [ ] **Homepage has no hero / mood-setting moment** (design critique, 9/23,
      compared live against foodpanda.ph, GrabFood, Uber Eats, Deliveroo -
      every one of them opens with a photo, gradient card, or bold headline
      before the browsing grid; Otu-Zan goes flat header -> grid -> a large
      dead whitespace gap -> footer). Already built once this session
      (gradient card, time-of-day greeting, real catalog stats, no
      photography needed) and reverted at the user's request mid-session to
      slow down and reconsider rather than accept it live - the code isn't
      lost, just not landed. Named the single most visible gap against the
      reference apps in the follow-up design critique; revisit when ready
      rather than re-building from scratch.
- [ ] **Color palette has no enforced system - 7+ ad hoc pink/magenta hex
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
      system, just drift between pages built at different times. Scope:
      collapse to a deliberate small scale (primary / dark-hover / light-tint)
      enforced through the existing `:root` tokens repo-wide, and decide on
      purpose whether gold/orange is a real secondary accent (used
      consistently for one role, e.g. promos) or should go away.
- [ ] **Header, service-nav, and footer are three stacked full-bleed blocks
      of solid saturated color with almost no white space between them**
      (design critique, 9/23) - real reference apps (Grab, Uber Eats) use
      white/neutral backgrounds and treat the brand color as an accent
      (buttons, badges, active states), not as environmental wallpaper.
      Bigger structural change than a color-value swap - touches layout, not
      just tokens - so scope it separately from the palette-consolidation
      item above.
- [ ] **Delivery location isn't surfaced until deep in checkout** (design
      critique, 9/23) - every reference app (foodpanda leads with "Select
      your address" in the header; Grab's hero has a location field built
      in) treats "where are you" as a primary, always-visible homepage
      element. Otu-Zan only asks via a delivery-location dropdown once a
      customer is already mid-checkout. Lighter-weight than the OpenLeaflet
      map item below (that one's about *how* location gets picked; this is
      about *when* it's surfaced) - could be as simple as showing the
      selected zone persistently in the header once chosen.
- [ ] **Products without photos hurt conversion** (web research, 9/21;
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
- [ ] **"Similar brands" section before the footer** (user request, 9/21, noticed on
      foodpanda) — a discovery/cross-sell section at the bottom of a brand's menu
      page suggesting other brands in the same category (e.g. viewing Jollibee
      suggests McDonald's, Mang Inasal — other Food Delivery brands). Standard
      pattern across delivery and e-commerce apps generally. Lower priority than the
      items above — more of a "keep browsing" nudge than something blocking an
      order, and needs a "same service/category" grouping rule decided first.
- [ ] **Rider name visible in customer notifications** (teammate request, 9/20) —
      confirmed gap: no customer-facing component currently reads `assignedRider`
      at all, so a customer never sees who's delivering their order.
- [ ] **"Inconsistent empty/loading states (UX)"** — Admin's Payments tab has a
      proper icon+heading+subtext empty state; Riders/Customers/Brands tables just
      show flat "No X found." text, and none of them distinguish "still loading"
      from "genuinely empty." **Confirmed this is worse than cosmetic during a
      full QA pass (9/22)**: the Brands tab genuinely flashed "No brands found."
      on a real page load with 16 real brands in the database - `CatalogTab` has
      no loading state at all, so the empty-table render and the "still fetching"
      state are visually identical. An admin landing on a slower connection has
      no way to tell "empty" from "not done loading yet." (Previously tracked as
      two separate items - "Inconsistent empty states" and "Admin table loading
      state" - merged here since they're the same underlying gap.)

### Functionality

- [ ] **"Newly added" indicator when browsing a brand's menu** (user request,
      9/22) — needs confirming `Product` actually has a reliable creation
      timestamp to key off (Eloquent's default `created_at` likely already
      exists but hasn't been checked), then a badge/section for items added
      within some recency window.
- [ ] **`Product.StockQuantity` exists in the schema but is completely
      unenforced** (found during the full QA pass, 9/22) - every product in
      the live catalog reads `StockQuantity: 0`, and grepping the entire
      backend turns up zero references to that column outside the migration
      itself. Nothing validates it, decrements it, or blocks ordering an
      item that's actually out of stock - a customer can order any quantity
      of anything regardless of real availability. **Found the team's own
      answer already sitting in the repo, unrun**: there's an existing
      migration, `2026_09_17_000006_remove_product_stock.php`, that drops
      this exact column - the team already decided "remove it," just never
      ran that migration against the dev database (it's still there, hence
      this finding). Left un-run rather than running it unilaterally: that's
      a real schema change to a live shared database, worth confirming the
      team still wants before applying.
- [ ] Delete dead Express backend (`backend/`) + hardcoded access codes in
      `src/config/roles.js` — not currently exploitable (Laravel ignores role/accessCode
      on register), but it's a loaded gun sitting in the repo. **Needs a decision,
      not just code (9/22)**: Sean's "jollibee menu" commit touched
      `backend/database/schema.sql` directly, so someone on the team may still be
      using this folder for something (a reference copy of the schema?). Confirm
      with Sean before deleting rather than assuming it's safe to remove.
      `src/config/roles.js`'s hardcoded codes are unambiguously dead either way.
- [ ] Backend test coverage for order/payment flows (best done once 1b–1e exist,
      which they now do - see Completed Work).
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
- [ ] *(Needs specifics)* **"Make the header better"** (user request, 9/22) —
      too vague to scope as stated. Either point at a specific reference site's
      header the way foodpanda/Deliveroo were used for the entry-point and hero
      work already landed, or describe concretely what's not working about the
      current one.

## Low Priority

- [ ] **Show estimated time on the brand-selection screen** (Grab/foodpanda
      reference, 9/21) — live-checked foodpanda.ph and GrabFood's web apps for
      comparison. foodpanda's "Top brands" section shows a delivery-time estimate
      (e.g. "5 min") right on the brand tile, before the customer even opens the
      menu. Otu-Zan's Home.jsx brand grid shows only logo + name — no timing context
      up front. Would need real prep-time data per brand/service to be honest, not
      just decorative (tie to `calculateEstimatedWaitMinutes`, already used inside
      each menu page, just not surfaced one level up).
- [ ] **Dark mode** (teammate/user request, 9/21) — technically possible, nothing
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
- [ ] Clean up stale "jayson deguzman" hardcoded filter in
      `CustomerActivityContext.jsx` (4 places) — verify no live bad data still depends
      on it first.
- [ ] Align order status labels with the team's documented decision (meeting
      minutes: Prepared → Packaging → Delivering) — currently uses different wording
      (`pending_rider`, `confirmed`, `preparing`, etc.).
- [ ] Automate the Security test cases already promised in the QA plan (TC-020
      session expiry, TC-021 RBAC restriction, TC-022 SQL injection) — most
      meaningful now that 1b–1d exist (see Completed Work).
- [ ] Mobile/responsive verification pass on remaining customer-facing pages beyond
      what's already been spot-checked.
- [ ] **Set up hosting and deploy** (teammate request, 9/20; recommendation given
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
- [ ] *(Research note)* Couldn't get live reference for foodpanda's actual menu/
      cart/checkout screens — hit a bot-detection wall navigating into a restaurant
      page both on 9/21 and again on 9/23, did not attempt to bypass it either time.
      GrabFood gates restaurant browsing behind login too. Followed up with web
      search and homepage-level comparison instead since direct browsing hit walls.
- [ ] *(Research note)* The same GrabFood UX analysis flags carousel-style browsing
      (swipeable cards) as having low discoverability per NNGroup research — most
      users stop swiping after 3-4 cards. Otu-Zan's category-grouped list layout
      (not carousels) is actually the safer choice here, not a gap — noting this so
      nobody "fixes" it into a carousel later assuming that's more modern.

---

## Data Analytics (Emerging Technology)

**Current status, honestly: researched and planned only. Zero layers implemented
yet.** The plan below is real, specific, and grounded in what this system's schema
already collects - but none of it is running code today. See the chat conversation
from 9/23 for the exact answer/script to give if asked "where is the emerging
technology in your system" during a progress check - the short version is: be
honest that you're in the implementation phase with a validated plan, not claim
something exists that doesn't.

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

- [ ] **Layer 1 — Revenue Trends & Best-Sellers (Descriptive Analytics)**.
      **Most of the backend work is already done (9/23)**, as a side effect of
      the Revenue tab fix and the best-sellers home-page feature above:
      `GET /api/admin/revenue` aggregates real, persisted `ServiceFee` by
      calendar day and by service; `GET /api/catalog/best-sellers` ranks
      products by real units sold in the last 30 days. What's left for this to
      count as the analytics *layer* rather than just two dashboard features:
      a peak-ordering-time query (hour-of-day / day-of-week), and surfacing
      the existing `daily` trend data from the revenue endpoint as an actual
      chart on the admin side instead of just the three stat cards it renders
      today.
      Dashboard design research recommends keeping each view to a handful of
      KPIs with one clear primary metric, not a wall of numbers
      ([Improvado: Dashboard Design Best
      Practices](https://improvado.io/blog/dashboard-design-guide)) - resist the
      urge to show everything at once. **This is the layer to implement first**
      - most of it is already done as a side effect of the bug fix.
- [ ] **Layer 2 — RFM Customer Segmentation (Diagnostic Analytics)**. Score each
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
      **Cheapest of the three layers and doesn't need to wait on anything else** -
      it's a query, not a feature. Gives the paper a named, citable methodology
      instead of "we counted things."
- [ ] **Layer 3 — Lightweight Predictive Demand Forecast (Predictive Analytics)**.
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
      else in its architecture. **Do this one last, and only if time allows** -
      it's the most "emerging-tech-sounding" layer for the paper, but the least
      load-bearing for the actual running system.

## Non-code / academic

- [ ] **Confirm the Data Analytics pivot with your instructor/team** (teammate
      request, 9/20; researched 9/22-23). Your team's meeting minutes (Aug 26)
      had the emerging-tech slot as AI-based ETA prediction, later deprioritized
      in favor of simple status labels. Data Analytics is a different pivot from
      what's currently documented - still confirm the switch before it goes into
      the paper, but you now have a concrete, achievable, industry-validated plan
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
