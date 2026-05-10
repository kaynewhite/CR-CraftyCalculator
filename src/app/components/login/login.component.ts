import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
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

  constructor(
    private authService: AuthService,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.setTheme(this.themeService.getCurrentTheme());
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
      await this.waitForUser();
      this.redirectByRole();
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Invalid email or password.';
      this.error = msg;
      this.isLoading = false;
    }
  }

  private waitForUser(): Promise<void> {
    return new Promise(resolve => {
      const sub = this.authService.currentUser.subscribe(user => {
        if (user) {
          sub.unsubscribe();
          resolve();
        }
      });
      setTimeout(() => { sub.unsubscribe(); resolve(); }, 6000);
    });
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
