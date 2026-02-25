import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface NavItem {
  route: string;
  label: string;
  icon: 'home' | 'calendar' | 'layers' | 'briefcase' | 'list' | 'users';
}

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
  @Input({ required: true }) items: NavItem[] = [];
}
