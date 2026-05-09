import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    if (authService.isAuthenticated()) {
      const user = (authService as any).currentUserValue;
      if (user && (user.role === 'admin' || user.role === 'superadmin') && router.url === '/dashboard') {
        router.navigate(['/admin-dashboard']);
        return false;
      }
      return true;
    }
    router.navigate(['/login']);
    return false;
  } catch (e) {
    console.error('authGuard error:', e);
    return true;
  }
};

export const guestGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    if (!authService.isAuthenticated()) {
      return true;
    }
    const user = (authService as any).currentUserValue;
    if (user && (user.role === 'admin' || user.role === 'superadmin')) {
      router.navigate(['/admin-dashboard']);
    } else {
      router.navigate(['/dashboard']);
    }
    return false;
  } catch (e) {
    console.error('guestGuard error:', e);
    return true;
  }
};

export const adminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    const user = (authService as any).currentUserValue;
    if (user && (user.role === 'admin' || user.role === 'superadmin')) {
      return true;
    }
    router.navigate(['/bigboss-login']);
    return false;
  } catch (e) {
    console.error('adminGuard error:', e);
    return true;
  }
};
