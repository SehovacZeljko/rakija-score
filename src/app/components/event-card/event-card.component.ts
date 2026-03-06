import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

import { InlineSpinnerComponent } from '../inline-spinner/inline-spinner.component';
import { Category } from '../../models/category.model';
import { FestivalEvent } from '../../models/event.model';
import { CategoryService } from '../../services/category.service';
import { EventService } from '../../services/event.service';

@Component({
  selector: 'app-event-card',
  imports: [InlineSpinnerComponent, RouterLink, LucideAngularModule],
  templateUrl: './event-card.component.html',
  styleUrl: './event-card.component.scss',
})
export class EventCardComponent {
  private readonly eventService = inject(EventService);
  private readonly categoryService = inject(CategoryService);

  readonly event = input.required<FestivalEvent>();
  readonly categories = input.required<Category[]>();
  readonly festivalId = input.required<string>();

  // Edit mode
  readonly isEditing = signal(false);
  readonly editingName = signal('');
  readonly editingYear = signal(new Date().getFullYear());
  readonly isSavingEdit = signal(false);
  readonly isEditNameValid = computed(() => this.editingName().trim().length >= 3);

  // Transitions
  readonly isActivating = signal(false);
  readonly isFinishing = signal(false);
  readonly isReverting = signal(false);
  readonly isReopening = signal(false);

  // Category form
  readonly showCategoryForm = signal(false);
  readonly newCategoryName = signal('');
  readonly isSavingCategory = signal(false);

  // Category delete
  readonly deletingCategoryId = signal<string | null>(null);
  readonly deleteErrorCategoryId = signal<string | null>(null);

  startEdit(): void {
    this.editingName.set(this.event().name);
    this.editingYear.set(this.event().year);
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
    this.editingName.set('');
    this.editingYear.set(new Date().getFullYear());
  }

  onEditNameInput(domEvent: Event): void {
    this.editingName.set((domEvent.target as HTMLInputElement).value);
  }

  onEditYearInput(domEvent: Event): void {
    const val = parseInt((domEvent.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) this.editingYear.set(val);
  }

  async saveEdit(): Promise<void> {
    const name = this.editingName().trim();
    if (name.length < 3) return;
    this.isSavingEdit.set(true);
    try {
      await this.eventService.updateEvent(this.event().eventId, name, this.editingYear());
      this.isEditing.set(false);
      this.editingName.set('');
    } finally {
      this.isSavingEdit.set(false);
    }
  }

  async activateEvent(): Promise<void> {
    this.isActivating.set(true);
    try {
      await this.eventService.activateEvent(this.festivalId(), this.event().eventId);
    } finally {
      this.isActivating.set(false);
    }
  }

  async revertToStaging(): Promise<void> {
    this.isReverting.set(true);
    try {
      await this.eventService.revertToStaging(this.event().eventId);
    } finally {
      this.isReverting.set(false);
    }
  }

  async finishEvent(): Promise<void> {
    this.isFinishing.set(true);
    try {
      await this.eventService.finishEvent(this.event().eventId);
    } finally {
      this.isFinishing.set(false);
    }
  }

  async reopenEvent(): Promise<void> {
    this.isReopening.set(true);
    try {
      await this.eventService.reopenEvent(this.festivalId(), this.event().eventId);
    } finally {
      this.isReopening.set(false);
    }
  }

  openCategoryForm(): void {
    this.newCategoryName.set('');
    this.showCategoryForm.set(true);
  }

  cancelCategoryForm(): void {
    this.newCategoryName.set('');
    this.showCategoryForm.set(false);
  }

  onCategoryNameInput(domEvent: Event): void {
    this.newCategoryName.set((domEvent.target as HTMLInputElement).value);
  }

  async createCategory(): Promise<void> {
    const name = this.newCategoryName().trim();
    if (!name) return;
    this.isSavingCategory.set(true);
    try {
      await this.categoryService.createCategory(this.event().eventId, name);
      this.newCategoryName.set('');
      this.showCategoryForm.set(false);
    } finally {
      this.isSavingCategory.set(false);
    }
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
