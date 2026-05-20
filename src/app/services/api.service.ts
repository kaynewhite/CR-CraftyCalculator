import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;
  private token: string | null = null;

  constructor(private http: HttpClient) {}

  setToken(token: string | null) {
    this.token = token;
  }

  private headers(): HttpHeaders {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return new HttpHeaders(h);
  }

  private handle(obs: Observable<any>): Observable<any> {
    return obs.pipe(
      catchError(err => {
        const msg = err?.error?.error || err?.error?.message || err?.message || 'Request failed';
        return throwError(() => new Error(msg));
      })
    );
  }

  get(path: string): Observable<any> {
    return this.handle(this.http.get(`${this.baseUrl}${path}`, { headers: this.headers() }));
  }

  post(path: string, body: any): Observable<any> {
    return this.handle(this.http.post(`${this.baseUrl}${path}`, body, { headers: this.headers() }));
  }

  put(path: string, body: any): Observable<any> {
    return this.handle(this.http.put(`${this.baseUrl}${path}`, body, { headers: this.headers() }));
  }

  delete(path: string): Observable<any> {
    return this.handle(this.http.delete(`${this.baseUrl}${path}`, { headers: this.headers() }));
  }

  // ── Auth ──
  login(email: string, password: string): Observable<any> {
    return this.handle(this.http.post(`${this.baseUrl}/auth/login`, { email, password }));
  }

  signup(name: string, email: string, password: string): Observable<any> {
    return this.handle(this.http.post(`${this.baseUrl}/auth/signup`, { name, email, password }));
  }

  // ── Users ──
  getMe(): Observable<any> { return this.get('/users/me'); }
  updateMe(data: { name?: string; email?: string }): Observable<any> { return this.put('/users/me', data); }
  getAllUsers(): Observable<any> { return this.get('/users'); }
  setUserStatus(id: string, status: string, feedback?: string): Observable<any> {
    return this.put(`/users/${id}/status`, { status, rejection_feedback: feedback });
  }
  setUserRole(id: string, role: string): Observable<any> {
    return this.put(`/users/${id}/role`, { role });
  }
  deleteUser(id: string): Observable<any> { return this.delete(`/users/${id}`); }

  // ── Materials ──
  getMaterials(): Observable<any> { return this.get('/materials'); }
  createMaterial(data: any): Observable<any> { return this.post('/materials', data); }
  updateMaterial(id: string, data: any): Observable<any> { return this.put(`/materials/${id}`, data); }
  deleteMaterial(id: string): Observable<any> { return this.delete(`/materials/${id}`); }

  // ── Calculations ──
  getCalculations(): Observable<any> { return this.get('/calculations'); }
  getCalculationSummary(): Observable<any> { return this.get('/calculations/summary'); }
  createCalculation(data: any): Observable<any> { return this.post('/calculations', data); }
  deleteCalculation(id: string): Observable<any> { return this.delete(`/calculations/${id}`); }

  // ── Subscriptions ──
  getPlans(): Observable<any> { return this.get('/subscriptions/plans'); }
  getMySubscription(): Observable<any> { return this.get('/subscriptions/me'); }
  getAllSubscriptions(): Observable<any> { return this.get('/subscriptions'); }
  setUserPlan(userId: string, plan: string, months = 1): Observable<any> {
    return this.put(`/subscriptions/${userId}`, { plan, duration_months: months });
  }

  // ── Payments ──
  getQrCodes(): Observable<any> { return this.get('/payments/qr'); }
  setQrCode(method: string, qr_url: string): Observable<any> {
    return this.put('/payments/qr', { method, qr_url });
  }
  getMyPayments(): Observable<any> { return this.get('/payments'); }
  getAllPayments(): Observable<any> { return this.get('/payments/all'); }
  submitPayment(data: { plan: string; method: string; screenshot_url?: string }): Observable<any> {
    return this.post('/payments', data);
  }
  approvePayment(id: string): Observable<any> { return this.put(`/payments/${id}/approve`, {}); }
  rejectPayment(id: string, feedback?: string): Observable<any> {
    return this.put(`/payments/${id}/reject`, { feedback });
  }

  // ── Admin ──
  getAdminStats(): Observable<any> { return this.get('/admin/stats'); }
  getRevenueChart(): Observable<any> { return this.get('/admin/stats/revenue'); }
  getSubscriptionLogs(): Observable<any> { return this.get('/admin/logs/subscriptions'); }
  getSystemLogs(): Observable<any> { return this.get('/admin/logs/system'); }
  clearSystemLogs(): Observable<any> { return this.delete('/admin/logs/system'); }
  getAdminAccounts(): Observable<any> { return this.get('/admin/admins'); }

  // ── Password Reset (admin-mediated) ──
  forgotPassword(email: string): Observable<any> {
    return this.post('/auth/forgot-password', { email });
  }
  resetPassword(token: string, password: string): Observable<any> {
    return this.post('/auth/reset-password', { token, password });
  }
  validateResetToken(token: string): Observable<any> {
    return this.get(`/auth/validate-token/${token}`);
  }
  getResetRequests(): Observable<any> { return this.get('/admin/reset-requests'); }
  dismissResetRequest(id: string): Observable<any> { return this.delete(`/admin/reset-requests/${id}`); }

  // ── Health ──
  health(): Observable<any> { return this.get('/health'); }
}
