import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService } from '../../services/subscription.service';
import { ThemeService } from '../../services/theme.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

interface UserDetail {
  id: string;
  name: string;
  email: string;
  subscription: string;
  status: string; // will hold either 'active', subscription status or 'rejected'
  createdAt: string;
  calculationCount: number;
  rejectionFeedback?: string;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
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

  subscriptionOptions = ['all', 'free', 'basic', 'pro'];

  constructor(
    private router: Router,
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    // ensure theme classes are applied
    this.themeService.setTheme(this.themeService.getCurrentTheme());
    // Initialize theme
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    const currentUser = (this.authService as any).currentUserValue;
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      this.router.navigate(['/admin-login']);
      return;
    }

    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    
    // Get all users from localStorage
    const usersStr = localStorage.getItem('users');
    const allStoredUsers = usersStr ? JSON.parse(usersStr) : [];
    
    // Filter out admin/superadmin from the user list
    const regularUsers = allStoredUsers.filter((u: any) => u.role === 'user');

    // Count calculations per user
    const savedCalcsStr = localStorage.getItem('savedCalculations');
    const savedCalcs = savedCalcsStr ? JSON.parse(savedCalcsStr) : [];
    const calcCounts: { [key: string]: number } = {};
    
    savedCalcs.forEach((calc: any) => {
      const userId = calc.userId || 'unknown';
      calcCounts[userId] = (calcCounts[userId] || 0) + 1;
    });

    // Map users to detail interface
    this.users = regularUsers.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      subscription: user.subscriptionPlan || 'free',
      status: user.status === 'rejected' ? 'rejected' : this.getSubscriptionStatus(user.id),
      createdAt: new Date(user.createdAt).toLocaleDateString(),
      calculationCount: calcCounts[user.id] || 0,
      rejectionFeedback: user.rejectionFeedback
    }));

    this.applyFilters();
    this.isLoading = false;
  }

  getSubscriptionStatus(userId: string): string {
    const subStr = localStorage.getItem(`subscription_${userId}`);
    if (!subStr) return 'inactive';
    
    const sub = JSON.parse(subStr);
    return sub.status || 'inactive';
  }

  rejectUser(user: UserDetail): void {
    const feedback = prompt('Provide rejection feedback for user ' + user.name + ':');
    if (feedback === null) {
      return; // user cancelled
    }
    const stored = JSON.parse(localStorage.getItem('users') || '[]');
    const idx = stored.findIndex((u: any) => u.id === user.id);
    if (idx !== -1) {
      stored[idx].status = 'rejected';
      stored[idx].rejectionFeedback = feedback;
      localStorage.setItem('users', JSON.stringify(stored));
      alert('User has been marked as rejected. They will see a notice on their next login.');
      this.loadUsers();
    }
  }

  reactivateUser(user: UserDetail): void {
    if (!confirm(`Are you sure you want to reactivate ${user.name}?`)) {
      return;
    }
    const stored = JSON.parse(localStorage.getItem('users') || '[]');
    const idx = stored.findIndex((u: any) => u.id === user.id);
    if (idx !== -1) {
      stored[idx].status = 'active';
      delete stored[idx].rejectionFeedback;
      localStorage.setItem('users', JSON.stringify(stored));
      this.loadUsers();
    }
  }

  applyFilters(): void {
    let filtered = [...this.users];

    // Filter by subscription plan
    if (this.subscriptionFilter !== 'all') {
      filtered = filtered.filter(u => u.subscription === this.subscriptionFilter);
    }

    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.id.includes(term)
      );
    }

    this.filteredUsers = filtered;
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  getUserSubscriptionName(plan: string): string {
    const plans = this.subscriptionService.getPlans();
    const found = plans.find(p => p.id === plan);
    return found ? found.name : plan.charAt(0).toUpperCase() + plan.slice(1);
  }

  goBack(): void {
    this.router.navigate(['/admin-dashboard']);
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  onSidebarClose(): void {
    this.sidebarOpen = false;
  }

  onCollapseSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
