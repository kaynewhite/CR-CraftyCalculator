import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css'
})
export class AdminLoginComponent implements OnInit {
  email: string = '';
  password: string = '';
  error: string = '';
  isLoading: boolean = false;
  showPassword: boolean = false;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      const user = this.authService.currentUserValue;
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        this.router.navigate(['/admin-dashboard']);
      } else {
        this.router.navigate(['/dashboard']);
      }
    }
  }

  login(): void {
    if (!this.email || !this.password) {
      this.error = 'Please enter your email and password';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (user) => {
        if (user.role === 'admin' || user.role === 'superadmin') {
          this.router.navigate(['/admin-dashboard']);
        } else {
          this.error = 'Access denied. Admin credentials required.';
          this.authService.logout();
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.message || 'Authentication failed. Please try again.';
        this.isLoading = false;
      }
    });
  }
}
