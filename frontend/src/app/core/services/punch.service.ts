import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { GymSettingsService } from './gym-settings.service';

export interface Punch {
  id: string;
  user_id: string;
  work_date: string;
  check_in_at: string;
  check_in_lat?: number;
  check_in_lng?: number;
  check_in_note?: string;
  check_out_at?: string;
  check_out_lat?: number;
  check_out_lng?: number;
  check_out_note?: string;
  status: 'open' | 'closed_manual' | 'closed_auto' | 'edited_admin';
  edited_by_admin: boolean;
  edited_at?: string;
}

@Injectable({ providedIn: 'root' })
export class PunchService {
  private supabase = inject(SupabaseService).client;
  private auth = inject(AuthService);
  private settings = inject(GymSettingsService);

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private getMadridToday(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  }

  private async validateGeofence(lat: number, lng: number): Promise<void> {
    const gym = await this.settings.getSettings();
    if (gym.latitude == null || gym.longitude == null) return;
    const dist = Math.round(this.haversine(lat, lng, gym.latitude, gym.longitude));
    if (dist > gym.radius_meters) {
      throw new Error(
        `Estás demasiado lejos del gimnasio (${dist}m). El radio permitido es ${gym.radius_meters}m.`
      );
    }
  }

  async getMyPunches(year?: number, month?: number): Promise<Punch[]> {
    const userId = this.auth.currentUser()?.id;
    if (!userId) throw new Error('No autenticado');

    let query = this.supabase
      .from('punches')
      .select('*')
      .eq('user_id', userId)
      .order('check_in_at', { ascending: false });

    if (year && month) {
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const to = new Date(year, month, 0).toISOString().split('T')[0];
      query = query.gte('work_date', from).lte('work_date', to);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as Punch[];
  }

  async checkIn(lat?: number, lng?: number, note?: string): Promise<Punch> {
    const userId = this.auth.currentUser()?.id;
    if (!userId) throw new Error('No autenticado');

    if (lat !== undefined && lng !== undefined) {
      await this.validateGeofence(lat, lng);
    }

    const { data, error } = await this.supabase
      .from('punches')
      .insert({
        user_id: userId,
        work_date: this.getMadridToday(),
        check_in_at: new Date().toISOString(),
        check_in_lat: lat ?? null,
        check_in_lng: lng ?? null,
        check_in_note: note ?? null,
        status: 'open',
        edited_by_admin: false
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Punch;
  }

  async checkOut(punchId: string, lat?: number, lng?: number, note?: string): Promise<Punch> {
    if (lat !== undefined && lng !== undefined) {
      await this.validateGeofence(lat, lng);
    }

    const { data, error } = await this.supabase
      .from('punches')
      .update({
        check_out_at: new Date().toISOString(),
        check_out_lat: lat ?? null,
        check_out_lng: lng ?? null,
        check_out_note: note ?? null,
        status: 'closed_manual',
        updated_at: new Date().toISOString()
      })
      .eq('id', punchId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Punch;
  }

  async adminGetPunches(userId?: string, year?: number, month?: number): Promise<Punch[]> {
    let query = this.supabase
      .from('punches')
      .select('*')
      .order('check_in_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId);
    if (year && month) {
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const to = new Date(year, month, 0).toISOString().split('T')[0];
      query = query.gte('work_date', from).lte('work_date', to);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as Punch[];
  }

  async adminCreatePunch(payload: {
    user_id: string;
    work_date: string;
    check_in_at: string;
    check_out_at?: string;
    check_in_note?: string;
    check_out_note?: string;
  }): Promise<Punch> {
    const { data, error } = await this.supabase
      .from('punches')
      .insert({
        ...payload,
        status: payload.check_out_at ? 'edited_admin' : 'open',
        edited_by_admin: true,
        edited_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Punch;
  }

  async adminUpdatePunch(punchId: string, payload: {
    check_in_at?: string;
    check_out_at?: string;
    check_in_note?: string;
    check_out_note?: string;
  }): Promise<Punch> {
    const { data, error } = await this.supabase
      .from('punches')
      .update({
        ...payload,
        status: 'edited_admin',
        edited_by_admin: true,
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', punchId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Punch;
  }

  async adminDeletePunch(punchId: string): Promise<void> {
    const { error } = await this.supabase
      .from('punches')
      .delete()
      .eq('id', punchId);
    if (error) throw new Error(error.message);
  }
}
