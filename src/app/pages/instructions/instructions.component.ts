import { Component, inject } from '@angular/core';

import { HeaderComponent } from '../../components/header/header.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-instructions',
  imports: [HeaderComponent],
  templateUrl: './instructions.component.html',
  styleUrl: './instructions.component.scss',
})
export class InstructionsComponent {
  private readonly authService = inject(AuthService);

  get isAdmin(): boolean {
    return this.authService.currentUser()?.role === 'admin';
  }

  get homeRoute(): string {
    return this.isAdmin ? '/admin/festivals' : '/dashboard';
  }
}
