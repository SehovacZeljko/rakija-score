import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BarcodeScannerComponent } from './components/barcode-scanner/barcode-scanner.component';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { ToastComponent } from './components/toast/toast.component';
import { BarcodeScanService } from './services/barcode-scan.service';
import { FestivalContextService } from './services/festival-context.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, BarcodeScannerComponent, LoadingSpinnerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly scanService = inject(BarcodeScanService);
  readonly ctx = inject(FestivalContextService);
}
