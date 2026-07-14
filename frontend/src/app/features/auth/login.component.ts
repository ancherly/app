import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-bg"></div>

      <div class="login-container">
        <div class="login-brand">
          <div class="brand-icon"><i class="fas fa-dumbbell"></i></div>
          <h1 class="brand-name">GYMFICHAJE</h1>
          <p class="brand-tagline">Control horario profesional</p>
        </div>

        <div class="login-card">
          <h2 class="login-title">Iniciar sesión</h2>

          @if (error()) {
            <div class="error-banner" data-testid="login-error">
              <i class="fas fa-circle-exclamation"></i>
              {{ error() }}
            </div>
          }

          <form (ngSubmit)="onLogin()" class="login-form">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input
                class="form-input"
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="tu@email.com"
                autocomplete="email"
                data-testid="login-email-input"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label">Contraseña</label>
              <div class="input-wrapper">
                <input
                  class="form-input"
                  [type]="showPassword() ? 'text' : 'password'"
                  [(ngModel)]="password"
                  name="password"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  data-testid="login-password-input"
                  required
                />
                <button type="button" class="toggle-password" (click)="togglePassword()">
                  <i [class]="showPassword() ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              class="btn btn-primary login-btn"
              [disabled]="loading()"
              data-testid="login-submit-button"
            >
              @if (loading()) {
                <span class="spinner"></span>
                Entrando...
              } @else {
                <i class="fas fa-right-to-bracket"></i>
                Entrar
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-base);
      position: relative;
      overflow: hidden;
      padding: 20px;
    }

    .login-bg {
      position: absolute;
      inset: 0;
      background-image: url('https://images.pexels.com/photos/4753890/pexels-photo-4753890.jpeg');
      background-size: cover;
      background-position: center;
      opacity: 0.12;
    }

    .login-container {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }

    .login-brand {
      text-align: center;
    }

    .brand-icon {
      width: 64px;
      height: 64px;
      background: var(--accent-blue);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 12px;
      font-size: 1.5rem;
      color: #fff;
    }

    .brand-name {
      font-family: var(--font-heading);
      font-size: 2.5rem;
      font-weight: 900;
      letter-spacing: 0.1em;
      color: var(--text-primary);
    }

    .brand-tagline {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-top: 4px;
      letter-spacing: 0.05em;
    }

    .login-card {
      width: 100%;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px 28px;
    }

    .login-title {
      font-family: var(--font-heading);
      font-size: 1.5rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 24px;
      color: var(--text-primary);
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius);
      color: var(--status-red);
      font-size: 0.875rem;
      margin-bottom: 16px;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .input-wrapper {
      position: relative;
    }

    .input-wrapper .form-input {
      padding-right: 44px;
    }

    .toggle-password {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
    }
    .toggle-password:hover { color: var(--text-primary); }

    .login-btn {
      width: 100%;
      padding: 13px;
      font-size: 0.9rem;
      margin-top: 4px;
    }
  `]
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  error = signal<string | null>(null);
  loading = signal(false);
  showPassword = signal(false);

  togglePassword() { this.showPassword.update(v => !v); }

  async onLogin() {
    if (!this.email || !this.password) return;
    this.error.set(null);
    this.loading.set(true);
    try {
      const user = await this.authService.login(this.email, this.password);
      if (user.role === 'admin') {
        this.router.navigate(['/admin/users']);
      } else {
        this.router.navigate(['/employee/dashboard']);
      }
    } catch (err: any) {
      const detail = err?.error?.detail;
      this.error.set(
        typeof detail === 'string' ? detail :
        Array.isArray(detail) ? detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ') :
        'Error al iniciar sesión. Verifica tus credenciales.'
      );
    } finally {
      this.loading.set(false);
    }
  }
}
