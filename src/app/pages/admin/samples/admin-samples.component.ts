import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { of, startWith, switchMap } from 'rxjs';

import { ActiveFestivalBannerComponent } from '../../../components/active-festival-banner/active-festival-banner.component';
import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { Sample } from '../../../models/sample.model';
import { CategoryService } from '../../../services/category.service';
import { FestivalContextService } from '../../../services/festival-context.service';
import { ProducerService } from '../../../services/producer.service';
import { SampleData, SampleService } from '../../../services/sample.service';

@Component({
  selector: 'app-admin-samples',
  imports: [ReactiveFormsModule, LoadingSpinnerComponent, ActiveFestivalBannerComponent],
  templateUrl: './admin-samples.component.html',
  styleUrl: './admin-samples.component.scss',
})
export class AdminSamplesComponent {
  private readonly ctx = inject(FestivalContextService);
  private readonly categoryService = inject(CategoryService);
  private readonly producerService = inject(ProducerService);
  private readonly sampleService = inject(SampleService);
  private readonly fb = inject(FormBuilder);

  readonly activeFestival = this.ctx.activeFestival;
  readonly activeEvent = this.ctx.activeEvent;
  readonly dataReady = this.ctx.dataReady;

  private readonly categories$ = this.ctx.activeEvent$.pipe(
    switchMap((event) => {
      if (!event) return of([]);
      return this.categoryService.getCategoriesForEvents([event.eventId]).pipe(startWith([]));
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
