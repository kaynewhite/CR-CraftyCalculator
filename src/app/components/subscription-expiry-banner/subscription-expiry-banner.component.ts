import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-subscription-expiry-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription-expiry-banner.component.html',
  styleUrls: ['./subscription-expiry-banner.component.css']
})
export class SubscriptionExpiryBannerComponent implements OnInit {
  showBanner = false;
  daysRemaining = 0;
  expiryDate: Date | null = null;

  constructor(
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.checkSubscriptionExpiry();
  }

  checkSubscriptionExpiry(): void {
    const subscription = this.subscriptionService.getCurrentSubscription();
    
    if (!subscription || subscription.currentPlan === 'free') {
      this.showBanner = false;
      return;
    }

    const expiryDate = new Date(subscription.expiryDate);
    this.expiryDate = expiryDate;
    
    const now = new Date();
    const timeDiff = expiryDate.getTime() - now.getTime();
    this.daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // Show banner if within 7 days OR already expired
    this.showBanner = this.daysRemaining <= 7;
  }

  extendSubscription(): void {
    this.router.navigate(['/subscription']);
  }

  closeBanner(): void {
    this.showBanner = false;
  }
}
