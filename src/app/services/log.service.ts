import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { SubscriptionLog, SystemLog } from '../models/subscription-log.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class LogService {
  constructor(private api: ApiService) {}

  getSubscriptionLogs(): Observable<SubscriptionLog[]> {
    return new Observable(observer => {
      this.api.getSubscriptionLogs().subscribe({
        next: (rows: any[]) => {
          observer.next(rows.map(r => ({
            id: r.id, userId: r.user_id, action: r.action, plan: r.plan,
            cost: parseFloat(r.cost), approvedBy: r.approved_by,
            feedback: r.feedback, timestamp: r.created_at, details: r.details,
          })));
          observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  getSubscriptionLogsByUser(userId: string): Observable<SubscriptionLog[]> {
    return new Observable(observer => {
      this.getSubscriptionLogs().subscribe({
        next: (logs) => { observer.next(logs.filter(l => l.userId === userId)); observer.complete(); },
        error: (err: any) => observer.error(err),
      });
    });
  }

  getSystemLogs(): Observable<SystemLog[]> {
    return new Observable(observer => {
      this.api.getSystemLogs().subscribe({
        next: (rows: any[]) => {
          observer.next(rows.map(r => ({
            id: r.id, type: r.type, message: r.message,
            userId: r.user_id, adminId: r.admin_id,
            timestamp: r.created_at, details: r.details,
          })));
          observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  getSystemLogsByType(type: string): Observable<SystemLog[]> {
    return new Observable(observer => {
      this.getSystemLogs().subscribe({
        next: (logs) => { observer.next(logs.filter(l => l.type === type)); observer.complete(); },
        error: (err: any) => observer.error(err),
      });
    });
  }

  getSystemLogsByDateRange(startDate: Date, endDate: Date): Observable<SystemLog[]> {
    return new Observable(observer => {
      this.getSystemLogs().subscribe({
        next: (logs) => {
          observer.next(logs.filter(l => { const d = new Date(l.timestamp); return d >= startDate && d <= endDate; }));
          observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  clearSystemLogs(): Observable<void> {
    return new Observable(observer => {
      this.api.clearSystemLogs().subscribe({
        next: () => { observer.next(); observer.complete(); },
        error: (err: any) => observer.error(err),
      });
    });
  }

  addSubscriptionLog(_log: SubscriptionLog): Observable<void> { return of(void 0); }
  addSystemLog(_log: SystemLog): Observable<void> { return of(void 0); }
}
