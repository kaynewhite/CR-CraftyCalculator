import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { MaterialService } from '../../services/material.service';
import { SidebarService } from '../../services/sidebar.service';
import { Material } from '../../models/material.model';
import { SubscriptionService } from '../../services/subscription.service';

@Component({
  selector: 'app-inventory',
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css']
})
export class InventoryComponent implements OnInit, OnDestroy {
  materials: Material[] = [];
  filteredMaterials: Material[] = [];
  searchQuery: string = '';
  showAddModal: boolean = false;
  editingMaterial: Material | null = null;
  sidebarOpen: boolean = false;
  sidebarCollapsed: boolean = false;
  isEditing: boolean = false;
  currentPlan: 'free' | 'basic' | 'pro' = 'free';
  builtInCategories: string[] = [];
  private sidebarSubscription: Subscription;

  newMaterial = {
    name: '',
    quantity: 0,
    costPerUnit: 0,
    unit: 'piece' as 'piece' | 'pack' | 'roll' | 'sheet' | 'ream' | 'meter',
    category: ''
  };

  constructor(
    private materialService: MaterialService,
    public subscriptionService: SubscriptionService,
    private sidebarService: SidebarService
  ) {
    this.sidebarSubscription = new Subscription();
  }

  // expose inventory limit values for template
  get inventoryLimit(): number {
    return this.subscriptionService.getInventoryLimit(this.currentPlan);
  }

  get inventoryLimitDisplay(): string {
    const lim = this.inventoryLimit;
    return lim === Infinity ? '∞' : lim.toString();
  }

  ngOnInit(): void {
    this.loadMaterials();
    const sub = this.subscriptionService.getCurrentSubscription();
    if (sub) {
      this.currentPlan = sub.currentPlan;
    }
    this.builtInCategories = this.subscriptionService.getBuiltInCategories();
    
    // Subscribe to sidebar collapsed state
    this.sidebarSubscription = this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.sidebarCollapsed = collapsed;
    });
  }

  loadMaterials(): void {
    this.materials = this.materialService.getMaterials();
    this.filteredMaterials = this.materials;
  }

  searchMaterials(): void {
    if (!this.searchQuery) {
      this.filteredMaterials = this.materials;
    } else {
      this.filteredMaterials = this.materialService.searchMaterials(this.searchQuery);
    }
  }

  addMaterial(): void {
    if (!this.newMaterial.name || this.newMaterial.quantity <= 0 || this.newMaterial.costPerUnit <= 0) {
      alert('Please fill in all fields correctly');
      return;
    }

    // Check for duplicates
    const exists = this.materials.some(m => m.name.toLowerCase() === this.newMaterial.name.toLowerCase());
    if (exists) {
      alert('A material with this name already exists!');
      return;
    }

    try {
      if (this.isEditing && this.editingMaterial) {
        // Update existing material
        this.materialService.updateMaterial(this.editingMaterial.id, {
          ...this.newMaterial
        });
        this.isEditing = false;
        this.editingMaterial = null;
      } else {
        // Add new material
        this.materialService.addMaterial(this.newMaterial);
      }

      this.loadMaterials();
      this.showAddModal = false;
      this.resetForm();
    } catch (e: any) {
      alert(e.message);
    }
  }

  editMaterial(material: Material): void {
    this.editingMaterial = material;
    this.isEditing = true;
    this.newMaterial = {
      name: material.name,
      quantity: material.quantity,
      costPerUnit: material.costPerUnit,
      unit: material.unit,
      category: material.category || ''
    };
    this.showAddModal = true;
  }

  increaseQuantity(material: Material): void {
    this.materialService.updateMaterial(material.id, {
      quantity: material.quantity + 1
    });
    this.loadMaterials();
  }

  decreaseQuantity(material: Material): void {
    if (material.quantity > 0) {
      this.materialService.updateMaterial(material.id, {
        quantity: material.quantity - 1
      });
      this.loadMaterials();
    }
  }

  deleteMaterial(id: string): void {
    if (confirm('Are you sure you want to delete this material?')) {
      this.materialService.deleteMaterial(id);
      this.loadMaterials();
    }
  }

  resetForm(): void {
    this.newMaterial = { name: '', quantity: 0, costPerUnit: 0, unit: 'piece', category: '' };
    this.isEditing = false;
    this.editingMaterial = null;
  }

  closeModal(): void {
    this.showAddModal = false;
    this.resetForm();
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
