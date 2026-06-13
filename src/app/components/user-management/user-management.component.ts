import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { ThemeService } from '../../services/theme.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

interface UserDetail {
  id: string;
  name: string;
  email: string;
  subscription: string;
  status: string;
  createdAt: string;
  calculationCount: number;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css'],
})
export class UserManagementComponent implements OnInit {
  users: UserDetail[] = [];
  filteredUsers: UserDetail[] = [];
  searchTerm = '';
  subscriptionFilter = 'all';
  isLoading = true;
  sidebarOpen = false;
  sidebarCollapsed = false;
  isDarkMode = false;
  isSuperAdmin = false;

  showDeleteModal = false;
  userToDelete: UserDetail | null = null;
  isDeleting = false;
  deleteError = '';

  showRestrictModal = false;
  userToRestrict: UserDetail | null = null;
  restrictFeedback = '';
  isRestricting = false;

  showViewModal = false;
  userToView: UserDetail | null = null;
  userLogs: any[] = [];
  userSubscriptionLogs: any[] = [];
  isLoadingUserDetails = false;

  actionError = '';
  actionSuccess = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private api: ApiService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.setTheme(this.themeService.getCurrentTheme());
    this.themeService.isDarkMode$.subscribe(isDark => (this.isDarkMode = isDark));

    const currentUser = this.authService.currentUserValue;
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      this.router.navigate(['/login']);
      return;
    }
    this.isSuperAdmin = currentUser.role === 'superadmin';
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.api.getAllUsers().subscribe({
      next: (users: any[]) => {
        this.users = users
          .filter((u: any) => u.role === 'user')
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            subscription: u.plan || 'free',
            status: u.status || 'active',
            createdAt: u.created_at
              ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—',
            calculationCount: 0,
          }));
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('[UserMgmt] Load error:', err);
        this.isLoading = false;
      },
    });
  }

  openRestrictModal(user: UserDetail): void {
    this.userToRestrict = user;
    this.restrictFeedback = '';
    this.showRestrictModal = true;
  }

  closeRestrictModal(): void {
    this.showRestrictModal = false;
    this.userToRestrict = null;
    this.restrictFeedback = '';
    this.isRestricting = false;
  }

  confirmRestrict(): void {
    if (!this.userToRestrict) return;
    this.isRestricting = true;
    this.api.setUserStatus(this.userToRestrict.id, 'rejected', this.restrictFeedback || 'Account restricted').subscribe({
      next: () => {
        this.showFlash('success', `${this.userToRestrict!.name} account has been restricted.`);
        this.closeRestrictModal();
        this.loadUsers();
      },
      error: (err: any) => {
        this.isRestricting = false;
        this.showFlash('error', 'Failed to restrict user: ' + err.message);
      },
    });
  }

  openViewModal(user: UserDetail): void {
    this.userToView = user;
    this.userLogs = [];
    this.userSubscriptionLogs = [];
    this.isLoadingUserDetails = true;
    this.showViewModal = true;
    
    // Load subscription logs for this user
    this.api.getSubscriptionLogs().subscribe({
      next: (logs: any[]) => {
        this.userSubscriptionLogs = logs.filter(log => log.user_id === user.id).slice(0, 10);
        this.isLoadingUserDetails = false;
      },
      error: () => {
        this.isLoadingUserDetails = false;
      }
    });
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.userToView = null;
    this.userLogs = [];
    this.userSubscriptionLogs = [];
  }

  reactivateUser(user: UserDetail): void {
    this.api.setUserStatus(user.id, 'active').subscribe({
      next: () => {
        this.showFlash('success', `${user.name} has been reactivated.`);
        this.loadUsers();
      },
      error: (err: any) => this.showFlash('error', 'Failed to reactivate: ' + err.message),
    });
  }

  openDeleteModal(user: UserDetail): void {
    this.userToDelete = user;
    this.deleteError = '';
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.userToDelete = null;
    this.deleteError = '';
    this.isDeleting = false;
  }

  confirmDelete(): void {
    if (!this.userToDelete) return;
    this.isDeleting = true;
    this.deleteError = '';
    this.api.deleteUser(this.userToDelete.id).subscribe({
      next: () => {
        this.showFlash('success', `${this.userToDelete!.name} has been permanently deleted.`);
        this.closeDeleteModal();
        this.loadUsers();
      },
      error: (err: any) => {
        this.isDeleting = false;
        this.deleteError = err.message || 'Failed to delete user.';
      },
    });
  }

  applyFilters(): void {
    let filtered = [...this.users];
    if (this.subscriptionFilter !== 'all') {
      filtered = filtered.filter(u => u.subscription === this.subscriptionFilter);
    }
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        u =>
          u.name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.id.toLowerCase().includes(term)
      );
    }
    this.filteredUsers = filtered;
  }

  showFlash(type: 'success' | 'error', msg: string): void {
    if (type === 'success') { this.actionSuccess = msg; this.actionError = ''; }
    else { this.actionError = msg; this.actionSuccess = ''; }
    setTimeout(() => { this.actionSuccess = ''; this.actionError = ''; }, 4000);
  }

  onSearchChange(): void { this.applyFilters(); }
  onFilterChange(): void { this.applyFilters(); }
  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  onSidebarClose(): void { this.sidebarOpen = false; }
  onCollapseSidebar(): void { this.sidebarCollapsed = !this.sidebarCollapsed; }
}
