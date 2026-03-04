import { Component, ElementRef, HostListener, Input, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

import { AuthService } from '../../services/auth.service';
import { NavItem } from '../bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, NgClass, LucideAngularModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() items: NavItem[] = [];
  @Input() backRoute: string | null = null;
  @Input() subtitle: string = '';

  protected readonly authService = inject(AuthService);
  private readonly elementRef = inject(ElementRef);
  private readonly router = inject(Router);

  readonly isMenuOpen = signal(false);

  get homeRoute(): string {
    return this.authService.currentUser()?.role === 'admin' ? '/admin/festivals' : '/dashboard';
  }

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isMenuOpen.set(false);
    }
  }

  navigateTo(path: string): void {
    this.isMenuOpen.set(false);
    this.router.navigate([path]);
  }

  goBack(): void {
    this.router.navigate([this.backRoute]);
  }

  logout(): void {
    this.isMenuOpen.set(false);
    this.authService.logout();
  }
}
