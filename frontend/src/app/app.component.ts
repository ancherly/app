import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  template: `
    @if (authService.isLoading()) {
      <div class="global-loading">
        <div class="loading-spinner"></div>
        <p>Cargando...</p>
      </div>
    } @else {
      <router-outlet></router-outlet>
    }
  `,
  styles: [`
    .global-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: #0A0A0A;
      color: #A1A1AA;
      gap: 16px;
    }
    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #27272A;
      border-top-color: #007AFF;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class AppComponent {
  authService = inject(AuthService);
}
