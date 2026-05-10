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
              ? new Date(u.created_at).toLocaleDateString()
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

  rejectUser(user: UserDetail): void {
    const feedback = prompt(`Provide rejection feedback for ${user.name}:`);
    if (feedback === null) return;
    this.api.setUserStatus(user.id, 'rejected', feedback || 'No reason provided').subscribe({
      next: () => {
        alert('User has been rejected.');
        this.loadUsers();
      },
      error: (err: any) => alert('Failed to reject user: ' + err.message),
    });
  }

  reactivateUser(user: UserDetail): void {
    if (!confirm(`Reactivate ${user.name}?`)) return;
    this.api.setUserStatus(user.id, 'active').subscribe({
      next: () => this.loadUsers(),
      error: (err: any) => alert('Failed to reactivate: ' + err.message),
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
          u.id.includes(term)
      );
    }
    this.filteredUsers = filtered;
  }

  onSearchChange(): void { this.applyFilters(); }
  onFilterChange(): void { this.applyFilters(); }

  getUserSubscriptionName(plan: string): string {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  onSidebarClose(): void { this.sidebarOpen = false; }
  onCollapseSidebar(): void { this.sidebarCollapsed = !this.sidebarCollapsed; }
}
