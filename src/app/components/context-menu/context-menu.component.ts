import { Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

import { InlineSpinnerComponent } from '../inline-spinner/inline-spinner.component';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  action?: () => void;
  routerLink?: string[];
  queryParams?: Record<string, string>;
  destructive?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

@Component({
  selector: 'app-context-menu',
  imports: [LucideAngularModule, RouterLink, InlineSpinnerComponent],
  templateUrl: './context-menu.component.html',
  styleUrl: './context-menu.component.scss',
})
export class ContextMenuComponent {
  readonly items = input.required<ContextMenuItem[]>();

  readonly isOpen = signal(false);

  toggle(domEvent: MouseEvent): void {
    domEvent.stopPropagation();
    this.isOpen.update((open) => !open);
  }

  close(): void {
    this.isOpen.set(false);
  }

  handleAction(item: ContextMenuItem): void {
    this.close();
    item.action?.();
  }
}
