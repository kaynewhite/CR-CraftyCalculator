import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SubscriptionService } from '../../services/subscription.service';
import { ApiService } from '../../services/api.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-qr-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './qr-manager.component.html',
  styleUrls: ['./qr-manager.component.css']
})
export class QrManagerComponent implements OnInit {
  currentMayaQr: string | null = null;
  currentGcashQr: string | null = null;
  editingMethod: 'maya' | 'gcash' | null = null;
  newQrPreview: string | null = null;
  saving = false;
  successMsg = '';
  errorMsg = '';

  sidebarOpen = false;
  sidebarCollapsed = false;

  constructor(
    private subscriptionService: SubscriptionService,
    private api: ApiService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.setTheme(this.themeService.getCurrentTheme());
    this.subscriptionService.qr$.subscribe(qr => {
      this.currentMayaQr = qr.maya;
      this.currentGcashQr = qr.gcash;
    });
  }

  startEdit(method: 'maya' | 'gcash'): void {
    this.editingMethod = method;
    this.newQrPreview = null;
    this.successMsg = '';
    this.errorMsg = '';
  }

  cancelEdit(): void {
    this.editingMethod = null;
    this.newQrPreview = null;
  }

  onFileChange(event: any): void {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.newQrPreview = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  saveQr(): void {
    if (!this.editingMethod || !this.newQrPreview) return;
    this.saving = true;
    this.errorMsg = '';
    this.api.setQrCode(this.editingMethod, this.newQrPreview).subscribe({
      next: () => {
        if (this.editingMethod === 'maya') {
          this.subscriptionService.setMayaQr(this.newQrPreview);
        } else {
          this.subscriptionService.setGcashQr(this.newQrPreview);
        }
        this.saving = false;
        this.successMsg = `${this.editingMethod!.toUpperCase()} QR code updated successfully.`;
        this.editingMethod = null;
        this.newQrPreview = null;
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: () => {
        this.saving = false;
        this.errorMsg = 'Failed to save QR code. Please try again.';
      }
    });
  }

  clearQr(method: 'maya' | 'gcash'): void {
    if (!confirm(`Remove the current ${method === 'maya' ? 'PayMaya' : 'GCash'} QR code?`)) return;
    this.api.setQrCode(method, '').subscribe({
      next: () => {
        if (method === 'maya') this.subscriptionService.setMayaQr(null);
        else this.subscriptionService.setGcashQr(null);
        this.successMsg = `${method === 'maya' ? 'PayMaya' : 'GCash'} QR removed.`;
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: () => { this.errorMsg = 'Failed to remove QR code.'; }
    });
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  onSidebarClose(): void { this.sidebarOpen = false; }
  onCollapseSidebar(): void { this.sidebarCollapsed = !this.sidebarCollapsed; }
}
