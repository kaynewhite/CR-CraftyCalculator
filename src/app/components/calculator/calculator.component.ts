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
  productName: string = '';
  category: string = '';

  quantityProducedPerBatch: number = 1;
  printingCostPerUnit: number = 0;
  laborCostPerUnit: number = 0;
  wastePercentage: number = 5;
  profitMarginPercent: number = 50;

  selectedMaterials: MaterialInput[] = [];

  // Calculation results
  materialCostTotal: number = 0;
  totalCostsBeforeWaste: number = 0;
  wasteCost: number = 0;
  batchCostTotal: number = 0;   // full batch cost (materials + printing + labor + waste)
  costPerUnit: number = 0;      // batchCostTotal / quantity
  finalPrice: number = 0;       // suggested price per unit (margin-based)
  profitPerUnit: number = 0;    // finalPrice - costPerUnit
  totalPrinting: number = 0;
  totalLabor: number = 0;

  materials: Material[] = [];
  filteredMaterials: Material[] = [];
  searchMaterialsQuery: string = '';
  showInventorySelector: boolean = false;

  sidebarOpen: boolean = false;
  sidebarCollapsed: boolean = false;
  showResults: boolean = false;
  private sidebarSubscription: Subscription;
  private materialsSubscription: Subscription;

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
    this.materialsSubscription = new Subscription();
  }

  ngOnInit(): void {
    this.materialsSubscription = this.materialService.materials$.subscribe(mats => {
      this.materials = mats;
      if (!this.searchMaterialsQuery) {
        this.filteredMaterials = mats;
      } else {
        this.filteredMaterials = this.materialService.searchMaterials(this.searchMaterialsQuery);
      }
    });

    this.sidebarSubscription = this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.sidebarCollapsed = collapsed;
    });

    const subscription = this.subscriptionService.getCurrentSubscription();
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
        this.calculationsRemaining = Math.max(0, this.subscriptionService.getCalculationLimit('free') - used);
      } else {
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
    if (!this.hasUnlimitedCalculations && this.calculationsRemaining <= 0) {
      alert('You\'ve used all your calculations for this month. Upgrade your plan for unlimited calculations!');
      this.router.navigate(['/subscription']);
      return;
    }

    if (this.selectedMaterials.length === 0 && this.printingCostPerUnit === 0 && this.laborCostPerUnit === 0) {
      alert('Please add at least one material or other cost value');
      return;
    }

    this.calculate();

    if (!this.hasUnlimitedCalculations && this.currentPlan === 'free') {
      const used = parseInt(localStorage.getItem('calculationsUsedThisMonth') || '0');
      localStorage.setItem('calculationsUsedThisMonth', (used + 1).toString());
      this.calculationsRemaining = Math.max(0, this.subscriptionService.getCalculationLimit('free') - (used + 1));
    }

    this.showResults = true;

    if (!this.hasUnlimitedCalculations && this.calculationsRemaining <= 2 && this.calculationsRemaining > 0) {
      alert(`You have ${this.calculationsRemaining} calculations remaining. Consider upgrading your plan!`);
    }
  }

  performPrivateCalculation(): void {
    this.calculate();
  }

  calculate(): void {
    // Step 1 — sum material costs
    this.materialCostTotal = this.selectedMaterials.reduce((sum, m) => {
      const subtotal = m.quantity * m.costPerUnit;
      m.subtotal = subtotal;
      return sum + subtotal;
    }, 0);

    // Step 2 — flat batch fees for printing & labor
    this.totalPrinting = this.printingCostPerUnit;
    this.totalLabor = this.laborCostPerUnit;

    this.totalCostsBeforeWaste = this.materialCostTotal + this.totalPrinting + this.totalLabor;

    // Step 3 — waste
    this.wasteCost = this.totalCostsBeforeWaste * (this.wastePercentage / 100);

    // Step 4 — total batch cost & cost per unit
    this.batchCostTotal = this.totalCostsBeforeWaste + this.wasteCost;
    this.costPerUnit = this.quantityProducedPerBatch > 0
      ? this.batchCostTotal / this.quantityProducedPerBatch
      : 0;

    // Step 5 — margin-based pricing: price = cost / (1 - margin%)
    const margin = Math.min(Math.max(this.profitMarginPercent, 0), 99.99);
    this.finalPrice = this.costPerUnit / (1 - margin / 100);

    // Step 6 — profit per unit
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
      // totalCost = full batch cost (e.g. ₱441)
      totalCost: parseFloat(this.batchCostTotal.toFixed(2)),
      // suggestedPrice = price per unit (e.g. ₱58.80)
      suggestedPrice: parseFloat(this.finalPrice.toFixed(2)),
      profitMargin: this.profitMarginPercent,
      // profitAmount = profit per unit (e.g. ₱29.40)
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
    this.profitMarginPercent = 50;
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
    this.materialsSubscription.unsubscribe();
  }
}
