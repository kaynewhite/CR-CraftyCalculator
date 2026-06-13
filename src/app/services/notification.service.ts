import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface AppNotification {
  id: string;
  type: 'payment_approved' | 'payment_rejected' | 'subscription_expiring';
  message: string;
  created_at: string;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private refreshInterval: any = null;

  constructor(private api: ApiService, private authService: AuthService) {
    this.authService.currentUser.subscribe(user => {
      if (user && user.role !== 'admin' && user.role !== 'superadmin') {
        this.load();
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => this.load(), 5 * 60 * 1000);
      } else {
        this.notificationsSubject.next([]);
        if (this.refreshInterval) {
          clearInterval(this.refreshInterval);
          this.refreshInterval = null;
        }
      }
    });
  }

  load(): void {
    this.api.getNotifications().subscribe({
      next: (items: any[]) => {
        const readIds = this.getReadIds();
        const notifs: AppNotification[] = items.map(n => ({
          id: n.id,
          type: n.type,
          message: n.message,
          created_at: n.created_at,
          read: readIds.has(n.id),
        }));
        this.notificationsSubject.next(notifs);
      },
      error: (err: any) => console.error('[Notifications] Load error:', err),
    });
  }

  markAllRead(): void {
    const current = this.notificationsSubject.value;
    this.saveReadIds(current.map(n => n.id));
    this.notificationsSubject.next(current.map(n => ({ ...n, read: true })));
  }

  get unreadCount(): number {
    return this.notificationsSubject.value.filter(n => !n.read).length;
  }

  get notifications(): AppNotification[] {
    return this.notificationsSubject.value;
  }

  private getReadIds(): Set<string> {
    try {
      const stored = localStorage.getItem('cr_notif_read');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  }

  private saveReadIds(ids: string[]): void {
    try {
      const existing = this.getReadIds();
      ids.forEach(id => existing.add(id));
      localStorage.setItem('cr_notif_read', JSON.stringify([...existing]));
    } catch {}
  }
}
