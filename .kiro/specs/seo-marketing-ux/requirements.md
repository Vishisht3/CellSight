# Requirements Document

## Introduction

CellSight is a B2B SaaS platform for industrial EV fleet operators and battery supply chain managers, deployed as a React 18 SPA (Vite, React Router v6, Tailwind CSS) at `cell-sight.vercel.app` with a Node.js/Express backend on Railway and a PostgreSQL database.

The platform currently has no SEO infrastructure, no marketing landing content, and no public-facing informational pages. This feature adds 19 items across four categories:

- **SEO / Technical**: robots.txt, per-page `<title>` tags, meta descriptions, Open Graph / Twitter Card tags, image alt text, JSON-LD local business schema, Google Analytics
- **New pages**: custom 404 page, enquiry thank-you page, privacy policy page
- **UI / Content additions**: above-the-fold CTAs, breadcrumbs, case study section, FAQ section, response time promise, sticky mobile CTA, maps + directions, customer reviews section
- **Cross-cutting**: internal links across existing pages

Because the site is a React SPA, all `<head>` metadata management is done client-side via a `useDocumentMeta` hook, and all static files (robots.txt, OG images) are placed in `frontend/public/` so Vercel serves them before the SPA catch-all rewrite fires.

---

## Glossary

- **App**: The CellSight React SPA running at `cell-sight.vercel.app`.
- **Router**: The React Router v6 instance managing client-side navigation.
- **DocumentMeta_Hook**: The `useDocumentMeta` custom React hook responsible for updating `document.title` and `<meta>` tags on each route change.
- **SEO_Head**: The set of `<meta>` and `<link>` elements injected by DocumentMeta_Hook into the `<head>` of the document.
- **OG_Tags**: Open Graph and Twitter Card `<meta>` tags consumed by social platforms and link-preview services.
- **Schema_Script**: A `<script type="application/ld+json">` element containing JSON-LD structured data injected into the document `<head>`.
- **robots_txt**: The static `robots.txt` file placed in `frontend/public/` and served by Vercel at `cell-sight.vercel.app/robots.txt`.
- **GA_Script**: The Google Analytics 4 measurement script initialised at application start.
- **GA_Stream**: The Google Analytics 4 data stream identified by the `VITE_GA_MEASUREMENT_ID` environment variable.
- **NotFoundPage**: The React component rendered by the Router for all unmatched URL paths.
- **ThankYouPage**: The React component rendered at `/enquiry/thank-you` after a successful enquiry form submission.
- **PrivacyPolicyPage**: The React component rendered at `/privacy` containing the platform's privacy policy.
- **LandingSection**: The first viewport-visible area of a public-facing page, also called "above the fold".
- **CTA_Button**: A call-to-action button element that navigates to the sign-up or contact flow.
- **Breadcrumb_Trail**: The ordered list of ancestor page links rendered at the top of nested pages.
- **CaseStudy_Section**: A content section on the marketing landing area presenting anonymised customer success data.
- **FAQ_Section**: A content section presenting five question-and-answer pairs relevant to CellSight's value proposition.
- **ResponseTime_Badge**: A UI element communicating the platform's support response time commitment.
- **StickyMobileCTA**: A fixed-position CTA bar visible at the bottom of the viewport on screens narrower than 768 px.
- **MapEmbed**: An embedded map widget showing the CellSight office location with driving directions.
- **Reviews_Section**: A content section displaying five or more real customer testimonials with star ratings.
- **Alt_Text**: The `alt` attribute value on every `<img>` element in the App.
- **Enquiry_Form**: The contact / demo-request form on the public landing page that triggers navigation to ThankYouPage on success.

---

## Requirements

---

### Requirement 1: Custom 404 Page

**User Story:** As a visitor who navigates to a non-existent URL, I want to see a branded error page with navigation options, so that I understand I have reached a dead end and can find my way to useful content without using the browser back button.

#### Acceptance Criteria

1. WHEN the Router receives a URL that matches no defined route, THE App SHALL render NotFoundPage at that URL without redirecting.
2. THE NotFoundPage SHALL display the HTTP status concept "404" and a human-readable message explaining that the page was not found.
3. THE NotFoundPage SHALL display at least two CTA_Button elements: one navigating to `/` and one navigating to `/login`.
4. THE NotFoundPage SHALL apply the same visual design system (colours, fonts, Tailwind classes) as the rest of the App.
5. WHEN NotFoundPage is rendered, THE DocumentMeta_Hook SHALL set `document.title` to `"Page Not Found — CellSight"`.
6. WHEN NotFoundPage is rendered, THE DocumentMeta_Hook SHALL set the `<meta name="robots">` tag to `"noindex, nofollow"`.

---

### Requirement 2: Above-the-Fold Call-to-Actions

**User Story:** As a prospective customer visiting CellSight's public landing area, I want to see clear primary and secondary calls-to-action without scrolling, so that I can immediately understand what action to take next.

#### Acceptance Criteria

1. THE LandingSection SHALL contain a primary CTA_Button labelled "Start Free Trial" that navigates to `/signup`.
2. THE LandingSection SHALL contain a secondary CTA_Button labelled "Request a Demo" that navigates to the Enquiry_Form anchor on the same page.
3. WHILE the viewport height is 600 px or greater, THE LandingSection SHALL display both CTA_Button elements within the first 600 px of vertical page content without requiring scroll.
4. THE primary CTA_Button SHALL have a contrast ratio of at least 4.5:1 between its label text colour and its background colour, as defined by WCAG 2.1 Success Criterion 1.4.3.
5. WHEN a CTA_Button receives keyboard focus, THE App SHALL display a visible focus indicator with at least a 3:1 contrast ratio against the surrounding background.

---

### Requirement 3: Internal Links

**User Story:** As a visitor or authenticated user navigating the App, I want contextually relevant links to related pages, so that I can discover adjacent features without returning to a top-level menu.

#### Acceptance Criteria

1. THE FleetDashboard page SHALL contain an internal link to `/supply-chain/trace/:assetId` for each asset row that has a `batteryPackId` value.
2. THE SupplyChainDashboard page SHALL contain an internal link to `/correlation` labelled "View Field Correlations".
3. THE AlertsPage SHALL contain an internal link to the source asset page `/fleet/:id` for each alert that has a non-null `assetId`.
4. THE AlertsPage SHALL contain an internal link to the source supplier page `/supply-chain` for each alert that has a non-null `supplierId`.
5. THE LandingSection SHALL contain an internal link to `/privacy` labelled "Privacy Policy" in the page footer.
6. THE ThankYouPage SHALL contain an internal link to `/fleet` labelled "Go to Dashboard" and an internal link to `/` labelled "Return to Home".
7. WHEN an internal link is rendered as an anchor element, THE App SHALL set the `href` attribute to the target route path so that the link is indexable by search engine crawlers.

---

### Requirement 4: Thank-You Page After Enquiry

**User Story:** As a prospective customer who has submitted the demo-request form, I want to see a confirmation page, so that I know my enquiry was received and understand what happens next.

#### Acceptance Criteria

1. WHEN the Enquiry_Form submission succeeds, THE Router SHALL navigate to `/enquiry/thank-you`.
2. THE ThankYouPage SHALL display a confirmation heading and a description of next steps, including the response time commitment stated in Requirement 8.
3. THE ThankYouPage SHALL display the ResponseTime_Badge defined in Requirement 8.
4. THE ThankYouPage SHALL display a CTA_Button navigating to `/fleet` for users who already have an account.
5. WHEN ThankYouPage is rendered, THE DocumentMeta_Hook SHALL set `document.title` to `"Thank You — CellSight"`.
6. WHEN ThankYouPage is rendered, THE DocumentMeta_Hook SHALL set the `<meta name="robots">` tag to `"noindex, nofollow"`.

---

### Requirement 5: Breadcrumbs

**User Story:** As an authenticated user navigating to a detail or nested page, I want to see a breadcrumb trail showing my location in the page hierarchy, so that I can understand the site structure and navigate up without using the browser back button.

#### Acceptance Criteria

1. THE AssetDetail page SHALL display a Breadcrumb_Trail with the ordered items: "Fleet Health" → the asset name.
2. THE TraceView page SHALL display a Breadcrumb_Trail with the ordered items: "Supplier Portal" → "Trace" → the asset identifier.
3. THE ProfilePage SHALL display a Breadcrumb_Trail with the single item "My Profile".
4. WHEN a Breadcrumb_Trail is rendered, THE App SHALL render each ancestor item as an anchor element linking to its respective route.
5. WHEN a Breadcrumb_Trail is rendered, THE App SHALL render the current page item as a non-linked text node.
6. THE Breadcrumb_Trail SHALL include `aria-label="breadcrumb"` on its containing `<nav>` element and `aria-current="page"` on the current page item.
7. WHEN Breadcrumb_Trail items are rendered, THE Schema_Script on that page SHALL include a `BreadcrumbList` JSON-LD object whose `itemListElement` array mirrors the visible breadcrumb items.

---

### Requirement 6: Case Study Section

**User Story:** As a prospective customer evaluating CellSight, I want to read quantified evidence of how the platform has benefited similar organisations, so that I can build confidence in the product's value before signing up.

#### Acceptance Criteria

1. THE CaseStudy_Section SHALL display a minimum of two case study cards, each containing: a company-type label, a challenge statement, a measurable outcome, and a pull-quote attributed to a job title (not a personal name, for anonymity).
2. THE CaseStudy_Section SHALL display at least one outcome metric expressed as a percentage or numeric value (for example, "23% reduction in unplanned downtime").
3. THE CaseStudy_Section SHALL be reachable from the LandingSection via a "See Customer Results" anchor link without a full page navigation.
4. WHERE the viewport width is 768 px or greater, THE CaseStudy_Section SHALL render case study cards in a horizontal grid of at least two columns.
5. WHERE the viewport width is less than 768 px, THE CaseStudy_Section SHALL render case study cards in a single-column stacked layout.
6. THE CaseStudy_Section SHALL contain a CTA_Button navigating to `/signup` labelled "Get Started" immediately after the final case study card.

---

### Requirement 7: FAQ Section

**User Story:** As a prospective customer with questions about CellSight's pricing, security, or integration, I want to find answers on the page without contacting support, so that I can resolve objections independently and progress toward sign-up.

#### Acceptance Criteria

1. THE FAQ_Section SHALL display exactly five question-and-answer pairs covering the following topics: (a) pricing model, (b) data security and storage, (c) ERP/telematics integration, (d) time-to-value / onboarding, (e) supported vehicle and battery types.
2. WHEN a user activates a question item in the FAQ_Section, THE App SHALL expand the corresponding answer and collapse any previously expanded answer.
3. WHEN a question item is expanded, THE App SHALL set `aria-expanded="true"` on the trigger element and render the answer in the associated region element identified by `aria-controls`.
4. WHEN a question item is collapsed, THE App SHALL set `aria-expanded="false"` on the trigger element.
5. WHEN the FAQ_Section is rendered, THE Schema_Script on that page SHALL include a `FAQPage` JSON-LD object whose `mainEntity` array contains one `Question` entry per FAQ item, each with `name` and `acceptedAnswer.text` fields.

---

### Requirement 8: Response Time Promise

**User Story:** As a prospective or existing customer, I want to see a clearly stated support response time commitment, so that I can evaluate whether CellSight meets my operational SLA requirements.

#### Acceptance Criteria

1. THE ResponseTime_Badge SHALL display the text "We respond to all enquiries within 1 business day".
2. THE ResponseTime_Badge SHALL appear in the ThankYouPage immediately below the confirmation heading.
3. THE ResponseTime_Badge SHALL appear in the LandingSection in proximity to the Enquiry_Form.
4. THE ResponseTime_Badge SHALL render at a font size of 12 px or larger.
5. THE ResponseTime_Badge SHALL include an icon or visual indicator that distinguishes it from body copy.

---

### Requirement 9: Sticky Mobile Call-to-Action

**User Story:** As a visitor browsing CellSight on a mobile device, I want a persistent call-to-action visible while I scroll, so that I can initiate sign-up at any point without scrolling back to the top of the page.

#### Acceptance Criteria

1. WHILE the viewport width is less than 768 px, THE StickyMobileCTA SHALL be rendered as a fixed-position element at the bottom of the viewport with a z-index sufficient to appear above page content.
2. THE StickyMobileCTA SHALL contain a CTA_Button labelled "Get Started Free" that navigates to `/signup`.
3. WHILE the viewport width is 768 px or greater, THE App SHALL NOT render the StickyMobileCTA.
4. WHEN the user has scrolled to within 200 px of the page footer, THE StickyMobileCTA SHALL hide so that it does not overlap footer content.
5. THE StickyMobileCTA background SHALL have a contrast ratio of at least 4.5:1 between button label text and button background colour.

---

### Requirement 10: robots.txt

**User Story:** As a search engine crawler, I want a robots.txt file at the canonical domain root, so that I can determine which paths to index and avoid crawling authenticated or sensitive application routes.

#### Acceptance Criteria

1. THE App SHALL serve a `robots.txt` file at `cell-sight.vercel.app/robots.txt` with HTTP status 200 and `Content-Type: text/plain`.
2. THE robots_txt SHALL contain a `User-agent: *` directive.
3. THE robots_txt SHALL contain `Disallow` directives for the following paths: `/fleet`, `/fleet/`, `/supply-chain`, `/supply-chain/`, `/alerts`, `/correlation`, `/register`, `/profile`, `/readiness`, `/maintenance`, `/api/`.
4. THE robots_txt SHALL contain an `Allow: /` directive permitting crawling of public paths including `/`, `/login`, `/signup`, `/privacy`, `/enquiry/thank-you`.
5. THE robots_txt SHALL contain a `Sitemap:` directive pointing to `https://cell-sight.vercel.app/sitemap.xml`.
6. THE robots_txt file SHALL be placed in `frontend/public/` so that Vercel serves it before the SPA catch-all rewrite applies.

---

### Requirement 11: Unique Page Titles

**User Story:** As a search engine or browser user, I want every page to have a unique, descriptive title, so that search result listings and browser tabs accurately identify the page content.

#### Acceptance Criteria

1. THE DocumentMeta_Hook SHALL accept a `title` string parameter and set `document.title` to the value `"{title} — CellSight"` on every route change.
2. THE App SHALL invoke DocumentMeta_Hook on every route defined in the Router with the page-specific titles listed below:
   - `/login` → `"Sign In"`
   - `/signup` → `"Create Your Account"`
   - `/fleet` → `"Fleet Health Dashboard"`
   - `/fleet/:id` → `"Asset {assetName} — Fleet Health"`
   - `/readiness` → `"EV Replacement Planner"`
   - `/maintenance` → `"Work Orders"`
   - `/supply-chain` → `"Supplier Portal"`
   - `/supply-chain/trace/:assetId` → `"Pack Trace — {assetId}"`
   - `/alerts` → `"Alerts"`
   - `/correlation` → `"Field Claims & Correlation"`
   - `/register` → `"Register Data"`
   - `/profile` → `"My Profile"`
   - `/privacy` → `"Privacy Policy"`
   - `/enquiry/thank-you` → `"Thank You"`
   - `*` (404) → `"Page Not Found"`
3. WHEN the Router navigates to a new route, THE DocumentMeta_Hook SHALL update `document.title` within the same render cycle as the new page component mounting.
4. THE DocumentMeta_Hook SHALL restore the default title `"CellSight — Battery Intelligence Platform"` when a component using it unmounts without a subsequent hook invocation.

---

### Requirement 12: Meta Descriptions

**User Story:** As a search engine, I want a unique meta description on every public page, so that search result snippets accurately summarise each page's content and improve click-through rates.

#### Acceptance Criteria

1. THE DocumentMeta_Hook SHALL accept a `description` string parameter and set the content of `<meta name="description">` on every route change.
2. THE App SHALL invoke DocumentMeta_Hook with a description of 120–160 characters on each public-facing route: `/`, `/login`, `/signup`, `/privacy`.
3. IF the `description` parameter is not provided to DocumentMeta_Hook, THEN THE DocumentMeta_Hook SHALL set a default description: `"CellSight — Battery intelligence for EV fleet operators and supply chain managers. Monitor pack health, trace materials, and manage supplier risk."`.
4. WHEN the Router navigates away from a route, THE DocumentMeta_Hook SHALL replace the previous route's description with the incoming route's description so that at most one `<meta name="description">` element exists in `<head>` at any time.

---

### Requirement 13: Social Share Images (Open Graph / Twitter Card Meta Tags)

**User Story:** As a user who shares a CellSight URL on a social platform or messaging app, I want the shared link to display a branded preview card with a title, description, and image, so that the link appears professional and recognisable.

#### Acceptance Criteria

1. THE DocumentMeta_Hook SHALL accept an `ogImage` URL parameter and set `<meta property="og:image">` and `<meta name="twitter:image">` to that URL.
2. THE App SHALL provide a default OG image at `https://cell-sight.vercel.app/og-default.png` with dimensions of exactly 1200 × 630 px.
3. THE App SHALL set the following OG_Tags on every route:
   - `og:type` → `"website"`
   - `og:site_name` → `"CellSight"`
   - `og:url` → the canonical URL of the current page
   - `og:title` → the same value as `document.title`
   - `og:description` → the same value as `<meta name="description">`
   - `og:image` → the route-specific or default OG image URL
   - `twitter:card` → `"summary_large_image"`
   - `twitter:title` → the same value as `og:title`
   - `twitter:description` → the same value as `og:description`
4. WHEN the Router navigates to a new route, THE DocumentMeta_Hook SHALL update all OG_Tags within the same render cycle as the new page component mounting.
5. THE og-default.png image SHALL be placed in `frontend/public/` so that Vercel serves it as a static asset.

---

### Requirement 14: Maps and Directions

**User Story:** As a prospective customer or partner who wants to visit or verify the CellSight office, I want to see an embedded map with the business address and a link to driving directions, so that I can locate the office without leaving the page.

#### Acceptance Criteria

1. THE MapEmbed SHALL display an interactive map centred on the CellSight registered business address.
2. THE MapEmbed SHALL display a text block containing the full postal address, rendered as plain text (not solely as an image) so that it is machine-readable.
3. THE MapEmbed SHALL contain a link labelled "Get Directions" that opens the mapping service directions URL in a new browser tab with `target="_blank" rel="noopener noreferrer"`.
4. THE MapEmbed SHALL be embedded via an `<iframe>` with a descriptive `title` attribute value of `"CellSight office location map"`.
5. IF the browser does not load the map iframe, THEN THE App SHALL display the postal address text and the "Get Directions" link as a fallback so that the location information remains accessible.
6. THE MapEmbed SHALL appear on the public landing page in a section reachable without authentication.

---

### Requirement 15: Real Customer Reviews Section

**User Story:** As a prospective customer evaluating CellSight, I want to read authentic testimonials from existing customers with their role and organisation type, so that I can assess social proof before committing to a trial.

#### Acceptance Criteria

1. THE Reviews_Section SHALL display a minimum of five review cards, each containing: a star rating between 1 and 5 (inclusive), review text of at least 30 words, and an attribution containing a job title and organisation type (not a personal name).
2. THE Reviews_Section SHALL display the aggregate average star rating calculated from all displayed review cards.
3. THE star rating display SHALL use visible star icons for rated stars and visually distinct icons for unrated stars, and SHALL include a screen-reader-accessible text alternative expressing the numeric rating (for example, `aria-label="4 out of 5 stars"`).
4. WHEN the Reviews_Section is rendered, THE Schema_Script on that page SHALL include an `Organization` JSON-LD object with an `aggregateRating` field whose `ratingValue` matches the displayed average and `reviewCount` matches the number of displayed review cards.
5. WHERE the viewport width is 768 px or greater, THE Reviews_Section SHALL render review cards in a grid of at least three columns.
6. WHERE the viewport width is less than 768 px, THE Reviews_Section SHALL render review cards in a single-column stacked layout.

---

### Requirement 16: Alt Text on Images

**User Story:** As a screen reader user or a visitor whose images fail to load, I want every image to have a descriptive text alternative, so that the content and function of each image is accessible.

#### Acceptance Criteria

1. THE App SHALL set a non-empty `alt` attribute on every `<img>` element that conveys content or meaning.
2. WHEN an `<img>` element is purely decorative and conveys no information, THE App SHALL set its `alt` attribute to an empty string (`alt=""`).
3. THE Alt_Text for product-related images SHALL describe the image subject in 125 characters or fewer.
4. THE Alt_Text for CTA_Button images or icon-only images SHALL describe the button's action or destination (for example, `alt="Navigate to Fleet Health Dashboard"`).
5. THE App SHALL NOT use the image filename, URL path, or the word "image" or "photo" as the sole content of an `alt` attribute.
6. WHEN the OG image (`og-default.png`) is referenced as an `<img>` element anywhere in the App, THE App SHALL set its `alt` attribute to `"CellSight — Battery Intelligence Platform"`.

---

### Requirement 17: Local Business Schema (JSON-LD Structured Data)

**User Story:** As a search engine processing CellSight's public pages, I want machine-readable structured data describing the business, so that CellSight is eligible for rich results including knowledge panel entries and local business cards.

#### Acceptance Criteria

1. THE App SHALL inject a Schema_Script into `<head>` on the root public landing page containing a `LocalBusiness` JSON-LD object.
2. THE `LocalBusiness` object SHALL include the following fields: `@context`, `@type`, `name`, `url`, `logo`, `description`, `address` (with `@type: PostalAddress`, `streetAddress`, `addressLocality`, `addressRegion`, `postalCode`, `addressCountry`), `telephone`, `email`, `openingHours`, and `sameAs` (an array of social media profile URLs).
3. THE `LocalBusiness` object `url` field SHALL be set to `"https://cell-sight.vercel.app"`.
4. THE `LocalBusiness` object `logo` field SHALL reference the same logo asset used in the App's Sidebar branding, expressed as an absolute HTTPS URL.
5. WHEN the Router navigates away from a page that injected a Schema_Script, THE App SHALL remove that Schema_Script from `<head>` before the next page's Schema_Script is injected, so that at most one Schema_Script of each `@type` exists in `<head>` at any time.
6. THE Schema_Script content SHALL be valid JSON-LD that passes Google's Rich Results Test without errors.

---

### Requirement 18: Privacy Policy Page

**User Story:** As a visitor or existing user, I want to access a clear and complete privacy policy, so that I understand how my personal data and organisation data are collected, stored, and used by CellSight.

#### Acceptance Criteria

1. THE App SHALL render PrivacyPolicyPage at the route `/privacy` without requiring authentication.
2. THE PrivacyPolicyPage SHALL contain sections covering at minimum: (a) what data is collected, (b) how data is used, (c) data retention periods, (d) third-party services (including Google Analytics), (e) user rights and how to exercise them, (f) contact information for data enquiries, (g) the date the policy was last updated.
3. THE PrivacyPolicyPage SHALL be reachable via a footer link labelled "Privacy Policy" from every public-facing page and every authenticated page.
4. WHEN PrivacyPolicyPage is rendered, THE DocumentMeta_Hook SHALL set `document.title` to `"Privacy Policy — CellSight"`.
5. WHEN PrivacyPolicyPage is rendered, THE DocumentMeta_Hook SHALL set `<meta name="description">` to a description of 120–160 characters summarising the policy.
6. THE PrivacyPolicyPage SHALL display the last-updated date in ISO 8601 format (`YYYY-MM-DD`) adjacent to the page title.

---

### Requirement 19: Google Analytics Integration

**User Story:** As a CellSight product owner, I want page views and key user interactions tracked in Google Analytics 4, so that I can measure marketing funnel performance, feature adoption, and user drop-off points.

#### Acceptance Criteria

1. THE App SHALL load the GA_Script using the measurement ID stored in the `VITE_GA_MEASUREMENT_ID` environment variable when that variable is defined and non-empty.
2. IF `VITE_GA_MEASUREMENT_ID` is undefined or empty, THEN THE App SHALL NOT load the GA_Script, so that local development does not pollute the Analytics data stream.
3. WHEN the Router navigates to a new route, THE GA_Script SHALL send a `page_view` event to GA_Stream with the new pathname as the `page_path` parameter within 500 ms of the route change.
4. WHEN a user activates a CTA_Button, THE App SHALL send a `cta_click` event to GA_Stream with the parameters `cta_label` (the button's visible label text) and `cta_destination` (the target route path).
5. WHEN the Enquiry_Form is submitted successfully, THE App SHALL send a `generate_lead` event to GA_Stream.
6. THE GA_Script SHALL be loaded using the `async` attribute so that script loading does not block the main thread rendering of page content.
7. THE PrivacyPolicyPage SHALL disclose Google Analytics as a third-party service in the third-party services section defined in Requirement 18, Acceptance Criterion 2(d).

---

## Cross-Cutting Notes

### SPA Head Management Strategy

Because CellSight is a single-page application with no server-side rendering, all `<head>` metadata is managed client-side by the `DocumentMeta_Hook`. The hook MUST:

1. Use `document.querySelector` to locate existing tags before creating new ones, to avoid duplicates.
2. Remove or replace stale tags when the component using the hook unmounts or re-renders with new parameters.
3. Set the canonical `<link rel="canonical">` tag on each route to the absolute URL of that route.

### Static File Placement

The following files MUST be placed in `frontend/public/` and are NOT part of the React component tree:

- `robots.txt` (Requirement 10)
- `og-default.png` (Requirement 13)
- `sitemap.xml` (referenced in robots.txt — generation is in scope for the design phase)

Because `vercel.json` contains a catch-all rewrite (`"source": "/(.*)", "destination": "/index.html"`), any file placed in `frontend/public/` is served as a static asset before the rewrite fires, which is the correct behaviour for robots.txt and OG images.

### Accessibility Baseline

All new UI components MUST meet WCAG 2.1 Level AA. Requirements 2, 5, 7, 9, 15, and 16 each include specific accessibility acceptance criteria. Full validation requires manual testing with assistive technologies and expert accessibility review beyond what automated tooling can verify.

### Privacy and Analytics Consent

The Google Analytics integration (Requirement 19) and the Privacy Policy (Requirement 18) are coupled. The PrivacyPolicyPage MUST disclose GA4 tracking before GA is activated for all users. If a consent mechanism (cookie banner) is added in a subsequent feature, GA initialisation MUST be gated on consent. This requirements document does not specify a consent UI; that is deferred to a follow-on feature.
