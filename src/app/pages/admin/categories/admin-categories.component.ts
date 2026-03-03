import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, of, shareReplay, switchMap, take } from 'rxjs';

import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { Category } from '../../../models/category.model';
import { FestivalEvent } from '../../../models/event.model';
import { CategoryService } from '../../../services/category.service';
import { EventService } from '../../../services/event.service';
import { FestivalService } from '../../../services/festival.service';

@Component({
  selector: 'app-admin-categories',
  imports: [LoadingSpinnerComponent, RouterLink],
  templateUrl: './admin-categories.component.html',
  styleUrl: './admin-categories.component.scss',
})
export class AdminCategoriesComponent {
  private readonly festivalService = inject(FestivalService);
  private readonly eventService = inject(EventService);
  private readonly categoryService = inject(CategoryService);

  private readonly activeFestival$ = this.festivalService.getActiveFestival().pipe(shareReplay(1));

  readonly activeFestival = toSignal(this.activeFestival$, { initialValue: null });
  readonly dataReady = toSignal(this.activeFestival$.pipe(take(1), map(() => true)), {
    initialValue: false,
  });

  private readonly events$ = this.activeFestival$.pipe(
    switchMap((f) => (f ? this.eventService.getEventsForFestival(f.festivalId) : of([]))),
  );

  readonly events = toSignal(this.events$, { initialValue: [] });

  private readonly categories$ = this.events$.pipe(
    switchMap((events) => {
      const ids = events.map((e) => e.eventId);
      return this.categoryService.getCategoriesForEvents(ids);
    }),
  );

  readonly categories = toSignal(this.categories$, { initialValue: [] });

  readonly hasActiveEvent = computed(() => this.events().some((e) => e.status === 'active'));
  readonly hasNonFinishedEvent = computed(() =>
    this.events().some((e) => e.status === 'active' || e.status === 'staging'),
  );

  // Event form state
  readonly showEventForm = signal(false);
  readonly newEventName = signal('');
  readonly newEventYear = signal(new Date().getFullYear());
  readonly isSavingEvent = signal(false);

  // Event transition state
  readonly activatingEventId = signal<string | null>(null);
  readonly finishingEventId = signal<string | null>(null);
  readonly revertingEventId = signal<string | null>(null);
  readonly revertErrorEventId = signal<string | null>(null);
  readonly reopeningEventId = signal<string | null>(null);

  // Category form state — stores eventId of the event whose form is open
  readonly activeCategoryFormEventId = signal<string | null>(null);
  readonly newCategoryName = signal('');
  readonly isSavingCategory = signal(false);

  // Delete state
  readonly deletingCategoryId = signal<string | null>(null);
  readonly deleteErrorCategoryId = signal<string | null>(null);

  categoriesForEvent(eventId: string): Category[] {
    return this.categories().filter((c) => c.eventId === eventId);
  }

  readonly sortedEvents = computed(() => {
    // Sort by creation time only — stable positions prevent confusing card jumps
    // when an event changes status. Status is visible via badges.
    return [...this.events()].sort(
      (a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0),
    );
  });

  onEventNameInput(event: Event): void {
    this.newEventName.set((event.target as HTMLInputElement).value);
  }

  onEventYearInput(event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) this.newEventYear.set(val);
  }

  onCategoryNameInput(event: Event): void {
    this.newCategoryName.set((event.target as HTMLInputElement).value);
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

  async activateEvent(eventId: string): Promise<void> {
    const festivalId = this.activeFestival()?.festivalId;
    if (!festivalId) return;
    this.activatingEventId.set(eventId);
    try {
      await this.eventService.activateEvent(festivalId, eventId);
    } finally {
      this.activatingEventId.set(null);
    }
  }

  async finishEvent(eventId: string): Promise<void> {
    this.finishingEventId.set(eventId);
    try {
      await this.eventService.finishEvent(eventId);
    } finally {
      this.finishingEventId.set(null);
    }
  }

  async reopenEvent(eventId: string): Promise<void> {
    const festivalId = this.activeFestival()?.festivalId;
    if (!festivalId) return;
    this.reopeningEventId.set(eventId);
    try {
      await this.eventService.reopenEvent(festivalId, eventId);
    } finally {
      this.reopeningEventId.set(null);
    }
  }

  async revertToStaging(eventId: string): Promise<void> {
    this.revertingEventId.set(eventId);
    this.revertErrorEventId.set(null);
    try {
      await this.eventService.revertToStaging(eventId);
    } catch (error) {
      if (error instanceof Error && error.message === 'SCORES_EXIST') {
        this.revertErrorEventId.set(eventId);
        setTimeout(() => this.revertErrorEventId.set(null), 4000);
      }
    } finally {
      this.revertingEventId.set(null);
    }
  }

  openCategoryForm(eventId: string): void {
    this.newCategoryName.set('');
    this.activeCategoryFormEventId.set(eventId);
  }

  async createCategory(): Promise<void> {
    const name = this.newCategoryName().trim();
    const eventId = this.activeCategoryFormEventId();
    if (!name || !eventId) return;

    this.isSavingCategory.set(true);
    try {
      await this.categoryService.createCategory(eventId, name);
      this.newCategoryName.set('');
      this.activeCategoryFormEventId.set(null);
    } finally {
      this.isSavingCategory.set(false);
    }
  }

  cancelCategoryForm(): void {
    this.newCategoryName.set('');
    this.activeCategoryFormEventId.set(null);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    this.deletingCategoryId.set(categoryId);
    this.deleteErrorCategoryId.set(null);
    try {
      await this.categoryService.deleteCategory(categoryId);
    } catch {
      this.deleteErrorCategoryId.set(categoryId);
      setTimeout(() => this.deleteErrorCategoryId.set(null), 3000);
    } finally {
      this.deletingCategoryId.set(null);
    }
  }
}
