import { Component, WritableSignal, computed, signal } from '@angular/core';
import { inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { CategoryService } from '../../services/category.service';
import { SampleService } from '../../services/sample.service';
import { ScoreService } from '../../services/score.service';
import { Sample } from '../../models/sample.model';
import { SCORE_STEP, SCORING_CRITERIA } from '../../shared/scoring.constants';

@Component({
  selector: 'app-scoring',
  imports: [],
  templateUrl: './scoring.component.html',
  styleUrl: './scoring.component.scss',
})
export class ScoringComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly categoryService = inject(CategoryService);
  private readonly sampleService = inject(SampleService);
  private readonly scoreService = inject(ScoreService);

  readonly SCORING_CRITERIA = SCORING_CRITERIA;
  readonly SCORE_STEP = SCORE_STEP;

  private readonly categoryId = this.route.snapshot.paramMap.get('categoryId')!;
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
    const t = this.color() + this.clarity() + this.typicality() + this.aroma() + this.taste();
    return Math.round(t * 100) / 100;
  });

  constructor() {
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

      const assignment = assignments.find((a) => a.categoryId === this.categoryId);
      if (assignment?.status === 'finished') this.isLocked.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  getCriterionValue(key: string): number {
    return this.writableSignals[key]?.() ?? 0;
  }

  adjust(key: string, delta: number): void {
    const criterion = SCORING_CRITERIA.find((c) => c.key === key)!;
    const sig = this.writableSignals[key];
    if (!sig) return;
    const current = sig();
    const next = (Math.round(current * 100) + Math.round(delta * 100)) / 100;
    sig.set(Math.min(criterion.max, Math.max(criterion.min, next)));
  }

  setPreset(key: string, value: number): void {
    const criterion = SCORING_CRITERIA.find((c) => c.key === key)!;
    const sig = this.writableSignals[key];
    if (!sig) return;
    sig.set(Math.min(criterion.max, Math.max(criterion.min, value)));
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
      this.router.navigate(['/category', this.categoryId]);
    } finally {
      this.isSaving.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/category', this.categoryId]);
  }
}
