import { Component, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { LucideAngularModule } from 'lucide-angular';

import { HeaderComponent } from '../../components/header/header.component';
import { InlineSpinnerComponent } from '../../components/inline-spinner/inline-spinner.component';
import { LoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner.component';
import { AuthService } from '../../services/auth.service';
import { CategoryService } from '../../services/category.service';
import { FestivalContextService } from '../../services/festival-context.service';
import { SampleService } from '../../services/sample.service';
import { ScoreService } from '../../services/score.service';
import { ToastService } from '../../services/toast.service';
import { Sample } from '../../models/sample.model';
import { SCORE_STEP, SCORING_CRITERIA, ScoringCriterion } from '../../shared/scoring.constants';

@Component({
  selector: 'app-scoring',
  imports: [HeaderComponent, InlineSpinnerComponent, LoadingSpinnerComponent, LucideAngularModule],
  templateUrl: './scoring.component.html',
  styleUrl: './scoring.component.scss',
})
export class ScoringComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly categoryService = inject(CategoryService);
  private readonly ctx = inject(FestivalContextService);
  private readonly sampleService = inject(SampleService);
  private readonly scoreService = inject(ScoreService);
  private readonly toastService = inject(ToastService);

  readonly SCORING_CRITERIA = SCORING_CRITERIA;
  readonly SCORE_STEP = SCORE_STEP;

  protected readonly categoryId = this.route.snapshot.paramMap.get('categoryId')!;
  private readonly sampleId = this.route.snapshot.paramMap.get('sampleId')!;

  readonly sample = signal<Sample | null>(null);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly isLocked = signal(false);

  readonly color = signal(SCORING_CRITERIA[0].defaultValue);
  readonly clarity = signal(SCORING_CRITERIA[1].defaultValue);
  readonly typicality = signal(SCORING_CRITERIA[2].defaultValue);
  readonly aroma = signal(SCORING_CRITERIA[3].defaultValue);
  readonly taste = signal(SCORING_CRITERIA[4].defaultValue);
  readonly comment = signal('');

  private readonly writableSignals: Record<string, WritableSignal<number>> = {
    color: this.color,
    clarity: this.clarity,
    typicality: this.typicality,
    aroma: this.aroma,
    taste: this.taste,
  };

  readonly total = computed(() => {
    const rawTotal = this.color() + this.clarity() + this.typicality() + this.aroma() + this.taste();
    return Math.round(rawTotal * 100) / 100;
  });

  // Redirect to dashboard when the event becomes inactive while on this page.
  // Track whether an active event was ever seen so we don't redirect on initial
  // load (before Firestore resolves the signal from its null initial value).
  private hasSeenActiveEvent = false;

  constructor() {
    effect(() => {
      const activeEvent = this.ctx.activeEvent();
      if (activeEvent) {
        this.hasSeenActiveEvent = true;
      } else if (this.hasSeenActiveEvent) {
        void this.router.navigate(['/dashboard']);
      }
    });

    const uid = this.authService.currentUser()?.userId;
    if (!uid) {
      this.router.navigate(['/login']);
      return;
    }
    void this.loadData(uid);
  }

  private async loadData(uid: string): Promise<void> {
    try {
      const [sample, score, assignments] = await Promise.all([
        firstValueFrom(this.sampleService.getSampleById(this.sampleId)),
        firstValueFrom(this.scoreService.getScore(uid, this.sampleId)),
        firstValueFrom(this.categoryService.getJudgeAssignments(uid)),
      ]);

      this.sample.set(sample);

      if (score) {
        this.color.set(score.color);
        this.clarity.set(score.clarity);
        this.typicality.set(score.typicality);
        this.aroma.set(score.aroma);
        this.taste.set(score.taste);
        this.comment.set(score.comment);
      }

      const assignment = assignments.find((assignment) => assignment.categoryId === this.categoryId);
      const isEventActive = !!this.ctx.activeEvent();
      if (assignment?.status === 'finished' || !isEventActive) this.isLocked.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  getCriterionValue(key: string): number {
    return this.writableSignals[key]?.() ?? 0;
  }

  adjust(key: string, delta: number): void {
    const criterion = SCORING_CRITERIA.find((criterion) => criterion.key === key)!;
    const sig = this.writableSignals[key];
    if (!sig) return;
    const current = sig();
    const next = (Math.round(current * 100) + Math.round(delta * 100)) / 100;
    sig.set(Math.min(criterion.max, Math.max(criterion.min, next)));
  }

  setPreset(key: string, value: number): void {
    const criterion = SCORING_CRITERIA.find((criterion) => criterion.key === key)!;
    const sig = this.writableSignals[key];
    if (!sig) return;
    sig.set(Math.min(criterion.max, Math.max(criterion.min, value)));
  }

  getProgressPercent(criterion: ScoringCriterion): number {
    const value = this.getCriterionValue(criterion.key);
    const range = criterion.max - criterion.min;
    return range > 0 ? ((value - criterion.min) / range) * 100 : 0;
  }

  onCommentInput(event: Event): void {
    this.comment.set((event.target as HTMLTextAreaElement).value);
  }

  async saveScore(): Promise<void> {
    const uid = this.authService.currentUser()?.userId;
    if (!uid || this.isLocked()) return;
    this.isSaving.set(true);
    try {
      await this.scoreService.saveScore(uid, this.sampleId, {
        color: this.color(),
        clarity: this.clarity(),
        typicality: this.typicality(),
        aroma: this.aroma(),
        taste: this.taste(),
        comment: this.comment(),
      });
      this.toastService.show('Ocjena sačuvana');
      this.router.navigate(['/category', this.categoryId]);
    } finally {
      this.isSaving.set(false);
    }
  }

}
