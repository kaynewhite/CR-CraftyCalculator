import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'theme';
  private isDarkMode = new BehaviorSubject<boolean>(false);
  public isDarkMode$ = this.isDarkMode.asObservable();

  constructor() {
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;
    this.setTheme(isDark);
  }

  toggleTheme(): void {
    this.setTheme(!this.isDarkMode.value);
  }

  setTheme(isDark: boolean): void {
    this.isDarkMode.next(isDark);
    const theme = isDark ? 'dark' : 'light';
    localStorage.setItem(this.THEME_KEY, theme);
    
    if (isDark) {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
      document.documentElement.classList.add('dark-mode');
      document.documentElement.classList.remove('light-mode');
      document.body.dataset['theme'] = 'dark';
      document.documentElement.dataset['theme'] = 'dark';
    } else {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
      document.documentElement.classList.add('light-mode');
      document.documentElement.classList.remove('dark-mode');
      document.body.dataset['theme'] = 'light';
      document.documentElement.dataset['theme'] = 'light';
    }
  }

  getCurrentTheme(): boolean {
    return this.isDarkMode.value;
  }
}
