import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  imports: [],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly message = input.required<string>();
  readonly confirmLabel = input('Potvrdi');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
