import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-landing',
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  constructor(private authService: AuthService) {}

  openSignIn(): void {
    this.authService.openSignIn('/dashboard');
  }

  openSignUp(): void {
    this.authService.openSignUp('/dashboard');
  }
}
