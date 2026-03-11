import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BarcodeFormat } from '@zxing/library';

import { LucideAngularModule } from 'lucide-angular';
import { ZXingScannerModule } from '@zxing/ngx-scanner';

import { BarcodeScanService } from '../../services/barcode-scan.service';
import { SampleService } from '../../services/sample.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-barcode-scanner',
  imports: [LucideAngularModule, ZXingScannerModule],
  templateUrl: './barcode-scanner.component.html',
  styleUrl: './barcode-scanner.component.scss',
})
export class BarcodeScannerComponent {
  private readonly scanService = inject(BarcodeScanService);
  private readonly sampleService = inject(SampleService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly isProcessing = signal(false);
  readonly hasPermission = signal<boolean | null>(null);
  readonly hasCameras = signal<boolean | null>(null);
  readonly lastDetected = signal<string | null>(null);

  readonly formats = [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.QR_CODE,
  ];

  private lastScannedCode = '';
  private lastScanTime = 0;

  onPermissionResponse(hasPermission: boolean): void {
    this.hasPermission.set(hasPermission);
  }

  onCamerasFound(): void {
    this.hasCameras.set(true);
  }

  onCamerasNotFound(): void {
    this.hasCameras.set(false);
  }

  onScanFailure(): void {
    // Scan attempt made but nothing detected — scanner is running
  }

  async onScanSuccess(scannedCode: string): Promise<void> {
    const now = Date.now();
    if (scannedCode === this.lastScannedCode && now - this.lastScanTime < 2000) return;
    if (this.isProcessing()) return;

    this.lastScannedCode = scannedCode;
    this.lastScanTime = now;
    this.lastDetected.set(scannedCode);
    this.isProcessing.set(true);

    try {
      const categoryIds = this.scanService.assignedCategoryIds();
      const sample = await firstValueFrom(this.sampleService.getSampleByCodeGlobal(scannedCode));

      if (!sample) {
        this.toastService.show(`Uzorak "${scannedCode}" nije pronađen`, 'error');
      } else if (!categoryIds.includes(sample.categoryId)) {
        this.toastService.show('Niste dodijeljeni ovoj kategoriji', 'error');
      } else {
        await this.router.navigate(['/scoring', sample.categoryId, sample.sampleId]);
        this.scanService.close();
      }
    } finally {
      this.isProcessing.set(false);
    }
  }

  close(): void {
    this.scanService.close();
  }
}
