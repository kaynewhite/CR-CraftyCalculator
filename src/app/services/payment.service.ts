import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { PaymentRequest } from '../models/payment.model';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private requestsSubject = new BehaviorSubject<PaymentRequest[]>([]);
  public requests$ = this.requestsSubject.asObservable();

  private qrSubject = new BehaviorSubject<{ gcash: string | null; maya: string | null }>({ gcash: null, maya: null });
  public qr$ = this.qrSubject.asObservable();

  constructor(private api: ApiService, private authService: AuthService) {
    this.authService.currentUser.subscribe(user => {
      if (user) {
        this.loadMyRequests();
        this.loadQrCodes();
      } else {
        this.requestsSubject.next([]);
      }
    });
  }

  private toRequest(row: any): PaymentRequest {
    return {
      id: row.id,
      userId: row.user_id,
      plan: row.plan,
      method: row.method,
      screenshotUrl: row.screenshot_url,
      status: row.status,
      feedback: row.feedback,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectedBy: row.rejected_by,
      rejectedAt: row.rejected_at,
    };
  }

  loadMyRequests(): void {
    this.api.getMyPayments().subscribe({
      next: (rows: any[]) => this.requestsSubject.next(rows.map(r => this.toRequest(r))),
      error: (err: any) => console.error('[Payments] Load error:', err),
    });
  }

  loadQrCodes(): void {
    this.api.getQrCodes().subscribe({
      next: (data: any) => this.qrSubject.next({ gcash: data.gcash || null, maya: data.maya || null }),
      error: (err: any) => console.error('[Payments] QR load error:', err),
    });
  }

  getAll(): Observable<PaymentRequest[]> {
    return this.requests$;
  }

  getAllFromApi(): Observable<any[]> {
    return this.api.getAllPayments();
  }

  add(request: Partial<PaymentRequest>): Observable<void> {
    return new Observable(observer => {
      this.api.submitPayment({
        plan: request.plan!,
        method: request.method!,
        screenshot_url: request.screenshotUrl,
      }).subscribe({
        next: (row: any) => {
          const pr = this.toRequest(row);
          this.requestsSubject.next([pr, ...this.requestsSubject.value]);
          observer.next();
          observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  update(id: string, changes: Partial<PaymentRequest>): Observable<void> {
    const updated = this.requestsSubject.value.map(r => r.id === id ? { ...r, ...changes } : r);
    this.requestsSubject.next(updated);
    return of(void 0);
  }

  approve(id: string): Observable<any> {
    return new Observable(observer => {
      this.api.approvePayment(id).subscribe({
        next: (row: any) => {
          const updated = this.requestsSubject.value.map(r => r.id === id ? this.toRequest(row) : r);
          this.requestsSubject.next(updated);
          observer.next(row);
          observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  reject(id: string, feedback?: string): Observable<any> {
    return new Observable(observer => {
      this.api.rejectPayment(id, feedback).subscribe({
        next: (row: any) => {
          const updated = this.requestsSubject.value.map(r => r.id === id ? this.toRequest(row) : r);
          this.requestsSubject.next(updated);
          observer.next(row);
          observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  setQrCode(method: 'gcash' | 'maya', url: string): Observable<void> {
    return new Observable(observer => {
      this.api.setQrCode(method, url).subscribe({
        next: () => {
          const qr = { ...this.qrSubject.value, [method]: url };
          this.qrSubject.next(qr);
          observer.next();
          observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  findById(id: string): Observable<PaymentRequest | undefined> {
    return of(this.requestsSubject.value.find(r => r.id === id));
  }
}
