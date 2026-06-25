export interface ProductDetail {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  total: number;
}

export type LogisticsDocumentType = 'NV' | 'OC' | 'TR';

export interface PendingDocument {
  documentNumber: string; // Document number
  id: string; // composite key like NV-15726
  fecha: Date;
  tipo: LogisticsDocumentType;
  razonSocial: string;
  vendedor: string;
  totalPendiente: number;
  observaciones?: string;
  detalle: ProductDetail[];
}

export interface LogisticsRoute {
  id: string;
  name: string;
  createdAt?: any;
}

export interface LogisticsDriver {
  id: string;
  name: string;
  createdAt?: any;
}

export interface LogisticsVehicle {
  id: string;
  plate: string;
  description: string;
  createdAt?: any;
}

export interface LogisticsManifest {
  id: string; // generated as routeId_date
  driverId: string;
  vehicleId: string;
  routeId?: string;
  date?: string;
  isFinalized?: boolean;
  logisticsDataSaved?: boolean;
  routeNumber?: number; // Unique number id, e.g. 1001, 1002
  startTime?: string;
  endTime?: string;
  pendingPoints?: number;
  totalPoints?: number;
  initialKm?: number;
  finalKm?: number;
  documentsSnapshot?: {
    id: string;
    tipo: string;
    razonSocial: string;
    totalPendiente: number;
    totalAmount?: number;
    guideNumber?: string;
    logisticsNotes?: string;
    orderIndex?: number;
    deliveryStatus?: 'COMPLETO' | 'PARCIAL';
    trackingStatus?: 'ENTREGADO' | 'NO ENTREGADO' | 'RETIRADO' | 'NO RETIRADO' | 'EN CURSO';
    trackingObservation?: string;
    failedReason?: 'POR HORARIO' | 'CLIENTE NO RECIBE' | 'NO CARGADO' | string;
    detalle?: ProductDetail[];
    proceso?: 'ENTREGA' | 'RETIRO';
    location?: string;
  }[];
  updatedAt: any;
}

export interface LogisticsAssignment {
  documentId: string;
  route: string; // Dynamic route name or ID
  dispatchDate: string | null; // ISO Date
  guideNumber?: string;
  logisticsNotes?: string;
  location?: string;
  orderIndex?: number;
  totalAmount?: number;
  deliveryStatus?: 'COMPLETO' | 'PARCIAL';
  razonSocial?: string;
  tipo?: string;
  totalPendiente?: number;
  isAdditional?: boolean;
  updatedAt: any; // Server timestamp
}

export interface MergedDocument extends PendingDocument {
  assignment?: LogisticsAssignment;
  isOrphaned?: boolean;
  isMissingFromImport?: boolean;
  isAdditional?: boolean;
  trackingStatus?: 'ENTREGADO' | 'NO ENTREGADO' | 'RETIRADO' | 'NO RETIRADO' | 'EN CURSO';
  trackingObservation?: string;
  failedReason?: 'POR HORARIO' | 'CLIENTE NO RECIBE' | 'NO CARGADO' | string;
  proceso?: 'ENTREGA' | 'RETIRO';
  location?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  permissions: {
    canViewPlanning: boolean;
    canViewRouteSheets: boolean;
    canViewResumenRutas: boolean;
    canViewKPIs: boolean;
    canEditManifests: boolean;
    canEditParameters: boolean;
    canUploadExcel: boolean;
    canManageUsers: boolean;
    canEditPlanning: boolean;
  };
  createdAt: any;
}

export interface LogisticsRequest {
  id: string;
  title: string;
  description: string;
  clientName?: string;
  address?: string;
  priority: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  createdAt: string; // ISO String 
  createdBy: string; // email or name
  status: 'PENDIENTE' | 'COMPLETADO';
  observation?: string;
  completedAt?: string;
  completedBy?: string;
  targetDate: string; // YYYY-MM-DD
  alarmOption: 'SAME_DAY' | 'ANY_DAY' | 'SPECIFIC_DATE'; // trigger option
  alarmDate?: string; // SPECIFIC date YYYY-MM-DD if alarmOption is SPECIFIC_DATE
}

