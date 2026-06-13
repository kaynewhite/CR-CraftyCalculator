import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'],
})
export class ForgotPasswordComponent {
  email = '';
  isLoading = false;
  error = '';
  success = '';

  constructor(private api: ApiService) {}

  onSubmit(): void {
    if (!this.email.trim()) {
      this.error = 'Please enter your email address.';
      return;
    }
    this.isLoading = true;
    this.error = '';
    this.success = '';

    this.api.forgotPassword(this.email.trim()).subscribe({
      next: () => {
        this.isLoading = false;
        this.success =
          'A password reset link has been sent to your email. Please check your inbox (and spam folder).';
        this.email = '';
      },
      error: (err: any) => {
        this.isLoading = false;
        this.error = err.message || 'Failed to submit request. Please try again.';
      },
    });
  }
}
