# CLAUDE.md — Rakija Festival Judging App

## Project Overview

A mobile-first web application for digitizing the judging process at the **International Rakija Festivals**. Judges use the app to score rakija samples across standardized criteria. An admin panel (same app, protected routes) handles festival setup, category management, sample registration, and judge assignments.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | Angular v19 |
| Component Architecture | Standalone Components (no NgModule) |
| Styling | SCSS + Tailwind CSS |
| State Management | Angular Signals + Services |
| Backend / Database | Firebase Firestore |
| Authentication | Firebase Auth (email/password) |
| Code Formatting | Prettier |

---

## Folder Structure

```
src/
└── app/
    ├── components/       # Reusable UI components (shared across pages)
    ├── config/           # Firebase configuration, environment references
    ├── guards/           # Route guards (AuthGuard, AdminGuard)
    ├── helpers/          # Utility functions and helper methods
    ├── pages/            # Full page/route components
    │   ├── login/
    │   ├── register/
    │   ├── forgot-password/
    │   ├── reset-password/   # Custom password reset form (oobCode from email link)
    │   ├── dashboard/        # Categories dashboard (judge view)
    │   ├── category-detail/  # Samples list within a category
    │   ├── scoring/          # Scoring form for a single sample
    │   └── admin/            # Admin panel pages
    ├── pipes/            # Custom Angular pipes
    ├── resolvers/        # Route resolvers
    ├── services/         # Business logic, Firestore data access
    ├── models/           # TypeScript interfaces and models (one file per entity)
    └── shared/           # App-wide constants
```

> **Decision:** Models and interfaces are located in `src/app/models/` — one file per entity (e.g., `festival.model.ts`, `score.model.ts`).

---

## Naming Conventions

Follow **strict Angular CLI conventions** throughout the entire project.

- **Files:** `kebab-case` — e.g., `auth.guard.ts`, `scoring.service.ts`, `category-detail.component.ts`
- **Classes:** `PascalCase` — e.g., `AuthGuard`, `ScoringService`, `CategoryDetailComponent`
- **Interfaces:** `PascalCase` with `I` prefix optional — e.g., `Sample`, `Category`, `JudgeAssignment`
- **Constants:** `UPPER_SNAKE_CASE` — e.g., `MAX_SCORE`, `SCORE_STEP`
- **Signals:** `camelCase` with descriptive names — e.g., `categoriesSignal`, `currentSample`
- **Observables:** `camelCase` with `$` suffix — e.g., `categories$`, `auth$`

---

## Routing & Access Control

Two route guards protect access:

- **`AuthGuard`** — allows only authenticated users (judges and admins). Redirects unauthenticated users to `/login`.
- **`AdminGuard`** — allows only users with the `admin` role. Redirects unauthorized users to the judge dashboard.

### Route Structure

```
/login                         → LoginPage (public)
/register                      → RegisterPage (public)
/forgot-password               → ForgotPasswordPage (public)
/reset-password                → ResetPasswordPage (public, oobCode via query param)
/dashboard                     → DashboardPage (AuthGuard)
/category/:categoryId          → CategoryDetailPage (AuthGuard)
/scoring/:categoryId/:sampleId → ScoringPage (AuthGuard)
/admin                         → AdminLayout (AuthGuard + AdminGuard)
/admin/festivals               → Admin: Festival management
/admin/categories              → Admin: Category management
/admin/producers               → Admin: Producer management
/admin/samples                 → Admin: Sample management
/admin/judges                  → Admin: Judge management & assignments
```

---

## Application Flow (Judge)

### 1. Register (`/register`)
- Username, email, and password fields; Serbian labels ("Korisničko ime", "Email adresa", "Lozinka")
- On success: creates Firebase Auth user + writes `users/{uid}` Firestore doc with `username`, `email`, and `role: 'judge'`
- Redirects to `/login` after successful registration
- Link to `/login` for users who already have an account
- New accounts have no category assignments until an admin assigns them — dashboard will show empty state

### 2. Login (`/login`)
- Email/password login via Firebase Auth
- On success → redirect to `/dashboard`
- On failure → display inline error message
- Link to `/register` for new users
- Link to `/forgot-password` for password recovery

### 3. Forgot Password (`/forgot-password`)
- Single email field; Serbian label ("Email adresa")
- Calls Firebase `sendPasswordResetEmail()` — Firebase sends the reset link pointing to the app's custom `/reset-password` page
- On success → shows confirmation message ("Link za resetovanje lozinke je poslat na vašu email adresu") and link back to `/login`
- On error → inline error (e.g., email not found)
- **Firebase Console setup required:** Authentication → Templates → Password reset → Customize action URL → set to `{appDomain}/reset-password`

### 3a. Reset Password (`/reset-password`)
- Reached via the link in the Firebase password reset email; `oobCode` arrives as a URL query param
- On init: calls `verifyPasswordResetCode(oobCode)` to validate the code and retrieve the associated email
- If code is invalid or expired → shows error state with link to `/forgot-password` ("Zatražite novi link")
- Form: new password + confirm password fields; Serbian labels ("Nova lozinka", "Potvrdi lozinku")
- On submit: calls `confirmPasswordReset(oobCode, newPassword)`
- On success: shows confirmation ("Lozinka je uspješno promijenjena") + link to `/login`
- On error: inline error ("Link je istekao ili je već iskorišten. Zatražite novi.")

### 4. Categories Dashboard (`/dashboard`)
- Displays all categories assigned to the logged-in judge
- Each category card shows:
  - Category name
  - Scored / Total samples count (e.g., `24 / 38`)
  - Locked status indicator (lock icon when judge has locked the category)
- Festival year and judge name displayed in header

### 5. Category Detail (`/category/:categoryId`)
- Grid of sample cards for the selected category
- Each sample card shows:
  - Sequential number
  - Sample code (e.g., `1034`)
  - Score (green if scored, red/orange if unscored — `0.00`)
  - Status icon
- **Lock Category button** — visible always, active only when **all samples are scored**
- Clicking a sample card navigates to the scoring form
- Already-scored samples can be re-edited **until the category is locked**

### 6. Scoring Form (`/scoring/:categoryId/:sampleId`)
- Displays sample info: code, category, year, alcohol strength
- Scoring criteria with individual controls:

| Criterion | Serbian Label | Default | Max |
|---|---|---|---|
| Color | Boja | 1.00 | 1.00 |
| Clarity | Bistrina | 1.00 | 1.00 |
| Typicality | Tipičnost | 2.00 | 2.00 |
| Aroma | Miris | 5.00 | 5.00 |
| Taste | Ukus | 8.00 | 8.00 |

- Each criterion has `−` and `+` buttons that adjust the value by **±0.05**
- Preset quick-select values: `1`, `1`, `2`, `5`, `8`
- **Total score** displayed live (max **17.00 points**)
- Optional comment/description field (`Opis`)
- **SAVE button** — saves score to Firestore, navigates back to category detail

---

## Application Flow (Admin)

Admin panel is accessible via the same Angular app under `/admin` routes, protected by `AdminGuard`.

Core admin responsibilities:
- Create and manage festivals (only **one active festival** at a time)
- Manage categories (create, edit — deletion restricted once judging begins)
- Register producers of beverages
- Register samples and assign them to categories
- Search all self-registered users and assign them to specific categories of the active festival

---

## Business Rules

1. **One active festival at a time** — the system enforces a single active festival globally.
2. **Self-registration is open** — any user can register via `/register`; new accounts are automatically assigned `role: 'judge'`.
3. **Admins do not create user accounts** — user management in the admin panel is limited to browsing registered users and assigning them to categories.
4. **Judge assignments are per category** — a judge only sees categories they are assigned to, not all categories. A newly registered judge sees an empty dashboard until an admin assigns them.
5. **Category locking** — a judge can lock a category only after scoring **all** samples in that category. Locking is per-judge, not global.
6. **No edits after lock** — once a judge locks a category, no score modifications are allowed for that judge.
7. **Score range** — each criterion has a defined minimum and maximum. The `−` button must not go below the minimum; `+` must not exceed the maximum.
8. **Score step** — all adjustments are in increments of **0.05**.
9. **Category deletion** — categories cannot be deleted after judging has started (at least one score exists).
10. **Score calculation** — total score is always **calculated on the fly** from individual criteria values, never stored as a pre-computed sum (to avoid inconsistency).

---

## Firebase / Firestore

- Use **AngularFire** library for Firestore and Auth integration
- All Firestore access goes through **dedicated service classes** — components never call Firestore directly
- Use **compound document IDs** where appropriate for uniqueness (e.g., `judgeId_categoryId`)
- Prefer **calculated values over stored counters** to maintain data integrity
- Firestore **security rules** must enforce role-based access (judges can only read/write their own scores)

> **Offline support:** Not yet decided. If enabled later, use Firestore's built-in offline persistence (`enableIndexedDbPersistence`). Add as a feature flag in `config/`.

---
## Collections and their fields:

- festivals → festivalId, name, status (active|inactive), createdAt
- users → userId, username, email, role (admin|judge), createdAt
- producers → producerId, name, contactPerson, email, phone, address, region, country, createdAt
- events → eventId, festivalId (FK), name, year, status, closedAt, createdAt
- categories → categoryId, eventId (FK), name, status (active|inactive), createdAt
- judgeAssignments → assignmentId, judgeId (FK), categoryId (FK), status (active|finished) →  document ID should be {judgeId}_{categoryId}

- samples → sampleId, producerId (FK), categoryId (FK), sampleCode, year, alcoholStrength, order, createdAt
- scores → scoreId, judgeId (FK), sampleId (FK), color, clarity, typicality, aroma, taste, comment, scoredAt, updatedAt  →  document ID should be {judgeId}_{sampleId}

## State Management

- Use **Angular Signals** for reactive UI state (e.g., current score values, loading states, form state)
- Use **Services** for shared application state and Firestore data access
- Avoid NgRx unless complexity justifies it — keep it simple
- Services expose data as **Signals or Observables** depending on use case:
  - Signals → local/component UI state
  - Observables → Firestore real-time streams

---

## Styling Guidelines

- **Mobile-first** — design for phone screens first (minimum 375px), then scale up
- **Prefer Tailwind utility classes for all styling** — use them for layout, spacing, typography, colors, borders, shadows, states (hover, focus, disabled), and responsive variants whenever possible
- Only use **SCSS** when Tailwind genuinely cannot handle the case cleanly: complex pseudo-element rules, custom keyframe animations, deeply nested overrides of third-party components, or browser-specific hacks
- **Never write a CSS/SCSS rule if a Tailwind utility class can do the same job**
- Keep component styles scoped — use Angular's `ViewEncapsulation` defaults

---

## Design Tokens & Color System

All colors below must be registered in `tailwind.config.js` under `theme.extend.colors` and as CSS custom properties in `styles.scss` so they are available both as Tailwind classes and SCSS variables.

### Brand Colors

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#3D1A24` | Header bar, active category cards, primary buttons, logo background |
| `primary-dark` | `#2A1019` | Hover/pressed state on primary elements, shadows |
| `primary-light` | `#5C2535` | Lighter variant for borders, subtle highlights on dark surfaces |
| `accent` | `#C8D93A` | Slider thumbs, FAB button, score indicators, active tab dot |
| `accent-hover` | `#A8B82A` | Hover state on accent elements |

### Background & Surface Colors

| Token | Hex | Usage |
|---|---|---|
| `bg-app` | `#F5F0EB` | Main app background (warm off-white, not pure white) |
| `bg-card` | `#FFFFFF` | Sample cards, content panels, modals |
| `bg-surface` | `#F0EBE5` | Input backgrounds, secondary surfaces, inactive states |
| `bg-header` | `#3D1A24` | Top navigation bar (same as primary) |

### Text Colors

| Token | Hex | Usage |
|---|---|---|
| `text-primary` | `#1A1A1A` | Headings, main body content |
| `text-secondary` | `#6B6B6B` | Subtitles, metadata, field labels |
| `text-muted` | `#9CA3AF` | Placeholders, hints, disabled text |
| `text-on-primary` | `#FFFFFF` | Text placed on dark primary backgrounds |
| `text-on-accent` | `#1A1A1A` | Text placed on accent (yellow-green) backgrounds |

### Semantic / Status Colors

| Token | Hex | Usage |
|---|---|---|
| `status-success` | `#22C55E` | "Ready to judge" dot, completed checkmarks, scored indicators |
| `status-pending` | `#F59E0B` | Pending evaluation, partial progress |
| `status-error` | `#EF4444` | Errors, validation failures, unscored warnings |
| `status-info` | `#3B82F6` | Informational indicators (e.g., remaining count) |
| `status-locked` | `#6B6B6B` | Locked category indicator |

### Border & Divider Colors

| Token | Hex | Usage |
|---|---|---|
| `border-default` | `#E5DDD5` | Card borders, dividers, input outlines |
| `border-focus` | `#3D1A24` | Input focus ring (primary color) |

---

## Typography

- **Font family:** `Inter` (Google Fonts) — load via `index.html`
- **Fallback stack:** `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

| Role | Weight | Size (mobile) | Usage |
|---|---|---|---|
| Page title | 700 | `24px` | "Ready to judge?", page headings |
| Section heading | 600 | `18px` | "Categories", "Samples: Šljivovica" |
| Card title | 600 | `16px` | Category name, sample code |
| Body | 400 | `14px` | Descriptions, metadata, labels |
| Caption / Label | 500 | `12px` | "POOR / EXCELLENT", status chips, uppercase labels |
| Score value | 700 | `16px` | Score numbers displayed next to criteria |

Letter spacing for uppercase labels (captions): `0.05em`

---

## Component Style Patterns

### Cards
- Background: `bg-card` (`#FFFFFF`)
- Border radius: `12px`
- Box shadow: `0 1px 4px rgba(0,0,0,0.08)`
- Padding: `16px`

### Active / Selected Category Card
- Background: `primary` (`#3D1A24`)
- Text: `text-on-primary` (`#FFFFFF`)
- Border radius: `12px`

### Primary Button (e.g., Submit Evaluation)
- Background: `primary` (`#3D1A24`)
- Text: `#FFFFFF`, weight `600`
- Border radius: `10px`
- Padding: `14px 24px`
- Hover: `primary-dark` (`#2A1019`)

### FAB Button (center nav)
- Background: `accent` (`#C8D93A`)
- Icon color: `#1A1A1A`
- Shape: circle, `56px`
- Shadow: `0 4px 12px rgba(200,217,58,0.4)`

### Sliders (Scoring Criteria)
- Track color (inactive): `#E5DDD5`
- Track color (active/filled): `accent` (`#C8D93A`)
- Thumb: `accent` (`#C8D93A`), `20px` circle, with subtle shadow

### Status Chips / Badges
- "ACTIVE" chip: `accent` background, `text-on-accent` text, `6px` border radius, uppercase, `11px` font
- "3/12 Judged" badge: `bg-surface` background, `text-secondary` text, `20px` border radius

### Bottom Navigation Bar
- Background: `#FFFFFF`
- Border top: `1px solid #E5DDD5`
- Active icon/label: `primary` (`#3D1A24`)
- Inactive icon/label: `text-muted` (`#9CA3AF`)
- Active tab indicator: small `accent` dot above icon

---

## Barcode Scanning

**Deferred to a later version.** When implemented, use `@zxing/ngx-scanner`. The feature should allow scanning a bottle barcode to directly open the scoring form for that sample, eliminating manual selection errors.

---

## Code Style & Formatting

- **Prettier** is configured for consistent formatting — run before committing
- Follow Angular style guide for all component, service, and standalone structure
- TypeScript: **standard mode** (strict mode, `strictNullChecks` enforced)
- Keep components **thin** — move business logic to services
- Use `async` pipe in templates instead of manual subscription management where possible
- **Prefer `async/await` over `.then()` chains** for all Promise-based code — more readable, easier to add `try/catch`, and consistent across the codebase

---

## Key Commands

```bash
# Install dependencies
npm install

# Start development server
ng serve

# Build for production
ng build --configuration production

# Format code
npx prettier --write .

# Generate component (example)
ng generate component pages/dashboard

# Generate service (example)
ng generate service services/scoring
```

---

## Notes for Claude Code

- Always check this file before writing any code
- Never call Firestore directly from a component — always go through a service
- When generating a new page, create it under `pages/` and add it to the route config in `app.routes.ts` — all components are standalone, no NgModule registration needed
- When adding a new constant (scoring criteria, limits, step values), add it to `shared/` — never hardcode values in components
- If models/interfaces location has been decided, update the **TBD note** in the Folder Structure section above
- Mobile-first always — test layouts at 375px width minimum
- **Tailwind first** — always reach for a Tailwind utility class before writing any SCSS; only fall back to SCSS for things Tailwind genuinely cannot express
- The app UI language is **Serbian** (labels, buttons, field names) but all code, comments, and this file are in **English**
- **Always use separate files for components** — never use inline `template` or `styles` in `@Component`. Every component must have its own `.html` and `.scss` file referenced via `templateUrl` and `styleUrl`. Use the Angular CLI (`ng generate component`) to scaffold components correctly.
- **Max-width container standard** — all page content is constrained to `max-w-5xl` via the `app.component.html` wrapper. Fixed elements (header, bottom-nav) are outside the document flow, so they need their own inner wrapper: `<div class="mx-auto w-full max-w-5xl ...">`. Always use `mx-auto w-full max-w-5xl` for any element that needs to match this constraint.