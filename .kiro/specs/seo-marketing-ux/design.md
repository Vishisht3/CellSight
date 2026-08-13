# Design Document — SEO / Marketing / UX

## Overview

CellSight is a React 18 SPA (Vite, React Router v6, Tailwind CSS, TypeScript) deployed at `cell-sight.vercel.app`. Because there is no server-side rendering, all `<head>` metadata must be managed client-side. This design covers the architecture for 19 SEO, marketing, and UX items across four categories.

---

## Architecture Decisions

### 1. Head Management — `useDocumentMeta` Hook

**Approach:** A single custom hook (`src/hooks/useDocumentMeta.ts`) using native DOM APIs — no third-party library (no `react-helmet`).

**Why:** The project has no SSR requirement, so a DOM-mutation hook is sufficient. It avoids adding a dependency and integrates cleanly with React's effect lifecycle.

**Mechanism:**
- On mount: creates or updates `<title>`, `<meta name="description">`, `<link rel="canonical">`, all OG/Twitter `<meta>` tags, and an optional `<script type="application/ld+json">`.
- Each managed element is identified by a unique `data-cellsight-meta` attribute so the hook can locate and replace it without duplication.
- On unmount: removes all tags it created and restores the default title.
- On re-render with new params: replaces existing tags in-place (upsert pattern).

**Signature:**
```typescript
useDocumentMeta(options: {
  title: string;
  description?: string;
  ogImage?: string;
  schema?: Record<string, unknown> | Record<string, unknown>[];
  noIndex?: boolean;
})
```

---

### 2. Analytics — `useAnalytics` Hook

**Approach:** A hook + module that lazily injects the GA4 `gtag.js` script only when `VITE_GA_MEASUREMENT_ID` is defined and non-empty.

**Mechanism:**
- On app mount: injects `<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID">` and initialises `window.gtag`.
- Uses `useLocation` from React Router to send `page_view` events on every route change.
- Exports `trackEvent(name, params)` for use in page components (CTA clicks, form submissions).
- In local development (no `VITE_GA_MEASUREMENT_ID`): is a no-op, ensuring analytics do not pollute the GA stream.

---

### 3. Route Architecture

The current `App.tsx` has `RootRedirect` at `/` which pushes authenticated users to `/fleet` or `/supply-chain`. This is changed to:

- `/` → `LandingPage` (public, no auth required)
- Authenticated users visiting `/` see a version of `LandingPage` with a "Go to Dashboard" CTA instead of "Start Free Trial"
- `/login` and `/signup` remain public
- `/privacy` → `PrivacyPolicyPage` (public, no auth)
- `/enquiry/thank-you` → `ThankYouPage` (public, no auth)
- `*` → `NotFoundPage` (replaces the existing `Navigate to /` catch-all)

All existing authenticated routes inside `<AppShell />` remain unchanged.

---

### 4. New Pages

#### LandingPage (`/`)
The primary public marketing page. Sections (in order):

1. **Hero** — full-viewport gradient header matching the Windows XP navy/blue design system. Contains: headline, sub-headline, "Start Free Trial" primary CTA (→`/signup`), "Request a Demo" secondary CTA (→`#enquiry`), `ResponseTimeBadge` near the enquiry form anchor.
2. **Case Studies** (`id="case-studies"`) — two cards in a responsive grid. Anchor link from hero ("See Customer Results").
3. **FAQ** (`id="faq"`) — five accordion items. JSON-LD `FAQPage` schema injected.
4. **Reviews** (`id="reviews"`) — five cards + aggregate star rating. JSON-LD `Organization.aggregateRating` schema.
5. **Enquiry Form** (`id="enquiry"`) — simple demo request form that, on success, navigates to `/enquiry/thank-you` and fires GA `generate_lead`.
6. **Map** — OpenStreetMap iframe embed for IIT Roorkee with fallback address text and directions link.
7. **Footer** — Privacy Policy link, copyright.

Schema injected: `LocalBusiness` + `FAQPage` + `Organization` (with aggregateRating).

If authenticated: hero shows "Go to Dashboard" (→`/fleet`) instead of sign-up CTAs; `StickyMobileCTA` is hidden.

#### NotFoundPage (`*`)
Branded 404 page. Uses the same navy/blue header chrome as `LoginPage`. Shows "404 — Page Not Found", helpful message, two buttons: "Go to Home" and "Sign In". Sets `noindex` meta.

#### ThankYouPage (`/enquiry/thank-you`)
Confirmation page. Shows `ResponseTimeBadge`, next-steps text, "Go to Dashboard" (→`/fleet`) and "Return to Home" (→`/`) links. Sets `noindex` meta.

#### PrivacyPolicyPage (`/privacy`)
Seven-section privacy policy. Accessible without auth. Linked from the footer of every page (landing, authenticated app shell sidebar footer). Last updated date: 2026-08-13. Proper 120–160 char meta description.

---

### 5. New Components

#### `Breadcrumb` (`src/components/ui/Breadcrumb.tsx`)
- Props: `items: Array<{ label: string; href?: string }>`
- Renders `<nav aria-label="breadcrumb">` with `›` separators
- Last item: `aria-current="page"`, no link
- Styling: small (11px), muted blue-grey text, matching the XP `win-section-header` tone

#### `ResponseTimeBadge` (`src/components/ui/ResponseTimeBadge.tsx`)
- Clock icon + "We respond to all enquiries within 1 business day"
- Green/teal pill badge (background `#d4edda`, border `#82c891`, text `#155724`)
- Minimum font size 12px

#### `StickyMobileCTA` (`src/components/ui/StickyMobileCTA.tsx`)
- `position: fixed`, `bottom: 0`, `left: 0`, `right: 0`, `z-index: 9999`
- Visible only on viewport < 768px (CSS media query via inline style + `useEffect` on resize, or Tailwind `md:hidden`)
- "Get Started Free" → `/signup`
- Hides when user scrolls within 200px of the page footer (`useEffect` scroll listener)

---

### 6. Static Files (`frontend/public/`)

| File | Purpose |
|------|---------|
| `robots.txt` | Tells crawlers which paths to index / disallow |
| `sitemap.xml` | Lists all public URLs for crawlers |
| `og-default.svg` | Default Open Graph image (1200×630 equivalent SVG) |

These files are served by Vercel as static assets before the SPA catch-all rewrite fires (per `vercel.json`).

---

### 7. Breadcrumbs on Nested Pages

JSON-LD `BreadcrumbList` schema is injected alongside visible breadcrumbs on:
- `AssetDetail` — Fleet Health → {assetName}
- `TraceView` — Supplier Portal → Trace → {assetId}
- `ProfilePage` — My Profile

---

### 8. Internal Links

| Page | Addition |
|------|---------|
| `FleetDashboard` | "Trace" link column → `/supply-chain/trace/:assetId` per row where `batteryPackId` exists |
| `SupplyChainDashboard` | "View Field Correlations" link → `/correlation` in toolbar area |
| `AlertsPage` | Asset link → `/fleet/:id` per alert with `assetId`; Supplier link → `/supply-chain` per alert with `supplierId` |
| All public pages | Footer link "Privacy Policy" → `/privacy` |
| `ThankYouPage` | "Go to Dashboard" → `/fleet`, "Return to Home" → `/` |

---

### 9. Privacy Policy Footer Link

Added to `Sidebar.tsx` footer section (below the user section) and to `LandingPage` footer. This ensures it is present on all authenticated pages (via the sidebar) and on the public landing page.

---

### 10. Alt Text

All `<img>` elements are audited and given descriptive `alt` attributes. The OG image referenced as `<img>` receives `alt="CellSight — Battery Intelligence Platform"`. Decorative images receive `alt=""`.

---

### 11. Google Analytics

- Measurement ID read from `VITE_GA_MEASUREMENT_ID` environment variable
- Script injected with `async` attribute
- `page_view` event on every route change (via `useLocation` effect)
- `cta_click` event via exported `trackEvent` called from CTA buttons
- `generate_lead` event on enquiry form success
- `.env.local` has `VITE_GA_MEASUREMENT_ID=` (empty) so local dev is clean

---

## File Structure

```
frontend/
├── public/
│   ├── robots.txt          (new)
│   ├── sitemap.xml         (new)
│   └── og-default.svg      (new)
├── src/
│   ├── hooks/
│   │   ├── useDocumentMeta.ts   (new)
│   │   └── useAnalytics.ts      (new)
│   ├── pages/
│   │   ├── LandingPage.tsx      (new)
│   │   ├── NotFoundPage.tsx     (new)
│   │   ├── ThankYouPage.tsx     (new)
│   │   ├── PrivacyPolicyPage.tsx (new)
│   │   └── ...existing pages updated
│   └── components/
│       └── ui/
│           ├── Breadcrumb.tsx       (new)
│           ├── ResponseTimeBadge.tsx (new)
│           └── StickyMobileCTA.tsx  (new)
```

---

## WCAG 2.1 Level AA Compliance

- All CTA buttons: contrast ratio ≥ 4.5:1 (white text on `#2255b4` blue background)
- Focus indicators: visible outline with ≥ 3:1 contrast
- Star ratings: `aria-label="N out of 5 stars"` on each rating element
- FAQ accordion: `aria-expanded`, `aria-controls` on trigger buttons
- Breadcrumbs: `aria-label="breadcrumb"` on nav, `aria-current="page"` on current item
- Map iframe: descriptive `title` attribute
- Images: non-empty `alt` on all content images, `alt=""` on decorative images

> Full WCAG validation requires manual testing with assistive technologies (NVDA, VoiceOver) beyond what automated tooling can verify.
