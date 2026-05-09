import { Injectable } from '@angular/core';
import { Calculation, CalculationSummary } from '../models/calculation.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CalculationService {
  private calculationsSubject = new BehaviorSubject<Calculation[]>([]);
  public calculations$ = this.calculationsSubject.asObservable();

  private summaryCache: CalculationSummary | null = null;

  constructor(private api: ApiService, private authService: AuthService) {
    this.authService.currentUser.subscribe(user => {
      if (user) this.load();
      else this.calculationsSubject.next([]);
    });
  }

  private toCalculation(row: any): Calculation {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      category: row.category,
      materials: Array.isArray(row.materials) ? row.materials : JSON.parse(row.materials || '[]'),
      totalCost: parseFloat(row.total_cost),
      suggestedPrice: parseFloat(row.suggested_price),
      profitMargin: parseFloat(row.profit_margin),
      profitAmount: parseFloat(row.profit_amount),
      notes: row.notes,
      createdAt: new Date(row.created_at),
    };
  }

  load(): void {
    this.api.getCalculations().subscribe({
      next: (rows: any[]) => this.calculationsSubject.next(rows.map(r => this.toCalculation(r))),
      error: (err: any) => console.error('[Calculations] Load error:', err),
    });
  }

  getCalculations(): Calculation[] {
    return this.calculationsSubject.value;
  }

  getCalculationById(id: string): Calculation | undefined {
    return this.calculationsSubject.value.find(c => c.id === id);
  }

  addCalculation(calculation: Omit<Calculation, 'id' | 'createdAt'>): Calculation {
    const payload = {
      name: calculation.name,
      category: calculation.category,
      materials: calculation.materials,
      total_cost: calculation.totalCost,
      suggested_price: calculation.suggestedPrice,
      profit_margin: calculation.profitMargin,
      profit_amount: calculation.profitAmount,
      notes: calculation.notes,
    };
    const temp: Calculation = {
      ...calculation,
      id: 'pending-' + Date.now(),
      createdAt: new Date(),
    };

    this.api.createCalculation(payload).subscribe({
      next: (row: any) => {
        const c = this.toCalculation(row);
        this.calculationsSubject.next([c, ...this.calculationsSubject.value]);
      },
      error: (err: any) => console.error('[Calculations] Save error:', err),
    });

    return temp;
  }

  addCalculationAsync(calculation: Omit<Calculation, 'id' | 'createdAt'>): Observable<Calculation> {
    const payload = {
      name: calculation.name,
      category: calculation.category,
      materials: calculation.materials,
      total_cost: calculation.totalCost,
      suggested_price: calculation.suggestedPrice,
      profit_margin: calculation.profitMargin,
      profit_amount: calculation.profitAmount,
      notes: calculation.notes,
    };
    return new Observable(observer => {
      this.api.createCalculation(payload).subscribe({
        next: (row: any) => {
          const c = this.toCalculation(row);
          this.calculationsSubject.next([c, ...this.calculationsSubject.value]);
          observer.next(c);
          observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  deleteCalculation(id: string): boolean {
    this.api.deleteCalculation(id).subscribe({
      next: () => this.calculationsSubject.next(this.calculationsSubject.value.filter(c => c.id !== id)),
      error: (err: any) => console.error('[Calculations] Delete error:', err),
    });
    return true;
  }

  getSavedLimit(): number {
    return Infinity; // enforced server-side
  }

  getExpiryDays(): number {
    return 30;
  }

  getRemainingSlots(): number {
    return Infinity;
  }

  enforceLimits(): void {
    this.load();
  }

  getCalculationSummary(): CalculationSummary {
    const calculations = this.calculationsSubject.value;
    const totalCalculations = calculations.length;
    const averageProfit = calculations.length > 0
      ? calculations.reduce((s, c) => s + c.profitAmount, 0) / calculations.length
      : 0;
    const totalMaterialsUsed = calculations.reduce((s, c) =>
      s + c.materials.reduce((ms, m) => ms + m.quantity, 0), 0);
    const recentCalculations = [...calculations]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
    return { totalCalculations, averageProfit, totalMaterialsUsed, recentCalculations };
  }

  searchCalculations(query: string): Calculation[] {
    const q = query.toLowerCase();
    return this.calculationsSubject.value.filter(c =>
      c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.notes?.toLowerCase().includes(q)
    );
  }

  filterByCategory(category: string): Calculation[] {
    return this.calculationsSubject.value.filter(c => c.category === category);
  }

  sortCalculations(sortBy: 'date' | 'profit' | 'name', order: 'asc' | 'desc' = 'desc'): Calculation[] {
    return [...this.calculationsSubject.value].sort((a, b) => {
      let v = 0;
      if (sortBy === 'date') v = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      else if (sortBy === 'profit') v = b.profitAmount - a.profitAmount;
      else if (sortBy === 'name') v = a.name.localeCompare(b.name);
      return order === 'asc' ? -v : v;
    });
  }
}
