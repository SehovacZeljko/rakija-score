import { Component, computed, inject, signal, AfterViewChecked, ElementRef, ViewChildren, QueryList } from '@angular/core';
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
import JsBarcode from 'jsbarcode';

import { ActiveFestivalBannerComponent } from '../../../components/active-festival-banner/active-festival-banner.component';
import { InlineSpinnerComponent } from '../../../components/inline-spinner/inline-spinner.component';
import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { SelectDropdownComponent } from '../../../components/select-dropdown/select-dropdown.component';
import { Sample } from '../../../models/sample.model';
import { CategoryService } from '../../../services/category.service';
import { FestivalContextService } from '../../../services/festival-context.service';
import { ProducerService } from '../../../services/producer.service';
import { SampleData, SampleService } from '../../../services/sample.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-admin-samples',
  imports: [ReactiveFormsModule, LoadingSpinnerComponent, InlineSpinnerComponent, ActiveFestivalBannerComponent, SelectDropdownComponent, LucideAngularModule],
  templateUrl: './admin-samples.component.html',
  styleUrl: './admin-samples.component.scss',
})
export class AdminSamplesComponent implements AfterViewChecked {
  @ViewChildren('barcodeEl') barcodeElements!: QueryList<ElementRef<SVGElement>>;
  private readonly ctx = inject(FestivalContextService);
  private readonly categoryService = inject(CategoryService);
  private readonly producerService = inject(ProducerService);
  private readonly sampleService = inject(SampleService);
  private readonly fb = inject(FormBuilder);

  readonly activeFestival = this.ctx.activeFestival;
  readonly adminCurrentEvent = this.ctx.adminCurrentEvent;
  readonly dataReady = this.ctx.dataReady;

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
  readonly searchQuery = signal('');

  readonly filteredSamples = computed(() => {
    const categoryId = this.selectedCategoryId();
    const query = this.searchQuery().trim().toLowerCase();
    let samples = this.allSamples();

    if (categoryId) {
      samples = samples.filter((sample) => sample.categoryId === categoryId);
    }
    if (query) {
      samples = samples.filter(
        (sample) =>
          sample.sampleCode.toLowerCase().includes(query) ||
          (this.producerMap().get(sample.producerId) ?? '').toLowerCase().includes(query),
      );
    }
    return samples;
  });

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  readonly mode = signal<'list' | 'create' | 'edit' | 'barcodes'>('list');
  private barcodesRendered = false;
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

  openBarcodes(): void {
    this.barcodesRendered = false;
    this.mode.set('barcodes');
  }

  printBarcodes(): void {
    window.print();
  }

  ngAfterViewChecked(): void {
    if (this.mode() === 'barcodes' && !this.barcodesRendered && this.barcodeElements?.length) {
      this.barcodeElements.forEach((ref) => {
        const sampleCode = ref.nativeElement.dataset['code'] ?? '';
        JsBarcode(ref.nativeElement, sampleCode, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: false,
          margin: 0,
        });
      });
      this.barcodesRendered = true;
    }
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
