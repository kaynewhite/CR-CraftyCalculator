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

@Component({
  selector: 'app-calculator',
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.css']
})
export class CalculatorComponent implements OnInit, OnDestroy {
  // Product Info
  productName: string = '';
  category: string = '';

  // Pricing Inputs
  quantityProducedPerBatch: number = 1;
  printingCostPerUnit: number = 0;
  laborCostPerUnit: number = 0;
  wastePercentage: number = 5;
  profitMarginPercent: number = 50;

  // Material management (inventory)
  selectedMaterials: MaterialInput[] = [];

  // Calculation Results
  materialCostTotal: number = 0;
  totalCostsBeforeWaste: number = 0;
  wasteCost: number = 0;
  costPerUnit: number = 0;
  finalPrice: number = 0;
  profitPerUnit: number = 0;

  // Inventory Integration
  materials: Material[] = [];
  filteredMaterials: Material[] = [];
  searchMaterialsQuery: string = '';
  showInventorySelector: boolean = false;

  // UI States
  sidebarOpen: boolean = false;
  sidebarCollapsed: boolean = false;
  showResults: boolean = false;
  private sidebarSubscription: Subscription;

  // Subscription & Calculations
  currentPlan: 'free' | 'basic' | 'pro' = 'free';
  calculationsRemaining: number = 10;
  hasUnlimitedCalculations: boolean = false;
  builtInCategories: string[] = [];

  constructor(
    private calculationService: CalculationService,
    private materialService: MaterialService,
    public subscriptionService: SubscriptionService,
    private router: Router,
    private sidebarService: SidebarService
  ) {
    this.sidebarSubscription = new Subscription();
  }

  ngOnInit(): void {
    this.materials = this.materialService.getMaterials();
    this.filteredMaterials = this.materials;
    
    // Subscribe to sidebar collapsed state
    this.sidebarSubscription = this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.sidebarCollapsed = collapsed;
    });
    
    // Load subscription info
    const subscription = this.subscriptionService.getCurrentSubscription();
    if (subscription) {
      this.currentPlan = subscription.currentPlan;
      // calculator uses its own category set
      this.builtInCategories = this.subscriptionService.getCalculatorCategories();
      
      // Set based on plan
      if (this.currentPlan === 'free') {
        this.hasUnlimitedCalculations = false;
        // reset or calculate monthly counter
        const storedMonth = localStorage.getItem('calculationsUsedMonth');
        const nowMonth = new Date().toISOString().slice(0,7);
        let used = parseInt(localStorage.getItem('calculationsUsedThisMonth') || '0');
        if (storedMonth !== nowMonth) {
          used = 0;
          localStorage.setItem('calculationsUsedThisMonth', '0');
          localStorage.setItem('calculationsUsedMonth', nowMonth);
        }
        this.calculationsRemaining = Math.max(0, this.subscriptionService.getCalculationLimit('free') - used);
      } else if (this.currentPlan === 'basic') {
        this.hasUnlimitedCalculations = true;
        this.calculationsRemaining = Infinity;
      } else if (this.currentPlan === 'pro') {
        this.hasUnlimitedCalculations = true;
        this.calculationsRemaining = Infinity;
      }
    }
  }

  searchMaterials(): void {
    if (!this.searchMaterialsQuery) {
      this.filteredMaterials = this.materials;
    } else {
      this.filteredMaterials = this.materialService.searchMaterials(this.searchMaterialsQuery);
    }
  }


  updateMaterialSubtotal(mat: MaterialInput): void {
    mat.subtotal = mat.quantity * mat.costPerUnit;
    this.performPrivateCalculation();
  }

  removeMaterial(index: number): void {
    this.selectedMaterials.splice(index, 1);
    this.performPrivateCalculation();
  }

  selectMaterialFromInventory(material: Material): void {
    // add material to selected list, avoid duplicates
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
    this.performPrivateCalculation();
  }

  performCalculation(): void {
    // Check if user can calculate
    if (!this.hasUnlimitedCalculations && this.calculationsRemaining <= 0) {
      alert('You\'ve used all your calculations for this month. Upgrade your plan for unlimited calculations!');
      this.router.navigate(['/subscription']);
      return;
    }

    // Validate inputs
    if (this.selectedMaterials.length === 0 && this.printingCostPerUnit === 0 && this.laborCostPerUnit === 0) {
      alert('Please add at least one material or other cost value');
      return;
    }

    // Perform calculation
    this.calculate();

    // Decrement calculations remaining for free plan
    if (!this.hasUnlimitedCalculations && this.currentPlan === 'free') {
      const used = parseInt(localStorage.getItem('calculationsUsedThisMonth') || '0');
      localStorage.setItem('calculationsUsedThisMonth', (used + 1).toString());
      this.calculationsRemaining = Math.max(0, this.subscriptionService.getCalculationLimit('free') - (used + 1));
    }

    // Show results
    this.showResults = true;

    // Show warning if running low
    if (!this.hasUnlimitedCalculations && this.calculationsRemaining <= 2 && this.calculationsRemaining > 0) {
      alert(`You have ${this.calculationsRemaining} calculations remaining. Consider upgrading your plan!`);
    }
  }

  performPrivateCalculation(): void {
    // Internal calculation without showing full breakdown
    this.calculate();
  }

  calculate(): void {
    // Material cost: sum of each material's quantity × cost per unit
    this.materialCostTotal = this.selectedMaterials.reduce((sum, m) => {
      const subtotal = m.quantity * m.costPerUnit;
      m.subtotal = subtotal;
      return sum + subtotal;
    }, 0);

    // Total costs before waste (per batch)
    this.totalCostsBeforeWaste = this.materialCostTotal +
      (this.printingCostPerUnit * this.quantityProducedPerBatch) +
      (this.laborCostPerUnit * this.quantityProducedPerBatch);

    // Waste cost (percentage of total costs)
    this.wasteCost = this.totalCostsBeforeWaste * (this.wastePercentage / 100);

    // Cost per unit (total cost including waste, divided by quantity produced)
    const totalBatchCost = this.totalCostsBeforeWaste + this.wasteCost;
    this.costPerUnit = totalBatchCost / this.quantityProducedPerBatch;

    // Final price with profit margin
    this.finalPrice = this.costPerUnit * (1 + this.profitMarginPercent / 100);

    // Profit per unit
    this.profitPerUnit = this.finalPrice - this.costPerUnit;
  }

  savePricing(): void {
    if (!this.productName || !this.category || this.quantityProducedPerBatch <= 0) {
      alert('Please fill in Product Name, Category, and Quantity');
      return;
    }

    // Ensure there is at least one material entry
    if (this.selectedMaterials.length === 0) {
      alert('Please add at least one material');
      return;
    }

    // Save as a calculation to saved list
    const batchRevenue = this.finalPrice * this.quantityProducedPerBatch;
    const batchProfit = (this.finalPrice - this.costPerUnit) * this.quantityProducedPerBatch;

    // check remaining slots before saving
    const remaining = this.calculationService.getRemainingSlots();
    if (remaining === 0) {
      const plan = this.subscriptionService.getCurrentSubscription()?.currentPlan || 'free';
      if (plan !== 'pro') {
        alert('You have reached the maximum number of saved calculations for your plan. Saving another will remove the oldest entry.');
      }
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
      totalCost: this.materialCostTotal,
      suggestedPrice: batchRevenue,
      profitMargin: this.profitMarginPercent,
      profitAmount: batchProfit,
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
    this.profitMarginPercent = 50;
    this.showResults = false;
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
