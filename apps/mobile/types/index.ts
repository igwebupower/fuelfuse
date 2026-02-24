// Re-export shared types
export * from '@fuelfuse/shared';

// Mobile-specific types
export interface NavigationParams {
  stationId?: string;
}

export interface LocationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
}

export interface DeviceLocation {
  latitude: number;
  longitude: number;
}

export interface NotificationPermissionResult {
  granted: boolean;
  token?: string;
  error?: string;
}
