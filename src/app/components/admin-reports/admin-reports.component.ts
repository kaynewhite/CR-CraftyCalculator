import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { ReportService, Report } from '../../services/report.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, DatePipe],
  templateUrl: './admin-reports.component.html',
  styleUrls: ['./admin-reports.component.css']
})
export class AdminReportsComponent implements OnInit {
  activeTab: 'user-reports' | 'admin-reports' | 'submit' = 'user-reports';
  sidebarOpen = false;
  sidebarCollapsed = false;
  isDarkMode = false;
  isLoading = false;
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  currentUser: any;
  get isSuperAdmin(): boolean { return this.currentUser?.role === 'superadmin'; }

  userReports: Report[] = [];
  filteredUserReports: Report[] = [];
  adminReports: Report[] = [];
  filteredAdminReports: Report[] = [];

  searchTerm = '';
  statusFilter = 'all';
  typeFilter = 'all';

  expandedId: string | null = null;
  replyText: Record<string, string> = {};
  replyingId: string | null = null;

  submitForm = { type: 'bug', subject: '', description: '' };

  reportTypes = [
    { value: 'bug',      label: 'Bug',      icon: 'bi-bug-fill',                color: 'type-bug' },
    { value: 'problem',  label: 'Problem',  icon: 'bi-exclamation-circle-fill', color: 'type-problem' },
    { value: 'feedback', label: 'Feedback', icon: 'bi-chat-dots-fill',          color: 'type-feedback' },
    { value: 'other',    label: 'Other',    icon: 'bi-three-dots',              color: 'type-other' },
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private themeService: ThemeService,
    private reportService: ReportService
  ) {}

  ngOnInit(): void {
    this.themeService.setTheme(this.themeService.getCurrentTheme());
    this.themeService.isDarkMode$.subscribe(d => (this.isDarkMode = d));
    this.currentUser = this.authService.currentUserValue;
    if (!this.currentUser || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'superadmin')) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadAll();
  }

  loadAll(): void {
    this.isLoading = true;
    this.reportService.getUserReports().subscribe({
      next: r => { this.userReports = r; this.applyUserFilters(); this.isLoading = false; },
      error: () => { this.isLoading = false; }
    });

    if (this.isSuperAdmin) {
      this.reportService.getAdminReports().subscribe({
        next: r => { this.adminReports = r; this.applyAdminFilters(); },
        error: () => {}
      });
    }
  }

  switchTab(tab: 'user-reports' | 'admin-reports' | 'submit'): void {
    this.activeTab = tab;
    this.clearMessages();
    this.expandedId = null;
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.typeFilter = 'all';
    this.applyUserFilters();
    this.applyAdminFilters();
  }

  applyUserFilters(): void {
    let list = [...this.userReports];
    if (this.statusFilter !== 'all') list = list.filter(r => r.status === this.statusFilter);
    if (this.typeFilter !== 'all')   list = list.filter(r => r.type === this.typeFilter);
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      list = list.filter(r =>
        r.subject.toLowerCase().includes(q) ||
        (r.reporter_name || '').toLowerCase().includes(q) ||
        (r.reporter_email || '').toLowerCase().includes(q)
      );
    }
    this.filteredUserReports = list;
  }

  applyAdminFilters(): void {
    let list = [...this.adminReports];
    if (this.statusFilter !== 'all') list = list.filter(r => r.status === this.statusFilter);
    if (this.typeFilter !== 'all')   list = list.filter(r => r.type === this.typeFilter);
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      list = list.filter(r =>
        r.subject.toLowerCase().includes(q) ||
        (r.reporter_name || '').toLowerCase().includes(q) ||
        (r.reporter_email || '').toLowerCase().includes(q)
      );
    }
    this.filteredAdminReports = list;
  }

  onFilterChange(): void {
    this.applyUserFilters();
    this.applyAdminFilters();
  }

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  markSeen(report: Report): void {
    if (report.status !== 'open') return;
    this.reportService.markSeen(report.id).subscribe({
      next: updated => this.patchUserReport(updated),
      error: () => {}
    });
  }

  sendReply(report: Report): void {
    const text = (this.replyText[report.id] || '').trim();
    if (!text) return;
    this.replyingId = report.id;
    this.reportService.reply(report.id, text).subscribe({
      next: updated => {
        this.replyingId = null;
        this.replyText[report.id] = '';
        if (this.activeTab === 'user-reports') this.patchUserReport(updated);
        else this.patchAdminReport(updated);
      },
      error: () => { this.replyingId = null; }
    });
  }

  forwardReport(report: Report): void {
    if (!confirm(`Forward this report to the Superadmin? The user will not be notified.`)) return;
    this.reportService.forward(report.id).subscribe({
      next: updated => this.patchUserReport(updated),
      error: (err: any) => { this.errorMessage = err?.error?.error || 'Failed to forward.'; }
    });
  }

  resolveReport(report: Report): void {
    if (!confirm('Mark this report as resolved?')) return;
    this.reportService.resolve(report.id).subscribe({
      next: updated => {
        if (this.activeTab === 'user-reports') this.patchUserReport(updated);
        else this.patchAdminReport(updated);
      },
      error: () => {}
    });
  }

  deleteReport(report: Report): void {
    if (!confirm('Permanently delete this report?')) return;
    this.reportService.deleteReport(report.id).subscribe({
      next: () => {
        this.adminReports = this.adminReports.filter(r => r.id !== report.id);
        this.userReports  = this.userReports.filter(r => r.id !== report.id);
        this.applyUserFilters();
        this.applyAdminFilters();
      },
      error: () => {}
    });
  }

  submitReport(): void {
    this.clearMessages();
    if (!this.submitForm.subject.trim() || !this.submitForm.description.trim()) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }
    this.isSubmitting = true;
    this.reportService.submitReport(this.submitForm.type, this.submitForm.subject, this.submitForm.description).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = 'Your report has been submitted to the Superadmin.';
        this.submitForm = { type: 'bug', subject: '', description: '' };
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.error || 'Failed to submit report.';
      }
    });
  }

  private patchUserReport(updated: Report): void {
    const idx = this.userReports.findIndex(r => r.id === updated.id);
    if (idx !== -1) this.userReports[idx] = updated;
    this.applyUserFilters();
  }

  private patchAdminReport(updated: Report): void {
    const idx = this.adminReports.findIndex(r => r.id === updated.id);
    if (idx !== -1) this.adminReports[idx] = updated;
    this.applyAdminFilters();
  }

  clearMessages(): void { this.successMessage = ''; this.errorMessage = ''; }

  getTypeInfo(type: string) {
    return this.reportTypes.find(t => t.value === type) || this.reportTypes[3];
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      open: 'status-open', seen: 'status-seen',
      resolved: 'status-resolved', closed: 'status-closed'
    };
    return map[status] || '';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      open: 'Open', seen: 'Seen', resolved: 'Resolved', closed: 'Closed'
    };
    return map[status] || status;
  }

  get openUserCount(): number { return this.userReports.filter(r => r.status === 'open').length; }
  get openAdminCount(): number { return this.adminReports.filter(r => r.status === 'open').length; }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  onSidebarClose(): void { this.sidebarOpen = false; }
  onCollapseSidebar(): void { this.sidebarCollapsed = !this.sidebarCollapsed; }
}
