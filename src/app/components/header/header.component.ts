import { Component, Input, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { NavItem } from '../bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, NgClass],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() items: NavItem[] = [];

  protected readonly authService = inject(AuthService);

  get homeRoute(): string {
    return this.authService.currentUser()?.role === 'admin' ? '/admin/festivals' : '/dashboard';
  }

  logout(): void {
    this.authService.logout();
  }
}
