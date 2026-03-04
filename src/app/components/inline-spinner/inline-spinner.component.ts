import { Component, input } from '@angular/core';

@Component({
  selector: 'app-inline-spinner',
  imports: [],
  templateUrl: './inline-spinner.component.html',
  styleUrl: './inline-spinner.component.scss',
})
export class InlineSpinnerComponent {
  readonly size = input(12);
}
