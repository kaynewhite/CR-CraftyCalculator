import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css'
})
export class SignupComponent implements OnInit {
  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      if (user) this.router.navigate(['/dashboard']);
    });
    this.waitForClerkAndOpen('signUp');
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

  openSignUp(): void { this.authService.openSignUp('/dashboard'); }
  openSignIn(): void { this.authService.openSignIn('/dashboard'); }
}
