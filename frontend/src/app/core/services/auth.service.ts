import { Injectable, inject, signal, computed, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'employee';
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService).client;
  private router = inject(Router);
  private zone = inject(NgZone);

  readonly currentUser = signal<User | null | undefined>(undefined);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isLoading = computed(() => this.currentUser() === undefined);

  async init(): Promise<void> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) {
        this.currentUser.set(null);
      } else {
        await this.loadProfile(session.user.id);
      }
    } catch {
      this.currentUser.set(null);
    }

    this.supabase.auth.onAuthStateChange(async (event, session) => {
      this.zone.run(async () => {
        if (event === 'SIGNED_OUT' || !session) {
          this.currentUser.set(null);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          await this.loadProfile(session.user.id);
        }
      });
    });
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, email, full_name, role, active')
      .eq('id', userId)
      .single();

    if (error || !data) {
      this.currentUser.set(null);
      return;
    }
    this.currentUser.set(data as User);
  }

  async login(email: string, password: string): Promise<User> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(this.translateError(error.message));

    await this.loadProfile(data.user.id);
    const user = this.currentUser();
    if (!user) throw new Error('No se encontró el perfil de usuario. Contacta al administrador.');
    if (!user.active) {
      await this.supabase.auth.signOut();
      this.currentUser.set(null);
      throw new Error('Tu cuenta está desactivada. Contacta al administrador.');
    }
    return user;
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  private translateError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
    if (msg.includes('Email not confirmed')) return 'Email no confirmado. Revisa tu bandeja de entrada.';
    if (msg.includes('Too many requests')) return 'Demasiados intentos. Espera unos minutos.';
    return msg;
  }
}
