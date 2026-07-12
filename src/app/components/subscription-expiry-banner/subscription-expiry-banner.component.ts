import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-subscription-expiry-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription-expiry-banner.component.html',
  styleUrls: ['./subscription-expiry-banner.component.css']
})
export class SubscriptionExpiryBannerComponent implements OnInit, OnDestroy {
  showBanner = false;
  daysRemaining = 0;
  expiryDate: Date | null = null;
  private subs = new Subscription();

  constructor(
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe reactively so the banner appears correctly on hard refresh
    this.subs.add(
      this.subscriptionService.subscription$.subscribe(subscription => {
        if (!subscription || subscription.currentPlan === 'free') {
          this.showBanner = false;
          return;
        }

        const expiryDate = new Date(subscription.expiryDate);
        this.expiryDate = expiryDate;

        const now = new Date();
        this.daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

        // Only show when nearing expiration (1–7 days left), not after it has expired
        this.showBanner = this.daysRemaining > 0 && this.daysRemaining <= 7;
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  extendSubscription(): void {
    this.router.navigate(['/subscription']);
  }

  closeBanner(): void {
    this.showBanner = false;
  }
}
