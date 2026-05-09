import { Injectable } from '@angular/core';
import { User } from '../models/user.model';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { ApiService } from './api.service';

declare const Clerk: any;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser = this.currentUserSubject.asObservable();

  private clerkReady = false;
  private tokenRefreshTimer: any = null;

  constructor(private api: ApiService) {
    this.initClerk();
  }

  private async initClerk(): Promise<void> {
    const check = setInterval(async () => {
      if (typeof (window as any).Clerk !== 'undefined') {
        clearInterval(check);
        await this.setupClerk();
      }
    }, 150);
    setTimeout(() => clearInterval(check), 12000);
  }

  private async setupClerk(): Promise<void> {
    const clerk = (window as any).Clerk;
    if (!clerk) return;
    try {
      await clerk.load();
      this.clerkReady = true;
      if (clerk.user) {
        await this.syncUser();
      }
      clerk.addListener(async ({ user }: any) => {
        if (user) {
          await this.syncUser();
        } else {
          this.currentUserSubject.next(null);
          this.api.setToken(null);
          if (this.tokenRefreshTimer) clearInterval(this.tokenRefreshTimer);
        }
      });
    } catch (err) {
      console.error('[Clerk] Setup error:', err);
    }
  }

  async syncUser(): Promise<void> {
    const clerk = (window as any).Clerk;
    if (!clerk?.session) return;
    try {
      const token = await clerk.session.getToken();
      if (!token) return;
      this.api.setToken(token);

      this.api.getMe().subscribe({
        next: (dbUser: any) => {
          const user: User = {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            password: '',
            role: dbUser.role || 'user',
            subscriptionPlan: (dbUser.plan as any) || 'free',
            createdAt: new Date(dbUser.created_at),
            status: dbUser.status || 'active',
          };
          this.currentUserSubject.next(user);
        },
        error: (err: any) => console.error('[Auth] Sync error:', err),
      });

      // Refresh token every 50 seconds
      if (this.tokenRefreshTimer) clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = setInterval(async () => {
        const fresh = await clerk.session?.getToken();
        if (fresh) this.api.setToken(fresh);
      }, 50000);
    } catch (err) {
      console.error('[Auth] Token error:', err);
    }
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(email: string, password: string): Observable<User> {
    return new Observable(observer => {
      const clerk = (window as any).Clerk;
      if (!clerk) {
        observer.error({ message: 'Authentication service not ready' });
        return;
      }
      clerk.openSignIn({
        afterSignInUrl: window.location.href,
      });
      observer.error({ message: 'Use the sign-in modal' });
    });
  }

  signup(name: string, email: string, password: string): Observable<User> {
    return new Observable(observer => {
      const clerk = (window as any).Clerk;
      if (!clerk) {
        observer.error({ message: 'Authentication service not ready' });
        return;
      }
      clerk.openSignUp({
        afterSignUpUrl: '/dashboard',
      });
      observer.error({ message: 'Use the sign-up modal' });
    });
  }

  logout(): void {
    const clerk = (window as any).Clerk;
    if (clerk) {
      clerk.signOut().then(() => {
        this.currentUserSubject.next(null);
        this.api.setToken(null);
      });
    } else {
      this.currentUserSubject.next(null);
      this.api.setToken(null);
    }
  }

  updateProfile(name: string, email: string): Observable<User> {
    return new Observable(observer => {
      this.api.updateMe({ name, email }).subscribe({
        next: (dbUser: any) => {
          const updated: User = {
            ...this.currentUserValue!,
            name: dbUser.name,
            email: dbUser.email,
          };
          this.currentUserSubject.next(updated);
          observer.next(updated);
          observer.complete();
        },
        error: (err: any) => observer.error(err),
      });
    });
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  isAdmin(): boolean {
    const u = this.currentUserValue;
    return u?.role === 'admin' || u?.role === 'superadmin';
  }

  openSignIn(redirectUrl?: string): void {
    const clerk = (window as any).Clerk;
    if (clerk) clerk.openSignIn({ afterSignInUrl: redirectUrl || '/dashboard' });
  }

  openSignUp(redirectUrl?: string): void {
    const clerk = (window as any).Clerk;
    if (clerk) clerk.openSignUp({ afterSignUpUrl: redirectUrl || '/dashboard' });
  }
}
