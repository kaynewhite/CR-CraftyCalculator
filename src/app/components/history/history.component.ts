import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CalculationService } from '../../services/calculation.service';
import { SidebarService } from '../../services/sidebar.service';
import { Calculation } from '../../models/calculation.model';
import { MaterialInput } from '../../models/material.model';
import { SubscriptionService } from '../../services/subscription.service';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';


@Component({
  selector: 'app-history',
  imports: [CommonModule, FormsModule, SidebarComponent, NotificationBellComponent],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit, OnDestroy {
  calculations: Calculation[] = [];
  filteredCalculations: Calculation[] = [];
  searchQuery: string = '';
  sortBy: 'date' | 'profit' | 'name' = 'date';
  remainingSlots: number = 0;
  sidebarOpen: boolean = false;
  sidebarCollapsed: boolean = false;
  currentPlan: 'free' | 'basic' | 'pro' = 'free';
  savedCount: number = 0;
  Infinity = Infinity;
  selectedCalc: Calculation | null = null;
  private subs = new Subscription();

  constructor(
    public calculationService: CalculationService,
    private subscriptionService: SubscriptionService,
    private sidebarService: SidebarService
  ) {}

  ngOnInit(): void {
    this.subs = new Subscription();

    // Reactively update whenever the service receives data from the API
    this.subs.add(
      this.calculationService.calculations$.subscribe(calculations => {
        this.calculations = calculations;
        this.savedCount = calculations.length;
        this.remainingSlots = this.calculationService.getRemainingSlots();
        this.applyFilters();
      })
    );

    // Reactively update plan on hard refresh
    this.subs.add(
      this.subscriptionService.subscription$.subscribe(sub => {
        if (sub) this.currentPlan = sub.currentPlan;
      })
    );

    this.subs.add(
      this.sidebarService.isCollapsed$.subscribe(collapsed => {
        this.sidebarCollapsed = collapsed;
      })
    );
  }

  loadSaved(): void {
    // Trigger a fresh fetch from the API; the calculations$ subscription above
    // will automatically update this.calculations and re-apply filters.
    this.calculationService.load();
  }

  applyFilters(): void {
    let filtered = this.searchQuery 
      ? this.calculationService.searchCalculations(this.searchQuery)
      : this.calculations;
    this.filteredCalculations = this.calculationService.sortCalculations(this.sortBy, 'desc').filter(c => 
      filtered.some(f => f.id === c.id)
    );
  }

  deleteCalculation(id: string): void {
    if (confirm('Are you sure you want to delete this calculation?')) {
      this.calculationService.deleteCalculation(id);
      this.loadSaved();
      this.remainingSlots = this.calculationService.getRemainingSlots();
    }
  }

  viewCalculation(calc: Calculation): void {
    this.selectedCalc = calc;
  }

  closeView(): void {
    this.selectedCalc = null;
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

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
