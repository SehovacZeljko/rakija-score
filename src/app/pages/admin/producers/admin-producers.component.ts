import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, shareReplay, take } from 'rxjs';

import { InlineSpinnerComponent } from '../../../components/inline-spinner/inline-spinner.component';
import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { Producer } from '../../../models/producer.model';
import { ProducerService } from '../../../services/producer.service';

@Component({
  selector: 'app-admin-producers',
  imports: [ReactiveFormsModule, LoadingSpinnerComponent, InlineSpinnerComponent],
  templateUrl: './admin-producers.component.html',
  styleUrl: './admin-producers.component.scss',
})
export class AdminProducersComponent {
  private readonly producerService = inject(ProducerService);
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
