import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { NotificationService } from '../../services/notification.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  @Input() isOpen: boolean = false;
  @Input() isCollapsed: boolean = false;
  @Output() closeSidebar = new EventEmitter<void>();
  @Output() toggleCollapse = new EventEmitter<void>();

  currentUser: User | null = null;
  isDarkMode: boolean = false;
  showNotifPanel: boolean = false;

  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin' || this.currentUser?.role === 'superadmin';
  }

  get isSuperAdmin(): boolean {
    return this.currentUser?.role === 'superadmin';
  }

  get unreadCount(): number {
    return this.notificationService.unreadCount;
  }

  generateLink(base: string): string {
    if (this.isAdmin) {
      if (base === 'dashboard') {
        return '/admin-dashboard';
      }
      return `/admin-${base}`;
    }
    return `/${base}`;
  }

  constructor(
    private authService: AuthService,
    private themeService: ThemeService,
    private router: Router,
    public notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
    });

    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
    this.closeSidebar.emit();
  }

  onNavigate(): void {
    this.closeSidebar.emit();
  }

  toggleCollapseSidebar(): void {
    this.toggleCollapse.emit();
  }

  toggleNotifPanel(): void {
    this.showNotifPanel = !this.showNotifPanel;
  }

  markAllRead(): void {
    this.notificationService.markAllRead();
  }

  onOverlayClick(): void {
    this.closeSidebar.emit();
  }
}
