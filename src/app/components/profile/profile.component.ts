import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  name = '';
  email = '';
  successMessage = '';
  errorMessage = '';
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

  openAccountSettings(): void {
    this.router.navigate(['/forgot-password']);
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  closeSidebar(): void { this.sidebarOpen = false; }
  toggleSidebarCollapse(): void { this.sidebarService.toggleCollapsed(); }

  ngOnDestroy(): void {
    this.sidebarSub.unsubscribe();
  }
}
