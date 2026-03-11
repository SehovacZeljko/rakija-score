import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, shareReplay, startWith, switchMap, take } from 'rxjs';

import { InlineSpinnerComponent } from '../../../components/inline-spinner/inline-spinner.component';
import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { FestivalEvent } from '../../../models/event.model';
import { Festival } from '../../../models/festival.model';
import { Sample } from '../../../models/sample.model';
import { CategoryService } from '../../../services/category.service';
import { EventService } from '../../../services/event.service';
import { FestivalService } from '../../../services/festival.service';
import { SampleService } from '../../../services/sample.service';
import { LucideAngularModule } from 'lucide-angular';

interface FestivalStats {
  totalEvents: number;
  totalSamples: number;
  distinctProducers: number;
  finishedEvents: number;
}

interface FestivalData {
  eventsMap: Map<string, FestivalEvent[]>;
  statsMap: Map<string, FestivalStats>;
}

@Component({
  selector: 'app-admin-festivals',
  imports: [LoadingSpinnerComponent, InlineSpinnerComponent, LucideAngularModule],
  templateUrl: './admin-festivals.component.html',
  styleUrl: './admin-festivals.component.scss',
})
export class AdminFestivalsComponent {
  private readonly festivalService = inject(FestivalService);
  private readonly eventService = inject(EventService);
  private readonly sampleService = inject(SampleService);
  private readonly categoryService = inject(CategoryService);

  private readonly festivals$ = this.festivalService.getAllFestivals().pipe(shareReplay(1));
  readonly festivals = toSignal(this.festivals$, { initialValue: [] });
  readonly dataReady = toSignal(this.festivals$.pipe(take(1), map(() => true)), {
    initialValue: false,
  });
  readonly showForm = signal(false);
  readonly newFestivalName = signal('');
  readonly isSaving = signal(false);
  readonly editingFestivalId = signal<string | null>(null);
  readonly editingName = signal('');
  readonly isSavingEdit = signal(false);

  readonly newFestivalNameValid = computed(() => this.newFestivalName().trim().length >= 3);
  readonly editingNameValid = computed(() => this.editingName().trim().length >= 3);

  private readonly allEvents$ = this.eventService.getAllEvents().pipe(shareReplay(1));
  private readonly allSamples$ = this.sampleService.getAllSamples().pipe(shareReplay(1));

  private readonly festivalData$ = combineLatest([this.allEvents$, this.allSamples$]).pipe(
    switchMap(([events, samples]) => {
      const eventsMap = new Map<string, FestivalEvent[]>();
      for (const event of events) {
        if (!eventsMap.has(event.festivalId)) eventsMap.set(event.festivalId, []);
        eventsMap.get(event.festivalId)!.push(event);
      }

      if (samples.length === 0) {
        const statsMap = new Map<string, FestivalStats>();
        for (const [festivalId, festivalEvents] of eventsMap) {
          statsMap.set(festivalId, {
            totalEvents: festivalEvents.length,
            totalSamples: 0,
            distinctProducers: 0,
            finishedEvents: festivalEvents.filter((event) => event.status === 'finished').length,
          });
        }
        return of({ eventsMap, statsMap } as FestivalData);
      }

      const categoryIds = [...new Set(samples.map((sample) => sample.categoryId))];
      const eventFestivalMap = new Map(events.map((event) => [event.eventId, event.festivalId]));

      return this.categoryService.getCategoriesByIds(categoryIds).pipe(
        map((categories) => {
          const categoryEventMap = new Map(
            categories.map((category) => [category.categoryId, category.eventId]),
          );

          const samplesByFestival = new Map<string, Sample[]>();
          for (const sample of samples) {
            const eventId = categoryEventMap.get(sample.categoryId);
            if (!eventId) continue;
            const festivalId = eventFestivalMap.get(eventId);
            if (!festivalId) continue;
            if (!samplesByFestival.has(festivalId)) samplesByFestival.set(festivalId, []);
            samplesByFestival.get(festivalId)!.push(sample);
          }

          const statsMap = new Map<string, FestivalStats>();
          for (const [festivalId, festivalEvents] of eventsMap) {
            const festivalSamples = samplesByFestival.get(festivalId) ?? [];
            statsMap.set(festivalId, {
              totalEvents: festivalEvents.length,
              totalSamples: festivalSamples.length,
              distinctProducers: new Set(festivalSamples.map((sample) => sample.producerId)).size,
              finishedEvents: festivalEvents.filter((event) => event.status === 'finished').length,
            });
          }

          return { eventsMap, statsMap } as FestivalData;
        }),
      );
    }),
    startWith(null),
    shareReplay(1),
  );

  readonly festivalData = toSignal(this.festivalData$, { initialValue: null });

  sortedEvents(festivalId: string): FestivalEvent[] {
    const events = this.festivalData()?.eventsMap.get(festivalId) ?? [];
    return [...events].sort((a, b) => b.year - a.year);
  }

  onNameInput(event: Event): void {
    this.newFestivalName.set((event.target as HTMLInputElement).value);
  }

  async createFestival(): Promise<void> {
    const name = this.newFestivalName().trim();
    if (name.length < 3) return;

    this.isSaving.set(true);
    try {
      await this.festivalService.createFestival(name);
      this.newFestivalName.set('');
      this.showForm.set(false);
    } finally {
      this.isSaving.set(false);
    }
  }

  cancelCreate(): void {
    this.newFestivalName.set('');
    this.showForm.set(false);
  }

  startEdit(festival: Festival): void {
    this.editingFestivalId.set(festival.festivalId);
    this.editingName.set(festival.name);
  }

  cancelEdit(): void {
    this.editingFestivalId.set(null);
    this.editingName.set('');
  }

  onEditNameInput(event: Event): void {
    this.editingName.set((event.target as HTMLInputElement).value);
  }

  async saveEdit(festivalId: string): Promise<void> {
    const name = this.editingName().trim();
    if (name.length < 3) return;
    this.isSavingEdit.set(true);
    try {
      await this.festivalService.updateFestivalName(festivalId, name);
      this.editingFestivalId.set(null);
      this.editingName.set('');
    } finally {
      this.isSavingEdit.set(false);
    }
  }
}
