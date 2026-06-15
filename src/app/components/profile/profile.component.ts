import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { User } from '../../models/user.model';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule, SidebarComponent, NotificationBellComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  name = '';
  email = '';
  successMessage = '';
  errorMessage = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordSuccess = '';
  passwordError = '';
  updatingPassword = false;
  isEditing = false;
  isLoading = false;
  sidebarOpen = false;
  sidebarCollapsed = false;
  private sidebarSub: Subscription;

  constructor(
    private authService: AuthService,
    private sidebarService: SidebarService,
    private router: Router
  ) {
    this.sidebarSub = new Subscription();
  }

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.name = user.name;
        this.email = user.email;
      }
    });
    this.sidebarSub = this.sidebarService.isCollapsed$.subscribe(collapsed => {
      this.sidebarCollapsed = collapsed;
    });
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    this.successMessage = '';
    this.errorMessage = '';
  }

  saveProfile(): void {
    if (!this.name || !this.email) {
      this.errorMessage = 'Please fill in all fields';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.updateProfile(this.name, this.email).subscribe({
      next: () => {
        this.isLoading = false;
        this.isEditing = false;
        this.successMessage = 'Profile updated successfully!';
        setTimeout(() => (this.successMessage = ''), 3000);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.errorMessage = err.message || 'Failed to update profile';
      },
    });
  }

  savePassword(): void {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.passwordError = 'Please complete all password fields';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'New password and confirmation do not match';
      return;
    }
    if (this.newPassword.length < 8) {
      this.passwordError = 'Password must be at least 8 characters long';
      return;
    }

    this.updatingPassword = true;
    this.passwordError = '';
    this.passwordSuccess = '';

    this.authService.updatePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.updatingPassword = false;
        this.passwordSuccess = 'Password updated successfully!';
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        setTimeout(() => (this.passwordSuccess = ''), 4000);
      },
      error: (err: any) => {
        this.updatingPassword = false;
        this.passwordError = err.message || 'Failed to update password';
      },
    });
  }

  openAccountSettings(): void {
    this.router.navigate(['/forgot-password']);
  }

  refreshProfile(): void {
    this.authService.refreshProfile();
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  closeSidebar(): void { this.sidebarOpen = false; }
  toggleSidebarCollapse(): void { this.sidebarService.toggleCollapsed(); }

  ngOnDestroy(): void {
    this.sidebarSub.unsubscribe();
  }
}
