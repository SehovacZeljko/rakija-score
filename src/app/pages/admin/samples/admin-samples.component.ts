import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, of, shareReplay, switchMap, take } from 'rxjs';

import { Sample } from '../../../models/sample.model';
import { CategoryService } from '../../../services/category.service';
import { EventService } from '../../../services/event.service';
import { FestivalService } from '../../../services/festival.service';
import { ProducerService } from '../../../services/producer.service';
import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { SampleData, SampleService } from '../../../services/sample.service';

@Component({
  selector: 'app-admin-samples',
  imports: [ReactiveFormsModule, LoadingSpinnerComponent],
  templateUrl: './admin-samples.component.html',
  styleUrl: './admin-samples.component.scss',
})
export class AdminSamplesComponent {
  private readonly festivalService = inject(FestivalService);
  private readonly eventService = inject(EventService);
  private readonly categoryService = inject(CategoryService);
  private readonly producerService = inject(ProducerService);
  private readonly sampleService = inject(SampleService);
  private readonly fb = inject(FormBuilder);

  private readonly activeFestival$ = this.festivalService.getActiveFestival().pipe(shareReplay(1));
  readonly activeFestival = toSignal(this.activeFestival$, { initialValue: null });
  readonly dataReady = toSignal(this.activeFestival$.pipe(take(1), map(() => true)), {
    initialValue: false,
  });

  private readonly events$ = this.activeFestival$.pipe(
    switchMap((f) => (f ? this.eventService.getEventsForFestival(f.festivalId) : of([]))),
  );

  private readonly categories$ = this.events$.pipe(
    switchMap((events) => {
      const ids = events.map((e) => e.eventId);
      return this.categoryService.getCategoriesForEvents(ids);
    }),
  );

  readonly categories = toSignal(this.categories$, { initialValue: [] });
  readonly producers = toSignal(this.producerService.getAllProducers(), { initialValue: [] });
  readonly allSamples = toSignal(this.sampleService.getAllSamples(), { initialValue: [] });

  readonly producerMap = computed(
    () => new Map(this.producers().map((p) => [p.producerId, p.name])),
  );
  readonly categoryMap = computed(
    () => new Map(this.categories().map((c) => [c.categoryId, c.name])),
  );

  readonly selectedCategoryId = signal<string | null>(null);
  readonly filteredSamples = computed(() => {
    const catId = this.selectedCategoryId();
    const samples = this.allSamples();
    return catId ? samples.filter((s) => s.categoryId === catId) : samples;
  });

  readonly mode = signal<'list' | 'create' | 'edit'>('list');
  readonly editingSample = signal<Sample | null>(null);
  readonly isSaving = signal(false);

  readonly form = this.fb.nonNullable.group({
    sampleCode: ['', Validators.required],
    producerId: ['', Validators.required],
    categoryId: ['', Validators.required],
    year: [new Date().getFullYear(), Validators.required],
    alcoholStrength: [40, Validators.required],
    order: [1, Validators.required],
  });

  onCategoryFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedCategoryId.set(val || null);
  }

  openCreate(): void {
    this.form.reset({
      sampleCode: '',
      producerId: '',
      categoryId: this.selectedCategoryId() ?? '',
      year: new Date().getFullYear(),
      alcoholStrength: 40,
      order: this.filteredSamples().length + 1,
    });
    this.editingSample.set(null);
    this.mode.set('create');
  }

  openEdit(sample: Sample): void {
    this.form.patchValue({
      sampleCode: sample.sampleCode,
      producerId: sample.producerId,
      categoryId: sample.categoryId,
      year: sample.year,
      alcoholStrength: sample.alcoholStrength,
      order: sample.order,
    });
    this.editingSample.set(sample);
    this.mode.set('edit');
  }

  cancel(): void {
    this.form.reset();
    this.editingSample.set(null);
    this.mode.set('list');
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.isSaving.set(true);
    const raw = this.form.getRawValue();
    const data: SampleData = {
      sampleCode: raw.sampleCode,
      producerId: raw.producerId,
      categoryId: raw.categoryId,
      year: Number(raw.year),
      alcoholStrength: Number(raw.alcoholStrength),
      order: Number(raw.order),
    };
    try {
      if (this.mode() === 'edit') {
        await this.sampleService.updateSample(this.editingSample()!.sampleId, data);
      } else {
        await this.sampleService.createSample(data);
      }
      this.cancel();
    } finally {
      this.isSaving.set(false);
    }
  }
}
