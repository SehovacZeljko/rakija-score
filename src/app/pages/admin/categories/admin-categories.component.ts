import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';

import { EventCardComponent } from '../../../components/event-card/event-card.component';
import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { CategoryService } from '../../../services/category.service';
import { EventService } from '../../../services/event.service';
import { FestivalContextService } from '../../../services/festival-context.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-admin-categories',
  imports: [LoadingSpinnerComponent, EventCardComponent, LucideAngularModule],
  templateUrl: './admin-categories.component.html',
  styleUrl: './admin-categories.component.scss',
})
export class AdminCategoriesComponent {
  private readonly ctx = inject(FestivalContextService);
  private readonly eventService = inject(EventService);
  private readonly categoryService = inject(CategoryService);

  readonly activeFestival = this.ctx.activeFestival;
  readonly dataReady = this.ctx.dataReady;

  private readonly events$ = this.ctx.activeFestival$.pipe(
    switchMap((f) => (f ? this.eventService.getEventsForFestival(f.festivalId) : of([]))),
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

  async createEvent(): Promise<void> {
    const name = this.newEventName().trim();
    const festivalId = this.activeFestival()?.festivalId;
    if (!name || !festivalId) return;

    this.isSavingEvent.set(true);
    try {
      await this.eventService.createEvent(festivalId, name, this.newEventYear());
      this.newEventName.set('');
      this.newEventYear.set(new Date().getFullYear());
      this.showEventForm.set(false);
    } finally {
      this.isSavingEvent.set(false);
    }
  }

  cancelEventForm(): void {
    this.newEventName.set('');
    this.newEventYear.set(new Date().getFullYear());
    this.showEventForm.set(false);
  }

  onNewEventClick(): void {
    this.showEventForm.set(true);
  }
}
