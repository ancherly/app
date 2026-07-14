import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'employee';
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly currentUser = signal<User | null | undefined>(undefined);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isLoading = computed(() => this.currentUser() === undefined);

  async init(): Promise<void> {
    try {
      const user = await firstValueFrom(this.http.get<User>(`${environment.apiUrl}/api/auth/me`));
      this.currentUser.set(user);
    } catch {
      this.currentUser.set(null);
    }
  }

  async login(email: string, password: string): Promise<User> {
    const user = await firstValueFrom(
      this.http.post<User>(`${environment.apiUrl}/api/auth/login`, { email, password })
    );
    this.currentUser.set(user);
    return user;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/api/auth/logout`, {}));
    } catch { /* ignore */ }
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
