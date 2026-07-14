import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  async getUsers(): Promise<GymUser[]> {
    return firstValueFrom(this.http.get<GymUser[]>(`${this.base}/api/admin/users`));
  }

  async createUser(data: { email: string; password: string; full_name: string; role: string }): Promise<GymUser> {
    return firstValueFrom(this.http.post<GymUser>(`${this.base}/api/admin/users`, data));
  }

  async updateUser(id: string, data: { full_name?: string; email?: string }): Promise<GymUser> {
    return firstValueFrom(this.http.put<GymUser>(`${this.base}/api/admin/users/${id}`, data));
  }

  async toggleActive(id: string): Promise<{ active: boolean }> {
    return firstValueFrom(this.http.patch<{ active: boolean }>(`${this.base}/api/admin/users/${id}/toggle-active`, {}));
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/api/admin/users/${id}/reset-password`, { new_password: newPassword }));
  }
}
