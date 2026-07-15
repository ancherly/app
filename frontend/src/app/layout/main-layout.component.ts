import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth.service';
import { signal } from '@angular/core';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="layout">
      <!-- Sidebar (desktop) -->
      <aside class="sidebar" [class.open]="menuOpen()">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <div class="brand-icon-sm"><i class="fas fa-dumbbell"></i></div>
            <span class="brand-text">GYMFICHAJE</span>
          </div>
          <button class="close-menu-btn" (click)="menuOpen.set(false)">
            <i class="fas fa-xmark"></i>
          </button>
        </div>

        <div class="user-info">
          <div class="user-avatar">
            {{ userInitial() }}
          </div>
          <div>
            <div class="user-name" data-testid="user-name-sidebar">{{ userName() }}</div>
            <div class="user-role">{{ isAdmin() ? 'Administrador' : 'Empleado' }}</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          @if (isAdmin()) {
            <a routerLink="/admin/users" routerLinkActive="active" class="nav-item" (click)="menuOpen.set(false)" data-testid="nav-users">
              <i class="fas fa-users"></i>
              <span>Empleados</span>
            </a>
            <a routerLink="/admin/reports" routerLinkActive="active" class="nav-item" (click)="menuOpen.set(false)" data-testid="nav-reports">
              <i class="fas fa-chart-bar"></i>
              <span>Informes</span>
            </a>
            <a routerLink="/admin/settings" routerLinkActive="active" class="nav-item" (click)="menuOpen.set(false)" data-testid="nav-settings">
              <i class="fas fa-gear"></i>
              <span>Configuración</span>
            </a>
          } @else {
            <a routerLink="/employee/dashboard" routerLinkActive="active" class="nav-item" (click)="menuOpen.set(false)" data-testid="nav-dashboard">
              <i class="fas fa-clock"></i>
              <span>Fichar</span>
            </a>
            <a routerLink="/employee/history" routerLinkActive="active" class="nav-item" (click)="menuOpen.set(false)" data-testid="nav-history">
              <i class="fas fa-calendar-days"></i>
              <span>Historial</span>
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <button class="btn btn-ghost logout-btn" (click)="logout()" data-testid="logout-button">
            <i class="fas fa-right-from-bracket"></i>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <!-- Overlay for mobile -->
      @if (menuOpen()) {
        <div class="overlay" (click)="menuOpen.set(false)"></div>
      }

      <!-- Main content -->
      <main class="main">
        <!-- Mobile top bar -->
        <header class="topbar">
          <button class="menu-btn" (click)="menuOpen.set(true)" data-testid="mobile-menu-button">
            <i class="fas fa-bars"></i>
          </button>
          <span class="topbar-title">{{ isAdmin() ? 'GYMFICHAJE Admin' : 'GYMFICHAJE' }}</span>
          <button class="btn btn-ghost btn-sm" (click)="logout()" data-testid="topbar-logout">
            <i class="fas fa-right-from-bracket"></i>
          </button>
        </header>

        <div class="content">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background: var(--bg-base);
    }

    /* ---- Sidebar ---- */
    .sidebar {
      width: 260px;
      flex-shrink: 0;
      background: var(--bg-surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      z-index: 50;
      transition: transform 0.25s ease;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 20px 16px;
      border-bottom: 1px solid var(--border);
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-icon-sm {
      width: 32px;
      height: 32px;
      background: var(--accent-blue);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      color: #fff;
    }

    .brand-text {
      font-family: var(--font-heading);
      font-size: 1.1rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      color: var(--text-primary);
    }

    .close-menu-btn {
      display: none;
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 1.25rem;
      cursor: pointer;
      padding: 4px;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--accent-blue);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-heading);
      font-size: 1.2rem;
      font-weight: 900;
      flex-shrink: 0;
    }

    .user-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--text-primary);
    }

    .user-role {
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .sidebar-nav {
      flex: 1;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      border-radius: var(--radius);
      color: var(--text-secondary);
      font-size: 0.9rem;
      font-weight: 500;
      text-decoration: none;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .nav-item:hover {
      background: var(--bg-elevated);
      color: var(--text-primary);
    }

    .nav-item.active {
      background: rgba(0, 122, 255, 0.15);
      color: var(--accent-blue);
      border: 1px solid rgba(0, 122, 255, 0.2);
    }

    .nav-item i {
      width: 18px;
      text-align: center;
    }

    .sidebar-footer {
      padding: 16px;
      border-top: 1px solid var(--border);
    }

    .logout-btn {
      width: 100%;
      justify-content: flex-start;
    }

    .overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 49;
    }

    /* ---- Main ---- */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .topbar {
      display: none;
      align-items: center;
      padding: 12px 16px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      gap: 12px;
      position: sticky;
      top: 0;
      z-index: 40;
    }

    .topbar-title {
      flex: 1;
      font-family: var(--font-heading);
      font-size: 1rem;
      font-weight: 900;
      letter-spacing: 0.06em;
    }

    .menu-btn {
      background: none;
      border: none;
      color: var(--text-primary);
      font-size: 1.2rem;
      cursor: pointer;
      padding: 6px;
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    /* ---- Responsive ---- */
    @media (max-width: 768px) {
      .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        height: 100vh;
        transform: translateX(-100%);
      }
      .sidebar.open {
        transform: translateX(0);
      }
      .close-menu-btn { display: flex; }
      .overlay { display: block; }
      .topbar { display: flex; }
      .content { padding: 16px; }
    }
  `]
})
export class MainLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  menuOpen = signal(false);
  isAdmin = this.authService.isAdmin;
  userName = computed(() => this.authService.currentUser()?.full_name || '');
  userInitial = computed(() => (this.authService.currentUser()?.full_name || 'U')[0].toUpperCase());

  async logout() {
    await this.authService.logout();
  }
}
