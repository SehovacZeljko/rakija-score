import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BarcodeScanService {
  readonly isOpen = signal(false);
  readonly assignedCategoryIds = signal<string[]>([]);

  open(categoryIds: string[]): void {
    this.assignedCategoryIds.set(categoryIds);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
