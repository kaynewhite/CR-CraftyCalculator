import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../models/user.model';
import { ApiService } from './api.service';

const TOKEN_KEY = 'cr_auth_token';
const USER_KEY = 'cr_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser = this.currentUserSubject.asObservable();

  constructor(private api: ApiService) {
    this.restoreSession();
  }

  private restoreSession(): void {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const userJson = localStorage.getItem(USER_KEY);
      if (token && userJson) {
        const user = JSON.parse(userJson) as User;
        this.api.setToken(token);
        this.currentUserSubject.next(user);
        this.refreshProfile();
      }
    } catch {
      this.clearSession();
    }
  }

  refreshProfile(): void {
    this.api.getMe().subscribe({
      next: (dbUser: any) => {
        const user = this.mapUser(dbUser);
        this.currentUserSubject.next(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      },
      error: () => {
        this.clearSession();
      },
    });
  }

  private mapUser(data: any): User {
    const role = data.role || 'user';
    const subscriptionPlan = role === 'admin' || role === 'superadmin' ? 'pro' : (data.plan || 'free');
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      password: '',
      role,
      subscriptionPlan,
      createdAt: new Date(data.created_at),
      status: data.status || 'active',
      rejectionFeedback: data.rejection_feedback,
    };
  }

  private storeSession(token: string, user: User): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.api.setToken(token);
    this.currentUserSubject.next(user);
    this.startHeartbeat();
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.api.setToken(null);
    this.currentUserSubject.next(null);
  }

  async signIn(email: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.api.login(email, password).subscribe({
        next: (res: any) => {
          const user = this.mapUser({ ...res.user, plan: res.user.plan || 'free' });
          this.storeSession(res.token, user);
          resolve();
        },
        error: (err: any) => reject(err),
      });
    });
  }

  async signUp(name: string, email: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.api.signup(name, email, password).subscribe({
        next: () => resolve(),
        error: (err: any) => reject(err),
      });
    });
  }

  async verifyOtp(email: string, otp: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.api.verifyOtp(email, otp).subscribe({
        next: (res: any) => {
          const user = this.mapUser({ ...res.user, plan: 'free' });
          this.storeSession(res.token, user);
          resolve();
        },
        error: (err: any) => reject(err),
      });
    });
  }

  async resendOtp(email: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.api.resendOtp(email).subscribe({
        next: () => resolve(),
        error: (err: any) => reject(err),
      });
    });
  }

  logout(): void {
    this.stopHeartbeat();
    this.api.logoutApi().subscribe({ error: () => {} });
    this.clearSession();
  }

  private heartbeatInterval: any = null;

  startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    this.api.heartbeat().subscribe({ error: () => {} });
    this.heartbeatInterval = setInterval(() => {
      if (this.isAuthenticated()) {
        this.api.heartbeat().subscribe({ error: () => {} });
      }
    }, 2 * 60 * 1000);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  isAdmin(): boolean {
    const u = this.currentUserValue;
    return u?.role === 'admin' || u?.role === 'superadmin';
  }

  isSuperAdmin(): boolean {
    return this.currentUserValue?.role === 'superadmin';
  }

  updateProfile(name: string, email: string): Observable<User> {
    return new Observable<User>((observer) => {
      this.api.updateMe({ name, email }).subscribe({
        next: (dbUser: any) => {
          const updated: User = {
            ...this.currentUserValue!,
            name: dbUser.name,
            email: dbUser.email,
          };
          this.currentUserSubject.next(updated);
          localStorage.setItem(USER_KEY, JSON.stringify(updated));
          observer.next(updated);
          observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  updatePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.api.updateMyPassword(currentPassword, newPassword);
  }

  openSignIn(_redirect?: string): void {}
  openSignUp(_redirect?: string): void {}
}
