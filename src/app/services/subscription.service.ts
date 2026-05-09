import { Injectable } from '@angular/core';
import { SubscriptionPlan, UserSubscription } from '../models/subscription.model';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private subscriptionSubject = new BehaviorSubject<UserSubscription | null>(null);
  public subscription$ = this.subscriptionSubject.asObservable();

  private qrSubject = new BehaviorSubject<{ maya: string | null; gcash: string | null }>({ maya: null, gcash: null });
  public qr$ = this.qrSubject.asObservable();

  private plans: SubscriptionPlan[] = [
    {
      id: 'free', name: 'free', displayName: 'Free Plan', price: 0,
      features: ['Up to 3 calculations per month','Basic material tracking','Saved calculations cap of 3 (expires after 30 days)','Simple profit calculator','Email support'],
      limitations: ['Limited to 10 materials in inventory','Cannot create custom categories','No advanced reports','Basic features only']
    },
    {
      id: 'basic', name: 'basic', displayName: 'Basic Plan', price: 100,
      features: ['Unlimited calculations','Advanced material management','Saved calculations cap of 10 (expires after 60 days)','Full saved calculations','Priority email support','Up to 50 materials in inventory'],
      limitations: ['Cannot create custom categories','No advanced analytics']
    },
    {
      id: 'pro', name: 'pro', displayName: 'Pro Plan', price: 250,
      features: ['Everything in Basic','Unlimited materials in inventory','Advanced analytics and reports','Custom categories','Priority support (24/7)']
    }
  ];

  constructor(private authService: AuthService, private api: ApiService) {
    this.authService.currentUser.subscribe(user => {
      if (user) {
        this.loadSubscription();
        this.loadQrCodes();
      } else {
        this.subscriptionSubject.next(null);
      }
    });
  }

  private loadSubscription(): void {
    this.api.getMySubscription().subscribe({
      next: (row: any) => {
        const sub: UserSubscription = {
          userId: row.user_id,
          currentPlan: row.plan as any,
          startDate: row.start_date,
          expiryDate: row.expiry_date,
          isActive: row.is_active,
          durationMonths: row.duration_months,
        };
        this.subscriptionSubject.next(sub);
      },
      error: () => {
        const user = this.authService.currentUserValue;
        if (user) {
          this.subscriptionSubject.next({
            userId: user.id, currentPlan: 'free',
            startDate: new Date(), expiryDate: new Date(Date.now() + 30 * 86400000), isActive: true,
          });
        }
      },
    });
  }

  private loadQrCodes(): void {
    this.api.getQrCodes().subscribe({
      next: (data: any) => this.qrSubject.next({ gcash: data.gcash || null, maya: data.maya || null }),
      error: () => {},
    });
  }

  getPlans(): SubscriptionPlan[] { return this.plans; }

  getPlanDetails(planName: 'free' | 'basic' | 'pro'): SubscriptionPlan | undefined {
    return this.plans.find(p => p.name === planName);
  }

  getCurrentSubscription(): UserSubscription | null {
    return this.subscriptionSubject.value;
  }

  getInventoryLimit(planName: 'free' | 'basic' | 'pro'): number {
    return planName === 'free' ? 10 : planName === 'basic' ? 50 : Infinity;
  }

  getCalculationLimit(planName: 'free' | 'basic' | 'pro'): number {
    return planName === 'free' ? 3 : Infinity;
  }

  allowsCustomCategory(planName: 'free' | 'basic' | 'pro'): boolean {
    return planName === 'pro';
  }

  getBuiltInCategories(): string[] {
    return ['Paper', 'Adhesive', 'Decoration', 'Paint', 'Cards', 'Packaging', 'Stationery'];
  }

  getCalculatorCategories(): string[] {
    return ['General Printing', 'Business Cards', 'Flyers & Brochures', 'Flyers & Banners', 'Labels & Stickers'];
  }

  getMayaQr(): string | null { return this.qrSubject.value.maya; }
  getGcashQr(): string | null { return this.qrSubject.value.gcash; }

  setMayaQr(url: string | null): void {
    this.qrSubject.next({ ...this.qrSubject.value, maya: url });
    if (url) this.api.setQrCode('maya', url).subscribe();
  }

  setGcashQr(url: string | null): void {
    this.qrSubject.next({ ...this.qrSubject.value, gcash: url });
    if (url) this.api.setQrCode('gcash', url).subscribe();
  }

  upgradePlan(newPlan: 'free' | 'basic' | 'pro'): Observable<UserSubscription> {
    return new Observable(observer => {
      const user = this.authService.currentUserValue;
      if (!user) { observer.error({ message: 'Not authenticated' }); return; }
      this.api.setUserPlan(user.id, newPlan).subscribe({
        next: (row: any) => {
          const sub: UserSubscription = {
            userId: row.user_id, currentPlan: row.plan as any,
            startDate: row.start_date, expiryDate: row.expiry_date, isActive: row.is_active,
          };
          this.subscriptionSubject.next(sub);
          observer.next(sub); observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  upgradePlanForUser(userId: string, newPlan: 'free' | 'basic' | 'pro'): Observable<UserSubscription> {
    return new Observable(observer => {
      this.api.setUserPlan(userId, newPlan).subscribe({
        next: (row: any) => {
          const sub: UserSubscription = {
            userId: row.user_id, currentPlan: row.plan as any,
            startDate: row.start_date, expiryDate: row.expiry_date, isActive: row.is_active,
          };
          if (this.authService.currentUserValue?.id === userId) {
            this.subscriptionSubject.next(sub);
          }
          observer.next(sub); observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  canAccessFeature(feature: string): boolean {
    const sub = this.getCurrentSubscription();
    if (!sub) return false;
    const plan = this.getPlanDetails(sub.currentPlan);
    return plan ? plan.features.includes(feature) : false;
  }
}
