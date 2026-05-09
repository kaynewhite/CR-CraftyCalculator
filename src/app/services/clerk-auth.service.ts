import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';

declare const Clerk: any;

export interface ClerkUser {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class ClerkAuthService {
  private userSubject = new BehaviorSubject<ClerkUser | null>(null);
  public user$ = this.userSubject.asObservable();
  private clerkReady = false;

  constructor(private api: ApiService) {}

  async initClerk(): Promise<void> {
    if (typeof window === 'undefined') return;

    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (typeof (window as any).Clerk !== 'undefined') {
          clearInterval(check);
          this.setupClerk().then(resolve);
        }
      }, 100);
      // Timeout after 10 seconds
      setTimeout(() => { clearInterval(check); resolve(); }, 10000);
    });
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
          this.userSubject.next(null);
          this.api.setToken(null);
        }
      });
    } catch (err) {
      console.error('[Clerk] Init error:', err);
    }
  }

  private async syncUser(): Promise<void> {
    try {
      const clerk = (window as any).Clerk;
      const token = await clerk.session?.getToken();
      if (!token) return;

      this.api.setToken(token);

      this.api.getMe().subscribe({
        next: (dbUser: any) => {
          this.userSubject.next({
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
            plan: dbUser.plan || 'free',
            status: dbUser.status,
          });
        },
        error: (err: any) => console.error('[Clerk] Sync error:', err),
      });
    } catch (err) {
      console.error('[Clerk] Token error:', err);
    }
  }

  get currentUser(): ClerkUser | null {
    return this.userSubject.value;
  }

  isAuthenticated(): boolean {
    return this.userSubject.value !== null;
  }

  isAdmin(): boolean {
    const u = this.userSubject.value;
    return u?.role === 'admin' || u?.role === 'superadmin';
  }

  async getToken(): Promise<string | null> {
    const clerk = (window as any).Clerk;
    if (!clerk?.session) return null;
    return clerk.session.getToken();
  }

  async refreshToken(): Promise<void> {
    const token = await this.getToken();
    if (token) this.api.setToken(token);
  }

  openSignIn(opts?: any): void {
    const clerk = (window as any).Clerk;
    if (clerk) clerk.openSignIn(opts || {});
  }

  openSignUp(opts?: any): void {
    const clerk = (window as any).Clerk;
    if (clerk) clerk.openSignUp(opts || {});
  }

  async signOut(): Promise<void> {
    const clerk = (window as any).Clerk;
    if (clerk) await clerk.signOut();
    this.userSubject.next(null);
    this.api.setToken(null);
  }
}
