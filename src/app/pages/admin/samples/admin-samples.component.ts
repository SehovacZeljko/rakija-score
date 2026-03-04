import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { of, startWith, switchMap } from 'rxjs';

import { ActiveFestivalBannerComponent } from '../../../components/active-festival-banner/active-festival-banner.component';
import { InlineSpinnerComponent } from '../../../components/inline-spinner/inline-spinner.component';
import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { SelectDropdownComponent } from '../../../components/select-dropdown/select-dropdown.component';
import { Sample } from '../../../models/sample.model';
import { CategoryService } from '../../../services/category.service';
import { FestivalContextService } from '../../../services/festival-context.service';
import { ProducerService } from '../../../services/producer.service';
import { SampleData, SampleService } from '../../../services/sample.service';

@Component({
  selector: 'app-admin-samples',
  imports: [ReactiveFormsModule, LoadingSpinnerComponent, InlineSpinnerComponent, ActiveFestivalBannerComponent, SelectDropdownComponent],
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
  readonly adminCurrentEvent = this.ctx.adminCurrentEvent;
  readonly dataReady = this.ctx.dataReady;
  readonly isEventActive = computed(() => this.adminCurrentEvent()?.status === 'active');

  private readonly categories$ = this.ctx.adminCurrentEvent$.pipe(
    switchMap((event) => {
      if (!event) return of([]);
      return this.categoryService.getCategoriesForEvents([event.eventId]).pipe(startWith([]));
    }),
  );

  readonly categories = toSignal(this.categories$, { initialValue: [] });
  readonly producers = toSignal(this.producerService.getAllProducers(), { initialValue: [] });
  private readonly eventSamples$ = this.categories$.pipe(
    switchMap((categories) =>
      this.sampleService.getSamplesForCategories(categories.map((category) => category.categoryId)),
    ),
    startWith([]),
  );
  readonly allSamples = toSignal(this.eventSamples$, { initialValue: [] });

  readonly producerMap = computed(
    () => new Map(this.producers().map((producer) => [producer.producerId, producer.name])),
  );
  readonly categoryMap = computed(
    () => new Map(this.categories().map((category) => [category.categoryId, category.name])),
  );

  readonly categoryOptions = computed(() =>
    this.categories().map((category) => ({ id: category.categoryId, label: category.name })),
  );
  readonly producerOptions = computed(() =>
    this.producers().map((producer) => ({ id: producer.producerId, label: producer.name })),
  );

  readonly selectedCategoryId = signal<string | null>(null);
  readonly filteredSamples = computed(() => {
    const categoryId = this.selectedCategoryId();
    const samples = this.allSamples();
    return categoryId ? samples.filter((sample) => sample.categoryId === categoryId) : samples;
  });

  readonly mode = signal<'list' | 'create' | 'edit'>('list');
  readonly editingSample = signal<Sample | null>(null);
  readonly isSaving = signal(false);

  readonly form = this.fb.nonNullable.group({
    sampleCode: [
      '',
      [Validators.required, Validators.minLength(4), this.uniqueSampleCodeValidator()],
    ],
    producerId: ['', Validators.required],
    categoryId: ['', Validators.required],
    year: [new Date().getFullYear(), Validators.required],
    alcoholStrength: [40, Validators.required],
    order: [1, Validators.required],
  });

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
    this.editingSample.set(sample);
    this.form.patchValue({
      sampleCode: sample.sampleCode,
      producerId: sample.producerId,
      categoryId: sample.categoryId,
      year: sample.year,
      alcoholStrength: sample.alcoholStrength,
      order: sample.order,
    });
    this.mode.set('edit');
  }

  private uniqueSampleCodeValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const code = (control.value as string)?.trim();
      if (!code) return null;
      const currentSampleId = this.editingSample()?.sampleId;
      const isDuplicate = this.allSamples().some(
        (sample) => sample.sampleCode === code && sample.sampleId !== currentSampleId,
      );
      return isDuplicate ? { duplicateCode: true } : null;
    };
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
