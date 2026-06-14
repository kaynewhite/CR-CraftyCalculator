import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CalculationService } from '../../services/calculation.service';
import { MaterialService } from '../../services/material.service';
import { SubscriptionService } from '../../services/subscription.service';
import { SidebarService } from '../../services/sidebar.service';
import { Material, MaterialInput } from '../../models/material.model';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';

@Component({
  selector: 'app-calculator',
  imports: [CommonModule, FormsModule, SidebarComponent, NotificationBellComponent],
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.css']
})
export class CalculatorComponent implements OnInit, OnDestroy {
  productName: string = '';
  category: string = '';

  quantityProducedPerBatch: number = 1;
  printingCostPerUnit: number = 0;
  laborCostPerUnit: number = 0;
  wastePercentage: number = 5;
  /** Markup % — Selling Price = Cost × (1 + markup/100) */
  markupPercent: number = 50;

  selectedMaterials: MaterialInput[] = [];

  // Calculation results
  materialCostTotal: number = 0;
  totalCostsBeforeWaste: number = 0;
  wasteCost: number = 0;
  batchCostTotal: number = 0;
  costPerUnit: number = 0;
  finalPrice: number = 0;
  profitPerUnit: number = 0;
  totalPrinting: number = 0;
  totalLabor: number = 0;

  materials: Material[] = [];
  filteredMaterials: Material[] = [];
  searchMaterialsQuery: string = '';
  showInventorySelector: boolean = false;

  sidebarOpen: boolean = false;
  sidebarCollapsed: boolean = false;
  showResults: boolean = false;

  currentPlan: 'free' | 'basic' | 'pro' = 'free';
  calculationsRemaining: number = 3;
  hasUnlimitedCalculations: boolean = false;
  builtInCategories: string[] = [];

  private subs = new Subscription();

  constructor(
    private calculationService: CalculationService,
    private materialService: MaterialService,
    public subscriptionService: SubscriptionService,
    private router: Router,
    private sidebarService: SidebarService
  ) {}

  ngOnInit(): void {
    // Clean up any previous subscriptions (handles manual ngOnInit calls safely)
    this.subs.unsubscribe();
    this.subs = new Subscription();

    // Materials
    this.subs.add(
      this.materialService.materials$.subscribe(mats => {
        this.materials = mats;
        this.filteredMaterials = this.searchMaterialsQuery
          ? this.materialService.searchMaterials(this.searchMaterialsQuery)
          : mats;
      })
    );

    // Sidebar collapse
    this.subs.add(
      this.sidebarService.isCollapsed$.subscribe(collapsed => {
        this.sidebarCollapsed = collapsed;
      })
    );

    // Subscribe REACTIVELY to subscription$ — fixes race condition where
    // getCurrentSubscription() returns null if the API hasn't responded yet.
    // Paid users would otherwise be treated as free until they refreshed.
    this.subs.add(
      this.subscriptionService.subscription$.subscribe(subscription => {
        if (subscription) {
          this.currentPlan = subscription.currentPlan;
          this.builtInCategories = this.subscriptionService.getCalculatorCategories();

          if (this.currentPlan === 'free') {
            this.hasUnlimitedCalculations = false;
            const storedMonth = localStorage.getItem('calculationsUsedMonth');
            const nowMonth = new Date().toISOString().slice(0, 7);
            let used = parseInt(localStorage.getItem('calculationsUsedThisMonth') || '0');
            if (storedMonth !== nowMonth) {
              used = 0;
              localStorage.setItem('calculationsUsedThisMonth', '0');
              localStorage.setItem('calculationsUsedMonth', nowMonth);
            }
            this.calculationsRemaining = Math.max(
              0,
              this.subscriptionService.getCalculationLimit('free') - used
            );
          } else {
            this.hasUnlimitedCalculations = true;
            this.calculationsRemaining = Infinity;
          }
        }
      })
    );
  }

  /** Refresh only materials from the API — does not reset calculator state. */
  refreshMaterials(): void {
    this.materialService.load();
  }

  searchMaterials(): void {
    this.filteredMaterials = this.searchMaterialsQuery
      ? this.materialService.searchMaterials(this.searchMaterialsQuery)
      : this.materials;
  }

  updateMaterialSubtotal(mat: MaterialInput): void {
    mat.subtotal = mat.quantity * mat.costPerUnit;
    this.calculate();
  }

  removeMaterial(index: number): void {
    this.selectedMaterials.splice(index, 1);
    this.calculate();
  }

  selectMaterialFromInventory(material: Material): void {
    const existing = this.selectedMaterials.find(m => m.materialId === material.id);
    if (existing) {
      alert('Material already added. You can adjust quantity/cost below.');
      this.showInventorySelector = false;
      this.searchMaterialsQuery = '';
      return;
    }

    this.selectedMaterials.push({
      materialId: material.id,
      materialName: material.name,
      quantity: 1,
      costPerUnit: material.costPerUnit,
      subtotal: material.costPerUnit * 1
    });

    this.productName = this.productName || material.name;
    this.showInventorySelector = false;
    this.searchMaterialsQuery = '';
    this.calculate();
  }

  performCalculation(): void {
    // Guard: only limit free plan users who are CONFIRMED on free plan
    if (!this.hasUnlimitedCalculations && this.currentPlan === 'free' && this.calculationsRemaining <= 0) {
      alert('You\'ve used all your calculations for this month. Upgrade your plan for unlimited calculations!');
      this.router.navigate(['/subscription']);
      return;
    }

    if (this.quantityProducedPerBatch <= 0) {
      alert('Quantity produced per batch must be at least 1');
      this.quantityProducedPerBatch = 1;
      return;
    }

    if (this.selectedMaterials.length === 0 && this.printingCostPerUnit === 0 && this.laborCostPerUnit === 0) {
      alert('Please add at least one material or other cost value');
      return;
    }

    this.calculate();

    // Decrement counter only for confirmed free-plan users
    if (!this.hasUnlimitedCalculations && this.currentPlan === 'free') {
      const used = parseInt(localStorage.getItem('calculationsUsedThisMonth') || '0');
      localStorage.setItem('calculationsUsedThisMonth', (used + 1).toString());
      this.calculationsRemaining = Math.max(
        0,
        this.subscriptionService.getCalculationLimit('free') - (used + 1)
      );
    }

    this.showResults = true;

    if (!this.hasUnlimitedCalculations && this.currentPlan === 'free' &&
        this.calculationsRemaining <= 2 && this.calculationsRemaining > 0) {
      alert(`You have ${this.calculationsRemaining} calculation(s) remaining this month. Consider upgrading!`);
    }
  }

  calculate(): void {
    // Step 1 — sum material costs for the full batch
    this.materialCostTotal = this.selectedMaterials.reduce((sum, m) => {
      m.subtotal = m.quantity * m.costPerUnit;
      return sum + m.subtotal;
    }, 0);

    // Step 2 — additional per-unit fees scaled to batch quantity
    this.totalPrinting = this.printingCostPerUnit * this.quantityProducedPerBatch;
    this.totalLabor    = this.laborCostPerUnit    * this.quantityProducedPerBatch;

    this.totalCostsBeforeWaste = this.materialCostTotal + this.totalPrinting + this.totalLabor;

    // Step 3 — waste allowance (clamped 0–100 so typed values outside range don't corrupt results)
    const wasteRate = Math.min(Math.max(this.wastePercentage || 0, 0), 100);
    this.wasteCost = this.totalCostsBeforeWaste * (wasteRate / 100);

    // Step 4 — total batch cost & cost per unit
    this.batchCostTotal = this.totalCostsBeforeWaste + this.wasteCost;
    this.costPerUnit = this.quantityProducedPerBatch > 0
      ? this.batchCostTotal / this.quantityProducedPerBatch
      : 0;

    // Step 5 — MARKUP-based pricing:
    //   Selling Price = Cost Per Unit × (1 + Markup% ÷ 100)
    //
    //   Example: cost ₱100, markup 50%  →  ₱100 × 1.5  = ₱150  (profit ₱50)
    //   Example: cost ₱100, markup 100% →  ₱100 × 2    = ₱200  (profit ₱100)
    //
    //   This is different from profit-margin pricing (cost ÷ (1 − margin%))
    //   which gives a larger selling price for the same percentage.
    const markup = Math.max(this.markupPercent, 0);
    this.finalPrice = this.costPerUnit * (1 + markup / 100);

    // Step 6 — profit per unit (always = costPerUnit × markup/100)
    this.profitPerUnit = this.finalPrice - this.costPerUnit;
  }

  savePricing(): void {
    if (!this.productName || !this.category || this.quantityProducedPerBatch <= 0) {
      alert('Please fill in Product Name, Category, and Quantity');
      return;
    }

    if (this.selectedMaterials.length === 0) {
      alert('Please add at least one material');
      return;
    }

    this.calculationService.addCalculation({
      name: this.productName,
      category: this.category,
      materials: this.selectedMaterials.map(m => ({
        materialId: m.materialId,
        materialName: m.materialName,
        quantity: m.quantity,
        costPerUnit: m.costPerUnit,
        subtotal: m.subtotal
      })),
      totalCost: parseFloat(this.batchCostTotal.toFixed(2)),
      suggestedPrice: parseFloat(this.finalPrice.toFixed(2)),
      profitMargin: this.markupPercent,        // stored as markupPercent in the DB field
      profitAmount: parseFloat(this.profitPerUnit.toFixed(2)),
      userId: ''
    });

    alert('Pricing saved successfully!');
    this.router.navigate(['/saved']);
  }

  resetCalculator(): void {
    this.productName = '';
    this.category = '';
    this.selectedMaterials = [];
    this.quantityProducedPerBatch = 1;
    this.printingCostPerUnit = 0;
    this.laborCostPerUnit = 0;
    this.wastePercentage = 5;
    this.markupPercent = 50;
    this.showResults = false;
    this.totalPrinting = 0;
    this.totalLabor = 0;
    this.materialCostTotal = 0;
    this.totalCostsBeforeWaste = 0;
    this.wasteCost = 0;
    this.batchCostTotal = 0;
    this.costPerUnit = 0;
    this.finalPrice = 0;
    this.profitPerUnit = 0;
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  closeSidebar(): void  { this.sidebarOpen = false; }
  toggleSidebarCollapse(): void { this.sidebarService.toggleCollapsed(); }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
