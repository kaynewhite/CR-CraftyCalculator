import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SubscriptionExpiryBannerComponent } from '../subscription-expiry-banner/subscription-expiry-banner.component';
import { CalculationService } from '../../services/calculation.service';
import { MaterialService } from '../../services/material.service';
import { SidebarService } from '../../services/sidebar.service';
import { AuthService } from '../../services/auth.service';
import { CalculationSummary, Calculation } from '../../models/calculation.model';
import { Subscription } from 'rxjs';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, SidebarComponent, SubscriptionExpiryBannerComponent, NotificationBellComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  summary: CalculationSummary | null = null;
  isLoading = true;
  sidebarOpen = false;
  sidebarCollapsed = false;
  recentSaved: Calculation[] = [];
  savedLimit: number = Infinity;
  Infinity = Infinity;
  private sidebarSubscription = new Subscription();

  constructor(
    public calculationService: CalculationService,
    private materialService: MaterialService,
    private sidebarService: SidebarService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.currentUserValue;
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
      this.router.navigate(['/admin-dashboard']);
      return;
    }

    this.loadDashboard();
    this.sidebarSubscription = this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.sidebarCollapsed = collapsed;
    });
  }

  ngOnDestroy(): void {
    this.sidebarSubscription.unsubscribe();
  }

  loadDashboard(): void {
    setTimeout(() => {
      this.summary = this.calculationService.getCalculationSummary();
      const materials = this.materialService.getMaterials();
      if (this.summary) {
        this.summary.totalMaterialsUsed = materials.length;
      }
      const allSaved = this.calculationService.getCalculations()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.savedLimit = this.calculationService.getSavedLimit();
      this.recentSaved = allSaved.slice(0, 3);
      this.isLoading = false;
    }, 500);
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  toggleSidebarCollapse(): void {
    this.sidebarService.toggleCollapsed();
  }
}
