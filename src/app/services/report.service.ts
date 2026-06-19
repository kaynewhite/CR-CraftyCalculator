import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Report {
  id: string;
  reporter_id: string;
  reporter_role: 'user' | 'admin';
  reporter_name?: string;
  reporter_email?: string;
  type: 'bug' | 'problem' | 'feedback' | 'other';
  subject: string;
  description: string;
  status: 'open' | 'seen' | 'resolved' | 'closed';
  is_forwarded: boolean;
  forwarded_by?: string;
  forwarded_by_name?: string;
  forwarded_at?: string;
  admin_reply?: string;
  admin_reply_at?: string;
  superadmin_reply?: string;
  superadmin_reply_at?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  constructor(private api: ApiService) {}

  submitReport(type: string, subject: string, description: string): Observable<any> {
    return this.api.post('/reports', { type, subject, description });
  }

  getMyReports(): Observable<any> {
    return this.api.get('/reports/mine');
  }

  getUserReports(): Observable<any> {
    return this.api.get('/reports/user-reports');
  }

  getAdminReports(): Observable<any> {
    return this.api.get('/reports/admin-reports');
  }

  markSeen(id: string): Observable<any> {
    return this.api.put(`/reports/${id}/seen`, {});
  }

  reply(id: string, reply: string): Observable<any> {
    return this.api.put(`/reports/${id}/reply`, { reply });
  }

  forward(id: string): Observable<any> {
    return this.api.put(`/reports/${id}/forward`, {});
  }

  resolve(id: string): Observable<any> {
    return this.api.put(`/reports/${id}/resolve`, {});
  }

  deleteReport(id: string): Observable<any> {
    return this.api.delete(`/reports/${id}`);
  }
}
