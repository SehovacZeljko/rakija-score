# Rakija Score — Build Plan

## Context
The rakija-score project is a bare Angular 19 scaffold with no application code. This plan breaks the entire app into small, independently testable features that can be built and verified one at a time. The judge flow (login → dashboard → category detail → scoring) is the critical path; admin flows come after.

**Architecture decisions confirmed:**
- Standalone components (no NgModules) — keep existing scaffold
- TypeScript strict mode: ON (`"strict": true` in tsconfig.json)
- Update CLAUDE.md to reflect both of these decisions

---

## Phase 1 — Project Setup

### [x] 1.1 Install and Configure Tailwind CSS
**Files:** `tailwind.config.js`, `src/styles.scss`, `src/index.html`, `package.json`

- `npm install -D tailwindcss@3 postcss autoprefixer && npx tailwindcss init`
- `tailwind.config.js` content array: `./src/**/*.{html,ts,scss}`
- Register all design token colors under `theme.extend.colors` (primary, accent, bg-*, text-*, status-*, border-*)
- Add `@tailwind base/components/utilities` to top of `styles.scss`
- Add CSS custom properties + Inter font-family on `body` in `styles.scss`
- Add Google Fonts `<link>` for Inter (weights 400,500,600,700) to `index.html`

**Verify:** `ng serve` starts cleanly; `body` has Inter font and `#F5F0EB` background in DevTools.

---

### [x] 1.2 Install Firebase and AngularFire
**Files:** `src/app/config/firebase.config.ts`, `src/app/app.config.ts`, `package.json`

- `npm install firebase @angular/fire`
- Create `src/app/config/firebase.config.ts` exporting `firebaseConfig` object
- Add `provideFirebaseApp`, `provideFirestore`, `provideAuth` to `appConfig` in `app.config.ts`
- Use only standalone AngularFire providers (not NgModule-style)

**Verify:** `ng serve` has no console errors; Firebase project connectivity visible in DevTools Network tab.

---

### [x] 1.3 Configure Prettier
**Files:** `.prettierrc`, `.prettierignore`, `package.json`, `.vscode/settings.json`

- `npm install -D prettier`
- `.prettierrc`: singleQuote, semi, trailingComma: "all", printWidth: 100, tabWidth: 2
- `.prettierignore`: dist/, node_modules/, .angular/, *.md
- Add `"format": "npx prettier --write ."` script to package.json
- Add formatOnSave to VSCode settings

**Verify:** `npx prettier --check .` runs without config errors.

---

### [x] 1.4 Create Folder Structure, Models, and Constants
**Files:** `src/app/models/*.ts`, `src/app/shared/scoring.constants.ts`, `tsconfig.json`

- Set `"strict": false` in `tsconfig.json`
- Create `src/app/models/` with one interface file per entity:
  - `festival.model.ts`, `user.model.ts`, `producer.model.ts`, `event.model.ts`
  - `category.model.ts`, `judge-assignment.model.ts`, `sample.model.ts`, `score.model.ts`
- Use `Timestamp` from `@angular/fire/firestore` for date fields
- Compound IDs: `judgeAssignments` uses `{judgeId}_{categoryId}`; `scores` uses `{judgeId}_{sampleId}`
- Create `src/app/shared/scoring.constants.ts`:
  - `SCORE_STEP = 0.05`
  - `SCORING_CRITERIA` array with key, labelSr, defaultValue, max, min per criterion
  - `MAX_TOTAL_SCORE = 17.00`
- Create empty directories: `components/`, `guards/`, `helpers/`, `pages/`, `pipes/`, `resolvers/`, `services/`
- Update CLAUDE.md: change NgModule → Standalone; add "Models are in `src/app/models/`"

**Verify:** `ng build` compiles cleanly with no model import errors.

---

## Phase 2 — Auth Infrastructure

### [x] 2.1 AuthService
**File:** `src/app/services/auth.service.ts`

- Inject `Auth` (AngularFire) and `Firestore`
- `currentUser$: Observable<User | null>` — chains `authState()` → fetches `users/{uid}` Firestore doc
- `currentUser = toSignal(currentUser$)` — call `toSignal()` in constructor
- `isAuthenticated = computed(() => !!this.currentUser())`
- `login(email, password): Promise<void>` — calls `signInWithEmailAndPassword`
- `register(email, password, username): Promise<void>` — calls `createUserWithEmailAndPassword`, then writes `users/{uid}` doc with `{ username, email, role: 'judge', createdAt }`
- `resetPassword(email): Promise<void>` — calls `sendPasswordResetEmail`; Firebase handles the reset link and hosted reset UI
- `logout(): Promise<void>` — calls `signOut`, navigates to `/login`

**Verify:** `ng build` passes; inject into AppComponent and log currentUser$ — emits null.

---

### [x] 2.2 AuthGuard and AdminGuard
**Files:** `src/app/guards/auth.guard.ts`, `src/app/guards/admin.guard.ts`

- Functional guards (`CanActivateFn`) — Angular 19 standard, no class-based guards
- `authGuard`: reads `authService.isAuthenticated()` signal; redirects to `/login` if false
- `adminGuard`: reads `authService.currentUser()?.role`; redirects to `/dashboard` if not admin

**Verify:** `ng build` passes; guards importable.

---

### [ ] 2.3 Register Page
**Files:** `src/app/pages/register/register.component.ts`, `.html`, `.scss`

- Standalone component using `ReactiveFormsModule`
- Form: username, email, password fields; Serbian labels ("Korisničko ime", "Email adresa", "Lozinka")
- Signals: `isLoading`, `errorMessage`
- On submit: calls `authService.register()`, navigates to `/login` on success
- On error: display Serbian error message (e.g., "Email adresa je već u upotrebi")
- Mobile-first layout: same centered card style as login; link to `/login` ("Već imate nalog? Prijavite se")
- Add route: `{ path: 'register', loadComponent: ... }` in `app.routes.ts`

**Verify:** Visit `/register`; submit with a new email → user doc created in Firestore with `role: 'judge'`; duplicate email shows error; success navigates to `/login`.

---

### [ ] 2.4 Login Page
**Files:** `src/app/pages/login/login.component.ts`, `.html`, `.scss`, `src/app/app.routes.ts`

- Standalone component using `ReactiveFormsModule`
- Form: email + password fields, Serbian labels ("Email adresa", "Lozinka")
- Signals: `isLoading`, `errorMessage`
- On submit: calls `authService.login()`, navigates to `/dashboard` on success
- On error: sets Serbian error message ("Pogrešni podaci za prijavu")
- Mobile-first layout: centered card on `bg-bg-app`, primary button "Prijavi se"; link to `/register` ("Nemate nalog? Registrujte se"); link to `/forgot-password` ("Zaboravili ste lozinku?")
- Add route: `{ path: 'login', loadComponent: ... }` + default redirect

**Verify:** Visit `/login`; wrong credentials show error; correct credentials navigate to `/dashboard` (404 for now — expected).

---

### [x] 2.5 Forgot Password Page
**Files:** `src/app/pages/forgot-password/forgot-password.component.ts`, `.html`, `.scss`

- Standalone component using `ReactiveFormsModule`
- Form: single email field; Serbian label ("Email adresa")
- Signals: `isLoading`, `errorMessage`, `successMessage`
- On submit: calls `authService.resetPassword(email)`
- On success: hide form, show confirmation ("Link za resetovanje lozinke je poslat na vašu email adresu") + link back to `/login`
- On error: inline error message ("Korisnik sa ovom email adresom nije pronađen")
- Mobile-first layout: same centered card style as login; link to `/login` ("Nazad na prijavu")
- Add route: `{ path: 'forgot-password', loadComponent: ... }` in `app.routes.ts`
- **Firebase Console setup required:** Authentication → Templates → Password reset → Customize action URL → set to `{appDomain}/reset-password`

**Verify:** Enter registered email → success message shown; Firebase sends reset email whose link points to `/reset-password`.

---

### [x] 2.6 Reset Password Page
**Files:** `src/app/pages/reset-password/reset-password.component.ts`, `.html`, `.scss`

**AuthService additions:**
- `verifyResetCode(oobCode: string): Promise<string>` — wraps Firebase `verifyPasswordResetCode()`; returns email associated with the code
- `confirmPasswordReset(oobCode: string, newPassword: string): Promise<void>` — wraps Firebase `confirmPasswordReset()`

**ResetPasswordComponent:**
- Standalone component using `ReactiveFormsModule`
- Reads `oobCode` from URL query params via `ActivatedRoute` on init
- Signals: `isLoading`, `isVerifying`, `errorMessage`, `successMessage`, `associatedEmail`
- On init: calls `authService.verifyResetCode(oobCode)` → sets `associatedEmail`; if code invalid/expired → sets error state, form not shown
- Form: new password + confirm password fields; Serbian labels ("Nova lozinka", "Potvrdi lozinku"); client-side match validation
- On submit: calls `authService.confirmPasswordReset(oobCode, newPassword)`
- On success: show confirmation ("Lozinka je uspješno promijenjena") + link to `/login`
- On error: inline error ("Link je istekao ili je već iskorišten. Zatražite novi link.") + link to `/forgot-password`
- Mobile-first layout: same centered card style as login
- Add route: `{ path: 'reset-password', loadComponent: ... }` in `app.routes.ts`

**Verify:** Click email link → code verified, email shown, form visible; submit valid password → success + navigates to `/login`; expired/used link → error state with link to `/forgot-password`.

---

### [ ] 2.7 Register All Routes + Stub Pages
**Files:** `src/app/app.routes.ts`, stub components for all pages

Create stub components (single `<p>` template) for:
- `pages/dashboard/dashboard.component.ts`
- `pages/category-detail/category-detail.component.ts`
- `pages/scoring/scoring.component.ts`
- `pages/admin/admin-layout.component.ts`
- `pages/admin/festivals/admin-festivals.component.ts`
- `pages/admin/categories/admin-categories.component.ts`
- `pages/admin/producers/admin-producers.component.ts`
- `pages/admin/samples/admin-samples.component.ts`
- `pages/admin/judges/admin-judges.component.ts`

Wire full `app.routes.ts` with guards and lazy `loadComponent`:
```
/login            → LoginComponent (public)
/register         → RegisterComponent (public)
/forgot-password  → ForgotPasswordComponent (public)
/reset-password   → ResetPasswordComponent (public)
/dashboard        → DashboardComponent (authGuard)
/category/:id     → CategoryDetailComponent (authGuard)
/scoring/:cid/:sid → ScoringComponent (authGuard)
/admin            → AdminLayoutComponent (authGuard + adminGuard), children:
  /admin/festivals, /categories, /producers, /samples, /judges
```

**Verify:**
- Unauthenticated → `/dashboard` redirects to `/login`
- Authenticated judge → `/admin` redirects to `/dashboard`
- Authenticated admin → `/admin` renders stub

---

## Phase 3 — Shared Shell

### [ ] 3.1 Header and Bottom Navigation Components
**Files:** `src/app/components/header/`, `src/app/components/bottom-nav/`

**Header component:**
- `@Input() title: string`
- Shows judge username (from `authService.currentUser()`)
- Logout icon button (right) → calls `authService.logout()`
- Background `bg-primary`, text white, height 56px, fixed top

**Bottom navigation:**
- Fixed bottom, white background, `border-t border-border-default`
- Dashboard tab with home icon; uses `RouterLinkActive` for active state (primary color + accent dot)
- Height 60px

**Verify:** Import both into `DashboardComponent` stub — header shows judge name; logout works.

---

## Phase 4 — Judge Flow

### [ ] 4.1 FestivalService + CategoryService + Dashboard Page
**Files:** `src/app/services/festival.service.ts`, `src/app/services/category.service.ts`, `src/app/pages/dashboard/`

**FestivalService:**
- `getActiveFestival(): Observable<Festival | null>` — query `festivals` where `status == 'active'`, limit 1

**CategoryService:**
- `getAssignedCategories(judgeId): Observable<Category[]>` — fetch `judgeAssignments` where `judgeId == uid`, then fetch corresponding `categories` docs (use `switchMap` + batch `in` query)
- `getJudgeAssignments(judgeId): Observable<JudgeAssignment[]>`

**ScoreService (stub for count only):**
- `getScoreCountForCategory(judgeId, categoryId): Observable<number>`

**DashboardComponent (replace stub):**
- Loads assigned categories + sample counts + lock status in real-time
- Category card: name, "X / Y ocijenjeno", lock icon if `status == 'finished'`
- Tap → navigate to `/category/:categoryId`
- Header title: active festival year + "Sudija: {name}"

**Verify:** Log in as judge with assigned categories → correct categories shown with real-time counts.

---

### [ ] 4.2 SampleService + Category Detail Page
**Files:** `src/app/services/sample.service.ts`, `src/app/pages/category-detail/`

**SampleService:**
- `getSamplesForCategory(categoryId): Observable<Sample[]>` — ordered by `order` field

**CategoryService additions:**
- `lockCategory(judgeId, categoryId): Promise<void>` — updates `judgeAssignments/{judgeId}_{categoryId}` → `status: 'finished'`

**CategoryDetailComponent:**
- Loads samples + scores for this judge (via `ScoreService.getScoresForCategory`)
- `computed()` signal `isAllScored`: all samples have a score doc
- Grid layout `grid grid-cols-3 gap-3`; sample cards: code, score value (green if scored, red if 0.00)
- "Zaključaj kategoriju" button: disabled unless `isAllScored()`; on click calls `lockCategory()`
- After locking: button disabled, lock icon shown on all cards

**Verify:** Navigate to `/category/:id` → samples grid renders; lock button disabled until all scored; locking works.

---

### [ ] 4.3 ScoreService + Scoring Form Page
**Files:** `src/app/services/score.service.ts`, `src/app/pages/scoring/`

**ScoreService (full):**
- `getScore(judgeId, sampleId): Observable<Score | null>` — reads `scores/{judgeId}_{sampleId}`
- `saveScore(data): Promise<void>` — `setDoc` with merge on `scores/{judgeId}_{sampleId}`; sets `scoredAt` on first write, `updatedAt` always
- `getScoresForCategory(judgeId, categoryId): Observable<Score[]>`
- `getScoreCountForCategory(judgeId, categoryId): Observable<number>`

**ScoringComponent:**
Signals: `color(1.00)`, `clarity(1.00)`, `typicality(2.00)`, `aroma(5.00)`, `taste(8.00)`, `comment('')`, `isLoading`, `isSaving`, `isLocked`

```typescript
total = computed(() =>
  +((color() + clarity() + typicality() + aroma() + taste())).toFixed(2)
);
```

`adjust(key, delta)` — integer arithmetic to avoid float errors:
```typescript
const next = (Math.round(current * 100) + Math.round(delta * 100)) / 100;
this[key].set(Math.min(max, Math.max(min, next)));
```

On init: load existing score → pre-populate signals; check if category locked → set `isLocked`

Template per criterion: Serbian label | `−` button | value | `+` button (from `SCORING_CRITERIA` constant)
Total display, comment textarea, "Sačuvaj" button (disabled when `isSaving || isLocked`)
If `isLocked`: read-only banner "Kategorija je zaključana. Ocjena se ne može mijenjati."

**Verify:**
- Pre-populates existing score
- `+`/`−` respect min/max
- 20× adjust by 0.05 → clean values (no floating point drift)
- Save writes to Firestore, navigates back
- Locked category → read-only mode

---

## Phase 5 — Admin Flow

### [ ] 5.1 Admin Layout Shell
**File:** `src/app/pages/admin/admin-layout.component.ts`

- Tab bar (mobile): "Festivali", "Kategorije", "Producenti", "Uzorci", "Sudije"
- `RouterLinkActive` for active tab styling
- `<router-outlet>` for child pages
- Logout button accessible

**Verify:** Navigate between admin sub-routes; each renders its stub.

---

### [ ] 5.2 Admin: Festival Management
**Files:** `src/app/pages/admin/festivals/`, `src/app/services/festival.service.ts` (extend)

**FestivalService additions:**
- `getAllFestivals(): Observable<Festival[]>`
- `createFestival(name): Promise<void>` — creates with `status: 'inactive'`
- `setActiveFestival(festivalId): Promise<void>` — Firestore batch: deactivate all, activate one

**UI:** List with "AKTIVAN"/"NEAKTIVAN" chips; "Novi festival" button with name form; "Postavi aktivnim" per row.

**Verify:** Create two festivals; set one active → other becomes inactive atomically.

---

### [ ] 5.3 Admin: Category Management
**Files:** `src/app/pages/admin/categories/`, `src/app/services/event.service.ts` (new), extend `category.service.ts`

**EventService:** `getEventsForFestival`, `createEvent`

**CategoryService additions:**
- `createCategory(eventId, name): Promise<void>`
- `canDeleteCategory(categoryId): Promise<boolean>` — checks if any score exists for samples in this category
- `deleteCategory(categoryId): Promise<void>` — guards with `canDeleteCategory`

**UI:** Grouped by event; create category form per event; delete icon (blocks if scores exist).

**Verify:** Category with scores cannot be deleted; category without scores deletes cleanly.

---

### [ ] 5.4 Admin: Producer Management
**Files:** `src/app/pages/admin/producers/`, `src/app/services/producer.service.ts`

**ProducerService:** `getAllProducers`, `createProducer`, `updateProducer`

**UI:** Searchable list (client-side signal filter); "Novi producent" form with all fields; tap to edit.

**Verify:** Create, edit, search producers.

---

### [ ] 5.5 Admin: Sample Management
**Files:** `src/app/pages/admin/samples/`, extend `src/app/services/sample.service.ts`

**SampleService additions:** `getAllSamples`, `createSample`, `updateSample`

**UI:** Filter by category; list with producer name resolved; create form (producer dropdown, category dropdown, sampleCode, year, alcoholStrength, order).

**Verify:** Create sample; filter by category works.

---

### [ ] 5.6 Admin: Judge Management
**Files:** `src/app/pages/admin/judges/`, `src/app/services/user.service.ts`, extend `category.service.ts`

**UserService:** `getAllUsers(): Observable<User[]>` — reads all docs from `users` collection (admins do not create users; accounts are self-registered)

**CategoryService additions:**
- `assignJudgeToCategory(judgeId, categoryId): Promise<void>` — creates `judgeAssignments/{judgeId}_{categoryId}`
- `removeJudgeFromCategory(judgeId, categoryId): Promise<void>` — checks no scores exist first

**UI:** Searchable user list (client-side signal filter); each user shows username + email; category dropdown to select which category to assign; assign/unassign toggle per user. No user creation form — admins only work with already-registered accounts.

**Verify:** Assign judge → appears on judge's dashboard; unassign → disappears; can't unassign if scores exist.

---

## Phase 6 — Polish

### [ ] 6.1 Loading States and Toast Notifications
**Files:** `src/app/components/loading-spinner/`, `src/app/components/toast/`, `src/app/services/toast.service.ts`

**ToastService:** `toasts = signal([])`, `show(message, type)`, auto-dismiss after 3s
Wire `<app-toast>` into `AppComponent` template.
Add loading spinners to all data-fetching pages.

**Verify:** Throttle network in DevTools → spinner shows; save shows "Ocjena sačuvana" toast.

---

### [ ] 6.2 Firestore Security Rules
**File:** `firestore.rules`

- Authenticated reads for all collections
- Judge can only write/read own scores (ownership by `judgeId == request.auth.uid`)
- Admin writes to all collections
- Locking enforcement in Angular service layer (not rules) — document this decision

**Verify:** Deploy rules; test that judge cannot write to festivals collection.

---

### [ ] 6.3 Empty States
Update all pages with empty state messages (Serbian) for no-data scenarios:
- Dashboard: "Niste dodijeljeni nijednoj kategoriji"
- Category detail: "Nema uzoraka u ovoj kategoriji"
- All admin list pages: appropriate empty state

---

### [ ] 6.4 Production Build + Firebase Hosting (Optional)
**Files:** `firebase.json`, `.firebaserc`

- `firebase.json`: `"public": "dist/rakija-score/browser"`, rewrite all → `/index.html`
- Deploy: `ng build --configuration production && firebase deploy --only hosting`

**Verify:** Production URL loads app; refreshing a deep route doesn't 404.

---

## Critical Files

| File | Purpose |
|---|---|
| `src/app/app.config.ts` | AngularFire providers registered here |
| `src/app/app.routes.ts` | All route definitions and guard assignments |
| `src/app/shared/scoring.constants.ts` | Single source of truth for scoring criteria |
| `src/styles.scss` | Tailwind directives + CSS custom properties + global font |
| `tailwind.config.js` | Design token colors |
| `tsconfig.json` | Set `"strict": true` in Feature 1.4 |
| `CLAUDE.md` | Update: standalone arch, models location, strict mode ON |

---

## Key Implementation Rules (Apply Everywhere)

1. **Float arithmetic:** Always use `Math.round(val * 100) / 100` for score adjustments — never raw `+`
2. **Compound IDs:** Access `scores/{judgeId}_{sampleId}` and `judgeAssignments/{judgeId}_{categoryId}` by ID directly, don't query by fields
3. **toSignal() placement:** Must be called in constructor (injection context) — never in ngOnInit
4. **Firestore in components:** Never — always go through a service
5. **Locking enforcement:** Check `judgeAssignments.status` in service before `saveScore()` — rules only enforce ownership
