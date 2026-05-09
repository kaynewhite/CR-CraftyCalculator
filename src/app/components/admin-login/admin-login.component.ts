import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css'
})
export class AdminLoginComponent implements OnInit {
  isLoading = false;
  error = '';

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      if (user) {
        if (user.role === 'admin' || user.role === 'superadmin') {
          this.router.navigate(['/admin-dashboard']);
        } else {
          this.error = 'Access denied. Admin credentials required.';
        }
      }
    });
  }

  login(): void {
    this.authService.openSignIn('/admin-dashboard');
  }
}
