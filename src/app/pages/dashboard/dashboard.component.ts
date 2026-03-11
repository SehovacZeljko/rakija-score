import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, filter, map, of, shareReplay, switchMap } from 'rxjs';

import { LucideAngularModule } from 'lucide-angular';

import { ActiveFestivalBannerComponent } from '../../components/active-festival-banner/active-festival-banner.component';
import { BottomNavComponent, NavItem } from '../../components/bottom-nav/bottom-nav.component';
import { HeaderComponent } from '../../components/header/header.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { User } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { BarcodeScanService } from '../../services/barcode-scan.service';
import { CategoryService } from '../../services/category.service';
import { FestivalContextService } from '../../services/festival-context.service';
import { SampleService } from '../../services/sample.service';
import { ScoreService } from '../../services/score.service';

@Component({
  selector: 'app-dashboard',
  imports: [HeaderComponent, BottomNavComponent, LoadingSpinnerComponent, ActiveFestivalBannerComponent, LucideAngularModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly barcodeScanService = inject(BarcodeScanService);
  private readonly categoryService = inject(CategoryService);
  private readonly ctx = inject(FestivalContextService);
  private readonly sampleService = inject(SampleService);
  private readonly scoreService = inject(ScoreService);
  private readonly router = inject(Router);

  readonly navItems: NavItem[] = [{ route: '/dashboard', label: 'Početna', icon: 'home' }];

  readonly currentUser = this.authService.currentUser;
  readonly activeFestival = this.ctx.activeFestival;
  readonly activeEvent = this.ctx.activeEvent;
  readonly dataReady = this.ctx.dataReady;

  private readonly uid$ = this.authService.currentUser$.pipe(
    filter((user): user is User => user !== null),
    map((user) => user.userId),
    distinctUntilChanged(),
    shareReplay(1),
  );

  private readonly assignments$ = this.uid$.pipe(
    switchMap((uid) => this.categoryService.getJudgeAssignments(uid)),
    shareReplay(1),
  );

  readonly assignments = toSignal(this.assignments$, { initialValue: [] });

  private readonly categoryIds$ = this.assignments$.pipe(
    map((assignments) => assignments.map((assignment) => assignment.categoryId)),
    distinctUntilChanged(
      (prevIds, nextIds) =>
        JSON.stringify([...prevIds].sort()) === JSON.stringify([...nextIds].sort()),
    ),
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
    const countMap = new Map<string, number>();
    for (const sample of this.samples()) {
      countMap.set(sample.categoryId, (countMap.get(sample.categoryId) ?? 0) + 1);
    }
    return countMap;
  });

  private readonly scoreCountMap = computed(() => {
    const scoredSampleIds = new Set(this.scores().map((score) => score.sampleId));
    const countMap = new Map<string, number>();
    for (const sample of this.samples()) {
      if (scoredSampleIds.has(sample.sampleId)) {
        countMap.set(sample.categoryId, (countMap.get(sample.categoryId) ?? 0) + 1);
      }
    }
    return countMap;
  });

  private readonly assignmentStatusMap = computed(
    () => new Map(this.assignments().map((assignment) => [assignment.categoryId, assignment.status])),
  );

  readonly categoryCards = computed(() => {
    const eventId = this.ctx.activeEvent()?.eventId;
    if (!eventId) return [];
    return this.categories()
      .filter((category) => category.eventId === eventId)
      .map((category) => ({
        ...category,
        sampleCount: this.sampleCountMap().get(category.categoryId) ?? 0,
        scoredCount: this.scoreCountMap().get(category.categoryId) ?? 0,
        isLocked: this.assignmentStatusMap().get(category.categoryId) === 'finished',
      }));
  });

  navigateToCategory(categoryId: string): void {
    this.router.navigate(['/category', categoryId]);
  }

  openScanner(): void {
    const categoryIds = this.categoryCards().map((card) => card.categoryId);
    this.barcodeScanService.open(categoryIds);
  }
}
