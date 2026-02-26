import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, map, of, startWith, switchMap } from 'rxjs';

import { Category } from '../../../models/category.model';
import { FestivalEvent } from '../../../models/event.model';
import { Producer } from '../../../models/producer.model';
import { Sample } from '../../../models/sample.model';
import { Score } from '../../../models/score.model';
import { User } from '../../../models/user.model';
import { CategoryService } from '../../../services/category.service';
import { EventService } from '../../../services/event.service';
import { ProducerService } from '../../../services/producer.service';
import { SampleService } from '../../../services/sample.service';
import { ScoreService } from '../../../services/score.service';
import { UserService } from '../../../services/user.service';

interface SampleResult {
  sample: Sample;
  producerName: string;
  scores: Score[];
  avgColor: number;
  avgClarity: number;
  avgTypicality: number;
  avgAroma: number;
  avgTaste: number;
  avgTotal: number;
  judgesScored: number;
  totalJudges: number;
}

interface CategoryResult {
  category: Category;
  samples: SampleResult[];
  lockedJudgeIds: Set<string>;
}

@Component({
  selector: 'app-admin-results',
  imports: [DecimalPipe],
  templateUrl: './admin-results.component.html',
  styleUrl: './admin-results.component.scss',
})
export class AdminResultsComponent {
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private readonly eventService = inject(EventService);
  private readonly categoryService = inject(CategoryService);
  private readonly sampleService = inject(SampleService);
  private readonly scoreService = inject(ScoreService);
  private readonly userService = inject(UserService);
  private readonly producerService = inject(ProducerService);

  private readonly eventId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('eventId') ?? '')),
    { initialValue: '' },
  );

  private readonly event$ = toObservable(this.eventId).pipe(
    switchMap((id) => (id ? this.eventService.getEventById(id) : of(null))),
  );

  private readonly categories$ = toObservable(this.eventId).pipe(
    switchMap((id) =>
      id ? this.categoryService.getCategoriesForEvent(id).pipe(startWith([])) : of([]),
    ),
  );

  private readonly assignments$ = this.categories$.pipe(
    switchMap((cats) => {
      if (!cats.length) return of([]);
      const ids = cats.map((c) => c.categoryId);
      return this.categoryService.getAssignmentsForCategories(ids).pipe(startWith([]));
    }),
  );

  private readonly samples$ = this.categories$.pipe(
    switchMap((cats) => {
      if (!cats.length) return of([]);
      const ids = cats.map((c) => c.categoryId);
      return this.sampleService.getSamplesForCategories(ids).pipe(startWith([]));
    }),
  );

  private readonly scores$ = this.samples$.pipe(
    switchMap((samples) => {
      if (!samples.length) return of([]);
      return this.scoreService.getScoresForSampleIds(samples.map((s) => s.sampleId));
    }),
  );

  private readonly producers$ = this.producerService.getAllProducers().pipe(startWith([]));

  readonly event = toSignal(this.event$, { initialValue: null as FestivalEvent | null });

  private readonly users = toSignal(this.userService.getAllUsers(), { initialValue: [] as User[] });

  readonly judgeNameMap = computed(
    () => new Map(this.users().map((u) => [u.userId, u.username])),
  );

  readonly categoryResults = toSignal(
    combineLatest([
      this.categories$,
      this.samples$,
      this.scores$,
      this.assignments$,
      this.producers$,
    ]).pipe(
      map(([categories, samples, scores, assignments, producers]) => {
        const producerMap = new Map(
          (producers as Producer[]).map((p) => [p.producerId, p.name]),
        );

        const scoresBySampleId = new Map<string, Score[]>();
        for (const score of scores) {
          const list = scoresBySampleId.get(score.sampleId) ?? [];
          list.push(score);
          scoresBySampleId.set(score.sampleId, list);
        }

        return categories.map((cat): CategoryResult => {
          const catSamples = samples.filter((s) => s.categoryId === cat.categoryId);
          const totalJudges = assignments.filter((a) => a.categoryId === cat.categoryId).length;

          const sampleResults: SampleResult[] = catSamples.map((sample): SampleResult => {
            const judgeScores = scoresBySampleId.get(sample.sampleId) ?? [];
            const n = judgeScores.length || 1;
            const avgField = (field: keyof Score) =>
              judgeScores.reduce((sum, s) => sum + (s[field] as number), 0) / n;

            const avgColor = avgField('color');
            const avgClarity = avgField('clarity');
            const avgTypicality = avgField('typicality');
            const avgAroma = avgField('aroma');
            const avgTaste = avgField('taste');

            return {
              sample,
              producerName: producerMap.get(sample.producerId) ?? '—',
              scores: judgeScores,
              avgColor,
              avgClarity,
              avgTypicality,
              avgAroma,
              avgTaste,
              avgTotal: avgColor + avgClarity + avgTypicality + avgAroma + avgTaste,
              judgesScored: judgeScores.length,
              totalJudges,
            };
          });

          sampleResults.sort((a, b) => b.avgTotal - a.avgTotal);

          const lockedJudgeIds = new Set(
            assignments
              .filter((a) => a.categoryId === cat.categoryId && a.status === 'finished')
              .map((a) => a.judgeId),
          );

          return { category: cat, samples: sampleResults, lockedJudgeIds };
        });
      }),
    ),
    { initialValue: [] as CategoryResult[] },
  );

  readonly expandedSampleId = signal<string | null>(null);

  toggleExpand(sampleId: string): void {
    this.expandedSampleId.update((id) => (id === sampleId ? null : sampleId));
  }

  scoreTotal(score: Score): number {
    return score.color + score.clarity + score.typicality + score.aroma + score.taste;
  }
}
