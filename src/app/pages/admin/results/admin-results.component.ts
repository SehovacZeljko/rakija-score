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
import {
  PdfExportInput,
  PdfJudgeScore,
  ResultsPdfService,
} from '../../../services/results-pdf.service';
import { SampleService } from '../../../services/sample.service';
import { ScoreService } from '../../../services/score.service';
import { UserService } from '../../../services/user.service';
import { LucideAngularModule } from 'lucide-angular';

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
  unscoredJudgeIds: string[];
}

interface CategoryResult {
  category: Category;
  samples: SampleResult[];
  lockedJudgeIds: Set<string>;
  totalJudges: number;
}

@Component({
  selector: 'app-admin-results',
  imports: [DecimalPipe, LucideAngularModule],
  templateUrl: './admin-results.component.html',
  styleUrl: './admin-results.component.scss',
})
export class AdminResultsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventService = inject(EventService);
  private readonly categoryService = inject(CategoryService);
  private readonly sampleService = inject(SampleService);
  private readonly scoreService = inject(ScoreService);
  private readonly userService = inject(UserService);
  private readonly producerService = inject(ProducerService);
  private readonly resultsPdfService = inject(ResultsPdfService);

  private readonly eventId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('eventId') ?? '')),
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
    switchMap((categories) => {
      if (!categories.length) return of([]);
      const categoryIds = categories.map((category) => category.categoryId);
      return this.categoryService.getAssignmentsForCategories(categoryIds).pipe(startWith([]));
    }),
  );

  private readonly samples$ = this.categories$.pipe(
    switchMap((categories) => {
      if (!categories.length) return of([]);
      const categoryIds = categories.map((category) => category.categoryId);
      return this.sampleService.getSamplesForCategories(categoryIds).pipe(startWith([]));
    }),
  );

  private readonly scores$ = this.samples$.pipe(
    switchMap((samples) => {
      if (!samples.length) return of([]);
      return this.scoreService
        .getScoresForSampleIds(samples.map((sample) => sample.sampleId))
        .pipe(startWith([]));
    }),
  );

  private readonly producers$ = this.producerService.getAllProducers().pipe(startWith([]));

  readonly event = toSignal(this.event$, { initialValue: null as FestivalEvent | null });

  private readonly users = toSignal(this.userService.getAllUsers(), { initialValue: [] as User[] });

  readonly judgeNameMap = computed(
    () => new Map(this.users().map((user) => [user.userId, user.username])),
  );

  readonly eventJudgeStats = computed(() => {
    const results = this.categoryResults();
    let totalSubmitted = 0;
    let totalExpected = 0;
    for (const categoryResult of results) {
      totalExpected += categoryResult.totalJudges * categoryResult.samples.length;
      totalSubmitted += categoryResult.samples.reduce(
        (acc, sampleResult) => acc + sampleResult.judgesScored,
        0,
      );
    }
    return { totalSubmitted, totalExpected };
  });

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
          (producers as Producer[]).map((producer) => [producer.producerId, producer.name]),
        );

        const scoresBySampleId = new Map<string, Score[]>();
        for (const score of scores) {
          const list = scoresBySampleId.get(score.sampleId) ?? [];
          list.push(score);
          scoresBySampleId.set(score.sampleId, list);
        }

        return categories.map((category): CategoryResult => {
          const categorySamples = samples.filter(
            (sample) => sample.categoryId === category.categoryId,
          );

          // Judges with a formal assignment record for this category
          const assignedJudgeIds = new Set(
            assignments
              .filter((assignment) => assignment.categoryId === category.categoryId)
              .map((assignment) => assignment.judgeId),
          );

          // Judges who submitted at least one score in this category (may lack an assignment record)
          const scoredJudgeIdsInCategory = new Set<string>();
          for (const sample of categorySamples) {
            for (const score of scoresBySampleId.get(sample.sampleId) ?? []) {
              scoredJudgeIdsInCategory.add(score.judgeId);
            }
          }

          // Union: any judge who is assigned OR who scored counts toward the total
          const allJudgeIds = new Set([...assignedJudgeIds, ...scoredJudgeIdsInCategory]);
          const totalJudges = allJudgeIds.size;
          const allJudgeIdList = [...allJudgeIds];

          const sampleResults: SampleResult[] = categorySamples.map((sample): SampleResult => {
            const judgeScores = scoresBySampleId.get(sample.sampleId) ?? [];
            const scoreCount = judgeScores.length || 1;
            const avgField = (field: keyof Score) =>
              judgeScores.reduce((sum, score) => sum + (score[field] as number), 0) / scoreCount;

            const avgColor = avgField('color');
            const avgClarity = avgField('clarity');
            const avgTypicality = avgField('typicality');
            const avgAroma = avgField('aroma');
            const avgTaste = avgField('taste');

            const scoredJudgeIds = new Set(judgeScores.map((score) => score.judgeId));
            const unscoredJudgeIds = allJudgeIdList.filter(
              (judgeId) => !scoredJudgeIds.has(judgeId),
            );

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
              unscoredJudgeIds,
            };
          });

          sampleResults.sort((resultA, resultB) => resultB.avgTotal - resultA.avgTotal);

          const lockedJudgeIds = new Set(
            assignments
              .filter(
                (assignment) =>
                  assignment.categoryId === category.categoryId &&
                  assignment.status === 'finished',
              )
              .map((assignment) => assignment.judgeId),
          );

          return { category, samples: sampleResults, lockedJudgeIds, totalJudges };
        });
      }),
    ),
    { initialValue: [] as CategoryResult[] },
  );

  readonly sortAscending = signal(false);

  readonly sortedCategoryResults = computed(() => {
    const ascending = this.sortAscending();
    return this.categoryResults().map((categoryResult) => ({
      ...categoryResult,
      samples: [...categoryResult.samples].sort((resultA, resultB) =>
        ascending ? resultA.avgTotal - resultB.avgTotal : resultB.avgTotal - resultA.avgTotal,
      ),
    }));
  });

  readonly expandedSampleIds = signal<Set<string>>(new Set());
  readonly expandedCategoryIds = signal<Set<string>>(new Set());

  readonly allSamplesExpanded = computed(() => {
    const allSamples = this.categoryResults().flatMap(
      (categoryResult) => categoryResult.samples,
    );
    return (
      allSamples.length > 0 &&
      allSamples.every((sampleResult) =>
        this.expandedSampleIds().has(sampleResult.sample.sampleId),
      )
    );
  });

  readonly allCategoriesExpanded = computed(() => {
    const results = this.categoryResults();
    return (
      results.length > 0 &&
      results.every((categoryResult) =>
        this.expandedCategoryIds().has(categoryResult.category.categoryId),
      )
    );
  });

  toggleExpand(sampleId: string): void {
    this.expandedSampleIds.update((expandedSet) => {
      const next = new Set(expandedSet);
      next.has(sampleId) ? next.delete(sampleId) : next.add(sampleId);
      return next;
    });
  }

  expandAllSamples(): void {
    const categoryIds = this.categoryResults().map(
      (categoryResult) => categoryResult.category.categoryId,
    );
    this.expandedCategoryIds.set(new Set(categoryIds));
    const sampleIds = this.categoryResults().flatMap((categoryResult) =>
      categoryResult.samples.map((sampleResult) => sampleResult.sample.sampleId),
    );
    this.expandedSampleIds.set(new Set(sampleIds));
  }

  collapseAllSamples(): void {
    this.expandedSampleIds.set(new Set());
  }

  toggleCategory(categoryId: string): void {
    this.expandedCategoryIds.update((expandedSet) => {
      const next = new Set(expandedSet);
      next.has(categoryId) ? next.delete(categoryId) : next.add(categoryId);
      return next;
    });
  }

  expandAllCategories(): void {
    const categoryIds = this.categoryResults().map(
      (categoryResult) => categoryResult.category.categoryId,
    );
    this.expandedCategoryIds.set(new Set(categoryIds));
  }

  collapseAllCategories(): void {
    this.expandedCategoryIds.set(new Set());
  }

  toggleSortDirection(): void {
    this.sortAscending.update((ascending) => !ascending);
  }

  goBack(): void {
    this.router.navigate(['/admin/events']);
  }

  downloadPdf(): void {
    const currentEvent = this.event();
    if (!currentEvent) return;

    const judgeNameMap = this.judgeNameMap();

    const input: PdfExportInput = {
      eventName: currentEvent.name,
      eventYear: currentEvent.year,
      totalSubmitted: this.eventJudgeStats().totalSubmitted,
      totalExpected: this.eventJudgeStats().totalExpected,
      categoryResults: this.sortedCategoryResults().map((categoryResult) => ({
        categoryName: categoryResult.category.name,
        samples: categoryResult.samples.map((sampleResult, index) => {
          const scoredJudges: PdfJudgeScore[] = sampleResult.scores.map((score) => ({
            judgeName: judgeNameMap.get(score.judgeId) ?? score.judgeId,
            scored: true,
            color: score.color,
            clarity: score.clarity,
            typicality: score.typicality,
            aroma: score.aroma,
            taste: score.taste,
            total: score.color + score.clarity + score.typicality + score.aroma + score.taste,
          }));

          const unscoredJudges: PdfJudgeScore[] = sampleResult.unscoredJudgeIds.map(
            (judgeId) => ({
              judgeName: judgeNameMap.get(judgeId) ?? judgeId,
              scored: false,
              color: 0,
              clarity: 0,
              typicality: 0,
              aroma: 0,
              taste: 0,
              total: 0,
            }),
          );

          return {
            rank: index + 1,
            sampleCode: sampleResult.sample.sampleCode,
            producerName: sampleResult.producerName,
            judgesScored: sampleResult.judgesScored,
            totalJudges: sampleResult.totalJudges,
            avgTotal: sampleResult.avgTotal,
            judgeScores: [...scoredJudges, ...unscoredJudges],
          };
        }),
      })),
    };

    this.resultsPdfService.generateResultsPdf(input);
  }

  scoreTotal(score: Score): number {
    return score.color + score.clarity + score.typicality + score.aroma + score.taste;
  }
}
