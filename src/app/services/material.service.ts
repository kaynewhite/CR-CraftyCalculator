import { Injectable } from '@angular/core';
import { Material } from '../models/material.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class MaterialService {
  private materialsSubject = new BehaviorSubject<Material[]>([]);
  public materials$ = this.materialsSubject.asObservable();

  constructor(private api: ApiService, private authService: AuthService) {
    this.authService.currentUser.subscribe(user => {
      if (user) this.load();
      else this.materialsSubject.next([]);
    });
  }

  private toMaterial(row: any): Material {
    return {
      id: row.id,
      name: row.name,
      quantity: parseFloat(row.quantity),
      costPerUnit: parseFloat(row.cost_per_unit),
      unit: row.unit,
      category: row.category,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  load(): void {
    this.api.getMaterials().subscribe({
      next: (rows: any[]) => this.materialsSubject.next(rows.map(r => this.toMaterial(r))),
      error: (err: any) => console.error('[Materials] Load error:', err),
    });
  }

  getMaterials(): Material[] {
    return this.materialsSubject.value;
  }

  getMaterialById(id: string): Material | undefined {
    return this.materialsSubject.value.find(m => m.id === id);
  }

  addMaterialAsync(material: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>): Observable<Material> {
    const payload = {
      name: material.name,
      quantity: material.quantity,
      cost_per_unit: material.costPerUnit,
      unit: material.unit,
      category: material.category || null,
    };
    return new Observable(observer => {
      this.api.createMaterial(payload).subscribe({
        next: (row: any) => {
          const m = this.toMaterial(row);
          this.materialsSubject.next([m, ...this.materialsSubject.value]);
          observer.next(m);
          observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  addMaterial(material: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>): Material {
    const temp: Material = { ...material, id: 'pending-' + Date.now(), createdAt: new Date(), updatedAt: new Date() };
    this.addMaterialAsync(material).subscribe({ error: e => console.error(e) });
    return temp;
  }

  updateMaterialAsync(id: string, updates: Partial<Material>): Observable<Material> {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.quantity !== undefined) payload.quantity = updates.quantity;
    if (updates.costPerUnit !== undefined) payload.cost_per_unit = updates.costPerUnit;
    if (updates.unit !== undefined) payload.unit = updates.unit;
    if (updates.category !== undefined) payload.category = updates.category;

    return new Observable(observer => {
      this.api.updateMaterial(id, payload).subscribe({
        next: (row: any) => {
          const updated = this.toMaterial(row);
          this.materialsSubject.next(this.materialsSubject.value.map(m => m.id === id ? updated : m));
          observer.next(updated);
          observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  updateMaterial(id: string, updates: Partial<Material>): Material | null {
    const existing = this.getMaterialById(id);
    if (!existing) return null;
    this.updateMaterialAsync(id, updates).subscribe({ error: e => console.error(e) });
    return { ...existing, ...updates, updatedAt: new Date() };
  }

  deleteMaterial(id: string): boolean {
    this.api.deleteMaterial(id).subscribe({
      next: () => this.materialsSubject.next(this.materialsSubject.value.filter(m => m.id !== id)),
      error: (err: any) => console.error('[Materials] Delete error:', err),
    });
    return true;
  }

  searchMaterials(query: string): Material[] {
    const q = query.toLowerCase();
    return this.materialsSubject.value.filter(m =>
      m.name.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q)
    );
  }

  getMaterialsByCategory(category: string): Material[] {
    return this.materialsSubject.value.filter(m => m.category === category);
  }

  getCategories(): string[] {
    const cats = this.materialsSubject.value.map(m => m.category).filter((c): c is string => !!c);
    return [...new Set(cats)];
  }
}
