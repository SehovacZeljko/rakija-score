import { Component } from '@angular/core';

import { BottomNavComponent, NavItem } from '../../components/bottom-nav/bottom-nav.component';
import { HeaderComponent } from '../../components/header/header.component';

@Component({
  selector: 'app-dashboard',
  imports: [HeaderComponent, BottomNavComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  readonly navItems: NavItem[] = [{ route: '/dashboard', label: 'Početna', icon: 'home' }];
}
