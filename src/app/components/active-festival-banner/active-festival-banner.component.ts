import { Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

import { FestivalContextService } from '../../services/festival-context.service';

@Component({
  selector: 'app-active-festival-banner',
  templateUrl: './active-festival-banner.component.html',
  styleUrl: './active-festival-banner.component.scss',
  imports: [LucideAngularModule],
})
export class ActiveFestivalBannerComponent {
  readonly ctx = inject(FestivalContextService);
}
