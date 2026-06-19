import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { ReportService, Report } from '../../services/report.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, DatePipe],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent implements OnInit {
  activeTab: 'submit' | 'mine' = 'submit';
  sidebarOpen = false;
  sidebarCollapsed = false;
  isDarkMode = false;
  isLoading = false;
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  myReports: Report[] = [];

  form = { type: 'bug', subject: '', description: '' };

  reportTypes = [
    { value: 'bug',      label: 'Bug',       icon: 'bi-bug-fill',         color: 'type-bug' },
    { value: 'problem',  label: 'Problem',   icon: 'bi-exclamation-circle-fill', color: 'type-problem' },
    { value: 'feedback', label: 'Feedback',  icon: 'bi-chat-dots-fill',   color: 'type-feedback' },
    { value: 'other',    label: 'Other',     icon: 'bi-three-dots',       color: 'type-other' },
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
    this.loadMyReports();
  }

  switchTab(tab: 'submit' | 'mine'): void {
    this.activeTab = tab;
    this.clearMessages();
    if (tab === 'mine') this.loadMyReports();
  }

  loadMyReports(): void {
    this.isLoading = true;
    this.reportService.getMyReports().subscribe({
      next: r => { this.myReports = r; this.isLoading = false; },
      error: () => { this.isLoading = false; }
    });
  }

  submit(): void {
    this.clearMessages();
    if (!this.form.subject.trim() || !this.form.description.trim()) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }
    this.isSubmitting = true;
    this.reportService.submitReport(this.form.type, this.form.subject, this.form.description).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = 'Your report has been submitted. An admin will review it shortly.';
        this.form = { type: 'bug', subject: '', description: '' };
        this.loadMyReports();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.error || 'Failed to submit report. Please try again.';
      }
    });
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

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

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  onSidebarClose(): void { this.sidebarOpen = false; }
  onCollapseSidebar(): void { this.sidebarCollapsed = !this.sidebarCollapsed; }
}
