import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, UpperCasePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LogService } from '../../services/log.service';
import { ThemeService } from '../../services/theme.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { SubscriptionLog, SystemLog, ActivityLog } from '../../models/subscription-log.model';

@Component({
  selector: 'app-system-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, DatePipe, UpperCasePipe, TitleCasePipe],
  templateUrl: './system-logs.component.html',
  styleUrls: ['./system-logs.component.css']
})
export class SystemLogsComponent implements OnInit {
  subscriptionLogs: SubscriptionLog[] = [];
  systemLogs: SystemLog[] = [];
  activityLogs: ActivityLog[] = [];
  filteredSubLogs: SubscriptionLog[] = [];
  filteredSysLogs: SystemLog[] = [];
  filteredActivityLogs: ActivityLog[] = [];

  activeTab: 'subscription' | 'system' | 'activity' = 'activity';
  logTypeFilter = 'all';
  actionFilter = 'all';
  activityActionFilter = 'all';
  searchQuery = '';
  dateRangeStart = '';
  dateRangeEnd = '';
  isLoading = true;
  sidebarOpen = false;
  sidebarCollapsed = false;
  isDarkMode = false;

  logTypes = ['all', 'approval', 'rejection', 'error', 'system', 'maintenance'];
  actionTypes = ['all', 'approved', 'rejected', 'upgraded', 'downgraded', 'cancelled'];
  activityActions = ['all', 'login', 'logout', 'signup'];

  constructor(
    private router: Router,
    private authService: AuthService,
    private logService: LogService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.setTheme(this.themeService.getCurrentTheme());
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    const currentUser = (this.authService as any).currentUserValue;
    if (!currentUser || currentUser.role !== 'superadmin') {
      this.router.navigate(['/admin-login']);
      return;
    }

    this.loadLogs();
  }

  loadLogs(): void {
    this.isLoading = true;

    this.logService.getSubscriptionLogs().subscribe({
      next: subLogs => {
        this.subscriptionLogs = subLogs;
        this.filterLogs();
      },
      error: () => {}
    });

    this.logService.getSystemLogs().subscribe({
      next: sysLogs => {
        this.systemLogs = sysLogs;
        this.filterLogs();
      },
      error: () => {}
    });

    this.logService.getActivityLogs().subscribe({
      next: actLogs => {
        this.activityLogs = actLogs;
        this.filterLogs();
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  switchTab(tab: 'subscription' | 'system' | 'activity'): void {
    this.activeTab = tab;
    this.logTypeFilter = 'all';
    this.actionFilter = 'all';
    this.activityActionFilter = 'all';
    this.searchQuery = '';
    this.filterLogs();
  }

  filterLogs(): void {
    this.filteredSubLogs = this.filterSubscriptionLogs();
    this.filteredSysLogs = this.filterSystemLogs();
    this.filteredActivityLogs = this.filterActivityLogs();
  }

  filterSubscriptionLogs(): SubscriptionLog[] {
    let filtered = [...this.subscriptionLogs];
    if (this.actionFilter !== 'all') filtered = filtered.filter(log => log.action === this.actionFilter);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        (log.userName || '').toLowerCase().includes(q) ||
        (log.userEmail || '').toLowerCase().includes(q) ||
        log.userId.toLowerCase().includes(q) ||
        log.plan.toLowerCase().includes(q)
      );
    }
    if (this.dateRangeStart) {
      const s = new Date(this.dateRangeStart);
      filtered = filtered.filter(log => new Date(log.timestamp) >= s);
    }
    if (this.dateRangeEnd) {
      const e = new Date(this.dateRangeEnd);
      e.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => new Date(log.timestamp) <= e);
    }
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  filterSystemLogs(): SystemLog[] {
    let filtered = [...this.systemLogs];
    if (this.logTypeFilter !== 'all') filtered = filtered.filter(log => log.type === this.logTypeFilter);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(q) ||
        (log.userName || '').toLowerCase().includes(q) ||
        (log.userId || '').toLowerCase().includes(q)
      );
    }
    if (this.dateRangeStart) {
      const s = new Date(this.dateRangeStart);
      filtered = filtered.filter(log => new Date(log.timestamp) >= s);
    }
    if (this.dateRangeEnd) {
      const e = new Date(this.dateRangeEnd);
      e.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => new Date(log.timestamp) <= e);
    }
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  filterActivityLogs(): ActivityLog[] {
    let filtered = [...this.activityLogs];
    if (this.activityActionFilter !== 'all') filtered = filtered.filter(log => log.action === this.activityActionFilter);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.userEmail.toLowerCase().includes(q) ||
        (log.userName || '').toLowerCase().includes(q) ||
        (log.ipAddress || '').toLowerCase().includes(q)
      );
    }
    if (this.dateRangeStart) {
      const s = new Date(this.dateRangeStart);
      filtered = filtered.filter(log => new Date(log.timestamp) >= s);
    }
    if (this.dateRangeEnd) {
      const e = new Date(this.dateRangeEnd);
      e.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => new Date(log.timestamp) <= e);
    }
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  onFilterChange(): void { this.filterLogs(); }

  getLogTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'approval': 'bi-check-circle-fill',
      'rejection': 'bi-x-circle-fill',
      'error': 'bi-exclamation-triangle-fill',
      'system': 'bi-gear-fill',
      'maintenance': 'bi-wrench-adjustable'
    };
    return icons[type] || 'bi-dot';
  }

  getActivityIcon(action: string): string {
    const icons: { [key: string]: string } = {
      'login': 'bi-box-arrow-in-right',
      'logout': 'bi-box-arrow-right',
      'signup': 'bi-person-plus-fill'
    };
    return icons[action] || 'bi-dot';
  }

  getLogTypeBadgeClass(type: string): string {
    const classes: { [key: string]: string } = {
      'approval': 'badge-type-approval',
      'rejection': 'badge-type-rejection',
      'error': 'badge-type-error',
      'system': 'badge-type-system',
      'maintenance': 'badge-type-maintenance'
    };
    return classes[type] || '';
  }

  getActionBadgeClass(action: string): string {
    const classes: { [key: string]: string } = {
      'approved': 'action-approved',
      'rejected': 'action-rejected',
      'upgraded': 'action-upgraded',
      'downgraded': 'action-downgraded',
      'cancelled': 'action-cancelled'
    };
    return classes[action] || '';
  }

  getActivityBadgeClass(action: string): string {
    const classes: { [key: string]: string } = {
      'login': 'activity-login',
      'logout': 'activity-logout',
      'signup': 'activity-signup'
    };
    return classes[action] || '';
  }

  clearSystemLogs(): void {
    if (!confirm('Are you sure you want to clear ALL system logs? This cannot be undone.')) return;
    this.logService.clearSystemLogs().subscribe(() => this.loadLogs());
  }

  clearActivityLogs(): void {
    if (!confirm('Are you sure you want to clear ALL activity logs? This cannot be undone.')) return;
    this.logService.clearActivityLogs().subscribe(() => this.loadLogs());
  }

  exportLogs(): void {
    let data: any[];
    if (this.activeTab === 'subscription') data = this.filteredSubLogs;
    else if (this.activeTab === 'system') data = this.filteredSysLogs;
    else data = this.filteredActivityLogs;

    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.activeTab}-logs-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.logTypeFilter = 'all';
    this.actionFilter = 'all';
    this.activityActionFilter = 'all';
    this.dateRangeStart = '';
    this.dateRangeEnd = '';
    this.filterLogs();
  }

  get currentLogCount(): number {
    if (this.activeTab === 'subscription') return this.filteredSubLogs.length;
    if (this.activeTab === 'system') return this.filteredSysLogs.length;
    return this.filteredActivityLogs.length;
  }

  get totalLogCount(): number {
    if (this.activeTab === 'subscription') return this.subscriptionLogs.length;
    if (this.activeTab === 'system') return this.systemLogs.length;
    return this.activityLogs.length;
  }

  get logLabel(): string {
    if (this.activeTab === 'subscription') return 'subscription log';
    if (this.activeTab === 'system') return 'system log';
    return 'activity log';
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  onSidebarClose(): void { this.sidebarOpen = false; }
  onCollapseSidebar(): void { this.sidebarCollapsed = !this.sidebarCollapsed; }
}
