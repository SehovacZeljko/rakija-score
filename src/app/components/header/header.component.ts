import { Component, Input, inject } from '@angular/core';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  @Input({ required: true }) title!: string;

  protected readonly authService = inject(AuthService);

  logout(): void {
    this.authService.logout();
  }
}
