import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CalculationService } from '../../services/calculation.service';
import { SidebarService } from '../../services/sidebar.service';
import { Calculation } from '../../models/calculation.model';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-history',
  imports: [CommonModule, FormsModule, SidebarComponent],
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
  private sidebarSubscription: Subscription;

  constructor(
    public calculationService: CalculationService,
    private subscriptionService: SubscriptionService,
    private sidebarService: SidebarService
  ) {
    this.sidebarSubscription = new Subscription();
  }

  ngOnInit(): void {
    const sub = this.subscriptionService.getCurrentSubscription();
    if (sub) {
      this.currentPlan = sub.currentPlan;
    }
    this.loadSaved();
    this.remainingSlots = this.calculationService.getRemainingSlots();
    
    // Subscribe to sidebar collapsed state
    this.sidebarSubscription = this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.sidebarCollapsed = collapsed;
    });
  }

  loadSaved(): void {
    // always load calculations regardless of plan, but cap/expire is handled in service
    this.calculations = this.calculationService.getCalculations();
    this.savedCount = this.calculations.length;
    this.remainingSlots = this.calculationService.getRemainingSlots();
    this.applyFilters();
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
    this.sidebarSubscription.unsubscribe();
  }
}
