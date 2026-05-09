import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule],

  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css'
})
export class SignupComponent implements OnInit {
  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      if (user) this.router.navigate(['/dashboard']);
    });
  }

  openSignUp(): void { this.authService.openSignUp('/dashboard'); }
  openSignIn(): void { this.authService.openSignIn('/dashboard'); }
}
