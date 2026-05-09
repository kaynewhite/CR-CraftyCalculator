import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      if (user) {
        if (user.role === 'admin' || user.role === 'superadmin') {
          this.router.navigate(['/admin-dashboard']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      }
    });
    this.waitForClerkAndOpen('signIn');
  }

  private waitForClerkAndOpen(type: 'signIn' | 'signUp'): void {
    const maxWait = 8000;
    const interval = 150;
    let elapsed = 0;
    const timer = setInterval(() => {
      const clerk = (window as any).Clerk;
      if (clerk?.components) {
        clearInterval(timer);
        if (type === 'signIn') {
          clerk.openSignIn({ afterSignInUrl: '/dashboard' });
        } else {
          clerk.openSignUp({ afterSignUpUrl: '/dashboard' });
        }
      }
      elapsed += interval;
      if (elapsed >= maxWait) clearInterval(timer);
    }, interval);
  }

  openSignIn(): void {
    this.authService.openSignIn('/dashboard');
  }
}
