import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  async getMyPunches(year?: number, month?: number): Promise<Punch[]> {
    let params = new HttpParams();
    if (year) params = params.set('year', year);
    if (month) params = params.set('month', month);
    return firstValueFrom(this.http.get<Punch[]>(`${this.base}/api/punches`, { params }));
  }

  async checkIn(lat?: number, lng?: number, note?: string): Promise<Punch> {
    return firstValueFrom(
      this.http.post<Punch>(`${this.base}/api/punches/checkin`, { latitude: lat, longitude: lng, note })
    );
  }

  async checkOut(punchId: string, lat?: number, lng?: number, note?: string): Promise<Punch> {
    return firstValueFrom(
      this.http.post<Punch>(`${this.base}/api/punches/checkout/${punchId}`, { latitude: lat, longitude: lng, note })
    );
  }

  async adminGetPunches(userId?: string, year?: number, month?: number): Promise<Punch[]> {
    let params = new HttpParams();
    if (userId) params = params.set('user_id', userId);
    if (year) params = params.set('year', year);
    if (month) params = params.set('month', month);
    return firstValueFrom(this.http.get<Punch[]>(`${this.base}/api/admin/punches`, { params }));
  }

  async adminCreatePunch(data: {
    user_id: string;
    work_date: string;
    check_in_at: string;
    check_out_at?: string;
    check_in_note?: string;
    check_out_note?: string;
  }): Promise<Punch> {
    return firstValueFrom(this.http.post<Punch>(`${this.base}/api/admin/punches`, data));
  }

  async adminUpdatePunch(punchId: string, data: {
    check_in_at?: string;
    check_out_at?: string;
    check_in_note?: string;
    check_out_note?: string;
  }): Promise<Punch> {
    return firstValueFrom(this.http.put<Punch>(`${this.base}/api/admin/punches/${punchId}`, data));
  }

  async adminDeletePunch(punchId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/api/admin/punches/${punchId}`));
  }
}
