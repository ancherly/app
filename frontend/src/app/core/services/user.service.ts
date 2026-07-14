import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface GymUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'employee';
  active: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private supabase = inject(SupabaseService).client;

  async getUsers(): Promise<GymUser[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, email, full_name, role, active, created_at')
      .order('full_name');
    if (error) throw new Error(error.message);
    return data as GymUser[];
  }

  async createUser(payload: { email: string; password: string; full_name: string; role: string }): Promise<GymUser> {
    const { data, error } = await this.supabase.functions.invoke('create-user', { body: payload });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data as GymUser;
  }

  async updateUser(id: string, payload: { full_name?: string; email?: string }): Promise<GymUser> {
    const { data, error } = await this.supabase
      .from('users')
      .update(payload)
      .eq('id', id)
      .select('id, email, full_name, role, active, created_at')
      .single();
    if (error) throw new Error(error.message);
    return data as GymUser;
  }

  async toggleActive(id: string): Promise<{ active: boolean }> {
    const { data: current, error: fetchErr } = await this.supabase
      .from('users')
      .select('active')
      .eq('id', id)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);

    const newActive = !current.active;
    const { error } = await this.supabase
      .from('users')
      .update({ active: newActive })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return { active: newActive };
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const { data, error } = await this.supabase.functions.invoke('reset-user-password', {
      body: { user_id: id, new_password: newPassword }
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
  }
}
