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
  verificationCode = '';

  showPassword = false;
  showConfirm = false;
  isLoading = false;
  error = '';
  needsVerification = false;

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
      const result = await this.authService.signUp(this.name.trim(), this.email.trim(), this.password);
      if (result.needsVerification) {
        this.needsVerification = true;
        this.isLoading = false;
      } else {
        await this.waitForUser();
        this.router.navigate(['/dashboard']);
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Sign up failed. Please try again.';
      this.error = msg;
      this.isLoading = false;
    }
  }

  async onVerify(): Promise<void> {
    if (!this.verificationCode.trim()) {
      this.error = 'Please enter your verification code.';
      return;
    }
    this.isLoading = true;
    this.error = '';
    try {
      await this.authService.verifyEmail(this.verificationCode.trim());
      await this.waitForUser();
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message ||
        'Invalid verification code. Please try again.';
      this.error = msg;
      this.isLoading = false;
    }
  }

  private waitForUser(): Promise<void> {
    return new Promise(resolve => {
      const sub = this.authService.currentUser.subscribe(user => {
        if (user) { sub.unsubscribe(); resolve(); }
      });
      setTimeout(() => { sub.unsubscribe(); resolve(); }, 6000);
    });
  }

  togglePassword(): void { this.showPassword = !this.showPassword; }
  toggleConfirm(): void { this.showConfirm = !this.showConfirm; }
}
