import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';

import { InlineSpinnerComponent } from '../../../components/inline-spinner/inline-spinner.component';
import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { FestivalEvent } from '../../../models/event.model';
import { CategoryService } from '../../../services/category.service';
import { EventService } from '../../../services/event.service';
import { FestivalContextService } from '../../../services/festival-context.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-admin-categories',
  imports: [LoadingSpinnerComponent, InlineSpinnerComponent, RouterLink, LucideAngularModule],
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

  // Event form state
  readonly showEventForm = signal(false);
  readonly newEventName = signal('');
  readonly newEventYear = signal(new Date().getFullYear());
  readonly isSavingEvent = signal(false);

  // Event edit state
  readonly editingEventId = signal<string | null>(null);
  readonly editingEventName = signal('');
  readonly editingEventYear = signal(new Date().getFullYear());
  readonly isSavingEventEdit = signal(false);
  readonly editingEventNameValid = computed(() => this.editingEventName().trim().length >= 3);

  // Event transition state
  readonly activatingEventId = signal<string | null>(null);
  readonly finishingEventId = signal<string | null>(null);
  readonly revertingEventId = signal<string | null>(null);
  readonly reopeningEventId = signal<string | null>(null);

  // Category form state — stores eventId of the event whose form is open
  readonly activeCategoryFormEventId = signal<string | null>(null);
  readonly newCategoryName = signal('');
  readonly isSavingCategory = signal(false);

  // Delete state
  readonly deletingCategoryId = signal<string | null>(null);
  readonly deleteErrorCategoryId = signal<string | null>(null);

  categoriesForEvent(eventId: string) {
    return this.categoriesByEventId().get(eventId) ?? [];
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

  onNewEventClick(): void {
    this.showEventForm.set(true);
  }

  startEventEdit(festivalEvent: FestivalEvent): void {
    this.editingEventId.set(festivalEvent.eventId);
    this.editingEventName.set(festivalEvent.name);
    this.editingEventYear.set(festivalEvent.year);
  }

  cancelEventEdit(): void {
    this.editingEventId.set(null);
    this.editingEventName.set('');
    this.editingEventYear.set(new Date().getFullYear());
  }

  onEditEventNameInput(event: Event): void {
    this.editingEventName.set((event.target as HTMLInputElement).value);
  }

  onEditEventYearInput(event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) this.editingEventYear.set(val);
  }

  async saveEventEdit(eventId: string): Promise<void> {
    const name = this.editingEventName().trim();
    if (name.length < 3) return;
    this.isSavingEventEdit.set(true);
    try {
      await this.eventService.updateEvent(eventId, name, this.editingEventYear());
      this.editingEventId.set(null);
      this.editingEventName.set('');
    } finally {
      this.isSavingEventEdit.set(false);
    }
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
    try {
      await this.eventService.revertToStaging(eventId);
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
