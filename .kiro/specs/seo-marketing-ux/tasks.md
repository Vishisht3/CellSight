# Implementation Tasks — SEO / Marketing / UX

## Task 1: Create `useDocumentMeta` Hook
**File:** `frontend/src/hooks/useDocumentMeta.ts`
- Accepts `{ title, description?, ogImage?, schema?, noIndex? }`
- Sets `document.title` to `"{title} — CellSight"`
- Upserts `<meta name="description">` (creates if absent, replaces if present)
- Upserts `<link rel="canonical">` to current absolute URL
- Upserts OG tags: `og:title`, `og:description`, `og:image`, `og:type`, `og:url`, `og:site_name`
- Upserts Twitter tags: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- Upserts `<meta name="robots" content="noindex,nofollow">` when `noIndex=true`
- Injects / replaces `<script type="application/ld+json">` for each schema object provided
- Tags are identified by `data-cellsight-meta` attribute to prevent duplicates
- Cleanup on unmount: removes all injected tags, restores default title

## Task 2: Create `useAnalytics` Hook
**File:** `frontend/src/hooks/useAnalytics.ts`
- Reads `import.meta.env.VITE_GA_MEASUREMENT_ID`
- If defined and non-empty: injects `<script async>` for gtag.js, initialises `window.gtag`
- Exports `trackEvent(name: string, params?: Record<string, unknown>)` function
- Sends `page_view` event on every React Router location change
- No-op if env var is absent

## Task 3: Create `NotFoundPage`
**File:** `frontend/src/pages/NotFoundPage.tsx`
- Branded 404 page matching LoginPage chrome (navy header, white body)
- "404 — Page Not Found" heading
- Helpful message
- "Go to Home" button → `/`
- "Sign In" button → `/login`
- `useDocumentMeta({ title: 'Page Not Found', noIndex: true })`

## Task 4: Create `ThankYouPage`
**File:** `frontend/src/pages/ThankYouPage.tsx`
- Confirmation heading + next-steps description
- `ResponseTimeBadge` below heading
- "Go to Dashboard" link → `/fleet`
- "Return to Home" link → `/`
- `useDocumentMeta({ title: 'Thank You', noIndex: true })`

## Task 5: Create `PrivacyPolicyPage`
**File:** `frontend/src/pages/PrivacyPolicyPage.tsx`
- Public (no auth required)
- Seven sections: data collected, how used, retention, third parties (GA), user rights, contact, last updated
- Last updated: 2026-08-13 (ISO 8601 displayed adjacent to title)
- `useDocumentMeta` with title "Privacy Policy" and 120–160 char description

## Task 6: Create `LandingPage`
**File:** `frontend/src/pages/LandingPage.tsx`
- Hero with "Start Free Trial" (→`/signup`) and "Request a Demo" (→`#enquiry`) CTAs
- "See Customer Results" anchor link → `#case-studies`
- `ResponseTimeBadge` near enquiry form
- Case study section (2 cards, responsive grid)
- FAQ accordion (5 items)
- Reviews section (5 cards + aggregate rating)
- Enquiry form (name, email, company, submit → navigate `/enquiry/thank-you` + `generate_lead` GA event)
- OpenStreetMap iframe embed with address and directions link
- Footer with Privacy Policy link
- `StickyMobileCTA` rendered at page root
- Full LocalBusiness + FAQPage + Organization JSON-LD schemas
- If authenticated: show "Go to Dashboard" instead of signup CTAs

## Task 7: Create `Breadcrumb` Component
**File:** `frontend/src/components/ui/Breadcrumb.tsx`
- Props: `items: Array<{ label: string; href?: string }>`
- `<nav aria-label="breadcrumb">`
- Items separated by ` › `
- Last item: `aria-current="page"`, not a link
- Ancestor items: `<a href>` links styled as muted blue links

## Task 8: Create `ResponseTimeBadge` Component
**File:** `frontend/src/components/ui/ResponseTimeBadge.tsx`
- Clock icon + "We respond to all enquiries within 1 business day"
- Green pill badge (bg `#d4edda`, border `#82c891`, text `#155724`)
- Font size ≥ 12px

## Task 9: Create `StickyMobileCTA` Component
**File:** `frontend/src/components/ui/StickyMobileCTA.tsx`
- Fixed bottom-0 position, z-index 9999
- Visible only on viewport < 768px
- "Get Started Free" → `/signup`
- Hides when scroll position is within 200px of footer
- Hidden on desktop

## Task 10: Create Static Files
**Files:**
- `frontend/public/robots.txt` — standard disallow/allow directives + sitemap pointer
- `frontend/public/sitemap.xml` — public URLs: `/`, `/login`, `/signup`, `/privacy`
- `frontend/public/og-default.svg` — 1200×630 branded SVG as OG image fallback

## Task 11: Update `App.tsx`
- Import and render new pages
- Change `/` route from `RootRedirect` to `LandingPage` (public)
- Add `/privacy` route (no auth)
- Add `/enquiry/thank-you` route (no auth)
- Change `*` catch-all from `Navigate to /` to `NotFoundPage`
- Initialise analytics (call `useAnalytics` inside `AppRoutes`)

## Task 12: Add `useDocumentMeta` to Existing Pages
Pages and titles:
- `FleetDashboard` → "Fleet Health Dashboard"
- `AssetDetail` → `"Asset ${asset.name} — Fleet Health"`
- `SupplyChainDashboard` → "Supplier Portal"
- `TraceView` → `"Pack Trace — ${assetId}"`
- `AlertsPage` → "Alerts"
- `CorrelationPage` → "Field Claims & Correlation"
- `ReadinessPage` → "EV Replacement Planner"
- `MaintenancePage` → "Work Orders"
- `RegisterDataPage` → "Register Data"
- `ProfilePage` → "My Profile"
- `LoginPage` → "Sign In"
- `SignUpPage` → "Create Your Account"

## Task 13: Add Breadcrumbs to Nested Pages
- `AssetDetail`: Fleet Health (→`/fleet`) → {asset.name}
- `TraceView`: Supplier Portal (→`/supply-chain`) → Trace (→`/supply-chain`) → {assetId}
- `ProfilePage`: My Profile (no link — single item)

## Task 14: Add Internal Links
- `FleetDashboard`: Add "Trace" link column to asset rows where `batteryPackId` is not null
- `SupplyChainDashboard`: Add "View Field Correlations" link → `/correlation`
- `AlertsPage`: Add asset link → `/fleet/:id` per alert where `assetId` is non-null
- `AlertsPage`: Add supplier link → `/supply-chain` per alert where `supplierId` is non-null

## Task 15: Add Privacy Policy Footer Link
- `Sidebar.tsx`: Add "Privacy Policy" link at the bottom of the user footer section
- `LandingPage.tsx`: Include in footer (already part of Task 6)

## Task 16: Audit and Add Alt Text
- Check all `<img>` elements across the codebase
- Add descriptive `alt` attributes to all content images
- Add `alt=""` to decorative images
- OG image `<img>`: `alt="CellSight — Battery Intelligence Platform"`

## Task 17: Add `.env.local`
- Ensure `frontend/.env.local` contains `VITE_GA_MEASUREMENT_ID=` (empty line) so GA does not fire locally

## Task 18: TypeScript Typecheck
- Run `npx tsc --noEmit` from `frontend/`
- Fix all type errors

## Task 19: Git Commit
- Stage all new and modified files
- Commit with message: `feat: add SEO/marketing/UX — meta hooks, landing page, 404, privacy, breadcrumbs, analytics`
