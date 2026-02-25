import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { FestivalService } from '../../../services/festival.service';

@Component({
  selector: 'app-admin-festivals',
  imports: [],
  templateUrl: './admin-festivals.component.html',
  styleUrl: './admin-festivals.component.scss',
})
export class AdminFestivalsComponent {
  private readonly festivalService = inject(FestivalService);

  readonly festivals = toSignal(this.festivalService.getAllFestivals(), { initialValue: [] });
  readonly showForm = signal(false);
  readonly newFestivalName = signal('');
  readonly isSaving = signal(false);
  readonly activatingId = signal<string | null>(null);

  onNameInput(event: Event): void {
    this.newFestivalName.set((event.target as HTMLInputElement).value);
  }

  async createFestival(): Promise<void> {
    const name = this.newFestivalName().trim();
    if (!name) return;

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

  async setActive(festivalId: string): Promise<void> {
    this.activatingId.set(festivalId);
    try {
      await this.festivalService.setActiveFestival(festivalId);
    } finally {
      this.activatingId.set(null);
    }
  }
}
