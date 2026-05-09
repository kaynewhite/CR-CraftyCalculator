import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  name: string = '';
  email: string = '';
  successMessage: string = '';
  errorMessage: string = '';
  isEditing: boolean = false;
  isLoading: boolean = false;
  sidebarOpen: boolean = false;
  sidebarCollapsed: boolean = false;
  private sidebarSubscription: Subscription;

  constructor(
    private authService: AuthService,
    private sidebarService: SidebarService
  ) {
    this.sidebarSubscription = new Subscription();
  }

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.name = user.name;
        this.email = user.email;
      }
    });
    
    // Subscribe to sidebar collapsed state
    this.sidebarSubscription = this.sidebarService.isCollapsed$.subscribe(collapsed => {
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
      next: (user) => {
        this.isLoading = false;
        this.isEditing = false;
        this.successMessage = 'Profile updated successfully!';
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Failed to update profile';
      }
    });
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  toggleSidebarCollapse(): void {
    this.sidebarService.toggleCollapsed();
  }

  openAccountSettings(): void {
    const clerk = (window as any).Clerk;
    if (clerk?.openUserProfile) {
      clerk.openUserProfile();
    } else {
      alert('Account settings are loading. Please try again in a moment.');
    }
  }

  ngOnDestroy(): void {
    this.sidebarSubscription.unsubscribe();
  }}