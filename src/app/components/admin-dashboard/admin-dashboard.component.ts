import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { ThemeService } from '../../services/theme.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, SidebarComponent, TitleCasePipe, DatePipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('revenueChart') revenueChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('planChart') planChartRef!: ElementRef<HTMLCanvasElement>;

  currentUser: any;
  topUsers: any[] = [];
  monthlyRevenue = { total: 0, approvedCount: 0 };
  pendingPayments: any[] = [];
  totalUsers = 0;
  totalCalculations = 0;
  planCounts = { free: 0, basic: 0, pro: 0 };
  revenueChartData: { month: string; revenue: number }[] = [];
  isLoading = true;
  isSuperAdmin = false;
  sidebarOpen = false;
  sidebarCollapsed = false;
  isDarkMode = false;
  today = new Date();

  // QR Setup
  showQrSetup = false;
  setupGcashQr: string | null = null;
  setupMayaQr: string | null = null;
  setupSaving = false;
  setupError = '';

  private revenueChart: Chart | null = null;
  private planChart: Chart | null = null;
  private chartsInitialized = false;

  constructor(
    public router: Router,
    private authService: AuthService,
    private api: ApiService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.setTheme(this.themeService.getCurrentTheme());
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
      if (this.chartsInitialized) {
        this.destroyCharts();
        setTimeout(() => this.initCharts(), 100);
      }
    });

    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
      if (!user) return;
      this.isSuperAdmin = user.role === 'superadmin';
      if (user.role !== 'admin' && user.role !== 'superadmin') {
        this.router.navigate(['/login']);
        return;
      }
      this.loadDashboardData();
      this.checkQrSetup();
    });
  }

  ngAfterViewInit(): void {
    if (!this.isLoading) setTimeout(() => this.initCharts(), 200);
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  checkQrSetup(): void {
    this.api.getQrCodes().subscribe({
      next: (data: any) => {
        const gcash = data.gcash || null;
        const maya = data.maya || null;
        this.setupGcashQr = gcash;
        this.setupMayaQr = maya;
        if (!gcash || !maya) {
          this.showQrSetup = true;
        }
      },
      error: () => {
        this.showQrSetup = true;
      }
    });
  }

  onSetupQrFile(event: any, method: 'gcash' | 'maya'): void {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      if (method === 'gcash') this.setupGcashQr = e.target.result;
      else this.setupMayaQr = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  removeSetupQr(method: 'gcash' | 'maya'): void {
    if (method === 'gcash') this.setupGcashQr = null;
    else this.setupMayaQr = null;
  }

  saveSetupQrs(): void {
    if (!this.setupGcashQr || !this.setupMayaQr) {
      this.setupError = 'Please upload both GCash and PayMaya QR codes to continue.';
      return;
    }
    this.setupSaving = true;
    this.setupError = '';
    Promise.all([
      this.api.setQrCode('gcash', this.setupGcashQr).toPromise(),
      this.api.setQrCode('maya', this.setupMayaQr).toPromise(),
    ]).then(() => {
      this.setupSaving = false;
      this.showQrSetup = false;
    }).catch(() => {
      this.setupSaving = false;
      this.setupError = 'Failed to save QR codes. Please try again.';
    });
  }

  destroyCharts(): void {
    if (this.revenueChart) { this.revenueChart.destroy(); this.revenueChart = null; }
    if (this.planChart) { this.planChart.destroy(); this.planChart = null; }
    this.chartsInitialized = false;
  }

  loadDashboardData(): void {
    this.isLoading = true;
    Promise.all([
      this.api.getAdminStats().toPromise(),
      this.api.getRevenueChart().toPromise(),
    ]).then(([stats, revenue]: any) => {
      if (stats) {
        this.totalUsers = stats.users?.total || 0;
        this.planCounts = stats.subscriptions || { free: 0, basic: 0, pro: 0 };
        this.pendingPayments = Array(stats.payments?.pending || 0).fill({});
        this.monthlyRevenue.total = stats.revenue?.total || 0;
        this.monthlyRevenue.approvedCount = stats.payments?.total || 0;
        this.topUsers = (stats.recent_users || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          calculationCount: 0,
          subscription: u.plan || 'free',
        }));
        this.totalCalculations = 0;
      }
      if (revenue) {
        this.revenueChartData = revenue.map((r: any) => ({
          month: r.month,
          revenue: parseFloat(r.revenue),
        }));
      }
      this.isLoading = false;
      setTimeout(() => this.initCharts(), 300);
    }).catch(err => {
      console.error('[Admin] Load error:', err);
      this.isLoading = false;
    });
  }

  initCharts(): void {
    this.destroyCharts();
    this.chartsInitialized = true;
    this.initRevenueChart();
    this.initPlanChart();
  }

  initRevenueChart(): void {
    if (!this.revenueChartRef?.nativeElement) return;
    const isDark = this.isDarkMode;
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#94A3B8' : '#6B7280';
    const brandColor = isDark ? '#FF6B8A' : '#E74C6C';

    const months: string[] = [];
    const revenues: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString('default', { month: 'short' }) + ' ' + d.getFullYear();
      months.push(label);
      const found = this.revenueChartData.find(r => r.month === label);
      revenues.push(found ? found.revenue : 0);
    }

    this.revenueChart = new Chart(this.revenueChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'Revenue (₱)',
          data: revenues,
          borderColor: brandColor,
          backgroundColor: isDark ? 'rgba(255,107,138,0.1)' : 'rgba(231,76,108,0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: brandColor,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#1A1D27' : '#FFFFFF',
            titleColor: isDark ? '#F1F5F9' : '#1A1D2E',
            bodyColor: isDark ? '#94A3B8' : '#4A5568',
            borderColor: isDark ? '#2D3250' : '#E8ECF0',
            borderWidth: 1, padding: 12,
            callbacks: { label: (ctx) => ` ₱${(ctx.parsed.y ?? 0).toLocaleString()}` }
          }
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 12, family: 'Inter' } } },
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 12, family: 'Inter' }, callback: (v) => `₱${v}` },
            beginAtZero: true
          }
        }
      }
    });
  }

  initPlanChart(): void {
    if (!this.planChartRef?.nativeElement) return;
    const isDark = this.isDarkMode;
    const total = this.planCounts.free + this.planCounts.basic + this.planCounts.pro;
    this.planChart = new Chart(this.planChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Free', 'Basic', 'Pro'],
        datasets: [{
          data: [this.planCounts.free || (total === 0 ? 1 : 0), this.planCounts.basic, this.planCounts.pro],
          backgroundColor: ['#E74C6C', '#F39C12', '#27AE60'],
          hoverBackgroundColor: ['#C0392B', '#D68910', '#1E8449'],
          borderWidth: 0, borderRadius: 4, spacing: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#1A1D27' : '#FFFFFF',
            titleColor: isDark ? '#F1F5F9' : '#1A1D2E',
            bodyColor: isDark ? '#94A3B8' : '#4A5568',
            borderColor: isDark ? '#2D3250' : '#E8ECF0',
            borderWidth: 1, padding: 10
          }
        }
      }
    });
  }

  viewPaymentApprovals(): void { this.router.navigate(['/admin-payments']); }
  viewUserManagement(): void { this.router.navigate(['/admin-users']); }
  viewSystemLogs(): void { this.router.navigate(['/admin-logs']); }
  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  onSidebarClose(): void { this.sidebarOpen = false; }
  onCollapseSidebar(): void { this.sidebarCollapsed = !this.sidebarCollapsed; }
  logout(): void { this.authService.logout(); this.router.navigate(['/login']); }
}
