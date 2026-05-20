import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { SubscriptionService } from '../../services/subscription.service';
import { ThemeService } from '../../services/theme.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

interface PaymentWithDetails {
  id: string;
  userId: string;
  userName: string;
  plan: string;
  method: string;
  screenshotUrl: string;
  status: string;
  feedback?: string;
  feedbackInput?: string;
  createdAt: string;
}

@Component({
  selector: 'app-payment-approval',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './payment-approval.component.html',
  styleUrls: ['./payment-approval.component.css'],
})
export class PaymentApprovalComponent implements OnInit {
  payments: PaymentWithDetails[] = [];
  filteredPayments: PaymentWithDetails[] = [];
  currentUser: any;
  isLoading = true;
  filterStatus = 'all';
  searchTerm = '';
  expandedPaymentId: string | null = null;
  sidebarOpen = false;
  sidebarCollapsed = false;
  isDarkMode = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private api: ApiService,
    private subscriptionService: SubscriptionService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.setTheme(this.themeService.getCurrentTheme());
    this.themeService.isDarkMode$.subscribe(isDark => (this.isDarkMode = isDark));

    this.currentUser = this.authService.currentUserValue;
    if (!this.currentUser || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'superadmin')) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadPayments();
  }

  loadPayments(): void {
    this.isLoading = true;
    this.api.getAllPayments().subscribe({
      next: (rows: any[]) => {
        this.payments = rows.map(p => ({
          id: p.id,
          userId: p.user_id,
          userName: p.user_name || p.user_id,
          plan: p.plan,
          method: p.method,
          screenshotUrl: p.screenshot_url || '',
          status: p.status,
          feedback: p.feedback,
          feedbackInput: '',
          createdAt: p.created_at,
        }));
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('[Payments] Load error:', err);
        this.isLoading = false;
      },
    });
  }

  applyFilters(): void {
    let filtered = [...this.payments];
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(p => {
        if (this.filterStatus === 'subscribing') {
          return ['pending', 'scanning'].includes(p.status);
        }
        if (this.filterStatus === 'subscribed') {
          return p.status === 'approved';
        }
        if (this.filterStatus === 'rejected') {
          return p.status === 'rejected';
        }
        return true;
      });
    }
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.userName.toLowerCase().includes(term) ||
          p.userId.toLowerCase().includes(term)
      );
    }
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.filteredPayments = filtered;
  }

  getSubscriptionState(status: string): string {
    if (['pending', 'scanning'].includes(status)) {
      return 'Subscribing';
    }
    if (status === 'approved') {
      return 'Subscribed';
    }
    if (status === 'rejected') {
      return 'Subscription Rejected';
    }
    return 'Unknown';
  }

  onFilterChange(): void { this.applyFilters(); }
  onSearchChange(): void { this.applyFilters(); }

  toggleExpanded(paymentId: string): void {
    this.expandedPaymentId = this.expandedPaymentId === paymentId ? null : paymentId;
  }

  approvePayment(payment: PaymentWithDetails): void {
    if (!confirm(`Approve payment from ${payment.userName}?`)) return;
    this.api.approvePayment(payment.id).subscribe({
      next: () => {
        // Backend already upgrades the subscription once a payment is approved.
        this.loadPayments();
      },
      error: (err: any) => alert('Failed to approve: ' + err.message),
    });
  }

  rejectPayment(payment: PaymentWithDetails): void {
    if (!payment.feedbackInput?.trim()) {
      alert('Please provide feedback before rejecting.');
      return;
    }
    if (!confirm('Reject this payment?')) return;
    this.api.rejectPayment(payment.id, payment.feedbackInput).subscribe({
      next: () => this.loadPayments(),
      error: (err: any) => alert('Failed to reject: ' + err.message),
    });
  }

  getPlanPrice(planId: string): number {
    const plan = this.subscriptionService.getPlans().find(p => p.id === planId);
    return plan?.price || 0;
  }

  getPlanName(planId: string): string {
    return planId.charAt(0).toUpperCase() + planId.slice(1);
  }

  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      pending: 'badge-warning',
      scanning: 'badge-info',
      approved: 'badge-success',
      rejected: 'badge-danger',
    };
    return classes[status] || 'badge-secondary';
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  onSidebarClose(): void { this.sidebarOpen = false; }
  onCollapseSidebar(): void { this.sidebarCollapsed = !this.sidebarCollapsed; }
}
