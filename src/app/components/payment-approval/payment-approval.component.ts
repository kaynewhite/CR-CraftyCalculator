import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PaymentService } from '../../services/payment.service';
import { LogService } from '../../services/log.service';
import { SubscriptionService } from '../../services/subscription.service';
import { ThemeService } from '../../services/theme.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { PaymentRequest } from '../../models/payment.model';

interface PaymentWithDetails {
  id: string;
  userId: string;
  plan: string;
  method: string;
  qrUrl: string;
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
  styleUrls: ['./payment-approval.component.css']
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
    private paymentService: PaymentService,
    private logService: LogService,
    private subscriptionService: SubscriptionService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    // make sure theme classes applied
    this.themeService.setTheme(this.themeService.getCurrentTheme());
    // Initialize theme
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    this.currentUser = (this.authService as any).currentUserValue;
    
    if (!this.currentUser || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'superadmin')) {
      this.router.navigate(['/admin-login']);
      return;
    }

    this.loadPayments();
  }

  loadPayments(): void {
    this.isLoading = true;
    this.paymentService.getAll().subscribe({
      next: (payments: PaymentRequest[]) => {
        this.payments = payments.map(p => ({
          ...p,
          createdAt: typeof p.createdAt === 'string' ? p.createdAt : p.createdAt.toISOString()
        })) as PaymentWithDetails[];
        this.applyFilters();
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.payments];

    // Filter by status
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === this.filterStatus);
    }

    // Filter by search term (userId)
    if (this.searchTerm) {
      filtered = filtered.filter(p => 
        p.userId.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    this.filteredPayments = filtered;
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  toggleExpanded(paymentId: string): void {
    this.expandedPaymentId = this.expandedPaymentId === paymentId ? null : paymentId;
  }

  approvePayment(payment: PaymentWithDetails): void {
    if (!confirm(`Approve payment from ${payment.userId}?`)) {
      return;
    }

    this.paymentService.update(payment.id, { 
      status: 'approved',
      approvedBy: this.currentUser.id,
      approvedAt: new Date().toISOString()
    }).subscribe({
      next: () => {
        // Log the approval
        this.logService.addSubscriptionLog({
          id: `log_${payment.id}`,
          userId: payment.userId,
          action: 'approved',
          plan: payment.plan,
          cost: this.getPlanPrice(payment.plan),
          approvedBy: this.currentUser.name,
          timestamp: new Date().toISOString()
        }).subscribe();

        // Update user subscription via service (handles localStorage & subjects)
        this.subscriptionService.upgradePlanForUser(payment.userId, payment.plan as 'free' | 'basic' | 'pro').subscribe();
        
        // Reload payments
        this.loadPayments();
      }
    });
  }

  rejectPayment(payment: PaymentWithDetails): void {
    if (!payment.feedbackInput || payment.feedbackInput.trim() === '') {
      alert('Please provide feedback before rejecting');
      return;
    }

    if (!confirm('Reject this payment?')) {
      return;
    }

    this.paymentService.update(payment.id, { 
      status: 'rejected',
      feedback: payment.feedbackInput,
      rejectedBy: this.currentUser.id,
      rejectedAt: new Date().toISOString()
    }).subscribe({
      next: () => {
        // Log the rejection
        this.logService.addSubscriptionLog({
          id: `log_${payment.id}_reject`,
          userId: payment.userId,
          action: 'rejected',
          plan: payment.plan,
          cost: this.getPlanPrice(payment.plan),
          feedback: payment.feedbackInput,
          approvedBy: this.currentUser.name,
          timestamp: new Date().toISOString()
        }).subscribe();

        this.loadPayments();
      }
    });
  }

  getPlanPrice(planId: string): number {
    const plan = this.subscriptionService.getPlans().find(p => p.id === planId);
    return plan?.price || 0;
  }

  getPlanName(planId: string): string {
    const plan = this.subscriptionService.getPlans().find(p => p.id === planId);
    return plan?.name || planId;
  }

  getStatusBadgeClass(status: string): string {
    const classes: { [key: string]: string } = {
      'pending': 'badge-warning',
      'scanning': 'badge-info',
      'approved': 'badge-success',
      'rejected': 'badge-danger'
    };
    return classes[status] || 'badge-secondary';
  }

  goBack(): void {
    this.router.navigate(['/admin-dashboard']);
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  onSidebarClose(): void {
    this.sidebarOpen = false;
  }

  onCollapseSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
