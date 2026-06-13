import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentRequest } from '../../models/payment.model';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-modal.component.html',
  styleUrls: ['./payment-modal.component.css']
})
export class PaymentModalComponent {
  @Input() plan: 'basic' | 'pro' | null = null;
  @Output() cancel = new EventEmitter<void>();
  @Output() submit = new EventEmitter<Partial<PaymentRequest>>();

  method: 'gcash' | 'maya' | null = null;
  qrUrl: string | null = null;
  screenshotFile: File | null = null;
  screenshotPreview: string | null = null;

  constructor(private subscriptionService: SubscriptionService) {}

  onMethodSelect(m: 'gcash' | 'maya') {
    this.method = m;
    // update QR based on method
    if (m === 'gcash') {
      this.qrUrl = this.subscriptionService.getGcashQr();
    } else if (m === 'maya') {
      this.qrUrl = this.subscriptionService.getMayaQr();
    }
  }

  onScreenshotChange(event: any) {
    const f = event.target.files && event.target.files[0];
    if (f && f.type.startsWith('image/')) {
      this.screenshotFile = f;
      // Convert file to base64 for persistent storage
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.screenshotPreview = e.target.result;
      };
      reader.readAsDataURL(f);
    }
  }

  send() {
    this.submit.emit({ 
      method: this.method!, 
      screenshotUrl: this.screenshotPreview || undefined 
    });
  }
}
