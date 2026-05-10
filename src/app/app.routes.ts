import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { LoginComponent } from './components/login/login.component';
import { SignupComponent } from './components/signup/signup.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { PaymentApprovalComponent } from './components/payment-approval/payment-approval.component';
import { UserManagementComponent } from './components/user-management/user-management.component';
import { SystemLogsComponent } from './components/system-logs/system-logs.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { CalculatorComponent } from './components/calculator/calculator.component';
import { HistoryComponent } from './components/history/history.component';
import { InventoryComponent } from './components/inventory/inventory.component';
import { ProfileComponent } from './components/profile/profile.component';
import { SubscriptionComponent } from './components/subscription/subscription.component';
import { QrManagerComponent } from './components/qr-manager/qr-manager.component';
import { PasswordResetsComponent } from './components/password-resets/password-resets.component';
import { authGuard, guestGuard, adminGuard, superAdminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LandingComponent, canActivate: [guestGuard] },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'signup', component: SignupComponent, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },

  { path: 'admin-login', redirectTo: '/login', pathMatch: 'full' },

  { path: 'admin-dashboard', component: AdminDashboardComponent, canActivate: [adminGuard] },
  { path: 'admin-payments', component: PaymentApprovalComponent, canActivate: [adminGuard] },
  { path: 'admin-qr', component: QrManagerComponent, canActivate: [adminGuard] },
  { path: 'admin-users', component: UserManagementComponent, canActivate: [adminGuard] },
  { path: 'admin-resets', component: PasswordResetsComponent, canActivate: [adminGuard] },
  { path: 'admin-logs', component: SystemLogsComponent, canActivate: [superAdminGuard] },

  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'calculator', component: CalculatorComponent, canActivate: [authGuard] },
  { path: 'saved', component: HistoryComponent, canActivate: [authGuard] },
  { path: 'inventory', component: InventoryComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'subscription', component: SubscriptionComponent, canActivate: [authGuard] },

  { path: '**', redirectTo: '' },
];
