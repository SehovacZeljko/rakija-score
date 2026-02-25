import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BottomNavComponent, NavItem } from '../../components/bottom-nav/bottom-nav.component';
import { HeaderComponent } from '../../components/header/header.component';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, HeaderComponent, BottomNavComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  readonly navItems: NavItem[] = [
    { route: '/admin/festivals', label: 'Festivali', icon: 'calendar' },
    { route: '/admin/categories', label: 'Kategorije', icon: 'layers' },
    { route: '/admin/producers', label: 'Proizvođači', icon: 'briefcase' },
    { route: '/admin/samples', label: 'Uzorci', icon: 'list' },
    { route: '/admin/judges', label: 'Sudije', icon: 'users' },
  ];
}
