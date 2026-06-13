import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.component.html',
  styleUrls: ['./notification-bell.component.css']
})
export class NotificationBellComponent {
  isOpen = false;

  constructor(public notificationService: NotificationService) {}

  get unreadCount(): number {
    return this.notificationService.unreadCount;
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  markAllRead(): void {
    this.notificationService.markAllRead();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notif-bell-wrap')) {
      this.isOpen = false;
    }
  }
}
