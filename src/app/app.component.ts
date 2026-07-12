import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from './services/theme.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'crafty-rachel';
  isDarkMode = false;

  // rejection/feedback state shown to users who have been rejected
  showRejectionBox = false;
  rejectionFeedback = '';

  constructor(
    public themeService: ThemeService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // make sure theme classes are set immediately on load
    this.themeService.setTheme(this.themeService.getCurrentTheme());

    // subscribe so that body class remains in sync when other components toggle theme
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
      if (isDark) {
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
        document.documentElement.classList.add('dark-mode');
        document.documentElement.classList.remove('light-mode');
      } else {
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
        document.documentElement.classList.add('light-mode');
        document.documentElement.classList.remove('dark-mode');
      }
    });

    // watch current user for rejection status
    this.authService.currentUser.subscribe(user => {
      if (user && user.status === 'rejected' && user.rejectionFeedback) {
        this.rejectionFeedback = user.rejectionFeedback;
        this.showRejectionBox = true;
      }
    });

    // listen to storage events so that changes made by admin in another tab/app are noticed
    window.addEventListener('storage', (event) => {
      if (event.key === 'cr_user') {
        try {
          const updated = JSON.parse(event.newValue || '{}');
          if (updated.status === 'rejected' && updated.rejectionFeedback) {
            this.rejectionFeedback = updated.rejectionFeedback;
            this.showRejectionBox = true;
          }
        } catch {}
      }
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  acknowledgeRejection(): void {
    this.showRejectionBox = false;
  }
}
