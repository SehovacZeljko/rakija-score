import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, of, shareReplay, switchMap, take } from 'rxjs';

import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { Category } from '../../../models/category.model';
import { CategoryService } from '../../../services/category.service';
import { EventService } from '../../../services/event.service';
import { FestivalService } from '../../../services/festival.service';

@Component({
  selector: 'app-admin-categories',
  imports: [LoadingSpinnerComponent],
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

  // Event form state
  readonly showEventForm = signal(false);
  readonly newEventName = signal('');
  readonly newEventYear = signal(new Date().getFullYear());
  readonly isSavingEvent = signal(false);

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
