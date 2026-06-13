import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  showPassword = false;
  isLoading = false;
  error = '';
  sessionWarning = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.setTheme(this.themeService.getCurrentTheme());
    this.route.queryParams.subscribe(params => {
      if (params['reason'] === 'session_invalidated') {
        this.sessionWarning = 'Your account was signed in on another device. You have been logged out.';
      }
    });
    if (this.authService.isAuthenticated()) {
      this.redirectByRole();
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.email.trim() || !this.password) {
      this.error = 'Please enter your email and password.';
      return;
    }
    this.isLoading = true;
    this.error = '';
    try {
      await this.authService.signIn(this.email.trim(), this.password);
      this.redirectByRole();
    } catch (err: any) {
      this.error = err?.message || 'Invalid email or password.';
      this.isLoading = false;
    }
  }

  private redirectByRole(): void {
    const user = this.authService.currentUserValue;
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      this.router.navigate(['/admin-dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }
}
