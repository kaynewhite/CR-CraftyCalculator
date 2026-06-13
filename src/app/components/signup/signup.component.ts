import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css'],
})
export class SignupComponent implements OnInit {
  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  showConfirm = false;
  isLoading = false;
  error = '';

  step: 'signup' | 'verify' = 'signup';
  otp = '';
  resendCooldown = 0;
  private resendTimer: any;

  constructor(
    private authService: AuthService,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.setTheme(this.themeService.getCurrentTheme());
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.name.trim() || !this.email.trim() || !this.password) {
      this.error = 'Please fill in all fields.';
      return;
    }
    if (this.password.length < 8) {
      this.error = 'Password must be at least 8 characters.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }
    this.isLoading = true;
    this.error = '';
    try {
      await this.authService.signUp(this.name.trim(), this.email.trim(), this.password);
      this.step = 'verify';
      this.startResendCooldown();
    } catch (err: any) {
      this.error = err?.message || 'Sign up failed. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  async onVerify(): Promise<void> {
    if (!this.otp.trim()) {
      this.error = 'Please enter the verification code.';
      return;
    }
    this.isLoading = true;
    this.error = '';
    try {
      await this.authService.verifyOtp(this.email.trim(), this.otp.trim());
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error = err?.message || 'Verification failed. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  async onResend(): Promise<void> {
    if (this.resendCooldown > 0) return;
    this.error = '';
    try {
      await this.authService.resendOtp(this.email.trim());
      this.startResendCooldown();
    } catch (err: any) {
      this.error = err?.message || 'Failed to resend code.';
    }
  }

  private startResendCooldown(): void {
    this.resendCooldown = 60;
    clearInterval(this.resendTimer);
    this.resendTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) clearInterval(this.resendTimer);
    }, 1000);
  }

  goBack(): void {
    this.step = 'signup';
    this.otp = '';
    this.error = '';
  }

  togglePassword(): void { this.showPassword = !this.showPassword; }
  toggleConfirm(): void { this.showConfirm = !this.showConfirm; }
}
