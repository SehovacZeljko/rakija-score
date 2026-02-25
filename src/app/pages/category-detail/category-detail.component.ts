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

import { BottomNavComponent, NavItem } from '../../components/bottom-nav/bottom-nav.component';
import { HeaderComponent } from '../../components/header/header.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { AuthService } from '../../services/auth.service';
import { CategoryService } from '../../services/category.service';
import { SampleService } from '../../services/sample.service';
import { ScoreService } from '../../services/score.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-category-detail',
  imports: [HeaderComponent, BottomNavComponent, LoadingSpinnerComponent],
  templateUrl: './category-detail.component.html',
  styleUrl: './category-detail.component.scss',
})
export class CategoryDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly categoryService = inject(CategoryService);
  private readonly sampleService = inject(SampleService);
  private readonly scoreService = inject(ScoreService);

  private readonly categoryId = this.route.snapshot.paramMap.get('categoryId')!;

  readonly navItems: NavItem[] = [{ route: '/dashboard', label: 'Početna', icon: 'home' }];

  private readonly uid$ = this.authService.currentUser$.pipe(
    filter((u): u is User => u !== null),
    map((u) => u.userId),
    distinctUntilChanged(),
    shareReplay(1),
  );

  private readonly category$ = this.categoryService
    .getCategoriesByIds([this.categoryId])
    .pipe(map((cats) => cats[0] ?? null));

  readonly category = toSignal(this.category$, { initialValue: null });

  private readonly assignment$ = this.uid$.pipe(
    switchMap((uid) => this.categoryService.getJudgeAssignments(uid)),
    map((assignments) => assignments.find((a) => a.categoryId === this.categoryId) ?? null),
  );

  readonly assignment = toSignal(this.assignment$, { initialValue: null });

  readonly isLocked = computed(() => this.assignment()?.status === 'finished');

  private readonly samples$ = this.sampleService
    .getSamplesForCategory(this.categoryId)
    .pipe(shareReplay(1));

  readonly samples = toSignal(this.samples$, { initialValue: [] });

  readonly dataReady = toSignal(
    this.samples$.pipe(take(1), map(() => true)),
    { initialValue: false },
  );

  private readonly scores$ = combineLatest([this.uid$, this.samples$]).pipe(
    switchMap(([uid, samples]) => {
      if (samples.length === 0) return of([]);
      const docIds = samples.map((s) => `${uid}_${s.sampleId}`);
      return this.scoreService.getScoresByDocIds(docIds);
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
    const scoredIds = this.scoredSampleIds();
    return samples.every((s) => scoredIds.has(s.sampleId));
  });

  readonly isLocking = signal(false);

  async lockCategory(): Promise<void> {
    const uid = this.authService.currentUser()?.userId;
    if (!uid) return;
    this.isLocking.set(true);
    try {
      await this.categoryService.lockCategory(uid, this.categoryId);
    } finally {
      this.isLocking.set(false);
    }
  }

  navigateToScoring(sampleId: string): void {
    this.router.navigate(['/scoring', this.categoryId, sampleId]);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
