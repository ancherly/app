import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GymSettings {
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  timezone: string;
}

@Injectable({ providedIn: 'root' })
export class GymSettingsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  async getSettings(): Promise<GymSettings> {
    return firstValueFrom(this.http.get<GymSettings>(`${this.base}/api/settings`));
  }

  async updateSettings(data: { latitude: number; longitude: number; radius_meters: number }): Promise<GymSettings> {
    return firstValueFrom(this.http.put<GymSettings>(`${this.base}/api/settings`, data));
  }
}
