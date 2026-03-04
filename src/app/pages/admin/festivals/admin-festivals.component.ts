import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, shareReplay, take } from 'rxjs';

import { InlineSpinnerComponent } from '../../../components/inline-spinner/inline-spinner.component';
import { LoadingSpinnerComponent } from '../../../components/loading-spinner/loading-spinner.component';
import { Festival } from '../../../models/festival.model';
import { FestivalService } from '../../../services/festival.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-admin-festivals',
  imports: [LoadingSpinnerComponent, InlineSpinnerComponent, LucideAngularModule],
  templateUrl: './admin-festivals.component.html',
  styleUrl: './admin-festivals.component.scss',
})
export class AdminFestivalsComponent {
  private readonly festivalService = inject(FestivalService);

  private readonly festivals$ = this.festivalService.getAllFestivals().pipe(shareReplay(1));
  readonly festivals = toSignal(this.festivals$, { initialValue: [] });
  readonly dataReady = toSignal(this.festivals$.pipe(take(1), map(() => true)), {
    initialValue: false,
  });
  readonly showForm = signal(false);
  readonly newFestivalName = signal('');
  readonly isSaving = signal(false);
  readonly activatingId = signal<string | null>(null);
  readonly activateError = signal(false);
  readonly editingFestivalId = signal<string | null>(null);
  readonly editingName = signal('');
  readonly isSavingEdit = signal(false);

  readonly newFestivalNameValid = computed(() => this.newFestivalName().trim().length >= 3);
  readonly editingNameValid = computed(() => this.editingName().trim().length >= 3);

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

  async setActive(festivalId: string): Promise<void> {
    this.activatingId.set(festivalId);
    this.activateError.set(false);
    try {
      await this.festivalService.setActiveFestival(festivalId);
    } catch (error) {
      if (error instanceof Error && error.message === 'NON_FINISHED_EVENTS_EXIST') {
        this.activateError.set(true);
        setTimeout(() => this.activateError.set(false), 5000);
      }
    } finally {
      this.activatingId.set(null);
    }
  }
}
