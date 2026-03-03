import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-instructions',
  imports: [],
  templateUrl: './instructions.component.html',
  styleUrl: './instructions.component.scss',
})
export class InstructionsComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  get isAdmin(): boolean {
    return this.authService.currentUser()?.role === 'admin';
  }

  get homeRoute(): string {
    return this.isAdmin ? '/admin/festivals' : '/dashboard';
  }

  goBack(): void {
    this.router.navigate([this.homeRoute]);
  }
}
