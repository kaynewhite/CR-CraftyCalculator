import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  email = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  showConfirm = false;
  isLoading = false;
  isValidating = true;
  isTokenValid = false;
  error = '';
  success = '';

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.isValidating = false;
      this.error = 'No reset token provided. Please request a new password reset.';
      return;
    }
    this.api.validateResetToken(this.token).subscribe({
      next: (res: any) => {
        this.isValidating = false;
        if (res.valid) {
          this.isTokenValid = true;
          this.email = res.email || '';
        } else {
          this.error = 'This reset link is invalid or has expired. Please request a new one.';
        }
      },
      error: () => {
        this.isValidating = false;
        this.error = 'Could not validate token. Please request a new password reset.';
      },
    });
  }

  onSubmit(): void {
    if (!this.password) {
      this.error = 'Please enter a new password.';
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

    this.api.resetPassword(this.token, this.password).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.success = res.message || 'Password reset successfully! You can now log in.';
        setTimeout(() => this.router.navigate(['/login']), 3000);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.error = err.message || 'Failed to reset password. Please try again.';
      },
    });
  }

  togglePassword(): void { this.showPassword = !this.showPassword; }
  toggleConfirm(): void { this.showConfirm = !this.showConfirm; }
}
