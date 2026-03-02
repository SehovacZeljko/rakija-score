import { Component, computed, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  of,
  shareReplay,
  switchMap,
  take,
} from 'rxjs';

import { ActiveFestivalBannerComponent } from '../../components/active-festival-banner/active-festival-banner.component';
import { BottomNavComponent, NavItem } from '../../components/bottom-nav/bottom-nav.component';
import { CategoryCarouselComponent } from '../../components/category-carousel/category-carousel.component';
import { HeaderComponent } from '../../components/header/header.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { AuthService } from '../../services/auth.service';
import { CategoryService } from '../../services/category.service';
import { FestivalContextService } from '../../services/festival-context.service';
import { SampleService } from '../../services/sample.service';
import { ScoreService } from '../../services/score.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-category-detail',
  imports: [
    HeaderComponent,
    BottomNavComponent,
    LoadingSpinnerComponent,
    ActiveFestivalBannerComponent,
    CategoryCarouselComponent,
  ],
  templateUrl: './category-detail.component.html',
  styleUrl: './category-detail.component.scss',
})
export class CategoryDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly categoryService = inject(CategoryService);
  private readonly ctx = inject(FestivalContextService);
  private readonly sampleService = inject(SampleService);
  private readonly scoreService = inject(ScoreService);

  readonly navItems: NavItem[] = [{ route: '/dashboard', label: 'Početna', icon: 'home' }];

  private readonly uid$ = this.authService.currentUser$.pipe(
    filter((u): u is User => u !== null),
    map((u) => u.userId),
    distinctUntilChanged(),
    shareReplay(1),
  );

  // ── Reactive category ID ─────────────────────────────────────────────────
  //
  // Angular reuses the same component instance when navigating between
  // /category/abc and /category/def (same route config). Reading the param
  // from route.snapshot only once would leave all streams pointing at the
  // original category. Subscribing to paramMap makes the param reactive so
  // everything updates whenever the route changes.

  private readonly categoryId$ = this.route.paramMap.pipe(
    map((params) => params.get('categoryId')!),
    distinctUntilChanged(),
    shareReplay(1),
  );

  readonly categoryId = toSignal(this.categoryId$, {
    initialValue: this.route.snapshot.paramMap.get('categoryId')!,
  });

  // ── All assigned-category data (shared between carousel and per-category) ─

  private readonly allAssignments$ = this.uid$.pipe(
    switchMap((uid) => this.categoryService.getJudgeAssignments(uid)),
    shareReplay(1),
  );

  readonly allAssignments = toSignal(this.allAssignments$, { initialValue: [] });

  private readonly allCategoryIds$ = this.allAssignments$.pipe(
    map((assignments) => assignments.map((a) => a.categoryId)),
    distinctUntilChanged(
      (prev, curr) =>
        JSON.stringify([...prev].sort()) === JSON.stringify([...curr].sort()),
    ),
  );

  private readonly allCategories$ = this.allCategoryIds$.pipe(
    switchMap((ids) => (ids.length ? this.categoryService.getCategoriesByIds(ids) : of([]))),
    shareReplay(1),
  );

  readonly allCategories = toSignal(this.allCategories$, { initialValue: [] });

  private readonly allSamples$ = this.allCategoryIds$.pipe(
    switchMap((ids) => (ids.length ? this.sampleService.getSamplesForCategories(ids) : of([]))),
    shareReplay(1),
  );

  readonly allSamples = toSignal(this.allSamples$, { initialValue: [] });

  private readonly allScores$ = this.uid$.pipe(
    switchMap((uid) => this.scoreService.getScoresForJudge(uid)),
    shareReplay(1),
  );

  readonly allScores = toSignal(this.allScores$, { initialValue: [] });

  // ── Per-category data (filtered from all-data using reactive categoryId) ──

  private readonly category$ = combineLatest([this.allCategories$, this.categoryId$]).pipe(
    map(([cats, id]) => cats.find((c) => c.categoryId === id) ?? null),
  );

  readonly category = toSignal(this.category$, { initialValue: null });

  private readonly assignment$ = combineLatest([this.allAssignments$, this.categoryId$]).pipe(
    map(([assignments, id]) => assignments.find((a) => a.categoryId === id) ?? null),
  );

  readonly assignment = toSignal(this.assignment$, { initialValue: null });

  readonly isLocked = computed(() => this.assignment()?.status === 'finished');

  private readonly samples$ = combineLatest([this.allSamples$, this.categoryId$]).pipe(
    map(([samples, id]) => samples.filter((s) => s.categoryId === id)),
    shareReplay(1),
  );

  readonly samples = toSignal(this.samples$, { initialValue: [] });

  readonly dataReady = toSignal(
    this.samples$.pipe(take(1), map(() => true)),
    { initialValue: false },
  );

  private readonly scores$ = combineLatest([this.allScores$, this.samples$]).pipe(
    map(([scores, samples]) => {
      const sampleIds = new Set(samples.map((s) => s.sampleId));
      return scores.filter((score) => sampleIds.has(score.sampleId));
    }),
    shareReplay(1),
  );

  readonly scores = toSignal(this.scores$, { initialValue: [] });

  private readonly scoredSampleIds = computed(() => new Set(this.scores().map((s) => s.sampleId)));

  readonly scoreMap = computed(() => {
    const map = new Map<string, number>();
    for (const score of this.scores()) {
      const total = score.color + score.clarity + score.typicality + score.aroma + score.taste;
      map.set(score.sampleId, Math.round(total * 100) / 100);
    }
    return map;
  });

  readonly isAllScored = computed(() => {
    const samples = this.samples();
    if (samples.length === 0) return false;
    return samples.every((s) => this.scoredSampleIds().has(s.sampleId));
  });

  readonly isLocking = signal(false);

  // ── Carousel category cards ────────────────────────────────────────────────

  private readonly sampleCountMap = computed(() => {
    const map = new Map<string, number>();
    for (const sample of this.allSamples()) {
      map.set(sample.categoryId, (map.get(sample.categoryId) ?? 0) + 1);
    }
    return map;
  });

  private readonly scoreCountMap = computed(() => {
    const scoredSampleIds = new Set(this.allScores().map((score) => score.sampleId));
    const map = new Map<string, number>();
    for (const sample of this.allSamples()) {
      if (scoredSampleIds.has(sample.sampleId)) {
        map.set(sample.categoryId, (map.get(sample.categoryId) ?? 0) + 1);
      }
    }
    return map;
  });

  private readonly assignmentStatusMap = computed(
    () => new Map(this.allAssignments().map((a) => [a.categoryId, a.status])),
  );

  readonly categoryCards = computed(() => {
    const eventId = this.ctx.activeEvent()?.eventId;
    if (!eventId) return [];
    return this.allCategories()
      .filter((cat) => cat.eventId === eventId)
      .map((cat) => ({
        categoryId: cat.categoryId,
        name: cat.name,
        sampleCount: this.sampleCountMap().get(cat.categoryId) ?? 0,
        scoredCount: this.scoreCountMap().get(cat.categoryId) ?? 0,
        isLocked: this.assignmentStatusMap().get(cat.categoryId) === 'finished',
      }));
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  async lockCategory(): Promise<void> {
    const uid = this.authService.currentUser()?.userId;
    if (!uid) return;
    this.isLocking.set(true);
    try {
      await this.categoryService.lockCategory(uid, this.categoryId());
    } finally {
      this.isLocking.set(false);
    }
  }

  navigateToScoring(sampleId: string): void {
    this.router.navigate(['/scoring', this.categoryId(), sampleId]);
  }

  onCategoryClick(categoryId: string): void {
    if (categoryId !== this.categoryId()) {
      this.router.navigate(['/category', categoryId]);
    }
  }
}
