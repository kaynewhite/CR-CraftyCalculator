import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../models/user.model';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

declare type ClerkInstance = any;

let _clerk: ClerkInstance | null = null;
let _clerkPromise: Promise<ClerkInstance> | null = null;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser = this.currentUserSubject.asObservable();
  private tokenRefreshTimer: any = null;
  private initialized = false;

  constructor(private api: ApiService) {
    this.init();
  }

  async getClerk(): Promise<ClerkInstance> {
    if (_clerk) return _clerk;
    if (_clerkPromise) return _clerkPromise;
    _clerkPromise = (async () => {
      const mod = await import('@clerk/clerk-js');
      const ClerkClass = (mod as any).default ?? (mod as any).Clerk;
      const clerk = new ClerkClass(environment.clerkPublishableKey);
      await clerk.load();
      _clerk = clerk;
      return clerk;
    })();
    return _clerkPromise;
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const clerk = await this.getClerk();
      if (clerk.session && clerk.user) {
        const token = await clerk.session.getToken();
        if (token) {
          this.api.setToken(token);
          await this.syncUser();
          this.startTokenRefresh(clerk);
        }
      }
      clerk.addListener(async ({ session, user }: any) => {
        if (session && user) {
          const token = await session.getToken();
          if (token) {
            this.api.setToken(token);
            await this.syncUser();
            this.startTokenRefresh(clerk);
          }
        } else {
          this.currentUserSubject.next(null);
          this.api.setToken(null);
          this.stopTokenRefresh();
        }
      });
    } catch (err) {
      console.error('[Auth] Init error:', err);
    }
  }

  private async syncUser(): Promise<void> {
    return new Promise((resolve) => {
      this.api.getMe().subscribe({
        next: (dbUser: any) => {
          const user: User = {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            password: '',
            role: dbUser.role || 'user',
            subscriptionPlan: dbUser.plan || 'free',
            createdAt: new Date(dbUser.created_at),
            status: dbUser.status || 'active',
          };
          this.currentUserSubject.next(user);
          resolve();
        },
        error: (err: any) => {
          console.error('[Auth] Sync error:', err);
          resolve();
        },
      });
    });
  }

  private startTokenRefresh(clerk: ClerkInstance): void {
    this.stopTokenRefresh();
    this.tokenRefreshTimer = setInterval(async () => {
      const token = await clerk.session?.getToken();
      if (token) this.api.setToken(token);
    }, 50000);
  }

  private stopTokenRefresh(): void {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const clerk = await this.getClerk();
    const result = await clerk.client.signIn.create({
      identifier: email,
      password: password,
    });
    if (result.status === 'complete') {
      await clerk.setActive({ session: result.createdSessionId });
    } else {
      throw new Error('Sign in could not be completed. Status: ' + result.status);
    }
  }

  async signUp(name: string, email: string, password: string): Promise<{ needsVerification: boolean }> {
    const clerk = await this.getClerk();
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || name;
    const lastName = nameParts.slice(1).join(' ') || '';

    const result = await clerk.client.signUp.create({
      emailAddress: email,
      password,
      firstName,
      lastName,
    });

    if (result.status === 'complete') {
      await clerk.setActive({ session: result.createdSessionId });
      return { needsVerification: false };
    } else if (result.status === 'missing_requirements') {
      await result.prepareEmailAddressVerification({ strategy: 'email_code' });
      return { needsVerification: true };
    } else {
      throw new Error('Sign up could not be completed. Status: ' + result.status);
    }
  }

  async verifyEmail(code: string): Promise<void> {
    const clerk = await this.getClerk();
    const result = await clerk.client.signUp.attemptEmailAddressVerification({ code });
    if (result.status === 'complete') {
      await clerk.setActive({ session: result.createdSessionId });
    } else {
      throw new Error('Verification failed. Please check your code and try again.');
    }
  }

  logout(): void {
    this.getClerk().then(clerk => clerk.signOut());
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
