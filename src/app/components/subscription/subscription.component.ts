import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SubscriptionService } from '../../services/subscription.service';
import { SidebarService } from '../../services/sidebar.service';
import { SubscriptionPlan, UserSubscription } from '../../models/subscription.model';
import { PaymentModalComponent } from '../payment-modal/payment-modal.component';
import { PaymentService } from '../../services/payment.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-subscription',
  imports: [CommonModule, SidebarComponent, PaymentModalComponent],
  templateUrl: './subscription.component.html',
  styleUrl: './subscription.component.css'
})
export class SubscriptionComponent implements OnInit, OnDestroy {
  plans: SubscriptionPlan[] = [];
  currentSubscription: UserSubscription | null = null;
  isLoading: boolean = false;
  sidebarOpen: boolean = false;
  sidebarCollapsed: boolean = false;
  private sidebarSubscription: Subscription;

  // payment modal state
  showPaymentModal = false;
  pendingPlan: 'basic' | 'pro' | null = null;
  // no longer store QR here; payment modal handles method-specific QR
  upgradeCost: number = 0; // Cost for upgrading from basic to pro

  // theme tracking for dark mode
  isDarkMode = false;

  constructor(
    private subscriptionService: SubscriptionService,
    private sidebarService: SidebarService,
    private paymentService: PaymentService,
    private themeService: ThemeService
  ) {
    this.sidebarSubscription = new Subscription();
  }

  ngOnInit(): void {
    // ensure theme classes are applied for dark mode toggling
    this.themeService.setTheme(this.themeService.getCurrentTheme());
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    this.plans = this.subscriptionService.getPlans();
    this.currentSubscription = this.subscriptionService.getCurrentSubscription();

    // listen for QR updates just so we can re-open modal if needed, though
    // PaymentModalComponent will fetch qr itself.
    this.subscriptionService.qr$.subscribe();
    
    // Subscribe to sidebar collapsed state
    this.sidebarSubscription = this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.sidebarCollapsed = collapsed;
    });
  }

  changePlan(planName: 'free' | 'basic' | 'pro'): void {
    if (this.currentSubscription?.currentPlan === planName) {
      return;
    }

    // start payment flow for plan selection
    if (planName === 'basic' || planName === 'pro') {
      this.pendingPlan = planName;
      // Calculate upgrade cost if applicable
      this.upgradeCost = this.calculateUpgradeCost(planName);
      // show modal; component will pick up correct QR once method selected
      this.showPaymentModal = true;
    } else {
      // free plan change can be immediate
      this.performPlanUpgrade(planName as any);
    }
  }

  calculateUpgradeCost(targetPlan: 'basic' | 'pro'): number {
    const current = this.currentSubscription?.currentPlan;
    
    if (current === 'basic' && targetPlan === 'pro') {
      // Upgrade from basic (100) to pro (250) = 150 extra
      return 150;
    } else if (current === 'free' && targetPlan === 'basic') {
      // New subscription to basic = 100
      return 100;
    } else if (current === 'free' && targetPlan === 'pro') {
      // New subscription to pro = 250
      return 250;
    }
    return 0;
  }

  performPlanUpgrade(planName: 'free' | 'basic' | 'pro') {
    this.isLoading = true;
    this.subscriptionService.upgradePlan(planName).subscribe({
      next: (subscription) => {
        this.currentSubscription = subscription;
        this.isLoading = false;
        alert(`Successfully changed to ${planName.toUpperCase()} plan!`);
      },
      error: (error) => {
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

  /**
   * Text shown on the plan button.  – never show raw cost, use friendly labels.
   */
  getUpgradePriceDisplay(planName: 'free' | 'basic' | 'pro'): string {
    if (this.isCurrentPlan(planName)) {
      return 'Current Plan';
    }

    // upgrade path from basic to pro should be labeled specially
    if (this.currentSubscription?.currentPlan === 'basic' && planName === 'pro') {
      return 'Upgrade';
    }

    // otherwise offer to select plan (free/basic/pro) without cost
    return 'Select Plan';
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  // payment modal callbacks
  onPaymentCancel() {
    this.showPaymentModal = false;
    this.pendingPlan = null;
    this.upgradeCost = 0;
  }

  onPaymentSubmit(data: Partial<import('../../models/payment.model').PaymentRequest>) {
    if (!this.pendingPlan) {
      return;
    }

    const payment: any = {
      plan: this.pendingPlan,
      method: data.method!,
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

  ngOnDestroy(): void {
    this.sidebarSubscription.unsubscribe();
  }
}
