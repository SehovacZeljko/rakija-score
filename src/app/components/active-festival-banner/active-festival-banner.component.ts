import { Component, inject } from '@angular/core';

import { FestivalContextService } from '../../services/festival-context.service';

@Component({
  selector: 'app-active-festival-banner',
  templateUrl: './active-festival-banner.component.html',
  styleUrl: './active-festival-banner.component.scss',
})
export class ActiveFestivalBannerComponent {
  readonly ctx = inject(FestivalContextService);
}
