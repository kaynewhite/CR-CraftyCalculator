import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SubscriptionExpiryBannerComponent } from '../subscription-expiry-banner/subscription-expiry-banner.component';
import { CalculationService } from '../../services/calculation.service';
import { MaterialService } from '../../services/material.service';
import { SidebarService } from '../../services/sidebar.service';
import { AuthService } from '../../services/auth.service';
import { CalculationSummary, Calculation } from '../../models/calculation.model';
import { combineLatest, Subscription } from 'rxjs';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink, SidebarComponent, SubscriptionExpiryBannerComponent, NotificationBellComponent],
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
  private subs = new Subscription();

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

    this.subs = new Subscription();

    // Reactively rebuild dashboard whenever calculations or materials arrive from the API
    this.subs.add(
      combineLatest([
        this.calculationService.calculations$,
        this.materialService.materials$,
      ]).subscribe(([calculations, materials]) => {
        const allSaved = [...calculations].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.summary = this.calculationService.getCalculationSummary();
        if (this.summary) {
          this.summary.totalMaterialsUsed = materials.length;
        }
        this.savedLimit = this.calculationService.getSavedLimit();
        this.recentSaved = allSaved.slice(0, 3);
        this.isLoading = false;
      })
    );

    this.subs.add(
      this.sidebarService.isCollapsed$.subscribe(collapsed => {
        this.sidebarCollapsed = collapsed;
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  loadDashboard(): void {
    // Trigger fresh fetches; the combineLatest subscription above will update the view.
    this.calculationService.load();
    this.materialService.load();
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
