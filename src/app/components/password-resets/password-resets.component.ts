import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { ThemeService } from '../../services/theme.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

interface ResetRequest {
  id: string;
  email: string;
  user_name: string;
  token: string;
  expires_at: string;
  created_at: string;
  copied?: boolean;
}

@Component({
  selector: 'app-password-resets',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, SidebarComponent],
  templateUrl: './password-resets.component.html',
  styleUrls: ['./password-resets.component.css'],
})
export class PasswordResetsComponent implements OnInit {
  requests: ResetRequest[] = [];
  isLoading = true;
  error = '';
  successMessage = '';
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
    this.themeService.isDarkMode$.subscribe(d => (this.isDarkMode = d));

    const user = this.authService.currentUserValue;
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadRequests();
  }

  loadRequests(): void {
    this.isLoading = true;
    this.error = '';
    this.api.getResetRequests().subscribe({
      next: (rows: any[]) => {
        this.requests = rows.map(r => ({ ...r, copied: false }));
        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = err.message || 'Failed to load reset requests.';
        this.isLoading = false;
      },
    });
  }

  getResetLink(token: string): string {
    const base = window.location.origin;
    return `${base}/reset-password?token=${token}`;
  }

  copyLink(req: ResetRequest): void {
    const link = this.getResetLink(req.token);
    navigator.clipboard.writeText(link).then(() => {
      req.copied = true;
      setTimeout(() => (req.copied = false), 2500);
    });
  }

  dismiss(req: ResetRequest): void {
    if (!confirm(`Dismiss reset request for ${req.email}?`)) return;
    this.api.dismissResetRequest(req.id).subscribe({
      next: () => {
        this.successMessage = `Request for ${req.email} dismissed.`;
        setTimeout(() => (this.successMessage = ''), 3000);
        this.loadRequests();
      },
      error: (err: any) => (this.error = err.message || 'Failed to dismiss.'),
    });
  }

  isExpiringSoon(expiresAt: string): boolean {
    return new Date(expiresAt).getTime() - Date.now() < 3 * 60 * 60 * 1000;
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  onSidebarClose(): void { this.sidebarOpen = false; }
  onCollapseSidebar(): void { this.sidebarCollapsed = !this.sidebarCollapsed; }
}
