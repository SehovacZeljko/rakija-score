import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, filter, map, of, shareReplay, switchMap } from 'rxjs';

import { ActiveFestivalBannerComponent } from '../../components/active-festival-banner/active-festival-banner.component';
import { BottomNavComponent, NavItem } from '../../components/bottom-nav/bottom-nav.component';
import { HeaderComponent } from '../../components/header/header.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { User } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { CategoryService } from '../../services/category.service';
import { FestivalContextService } from '../../services/festival-context.service';
import { SampleService } from '../../services/sample.service';
import { ScoreService } from '../../services/score.service';

@Component({
  selector: 'app-dashboard',
  imports: [HeaderComponent, BottomNavComponent, LoadingSpinnerComponent, ActiveFestivalBannerComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly categoryService = inject(CategoryService);
  private readonly ctx = inject(FestivalContextService);
  private readonly sampleService = inject(SampleService);
  private readonly scoreService = inject(ScoreService);
  readonly router = inject(Router);

  readonly navItems: NavItem[] = [{ route: '/dashboard', label: 'Početna', icon: 'home' }];

  readonly currentUser = this.authService.currentUser;
  readonly activeFestival = this.ctx.activeFestival;
  readonly activeEvent = this.ctx.activeEvent;
  readonly dataReady = this.ctx.dataReady;

  private readonly uid$ = this.authService.currentUser$.pipe(
    filter((u): u is User => u !== null),
    map((u) => u.userId),
    distinctUntilChanged(),
    shareReplay(1),
  );

  private readonly assignments$ = this.uid$.pipe(
    switchMap((uid) => this.categoryService.getJudgeAssignments(uid)),
    shareReplay(1),
  );

  readonly assignments = toSignal(this.assignments$, { initialValue: [] });

  private readonly categoryIds$ = this.assignments$.pipe(
    map((a) => a.map((x) => x.categoryId)),
    distinctUntilChanged((a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())),
  );

  private readonly categories$ = this.categoryIds$.pipe(
    switchMap((ids) => (ids.length ? this.categoryService.getCategoriesByIds(ids) : of([]))),
    shareReplay(1),
  );

  readonly categories = toSignal(this.categories$, { initialValue: [] });

  private readonly samples$ = this.categoryIds$.pipe(
    switchMap((ids) => (ids.length ? this.sampleService.getSamplesForCategories(ids) : of([]))),
    shareReplay(1),
  );

  readonly samples = toSignal(this.samples$, { initialValue: [] });

  private readonly scores$ = this.uid$.pipe(
    switchMap((uid) => this.scoreService.getScoresForJudge(uid)),
    shareReplay(1),
  );

  readonly scores = toSignal(this.scores$, { initialValue: [] });

  private readonly sampleCountMap = computed(() => {
    const map = new Map<string, number>();
    for (const s of this.samples()) {
      map.set(s.categoryId, (map.get(s.categoryId) ?? 0) + 1);
    }
    return map;
  });

  private readonly scoreCountMap = computed(() => {
    const scoredSampleIds = new Set(this.scores().map((s) => s.sampleId));
    const map = new Map<string, number>();
    for (const s of this.samples()) {
      if (scoredSampleIds.has(s.sampleId)) {
        map.set(s.categoryId, (map.get(s.categoryId) ?? 0) + 1);
      }
    }
    return map;
  });

  private readonly assignmentStatusMap = computed(
    () => new Map(this.assignments().map((a) => [a.categoryId, a.status])),
  );

  readonly categoryCards = computed(() => {
    const eventId = this.ctx.activeEvent()?.eventId;
    if (!eventId) return [];
    return this.categories()
      .filter((cat) => cat.eventId === eventId)
      .map((cat) => ({
        ...cat,
        sampleCount: this.sampleCountMap().get(cat.categoryId) ?? 0,
        scoredCount: this.scoreCountMap().get(cat.categoryId) ?? 0,
        isLocked: this.assignmentStatusMap().get(cat.categoryId) === 'finished',
      }));
  });

  navigateToCategory(categoryId: string): void {
    this.router.navigate(['/category', categoryId]);
  }
}
