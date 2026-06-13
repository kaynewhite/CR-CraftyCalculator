import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SubscriptionService } from '../../services/subscription.service';
import { SidebarService } from '../../services/sidebar.service';
import { AuthService } from '../../services/auth.service';
import { SubscriptionPlan, UserSubscription } from '../../models/subscription.model';
import { PaymentModalComponent } from '../payment-modal/payment-modal.component';
import { PaymentService } from '../../services/payment.service';
import { ThemeService } from '../../services/theme.service';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';

@Component({
  selector: 'app-subscription',
  imports: [CommonModule, SidebarComponent, PaymentModalComponent, NotificationBellComponent],
  templateUrl: './subscription.component.html',
  styleUrls: ['./subscription.component.css']
})
export class SubscriptionComponent implements OnInit, OnDestroy {
  plans: SubscriptionPlan[] = [];
  currentSubscription: UserSubscription | null = null;
  isLoading = false;
  sidebarOpen = false;
  sidebarCollapsed = false;
  private sidebarSubscription = new Subscription();
  private paymentSub = new Subscription();

  showPaymentModal = false;
  pendingPlan: 'basic' | 'pro' | null = null;
  upgradeCost = 0;
  hasPendingRequest = true;

  isDarkMode = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private subscriptionService: SubscriptionService,
    private sidebarService: SidebarService,
    private paymentService: PaymentService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.currentUserValue;
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
      this.router.navigate(['/admin-dashboard']);
      return;
    }

    this.themeService.setTheme(this.themeService.getCurrentTheme());
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    this.plans = this.subscriptionService.getPlans();
    this.currentSubscription = this.subscriptionService.getCurrentSubscription();
    this.subscriptionService.qr$.subscribe();

    this.paymentService.loadMyRequests();
    this.paymentSub = this.paymentService.requests$.subscribe(requests => {
      this.hasPendingRequest = requests.some(r => ['pending', 'scanning'].includes(r.status));
    });

    this.sidebarSubscription = this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.sidebarCollapsed = collapsed;
    });
  }

  ngOnDestroy(): void {
    this.sidebarSubscription.unsubscribe();
    this.paymentSub.unsubscribe();
  }

  refreshData(): void {
    this.currentSubscription = this.subscriptionService.getCurrentSubscription();
    this.paymentService.loadMyRequests();
  }

  changePlan(planName: 'free' | 'basic' | 'pro'): void {
    if (this.currentSubscription?.currentPlan === planName) {
      return;
    }

    if (this.hasPendingRequest) {
      return;
    }

    if (planName === 'basic' || planName === 'pro') {
      this.pendingPlan = planName;
      this.upgradeCost = this.calculateUpgradeCost(planName);
      this.showPaymentModal = true;
    } else {
      this.performPlanUpgrade(planName);
    }
  }

  calculateUpgradeCost(targetPlan: 'basic' | 'pro'): number {
    const current = this.currentSubscription?.currentPlan;
    if (current === 'basic' && targetPlan === 'pro') {
      return 150;
    } else if (current === 'free' && targetPlan === 'basic') {
      return 100;
    } else if (current === 'free' && targetPlan === 'pro') {
      return 250;
    }
    return 0;
  }

  performPlanUpgrade(planName: 'free' | 'basic' | 'pro'): void {
    this.isLoading = true;
    this.subscriptionService.upgradePlan(planName).subscribe({
      next: subscription => {
        this.currentSubscription = subscription;
        this.isLoading = false;
        alert(`Successfully changed to ${planName.toUpperCase()} plan!`);
      },
      error: () => {
        this.isLoading = false;
        alert('Failed to change plan. Please try again.');
      }
    });
  }

  isCurrentPlan(planName: string): boolean {
    return this.currentSubscription?.currentPlan === planName;
  }

  getPlanPrice(planName: 'free' | 'basic' | 'pro'): number {
    const plan = this.subscriptionService.getPlanDetails(planName);
    return plan ? plan.price : 0;
  }

  getUpgradePriceDisplay(planName: 'free' | 'basic' | 'pro'): string {
    if (this.isCurrentPlan(planName)) {
      return 'Current Plan';
    }
    if (this.currentSubscription?.currentPlan === 'basic' && planName === 'pro') {
      return 'Upgrade for ₱150';
    }
    return 'Select Plan';
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  onPaymentCancel(): void {
    this.showPaymentModal = false;
    this.pendingPlan = null;
    this.upgradeCost = 0;
  }

  onPaymentSubmit(data: Partial<import('../../models/payment.model').PaymentRequest>): void {
    if (!this.pendingPlan) {
      return;
    }

    const payment: any = {
      plan: this.pendingPlan,
      method: data.method,
      screenshotUrl: data.screenshotUrl,
    };

    this.paymentService.add(payment).subscribe({
      next: () => {
        this.showPaymentModal = false;
        this.pendingPlan = null;
        this.upgradeCost = 0;
        alert('Payment request submitted. Admin review is pending.');
      },
      error: (err: any) => {
        this.showPaymentModal = false;
        this.pendingPlan = null;
        this.upgradeCost = 0;
        alert('Failed to submit payment request: ' + (err?.message || 'Please try again.'));
      }
    });
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  toggleSidebarCollapse(): void {
    this.sidebarService.toggleCollapsed();
  }
}
