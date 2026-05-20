import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  try {
    if (authService.isAuthenticated()) {
      return true;
    }
    router.navigate(['/login']);
    return false;
  } catch {
    return true;
  }
};

export const guestGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  try {
    if (!authService.isAuthenticated()) return true;
    const user = authService.currentUserValue;
    if (user && (user.role === 'admin' || user.role === 'superadmin')) {
      router.navigate(['/admin-dashboard']);
    } else {
      router.navigate(['/dashboard']);
    }
    return false;
  } catch {
    return true;
  }
};

export const adminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  try {
    const user = authService.currentUserValue;
    if (user && (user.role === 'admin' || user.role === 'superadmin')) return true;
    router.navigate(['/login']);
    return false;
  } catch {
    return true;
  }
};

export const superAdminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  try {
    const user = authService.currentUserValue;
    if (user && user.role === 'superadmin') return true;
    router.navigate(['/admin-dashboard']);
    return false;
  } catch {
    return true;
  }
};
