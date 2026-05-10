import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [],
  template: `<div style="display:flex;align-items:center;justify-content:center;height:100vh;">
    <p style="color:var(--text-muted)">Redirecting to login…</p>
  </div>`,
})
export class AdminLoginComponent implements OnInit {
  constructor(private router: Router) {}
  ngOnInit(): void {
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
