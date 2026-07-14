import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface GymSettings {
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  timezone: string;
}

@Injectable({ providedIn: 'root' })
export class GymSettingsService {
  private supabase = inject(SupabaseService).client;
  private cached: GymSettings | null = null;

  async getSettings(): Promise<GymSettings> {
    if (this.cached) return this.cached;

    const { data, error } = await this.supabase
      .from('gym_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    this.cached = data ?? { latitude: null, longitude: null, radius_meters: 200, timezone: 'Europe/Madrid' };
    return this.cached!;
  }

  async updateSettings(payload: { latitude: number; longitude: number; radius_meters: number }): Promise<GymSettings> {
    this.cached = null;

    const { data: existing } = await this.supabase
      .from('gym_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await this.supabase
        .from('gym_settings')
        .update({ ...payload, timezone: 'Europe/Madrid' })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      result = data;
    } else {
      const { data, error } = await this.supabase
        .from('gym_settings')
        .insert({ ...payload, timezone: 'Europe/Madrid' })
        .select()
        .single();
      if (error) throw new Error(error.message);
      result = data;
    }

    this.cached = result as GymSettings;
    return this.cached;
  }
}
