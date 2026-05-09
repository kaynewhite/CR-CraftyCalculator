import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PaymentService } from '../../services/payment.service';
import { LogService } from '../../services/log.service';
import { CalculationService } from '../../services/calculation.service';
import { SubscriptionService } from '../../services/subscription.service';
import { ThemeService } from '../../services/theme.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface TopUser {
  id: string;
  name: string;
  email: string;
  calculationCount: number;
  subscription: string;
}

interface MonthlyRevenue {
  total: number;
  approvedCount: number;
}

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
  topUsers: TopUser[] = [];
  monthlyRevenue: MonthlyRevenue = { total: 0, approvedCount: 0 };
  pendingPayments: any[] = [];
  allPayments: any[] = [];
  totalUsers: number = 0;
  totalCalculations: number = 0;
  planCounts: { free: number; basic: number; pro: number } = { free: 0, basic: 0, pro: 0 };
  isLoading = true;
  isSuperAdmin = false;
  sidebarOpen = false;
  sidebarCollapsed = false;
  isDarkMode = false;
  today = new Date();

  private revenueChart: Chart | null = null;
  private planChart: Chart | null = null;
  private chartsInitialized = false;

  constructor(
    public router: Router,
    private authService: AuthService,
    private paymentService: PaymentService,
    private logService: LogService,
    private calculationService: CalculationService,
    private subscriptionService: SubscriptionService,
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

    this.currentUser = this.authService.currentUserValue;
    this.isSuperAdmin = this.currentUser?.role === 'superadmin';

    if (!this.currentUser || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'superadmin')) {
      this.router.navigate(['/bigboss-login']);
      return;
    }

    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    if (!this.isLoading) {
      setTimeout(() => this.initCharts(), 200);
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  destroyCharts(): void {
    if (this.revenueChart) { this.revenueChart.destroy(); this.revenueChart = null; }
    if (this.planChart) { this.planChart.destroy(); this.planChart = null; }
  }

  loadDashboardData(): void {
    this.isLoading = true;
    this.paymentService.getAll().subscribe({
      next: (payments) => {
        this.allPayments = payments;
        this.pendingPayments = payments.filter(p => p.status === 'pending');
        this.calculateMonthlyRevenue();
        this.calculateTopUsers();
        this.calculatePlanDistribution();
        this.calculateTotalCalculations();
        this.isLoading = false;
        setTimeout(() => this.initCharts(), 300);
      }
    });
  }

  calculateMonthlyRevenue(): void {
    const now = new Date();
    const approvedThisMonth = this.allPayments.filter(p => {
      const d = new Date(p.createdAt);
      return p.status === 'approved' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    this.monthlyRevenue.approvedCount = approvedThisMonth.length;
    this.monthlyRevenue.total = approvedThisMonth.reduce((sum, p) => {
      const plan = this.subscriptionService.getPlans().find(pl => pl.id === p.plan);
      return sum + (plan?.price || 0);
    }, 0);
  }

  calculateTopUsers(): void {
    const usersStr = localStorage.getItem('users');
    const allUsers = usersStr ? JSON.parse(usersStr) : [];
    const regularUsers = allUsers.filter((u: any) => u.role === 'user');
    this.totalUsers = regularUsers.length;

    const savedCalcs = localStorage.getItem('savedCalculations');
    const userCalculations: { [k: string]: number } = {};
    if (savedCalcs) {
      try {
        JSON.parse(savedCalcs).forEach((c: any) => {
          const uid = c.userId || 'unknown';
          userCalculations[uid] = (userCalculations[uid] || 0) + 1;
        });
      } catch {}
    }

    this.topUsers = regularUsers
      .map((u: any) => {
        const subStr = localStorage.getItem(`subscription_${u.id}`);
        const subscription = subStr ? JSON.parse(subStr).plan : u.subscriptionPlan || 'free';
        return { id: u.id, name: u.name, email: u.email, calculationCount: userCalculations[u.id] || 0, subscription };
      })
      .sort((a: TopUser, b: TopUser) => b.calculationCount - a.calculationCount)
      .slice(0, 5);
  }

  calculatePlanDistribution(): void {
    const usersStr = localStorage.getItem('users');
    const allUsers = usersStr ? JSON.parse(usersStr) : [];
    this.planCounts = { free: 0, basic: 0, pro: 0 };
    allUsers.filter((u: any) => u.role === 'user').forEach((u: any) => {
      const plan = u.subscriptionPlan || 'free';
      if (plan in this.planCounts) {
        this.planCounts[plan as keyof typeof this.planCounts]++;
      } else {
        this.planCounts.free++;
      }
    });
  }

  calculateTotalCalculations(): void {
    const savedCalcs = localStorage.getItem('savedCalculations');
    this.totalCalculations = savedCalcs ? JSON.parse(savedCalcs).length : 0;
  }

  initCharts(): void {
    this.destroyCharts();
    this.chartsInitialized = true;
    this.initRevenueChart();
    this.initPlanChart();
  }

  initRevenueChart(): void {
    if (!this.revenueChartRef?.nativeElement) return;

    const months: string[] = [];
    const revenues: number[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthName = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      months.push(`${monthName} ${year}`);

      const monthRevenue = this.allPayments
        .filter(p => {
          const pd = new Date(p.createdAt);
          return p.status === 'approved' && pd.getMonth() === d.getMonth() && pd.getFullYear() === year;
        })
        .reduce((sum, p) => {
          const plan = this.subscriptionService.getPlans().find(pl => pl.id === p.plan);
          return sum + (plan?.price || 0);
        }, 0);

      revenues.push(monthRevenue);
    }

    const isDark = this.isDarkMode;
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#94A3B8' : '#6B7280';
    const brandColor = isDark ? '#FF6B8A' : '#E74C6C';

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
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (ctx) => ` ₱${(ctx.parsed.y ?? 0).toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 12, family: 'Inter' } }
          },
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
          data: [
            this.planCounts.free || (total === 0 ? 1 : 0),
            this.planCounts.basic,
            this.planCounts.pro
          ],
          backgroundColor: ['#E74C6C', '#F39C12', '#27AE60'],
          hoverBackgroundColor: ['#C0392B', '#D68910', '#1E8449'],
          borderWidth: 0,
          borderRadius: 4,
          spacing: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#1A1D27' : '#FFFFFF',
            titleColor: isDark ? '#F1F5F9' : '#1A1D2E',
            bodyColor: isDark ? '#94A3B8' : '#4A5568',
            borderColor: isDark ? '#2D3250' : '#E8ECF0',
            borderWidth: 1,
            padding: 10
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

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/bigboss-login']);
  }
}
