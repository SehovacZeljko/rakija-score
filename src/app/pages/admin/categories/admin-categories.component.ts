import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, startWith, switchMap } from 'rxjs';

import { EventCardComponent } from '../../../components/event-card/event-card.component';
import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { SelectDropdownComponent } from '../../../components/select-dropdown/select-dropdown.component';
import { CategoryService } from '../../../services/category.service';
import { EventService } from '../../../services/event.service';
import { FestivalContextService } from '../../../services/festival-context.service';
import { FestivalService } from '../../../services/festival.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-admin-categories',
  imports: [LoadingSpinnerComponent, EventCardComponent, SelectDropdownComponent, LucideAngularModule],
  templateUrl: './admin-categories.component.html',
  styleUrl: './admin-categories.component.scss',
})
export class AdminCategoriesComponent {
  private readonly ctx = inject(FestivalContextService);
  private readonly eventService = inject(EventService);
  private readonly categoryService = inject(CategoryService);
  private readonly festivalService = inject(FestivalService);

  readonly activeFestival = this.ctx.activeFestival;
  readonly dataReady = this.ctx.dataReady;
  readonly allFestivals = toSignal(this.festivalService.getAllFestivals(), { initialValue: [] });

  private readonly events$ = this.festivalService.getAllFestivals().pipe(
    switchMap((festivals) => {
      if (!festivals.length) return of([]);
      return combineLatest(
        festivals.map((festival) => this.eventService.getEventsForFestival(festival.festivalId)),
      ).pipe(map((eventArrays) => eventArrays.flat()));
    }),
    startWith([]),
  );

  readonly events = toSignal(this.events$, { initialValue: [] });

  private readonly categories$ = this.events$.pipe(
    switchMap((events) => {
      const eventIds = events.map((e) => e.eventId);
      return this.categoryService.getCategoriesForEvents(eventIds);
    }),
  );

  readonly categories = toSignal(this.categories$, { initialValue: [] });

  readonly categoriesByEventId = computed(() => {
    const categoryMap = new Map<string, ReturnType<typeof this.categories>[number][]>();
    for (const category of this.categories()) {
      const list = categoryMap.get(category.eventId) ?? [];
      list.push(category);
      categoryMap.set(category.eventId, list);
    }
    return categoryMap;
  });

  // New event form state
  readonly showEventForm = signal(false);
  readonly newEventName = signal('');
  readonly newEventYear = signal(new Date().getFullYear());
  readonly isSavingEvent = signal(false);
  readonly selectedFestivalId = signal('');
  readonly showNewFestivalInput = signal(false);
  readonly newFestivalNameForEvent = signal('');

  readonly festivalOptions = computed(() =>
    this.allFestivals().map((festival) => ({ id: festival.festivalId, label: festival.name })),
  );

  readonly festivalNameMap = computed(() =>
    new Map(this.allFestivals().map((festival) => [festival.festivalId, festival.name])),
  );

  readonly allFestivalIds = computed(() => this.allFestivals().map((festival) => festival.festivalId));

  readonly sortedEvents = computed(() =>
    [...this.events()].sort(
      (a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0),
    ),
  );

  categoriesForEvent(eventId: string) {
    return this.categoriesByEventId().get(eventId) ?? [];
  }

  onEventNameInput(domEvent: Event): void {
    this.newEventName.set((domEvent.target as HTMLInputElement).value);
  }

  onEventYearInput(domEvent: Event): void {
    const val = parseInt((domEvent.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) this.newEventYear.set(val);
  }

  onFestivalSelected(festivalId: string | null): void {
    this.showNewFestivalInput.set(false);
    this.selectedFestivalId.set(festivalId ?? '');
  }

  onNewFestivalAction(): void {
    this.showNewFestivalInput.set(true);
    this.selectedFestivalId.set('');
  }

  onNewFestivalNameInput(domEvent: Event): void {
    this.newFestivalNameForEvent.set((domEvent.target as HTMLInputElement).value);
  }

  async createEvent(): Promise<void> {
    const eventName = this.newEventName().trim();
    if (!eventName) return;

    if (this.showNewFestivalInput() && this.newFestivalNameForEvent().trim().length < 3) return;
    if (!this.showNewFestivalInput() && !this.selectedFestivalId()) return;

    this.isSavingEvent.set(true);
    try {
      let festivalId = this.selectedFestivalId();
      if (this.showNewFestivalInput()) {
        festivalId = await this.festivalService.createFestival(this.newFestivalNameForEvent().trim());
      }

      await Promise.all([
        this.festivalService.setActiveFestival(festivalId),
        this.eventService.finishAllNonFinishedEvents(festivalId),
      ]);
      await this.eventService.createEvent(festivalId, eventName, this.newEventYear());
      this.newEventName.set('');
      this.newEventYear.set(new Date().getFullYear());
      this.selectedFestivalId.set('');
      this.showNewFestivalInput.set(false);
      this.newFestivalNameForEvent.set('');
      this.showEventForm.set(false);
    } finally {
      this.isSavingEvent.set(false);
    }
  }

  cancelEventForm(): void {
    this.newEventName.set('');
    this.newEventYear.set(new Date().getFullYear());
    this.selectedFestivalId.set('');
    this.showNewFestivalInput.set(false);
    this.newFestivalNameForEvent.set('');
    this.showEventForm.set(false);
  }

  onNewEventClick(): void {
    this.selectedFestivalId.set(this.activeFestival()?.festivalId ?? '');
    this.showEventForm.set(true);
  }
}
