import { Injectable } from '@angular/core';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

@Injectable({ providedIn: 'root' })
export class GeoService {
  async getCurrentPosition(): Promise<GeoPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no disponible en este dispositivo'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }),
        (err) => {
          switch (err.code) {
            case err.PERMISSION_DENIED:
              reject(new Error('Permiso de ubicación denegado. Actívalo en la configuración del navegador'));
              break;
            case err.POSITION_UNAVAILABLE:
              reject(new Error('Ubicación no disponible'));
              break;
            case err.TIMEOUT:
              reject(new Error('Tiempo de espera agotado al obtener la ubicación'));
              break;
            default:
              reject(new Error('Error al obtener la ubicación'));
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }
}
