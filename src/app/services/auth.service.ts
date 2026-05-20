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

  private refreshProfile(): void {
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
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      password: '',
      role: data.role || 'user',
      subscriptionPlan: data.plan || 'free',
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

  async signUp(name: string, email: string, password: string): Promise<{ needsVerification: boolean }> {
    return new Promise((resolve, reject) => {
      this.api.signup(name, email, password).subscribe({
        next: (res: any) => {
          const user = this.mapUser({ ...res.user, plan: 'free' });
          this.storeSession(res.token, user);
          resolve({ needsVerification: false });
        },
        error: (err: any) => reject(err),
      });
    });
  }

  logout(): void {
    this.clearSession();
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

  openSignIn(_redirect?: string): void {}
  openSignUp(_redirect?: string): void {}
}
