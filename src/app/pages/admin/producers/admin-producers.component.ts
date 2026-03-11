import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, map, of, shareReplay, startWith, switchMap, take } from 'rxjs';

import { InlineSpinnerComponent } from '../../../components/inline-spinner/inline-spinner.component';
import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { Producer } from '../../../models/producer.model';
import { Sample } from '../../../models/sample.model';
import { Score } from '../../../models/score.model';
import { CategoryService } from '../../../services/category.service';
import { ProducerService } from '../../../services/producer.service';
import { SampleService } from '../../../services/sample.service';
import { ScoreService } from '../../../services/score.service';
import { LucideAngularModule } from 'lucide-angular';

interface ProducerStats {
  totalSamples: number;
  avgScore: number | null;
  bestScore: number | null;
  eventsParticipated: number;
}

@Component({
  selector: 'app-admin-producers',
  imports: [DecimalPipe, ReactiveFormsModule, LoadingSpinnerComponent, InlineSpinnerComponent, LucideAngularModule],
  templateUrl: './admin-producers.component.html',
  styleUrl: './admin-producers.component.scss',
})
export class AdminProducersComponent {
  private readonly producerService = inject(ProducerService);
  private readonly sampleService = inject(SampleService);
  private readonly scoreService = inject(ScoreService);
  private readonly categoryService = inject(CategoryService);
  private readonly fb = inject(FormBuilder);

  private readonly producers$ = this.producerService.getAllProducers().pipe(shareReplay(1));

  readonly producers = toSignal(this.producers$, { initialValue: [] });
  readonly dataReady = toSignal(this.producers$.pipe(take(1), map(() => true)), {
    initialValue: false,
  });
  readonly searchQuery = signal('');
  readonly mode = signal<'list' | 'create' | 'edit'>('list');
  readonly editingProducer = signal<Producer | null>(null);
  readonly isSaving = signal(false);

  private readonly allSamples$ = this.sampleService.getAllSamples().pipe(shareReplay(1));

  private readonly statsMap$ = this.allSamples$.pipe(
    switchMap((samples) => {
      if (samples.length === 0) return of(new Map<string, ProducerStats>());

      const sampleIds = samples.map((sample) => sample.sampleId);
      const categoryIds = [...new Set(samples.map((sample) => sample.categoryId))];

      return combineLatest([
        this.scoreService.getScoresForSampleIds(sampleIds),
        this.categoryService.getCategoriesByIds(categoryIds),
      ]).pipe(
        map(([scores, categories]) => {
          const categoryEventMap = new Map(categories.map((category) => [category.categoryId, category.eventId]));

          const samplesByProducer = new Map<string, Sample[]>();
          for (const sample of samples) {
            if (!samplesByProducer.has(sample.producerId)) samplesByProducer.set(sample.producerId, []);
            samplesByProducer.get(sample.producerId)!.push(sample);
          }

          const scoresBySampleId = new Map<string, Score[]>();
          for (const score of scores) {
            if (!scoresBySampleId.has(score.sampleId)) scoresBySampleId.set(score.sampleId, []);
            scoresBySampleId.get(score.sampleId)!.push(score);
          }

          const statsMap = new Map<string, ProducerStats>();
          for (const [producerId, producerSamples] of samplesByProducer) {
            const eventIds = new Set(
              producerSamples
                .map((sample) => categoryEventMap.get(sample.categoryId))
                .filter((eventId): eventId is string => !!eventId),
            );

            const scoreTotals: number[] = [];
            for (const sample of producerSamples) {
              for (const score of scoresBySampleId.get(sample.sampleId) ?? []) {
                scoreTotals.push(score.color + score.clarity + score.typicality + score.aroma + score.taste);
              }
            }

            const avgScore =
              scoreTotals.length > 0
                ? scoreTotals.reduce((sum, total) => sum + total, 0) / scoreTotals.length
                : null;

            const bestScore = scoreTotals.length > 0 ? Math.max(...scoreTotals) : null;

            statsMap.set(producerId, {
              totalSamples: producerSamples.length,
              avgScore,
              bestScore,
              eventsParticipated: eventIds.size,
            });
          }

          return statsMap;
        }),
      );
    }),
    startWith(null),
    shareReplay(1),
  );

  readonly allStatsMap = toSignal(this.statsMap$, { initialValue: null });

  readonly filteredProducers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.producers();
    return this.producers().filter(
      (producer) =>
        producer.name.toLowerCase().includes(query) ||
        producer.contactPerson?.toLowerCase().includes(query) ||
        producer.region?.toLowerCase().includes(query) ||
        producer.country?.toLowerCase().includes(query),
    );
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    contactPerson: [''],
    email: [''],
    phone: [''],
    address: [''],
    region: [''],
    country: [''],
  });

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  openCreate(): void {
    this.form.reset();
    this.editingProducer.set(null);
    this.mode.set('create');
  }

  openEdit(producer: Producer): void {
    this.form.patchValue({
      name: producer.name,
      contactPerson: producer.contactPerson,
      email: producer.email,
      phone: producer.phone,
      address: producer.address,
      region: producer.region,
      country: producer.country,
    });
    this.editingProducer.set(producer);
    this.mode.set('edit');
  }

  cancel(): void {
    this.form.reset();
    this.editingProducer.set(null);
    this.mode.set('list');
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;

    this.isSaving.set(true);
    const data = this.form.getRawValue();

    try {
      if (this.mode() === 'edit') {
        await this.producerService.updateProducer(this.editingProducer()!.producerId, data);
      } else {
        await this.producerService.createProducer(data);
      }
      this.cancel();
    } finally {
      this.isSaving.set(false);
    }
  }
}
