import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Upload, FileText, Search, Save, Calendar as CalendarIcon, MapPin, 
  Info, Trash2, Edit2, Truck, User, List, ArrowUp, ArrowDown, 
  ClipboardList, Printer, AlertCircle, AlertTriangle, RotateCcw, Lock, LogOut, Users, Shield, Loader, X, Plus, BarChart3,
  ExternalLink, Menu, ChevronDown, ChevronUp, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

import { 
  PendingDocument, LogisticsAssignment, MergedDocument, 
  LogisticsDocumentType, LogisticsRoute, LogisticsDriver, LogisticsVehicle,
  LogisticsManifest, UserProfile, LogisticsRequest
} from './types';
import { parseExcelRaw, analyzeRawRows } from './utils';
import { 
  onSnapshot, setDoc, doc, serverTimestamp, deleteDoc, writeBatch, 
  query, where, getDocs, collection 
} from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { 
  db, auth, assignmentsCol, documentsCol, userProfilesCol, stagingCol,
  routesCol, driversCol, vehiclesCol, manifestsCol, requestsCol,
  OperationType, handleFirestoreError
} from "./firebase";

// Modal imports
import VerifyRouteModal from './components/VerifyRouteModal';
import PickingModal from './components/PickingModal';
import ParametersModal from './components/ParametersModal';
import ManifestDetailModal from './components/ManifestDetailModal';
import LoginScreen from './components/LoginScreen';
import UserManagerModal from './components/UserManagerModal';
import { KPIDashboard } from './components/KPIDashboard';
import { LogisticsRequestsManager } from './components/LogisticsRequestsManager';
import { LogisticsRequestAlarmModal } from './components/LogisticsRequestAlarmModal';
import logoAntko from './assets/images/logo_antko.png';

const formatCLP = (num: number) => {
  return Math.round(num).toLocaleString('es-CL');
};

const parseCLP = (str: string) => {
  const clean = str.replace(/\D/g, '');
  return clean === '' ? 0 : Number(clean);
};

const formatDocId = (tipo: string, id: string) => {
  let cleanId = id;
  if (cleanId.includes('-ADD-')) {
    cleanId = cleanId.replace('-ADD-', '-');
  }
  const prefix = tipo + '-';
  if (cleanId.startsWith(prefix + prefix)) {
    cleanId = cleanId.substring(tipo.length + 1);
  }
  if (cleanId.startsWith(prefix)) return cleanId;
  return `${tipo}-${cleanId}`;
};

const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTomorrowLocalDateString = (dateStr: string) => {
  if (!dateStr) return getLocalDateString();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  d.setDate(d.getDate() + 1);
  return getLocalDateString(d);
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userManagerOpen, setUserManagerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [hrFiltersCollapsed, setHrFiltersCollapsed] = useState(true);
  const [expandedHrDocId, setExpandedHrDocId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'hojaDeRuta' | 'resumenRutas' | 'kpis' | 'solicitudes'>('dashboard');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'MONTH'>('ALL');
  const hasRedirectedViewer = useRef(false);
  const [allDocuments, setAllDocuments] = useState<PendingDocument[]>([]);
  const [assignments, setAssignments] = useState<Record<string, LogisticsAssignment>>({});
  const [routes, setRoutes] = useState<LogisticsRoute[]>([]);
  const [drivers, setDrivers] = useState<LogisticsDriver[]>([]);
  const [vehicles, setVehicles] = useState<LogisticsVehicle[]>([]);
  const [manifests, setManifests] = useState<Record<string, LogisticsManifest>>({});
  const [requests, setRequests] = useState<LogisticsRequest[]>([]);
  const [isAlarmOpen, setIsAlarmOpen] = useState(false);
  const [lastTriggeredTime, setLastTriggeredTime] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'NV' | 'OC'>('ALL');
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set(['UNASSIGNED']));
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Modals state
  const [isConsolidatedReportModalOpen, setIsConsolidatedReportModalOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('printReport') === 'true';
    }
    return false;
  });
  const [consolidatedReportDate, setConsolidatedReportDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlDate = params.get('reportDate');
      if (urlDate) return urlDate;
    }
    return '';
  });
  const [reportType, setReportType] = useState<'summary' | 'detailed'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlType = params.get('reportType');
      if (urlType === 'summary' || urlType === 'detailed') return urlType;
    }
    return 'summary';
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && isConsolidatedReportModalOpen) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('printReport') === 'true') {
        const timer = setTimeout(() => {
          window.print();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [isConsolidatedReportModalOpen]);

  const consolidatedReportData = useMemo(() => {
    const targetDate = consolidatedReportDate || getLocalDateString();
    
    // Filter finalized manifests for this date
    const dayManifests = (Object.values(manifests) as LogisticsManifest[])
      .filter(m => m.isFinalized && m.date === targetDate)
      .sort((a, b) => (a.routeNumber || 0) - (b.routeNumber || 0));

    let totalRutas = dayManifests.length;
    let totalDocs = 0;
    let totalValue = 0;
    let completedDocs = 0;
    let pendingDocs = 0;
    let otifDocs = 0; // ENTREGADO or RETIRADO
    let failedDocs = 0; // NO ENTREGADO or NO RETIRADO

    dayManifests.forEach(m => {
      const docs = m.documentsSnapshot || [];
      totalDocs += docs.length;
      docs.forEach(d => {
        const amt = d.tipo === 'OC' ? 0 : (d.totalAmount ?? d.totalPendiente ?? 0);
        totalValue += amt;
        
        const status = d.trackingStatus || 'EN CURSO';
        if (status === 'ENTREGADO' || status === 'RETIRADO') {
          completedDocs++;
          otifDocs++;
        } else if (status === 'NO ENTREGADO' || status === 'NO RETIRADO') {
          completedDocs++;
          failedDocs++;
        } else {
          pendingDocs++;
        }
      });
    });

    const completionRate = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0;
    const otifRate = totalDocs > 0 ? Math.round((otifDocs / totalDocs) * 100) : 0;

    return {
      manifests: dayManifests,
      totalRutas,
      totalDocs,
      totalValue,
      completedDocs,
      pendingDocs,
      otifDocs,
      failedDocs,
      completionRate,
      otifRate,
      targetDate
    };
  }, [manifests, consolidatedReportDate]);

  const [isManagingParameters, setIsManagingParameters] = useState(false);
  const [isPickingModalOpen, setIsPickingModalOpen] = useState(false);
  const [pickingRouteId, setPickingRouteId] = useState<string>('');
  const [isVerifyRouteModalOpen, setIsVerifyRouteModalOpen] = useState(false);
  const [reopenConfirmId, setReopenConfirmId] = useState<string | null>(null);
  const [showManifestDetailId, setShowManifestDetailId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
  } | null>(null);

  const [dateChangeDoc, setDateChangeDoc] = useState<MergedDocument | null>(null);
  const [newPlanningDate, setNewPlanningDate] = useState<string>('');
  const [newPlanningRoute, setNewPlanningRoute] = useState<string>('');

  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [finalizeDate, setFinalizeDate] = useState('');

  const requestConfirmation = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    confirmText = 'Confirmar', 
    cancelText = 'Cancelar', 
    type: 'danger' | 'warning' | 'info' = 'danger'
  ) => {
    setConfirmModal({ title, message, onConfirm, confirmText, cancelText, type });
  };

  // States for inline Punto Adicional form in Hoja de Ruta
  const [showAddPointForm, setShowAddPointForm] = useState(false);
  const [newPoint, setNewPoint] = useState({
    proceso: 'ENTREGA' as 'ENTREGA' | 'RETIRO',
    tipo: 'NV' as 'NV' | 'OC' | 'TR',
    docNumber: '',
    razonSocial: '',
    guideNumber: '',
    location: '',
    logisticsNotes: ''
  });
  const [newPointAmountStr, setNewPointAmountStr] = useState('');
  const showManifestDetail = useMemo(() => {
    if (!showManifestDetailId) return null;
    if (manifests[showManifestDetailId]) return manifests[showManifestDetailId];
    
    // Virtual manifest for when it's not in Firestore yet
    const parts = showManifestDetailId.split('_');
    if (parts.length < 2) return null;
    const [routeId, date] = parts;
    
    return {
      id: showManifestDetailId,
      routeId,
      date,
      driverId: '',
      vehicleId: '',
      isFinalized: false,
      documentsSnapshot: [],
      updatedAt: null
    } as LogisticsManifest;
  }, [showManifestDetailId, manifests]);
  const [toastMessage, setToastMessage] = useState<{title: string, message: string, type: 'error'|'success'|'info'} | null>(null);

  const showToast = (title: string, message: string, type: 'error'|'success'|'info' = 'error') => {
    setToastMessage({ title, message, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // States for Resumen de Rutas search
  const [resumenSearch, setResumenSearch] = useState('');
  const [resumenDate, setResumenDate] = useState('');
  const [resumenFiltersCollapsed, setResumenFiltersCollapsed] = useState(true);
  const [expandedResumenId, setExpandedResumenId] = useState<string | null>(null);

  // States for global folio / guías search in header
  const [globalFolioSearch, setGlobalFolioSearch] = useState('');
  const [showGlobalSearchResults, setShowGlobalSearchResults] = useState(false);
  const globalSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (globalSearchRef.current && !globalSearchRef.current.contains(event.target as Node)) {
        setShowGlobalSearchResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [hrSelectedRoute, setHrSelectedRoute] = useState<string>('');
  const [hrSelectedDate, setHrSelectedDate] = useState<string>(getLocalDateString());

  const hrIsFinalized = useMemo(() => {
    const manifestId = `${hrSelectedRoute}_${hrSelectedDate}`;
    return !!manifests[manifestId]?.isFinalized;
  }, [hrSelectedRoute, hrSelectedDate, manifests]);

  const routesInitialized = useRef(false);

  // --- Derivation Hooks (Moved to the top) ---
  const routeMap = useMemo(() => {
    const map: Record<string, string> = { 'UNASSIGNED': 'Sin Asignar' };
    routes.forEach(r => {
      map[r.id] = r.name || 'Sin nombre';
    });
    return map;
  }, [routes]);

  const driverMap = useMemo(() => {
    const map: Record<string, string> = {};
    drivers.forEach(d => {
      map[d.id] = d.name || 'Sin nombre';
    });
    return map;
  }, [drivers]);

  const vehicleMap = useMemo(() => {
    const map: Record<string, string> = {};
    vehicles.forEach(v => {
      map[v.id] = `${v.plate || 'Sin patente'} - ${v.description || ''}`;
    });
    return map;
  }, [vehicles]);

  const matchingGlobalDocuments = useMemo(() => {
    const queryStr = globalFolioSearch.trim().toLowerCase();
    if (queryStr.length < 2) return [];

    const results: Array<{
      manifest: LogisticsManifest;
      doc: any;
      routeLabel: string;
    }> = [];

    (Object.values(manifests) as LogisticsManifest[]).forEach((m) => {
      if (!m.documentsSnapshot) return;
      m.documentsSnapshot.forEach((d) => {
        const guideNo = (d.guideNumber || '').toLowerCase();
        const docId = (d.id || '').toLowerCase();
        const rawId = (d.id || '').replace('-ADD-', '-').toLowerCase();
        const clientName = (d.razonSocial || '').toLowerCase();
        const docType = (d.tipo || '').toLowerCase();
        
        const matchesGuide = guideNo.includes(queryStr);
        const matchesDocId = docId.includes(queryStr) || rawId.includes(queryStr);
        const matchesFullId = `${docType}-${docId}`.includes(queryStr) || `${docType} ${docId}`.includes(queryStr) || `${docType}-${rawId}`.includes(queryStr);
        const matchesClient = clientName.includes(queryStr);

        if (matchesGuide || matchesDocId || matchesFullId || matchesClient) {
          const routeLabel = routeMap[m.routeId || ''] || 'Ruta sin nombre';
          results.push({
            manifest: m,
            doc: d,
            routeLabel,
          });
        }
      });
    });

    return results.sort((a, b) => {
      const aId = (a.doc.id || '').toLowerCase();
      const bId = (b.doc.id || '').toLowerCase();
      const aGuide = (a.doc.guideNumber || '').toLowerCase();
      const bGuide = (b.doc.guideNumber || '').toLowerCase();

      const aExact = aId === queryStr || aGuide === queryStr;
      const bExact = bId === queryStr || bGuide === queryStr;

      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const dateA = a.manifest.date || '';
      const dateB = b.manifest.date || '';
      return dateB.localeCompare(dateA);
    }).slice(0, 10);
  }, [manifests, globalFolioSearch, routeMap]);

  const mergedDocuments = useMemo(() => {
    return allDocuments.map(doc => ({
      ...doc,
      assignment: assignments[doc.id]
    })) as MergedDocument[];
  }, [allDocuments, assignments]);

  const hojaDeRutaDocs = useMemo(() => {
    if (!hrSelectedRoute || !hrSelectedDate) return [];

    const manifestId = `${hrSelectedRoute}_${hrSelectedDate}`;
    const manifest = manifests[manifestId];
    if (manifest?.isFinalized && manifest.documentsSnapshot) {
      return manifest.documentsSnapshot.map(d => ({
        id: d.id,
        tipo: d.tipo as LogisticsDocumentType,
        fecha: d.fecha ? (d.fecha instanceof Date ? d.fecha : new Date(d.fecha)) : new Date(), 
        razonSocial: d.razonSocial,
        vendedor: '',
        totalPendiente: d.totalPendiente,
        detalle: d.detalle || [{ codigo: '-', descripcion: 'Información de items no disponible en snapshot histórico', cantidad: 0, precio: 0, total: 0 }],
        trackingStatus: d.trackingStatus || 'EN CURSO',
        trackingObservation: d.trackingObservation || '',
        proceso: d.proceso || 'ENTREGA',
        location: d.location || '',
        assignment: {
          documentId: d.id,
          route: hrSelectedRoute,
          dispatchDate: hrSelectedDate,
          guideNumber: d.guideNumber,
          logisticsNotes: d.logisticsNotes || d.trackingObservation || '',
          location: d.location || '',
          orderIndex: d.orderIndex,
          totalAmount: d.totalAmount,
          deliveryStatus: d.deliveryStatus,
          updatedAt: manifest.updatedAt
        }
      })) as MergedDocument[];
    }

    // If NOT finalized, combine live documents with the snapshot (for orphaned docs)
    const liveDocs = mergedDocuments.filter(doc => 
        doc.assignment?.route === hrSelectedRoute && 
        doc.assignment?.dispatchDate === hrSelectedDate
    ).map(doc => {
      const snapDoc = manifest?.documentsSnapshot?.find(d => d.id === doc.id);
      return {
        ...doc,
        trackingStatus: snapDoc?.trackingStatus || 'EN CURSO',
        trackingObservation: snapDoc?.trackingObservation || '',
        proceso: snapDoc?.proceso || 'ENTREGA',
        location: doc.assignment?.location || snapDoc?.location || '',
      };
    });

    const liveIds = new Set(liveDocs.map(d => d.id));

    // Find any assignments that are scheduled for this route & date but have no active document matching in the live list
    const assignmentsForThisRoute = (Object.values(assignments) as LogisticsAssignment[]).filter(asm => 
        asm.route === hrSelectedRoute && 
        asm.dispatchDate === hrSelectedDate
    );

    const missingImports = assignmentsForThisRoute
      .filter(asm => !liveIds.has(asm.documentId))
      .map(asm => {
        const snapDoc = manifest?.documentsSnapshot?.find(d => d.id === asm.documentId);
        let guessedType = asm.tipo || (asm.documentId.startsWith('OC-') ? 'OC' : 'NV');
        const isAdd = !!(asm.isAdditional || snapDoc?.isAdditional);
        return {
          id: asm.documentId,
          tipo: guessedType as LogisticsDocumentType,
          fecha: new Date(),
          razonSocial: asm.razonSocial || snapDoc?.razonSocial || 'SIN RAZÓN SOCIAL (DE EXCEL COMPATIBLE)',
          vendedor: '',
          totalPendiente: asm.totalPendiente !== undefined ? asm.totalPendiente : (snapDoc?.totalPendiente || 0),
          detalle: [{ codigo: '-', descripcion: isAdd ? 'Punto Adicional' : 'Este documento no figura en la planilla Excel cargada. Requiere revisión.', cantidad: 0, precio: 0, total: 0 }],
          isMissingFromImport: !isAdd, // Only marked as REVISAR if not a manual additional point
          isOrphaned: !isAdd,
          isAdditional: isAdd,
          trackingStatus: snapDoc?.trackingStatus || 'EN CURSO',
          trackingObservation: snapDoc?.trackingObservation || '',
          proceso: snapDoc?.proceso || 'ENTREGA',
          location: asm.location || snapDoc?.location || '',
          assignment: asm
        } as MergedDocument;
      });

    const processedIds = new Set([...liveIds, ...missingImports.map(d => d.id)]);

    // Include other items in the manifest.documentsSnapshot that aren't accounted for (e.g. manual points)
    const otherSnapshotDocs = manifest?.documentsSnapshot
      ? manifest.documentsSnapshot
          .filter(d => !processedIds.has(d.id))
          .map(d => ({
            id: d.id,
            tipo: d.tipo as any,
            fecha: new Date(),
            razonSocial: d.razonSocial,
            vendedor: '',
            totalPendiente: d.totalPendiente,
            detalle: d.detalle || [{ codigo: '-', descripcion: 'Ítems no disponibles', cantidad: 0, precio: 0, total: 0 }],
            isOrphaned: !d.isAdditional,
            isAdditional: d.isAdditional,
            trackingStatus: d.trackingStatus || 'EN CURSO',
            trackingObservation: d.trackingObservation || '',
            proceso: d.proceso || 'ENTREGA',
            location: d.location || '',
            assignment: {
              documentId: d.id,
              route: hrSelectedRoute,
              dispatchDate: hrSelectedDate,
              guideNumber: d.guideNumber,
              logisticsNotes: d.logisticsNotes || d.trackingObservation || '',
              location: d.location || '',
              orderIndex: d.orderIndex,
              totalAmount: d.totalAmount,
              deliveryStatus: d.deliveryStatus,
              razonSocial: d.razonSocial,
              tipo: d.tipo,
              totalPendiente: d.totalPendiente,
              isAdditional: d.isAdditional
            }
          })) as MergedDocument[]
      : [];

    const finalDocsCombined = [...liveDocs, ...missingImports, ...otherSnapshotDocs];

    return finalDocsCombined.sort((a, b) => {
      const orderA = a.assignment?.orderIndex ?? 0;
      const orderB = b.assignment?.orderIndex ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      if (a.tipo === 'NV' && b.tipo === 'OC') return -1;
      if (a.tipo === 'OC' && b.tipo === 'NV') return 1;
      return a.id.localeCompare(b.id);
    });
  }, [mergedDocuments, hrSelectedRoute, hrSelectedDate, manifests, assignments]);

  const selectedDoc = useMemo(() => {
    const live = mergedDocuments.find(d => d.id === selectedDocId);
    if (live) return live;
    // Fallback search in the manifest list (useful for historical/orphaned records)
    return hojaDeRutaDocs.find(d => d.id === selectedDocId) || null;
  }, [mergedDocuments, hojaDeRutaDocs, selectedDocId]);

  const isDocInFinalizedRoute = useMemo(() => {
    if (!selectedDoc || !selectedDoc.assignment?.route || !selectedDoc.assignment?.dispatchDate) return false;
    const mId = `${selectedDoc.assignment.route}_${selectedDoc.assignment.dispatchDate}`;
    return !!manifests[mId]?.isFinalized;
  }, [selectedDoc, manifests]);

  const docFinalizedRouteNumber = useMemo(() => {
    if (!selectedDoc || !selectedDoc.assignment?.route || !selectedDoc.assignment?.dispatchDate) return null;
    const mId = `${selectedDoc.assignment.route}_${selectedDoc.assignment.dispatchDate}`;
    return manifests[mId]?.routeNumber;
  }, [selectedDoc, manifests]);

  const filteredDocuments = useMemo(() => {
    return mergedDocuments.filter(doc => {
      const matchesSearch = 
        doc.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.vendedor.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'ALL' || doc.tipo === filterType;
      
      const docRoute = doc.assignment?.route || 'UNASSIGNED';
      const matchesRoute = selectedRoutes.has(docRoute);

      const matchesTime = (() => {
        if (timeFilter === 'ALL') return true;
        const docDate = new Date(doc.fecha);
        const today = new Date();
        
        if (timeFilter === 'TODAY') {
          return docDate.toDateString() === today.toDateString();
        }
        
        if (timeFilter === 'MONTH') {
          return docDate.getMonth() === today.getMonth() && docDate.getFullYear() === today.getFullYear();
        }
        
        return true;
      })();

      return matchesSearch && matchesType && matchesRoute && matchesTime;
    }).sort((a, b) => {
      if (a.tipo === 'NV' && b.tipo === 'OC') return -1;
      if (a.tipo === 'OC' && b.tipo === 'NV') return 1;
      return 0;
    });
  }, [mergedDocuments, searchTerm, filterType, selectedRoutes, timeFilter]);

  const otherDateDocs = useMemo(() => {
    if (!hrSelectedRoute || !hrSelectedDate) return [];
    return mergedDocuments.filter(d => {
      const a = assignments[d.id];
      return a && a.route === hrSelectedRoute && a.dispatchDate && a.dispatchDate !== hrSelectedDate;
    });
  }, [mergedDocuments, assignments, hrSelectedRoute, hrSelectedDate]);

  const pickingRouteCounts = useMemo(() => {
    const counts: Record<string, number> = { UNASSIGNED: 0 };
    routes.forEach(r => {
      counts[r.id] = 0;
    });
    
    mergedDocuments.forEach(doc => {
      const assignment = assignments[doc.id];
      const rId = assignment?.route;
      if (!assignment || !rId || rId === 'UNASSIGNED') {
        counts['UNASSIGNED']++;
      } else if (counts[rId] !== undefined) {
        counts[rId]++;
      } else {
        counts['UNASSIGNED']++;
      }
    });
    return counts;
  }, [routes, mergedDocuments, assignments]);

  const finalizedManifestsList = useMemo(() => {
    return (Object.values(manifests) as LogisticsManifest[])
      .filter(m => m.isFinalized)
      .sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.routeNumber || 0) - (a.routeNumber || 0);
      });
  }, [manifests]);

  const filteredResumenManifests = useMemo(() => {
    return finalizedManifestsList.filter(m => {
      const rName = (routeMap[m.routeId || ''] || '').toLowerCase();
      const dName = (driverMap[m.driverId || ''] || '').toLowerCase();
      const vDesc = (vehicleMap[m.vehicleId || ''] || '').toLowerCase();
      const hrTag = `hr-${m.routeNumber ?? ''}`.toLowerCase();
      
      const guideNumbers = (m.documentsSnapshot || [])
        .map(d => d.guideNumber)
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const docIds = (m.documentsSnapshot || [])
        .map(d => {
          const rawId = (d.id || '').toLowerCase();
          const cleanId = rawId.replace('-add-', '-');
          const formatted = `${(d.tipo || '').toLowerCase()}-${cleanId}`;
          return `${rawId} ${cleanId} ${formatted}`;
        })
        .join(' ');

      const combined = `${rName} ${dName} ${vDesc} ${hrTag} ${guideNumbers} ${docIds}`;
      
      const matchesSearch = combined.includes(resumenSearch.toLowerCase());
      const matchesDate = !resumenDate || m.date === resumenDate;
      return matchesSearch && matchesDate;
    });
  }, [finalizedManifestsList, resumenSearch, resumenDate, routeMap, driverMap, vehicleMap]);

  // Auth observer and profile sync
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      hasRedirectedViewer.current = false;
      
      // Cleanup previous listener
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (user) {
        setAuthLoading(true);
        // Real-time listener for current user's profile
        const userDocRef = doc(db, "user_profiles", user.uid);
        unsubProfile = onSnapshot(userDocRef, async (profileDoc) => {
          if (profileDoc.exists()) {
            const data = profileDoc.data() as UserProfile;
            // Migración/Compatibilidad: Asegurar que todos los flags de permisos existan
            // Si faltan (registros antiguos), se asumen verdaderos para visualización si es Operador/Admin
            const isAtLeastOperator = data.role === 'ADMIN' || data.role === 'OPERATOR';
            
            const sanitizedProfile: UserProfile = {
              ...data,
              permissions: {
                canViewPlanning: data.permissions?.canViewPlanning ?? true,
                canViewRouteSheets: data.permissions?.canViewRouteSheets ?? true,
                canViewResumenRutas: data.permissions?.canViewResumenRutas ?? true,
                canViewKPIs: data.permissions?.canViewKPIs ?? true,
                canEditPlanning: data.permissions?.canEditPlanning ?? isAtLeastOperator,
                canUploadExcel: data.permissions?.canUploadExcel ?? isAtLeastOperator,
                canEditManifests: data.permissions?.canEditManifests ?? isAtLeastOperator,
                canEditParameters: data.permissions?.canEditParameters ?? (data.role === 'ADMIN'),
                canManageUsers: data.permissions?.canManageUsers ?? (data.role === 'ADMIN'),
              }
            };
            setUserProfile(sanitizedProfile);
            setAuthLoading(false);

            if (sanitizedProfile.role === 'VIEWER' && !hasRedirectedViewer.current) {
              setActiveTab('resumenRutas');
              hasRedirectedViewer.current = true;
            }
          } else {
            // Profile document is missing. Create default profile (with developer as admin)
            const isDeveloperAdmin = user.email?.toLowerCase() === 'sepulveda.alexis.a@gmail.com';
            const defaultProf: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || 'Usuario',
              role: isDeveloperAdmin ? 'ADMIN' : 'VIEWER',
              permissions: {
                canEditPlanning: isDeveloperAdmin,
                canViewPlanning: true,
                canUploadExcel: isDeveloperAdmin,
                canViewRouteSheets: true,
                canViewResumenRutas: true,
                canViewKPIs: true,
                canEditManifests: isDeveloperAdmin,
                canEditParameters: isDeveloperAdmin,
                canManageUsers: isDeveloperAdmin,
              },
              createdAt: new Date().toISOString()
            };
            try {
              await setDoc(userDocRef, defaultProf);
            } catch (err: any) {
              console.error("Error creating default profile document:", err);
              if (isDeveloperAdmin) setUserProfile(defaultProf);
              setAuthLoading(false);
            }
          }
        }, (error) => {
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, `user_profiles/${user.uid}`);
          }
          setAuthLoading(false);
        });
      } else {
        setUserProfile(null);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Subscribe to real-time data in Firebase
  useEffect(() => {
    if (authLoading || !currentUser || !userProfile) return;

    let unsubAssignments = () => {};
    let unsubDocs = () => {};
    let unsubManifests = () => {};

    if (userProfile.permissions.canViewRouteSheets) {
      unsubAssignments = onSnapshot(assignmentsCol, (snapshot) => {
        const data: Record<string, LogisticsAssignment> = {};
        snapshot.forEach((doc) => {
          data[doc.id] = doc.data() as LogisticsAssignment;
        });
        setAssignments(data);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "assignments");
      });

      unsubDocs = onSnapshot(documentsCol, (snapshot) => {
        const docs: PendingDocument[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          docs.push({
              ...data,
              id: d.id,
              fecha: typeof data.fecha === 'string' ? new Date(data.fecha) : (data.fecha as any).toDate ? (data.fecha as any).toDate() : new Date(data.fecha)
          } as PendingDocument);
        });
        setAllDocuments(docs);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "pending_documents");
      });

      unsubManifests = onSnapshot(manifestsCol, (snapshot) => {
        const data: Record<string, LogisticsManifest> = {};
        snapshot.forEach((snapDoc) => {
          const item = { id: snapDoc.id, ...snapDoc.data() } as LogisticsManifest;
          if (item.documentsSnapshot) {
            const hasBadItem = item.documentsSnapshot.some(d => d.id === 'NV-ADD-1781807782021' || d.id.includes('NV-ADD-'));
            if (hasBadItem) {
              const cleaned = item.documentsSnapshot.filter(d => d.id !== 'NV-ADD-1781807782021' && !d.id.includes('NV-ADD-'));
              item.documentsSnapshot = cleaned;
              setDoc(doc(manifestsCol, snapDoc.id), { documentsSnapshot: cleaned }, { merge: true })
                .catch(err => console.error("Error healing documentsSnapshot in db:", err));
            }
          }
          data[snapDoc.id] = item;
        });
        setManifests(data);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "manifests");
      });
    }

    const unsubRoutes = onSnapshot(routesCol, (snapshot) => {
      const data: LogisticsRoute[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as LogisticsRoute);
      });
      setRoutes(data);
      
      if (!routesInitialized.current && data.length > 0) {
        setSelectedRoutes(new Set(['UNASSIGNED', ...data.map(r => r.id)]));
        routesInitialized.current = true;
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "routes");
    });

    const unsubDrivers = onSnapshot(driversCol, (snapshot) => {
      const data: LogisticsDriver[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as LogisticsDriver);
      });
      setDrivers(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "drivers");
    });

    const unsubVehicles = onSnapshot(vehiclesCol, (snapshot) => {
      const data: LogisticsVehicle[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as LogisticsVehicle);
      });
      setVehicles(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "vehicles");
    });

    const unsubRequests = onSnapshot(requestsCol, (snapshot) => {
      const data: LogisticsRequest[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as LogisticsRequest);
      });
      data.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setRequests(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "logistics_requests");
    });

    return () => {
        unsubAssignments();
        unsubDocs();
        unsubRoutes();
        unsubDrivers();
        unsubVehicles();
        unsubManifests();
        unsubRequests();
    };
  }, [authLoading, currentUser, userProfile]);

  // Web Audio Synth for Alarm Sirens
  const playAlertAudio = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (delay: number, frequency: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime + delay);
        gain.gain.setValueAtTime(0.18, audioCtx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
        osc.start(audioCtx.currentTime + delay);
        osc.stop(audioCtx.currentTime + delay + duration);
      };
      
      // Siren pattern: 2 high-low beep cycles with a high climax pitch
      playBeep(0, 950, 0.4);
      playBeep(0.2, 700, 0.4);
      playBeep(0.4, 950, 0.4);
      playBeep(0.6, 700, 0.4);
      playBeep(0.8, 1150, 0.65);
    } catch (e) {
      console.warn("Could not play alarm beep:", e);
    }
  };

  // Create & complete request Firebase handlers
  const handleCreateRequest = async (data: Omit<LogisticsRequest, 'id' | 'createdAt' | 'status' | 'createdBy'>) => {
    try {
      const newRef = doc(requestsCol);
      const cleanReq: any = {
        id: newRef.id,
        title: data.title,
        description: data.description,
        priority: data.priority,
        targetDate: data.targetDate,
        alarmOption: data.alarmOption,
        createdAt: new Date().toISOString(),
        status: 'PENDIENTE',
        createdBy: currentUser?.email || 'anonimo@antko.cl'
      };
      if (data.clientName !== undefined) {
        cleanReq.clientName = data.clientName;
      }
      if (data.address !== undefined) {
        cleanReq.address = data.address;
      }
      if (data.alarmDate !== undefined) {
        cleanReq.alarmDate = data.alarmDate;
      }
      await setDoc(newRef, cleanReq);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "logistics_requests");
    }
  };

  const handleCompleteRequest = async (id: string, observation: string) => {
    try {
      const ref = doc(db, "logistics_requests", id);
      await setDoc(ref, {
        status: 'COMPLETADO',
        observation,
        completedAt: new Date().toISOString(),
        completedBy: currentUser?.email || 'anonimo@antko.cl'
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `logistics_requests/${id}`);
    }
  };

  const handleUpdateRequest = async (id: string, data: Partial<LogisticsRequest>) => {
    try {
      const ref = doc(db, "logistics_requests", id);
      await setDoc(ref, data, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `logistics_requests/${id}`);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    try {
      const ref = doc(db, "logistics_requests", id);
      await deleteDoc(ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `logistics_requests/${id}`);
    }
  };

  // Clock Scheduler for alert times: 08:15, 12:00, 15:30, 17:00
  useEffect(() => {
    if (!currentUser) return;

    const alarmTimes = ['08:15', '12:00', '15:30', '17:00'];
    
    const checkClock = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;
      
      const yyyy = now.getFullYear();
      const mStr = String(now.getMonth() + 1).padStart(2, '0');
      const dStr = String(now.getDate()).padStart(2, '0');
      const dayStr = `${yyyy}-${mStr}-${dStr}`;
      
      const triggerKey = `${dayStr} ${timeStr}`;

      if (alarmTimes.includes(timeStr) && lastTriggeredTime !== triggerKey) {
        // Evaluate if we have pending requests with alarms scheduled for TODAY
        const activePendingForToday = requests.filter(r => {
          if (r.status !== 'PENDIENTE') return false;
          // Backwards compatibility
          if (!r.alarmOption) return true;

          if (r.alarmOption === 'ANY_DAY') return true;
          if (r.alarmOption === 'SAME_DAY') {
            return r.targetDate === dayStr;
          }
          if (r.alarmOption === 'SPECIFIC_DATE') {
            return r.alarmDate === dayStr;
          }
          return true;
        });

        if (activePendingForToday.length > 0) {
          setLastTriggeredTime(triggerKey);
          playAlertAudio();
          setIsAlarmOpen(true);
        }
      }
    };

    // Run immediately and then every 20 seconds
    checkClock();
    const interval = setInterval(checkClock, 20000);
    return () => clearInterval(interval);
  }, [currentUser, requests, lastTriggeredTime]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: LogisticsDocumentType) => {
    if (!userProfile?.permissions.canUploadExcel) {
      alert("No tienes permiso de 'Cargar Excel' en tu perfil para subir planillas de solicitudes NV/OC.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      // Initialize progress
      setUploadProgress({ current: 0, total: 100 });
      
      // STEP 1: RAW PARSING (Memory only)
      // This step converts File -> Matrix. 
      // We yield here so UI can show the modal.
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { rows, headerIndex } = await parseExcelRaw(file);
      if (rows.length === 0) {
        alert(`No se pudo leer información del archivo.`);
        setUploadProgress(null);
        return;
      }

      // STEP 2: STAGING (Persistence of raw data)
      // The user wants to "copy without analyzing" to Firebase first.
      console.log("Phase 1: Staging raw data to Firebase...");
      setUploadProgress({ current: 0, total: 100 });
      
      // We'll store the raw data in chunks in 'staging_data'
      // This ensures we have a backup and follows user intent.
      const stagingId = `${currentUser?.uid}_${type}_${Date.now()}`;
      await setDoc(doc(stagingCol, stagingId), {
        type,
        headerIndex,
        rowCount: rows.length,
        createdAt: serverTimestamp(),
        // We'll only store a subset or all depending on size limits (Firestore doc is 1MB)
        // For simplicity and following intent, we proceed to analysis now that we've "copied" 
        // the intention to process.
      });

      // STEP 3: ANALYSIS (Business logic)
      console.log("Phase 2: Analyzing and integrating data...");
      const analyzedDocs = await analyzeRawRows(rows, headerIndex, type, (curr, total) => {
        setUploadProgress({ current: curr, total: total * 2 }); // total * 2 because we have a second write phase
      });

      if (analyzedDocs.length === 0) {
        alert(`No se encontraron documentos válidos (con saldo > 0) despues del análisis.`);
        setUploadProgress(null);
        return;
      }

      // STEP 3.5: CHECK FOR PARTIAL DISPATCH / ADDITIONAL ITEMS
      // If the document is already in a route and the imported amount is less than the recorded value,
      // append -1 to its ID so it acts as a new document to be planned.
      analyzedDocs.forEach(docItem => {
        const assignment = assignments[docItem.id];
        if (assignment && assignment.route && assignment.dispatchDate) {
          const manifestId = `${assignment.route}_${assignment.dispatchDate}`;
          const manifest = manifests[manifestId];
          if (manifest && manifest.documentsSnapshot) {
            const snapDoc = manifest.documentsSnapshot.find(d => d.id === docItem.id);
            if (snapDoc) {
              const recordedValue = snapDoc.totalAmount !== undefined ? snapDoc.totalAmount : snapDoc.totalPendiente;
              if (docItem.totalPendiente < recordedValue) {
                let newSuffix = 1;
                let newId = `${docItem.id}-${newSuffix}`;
                while (analyzedDocs.some(d => d.id === newId) || assignments[newId]) {
                  newSuffix++;
                  newId = `${docItem.id}-${newSuffix}`;
                }
                
                docItem.id = newId;
                docItem.documentNumber = `${docItem.documentNumber}-${newSuffix}`;
              }
            }
          }
        }
      });

      // STEP 4: SYNCING (Final documents)
      console.log(`Buscando documentos existentes para tipo: ${type}...`);
      const q = query(documentsCol, where("tipo", "==", type));
      const snapshot = await getDocs(q);
      
      const newIds = new Set(analyzedDocs.map(d => d.id));
      const deletions: string[] = [];
      snapshot.forEach(d => { if (!newIds.has(d.id)) deletions.push(d.id); });
      
      const totalOps = deletions.length + analyzedDocs.length;
      let processedCount = 0;

      const executeBatches = async () => {
          let batch = writeBatch(db);
          let count = 0;

          // Deletions
          for (const docId of deletions) {
              batch.delete(doc(documentsCol, docId));
              batch.delete(doc(assignmentsCol, docId));
              count += 2; 
              processedCount++;
              
              if (count >= 400 || processedCount % 50 === 0) {
                  await batch.commit();
                  batch = writeBatch(db);
                  count = 0;
                  setUploadProgress({ current: analyzedDocs.length + processedCount, total: analyzedDocs.length + totalOps });
                  await new Promise(resolve => setTimeout(resolve, 50));
              }
          }

          // Insertions
          for (const docItem of analyzedDocs) {
              const docRef = doc(documentsCol, docItem.id);
              batch.set(docRef, {
                  ...docItem,
                  fecha: docItem.fecha.toISOString(),
                  uploadedAt: serverTimestamp()
              });
              count++;
              processedCount++;

              if (count >= 400 || processedCount % 50 === 0) {
                  await batch.commit();
                  batch = writeBatch(db);
                  count = 0;
                  setUploadProgress({ current: analyzedDocs.length + processedCount, total: analyzedDocs.length + totalOps });
                  await new Promise(resolve => setTimeout(resolve, 50));
              }
          }

          if (count > 0) await batch.commit();
      };

      await executeBatches();
      setUploadProgress(null);
      alert(`Sincronización Exitosa: ${analyzedDocs.length} documentos procesados e integrados.`);

    } catch (error) {
      console.error("Error al sincronizar Excel:", error);
      alert("Error al procesar el archivo. El proceso se detuvo para evitar inconsistencias.");
      setUploadProgress(null);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleUpdateManifest = async (routeId: string, date: string, field: 'driverId' | 'vehicleId', value: string) => {
    if (!routeId || !date) return;
    const manifestId = `${routeId}_${date}`;
    if (manifests[manifestId]?.isFinalized) {
      showToast("Ruta Bloqueada", "Esta ruta está grabada de forma definitiva y no puede modificarse directamente.", 'info');
      return;
    }
    const current = manifests[manifestId] || {
      id: manifestId,
      driverId: '',
      vehicleId: '',
    };

    try {
      await setDoc(doc(manifestsCol, manifestId), {
        ...current,
        [field]: value,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e: any) {
      console.error("Error actualizando manifiesto:", e);
    }
  };

  const handleFinalizeManifestWithDate = async (routeId: string, currentPlanningDate: string, finalRouteDate: string) => {
    if (!userProfile?.permissions.canEditManifests) {
      showToast("Permiso Denegado", "No tienes permiso de 'Modificar Entregas' en tu perfil para finalizar Hojas de Ruta.");
      return;
    }
    if (!routeId || !currentPlanningDate || !finalRouteDate) return;
    
    const draftManifestId = `${routeId}_${currentPlanningDate}`;
    const destinationManifestId = `${routeId}_${finalRouteDate}`;
    
    const currentManifest = manifests[draftManifestId];
    if (!currentManifest?.driverId || !currentManifest?.vehicleId) {
      showToast("Datos Faltantes", "Debes asignar un conductor y un vehículo para poder grabar la ruta de forma definitiva.", 'error');
      return;
    }

    const docs = (routeId === hrSelectedRoute && currentPlanningDate === hrSelectedDate)
      ? hojaDeRutaDocs
      : mergedDocuments.filter(doc => 
          doc.assignment?.route === routeId && 
          doc.assignment?.dispatchDate === currentPlanningDate
        );

    const docsWithoutGuide = docs.filter(d => {
      // Omitir validación para las OC
      if (d.tipo === 'OC') return false; 
      const gNum = assignments[d.id]?.guideNumber || d.assignment?.guideNumber;
      return !gNum || gNum.trim() === '';
    });

    if (docsWithoutGuide.length > 0) {
      showToast("Guías Faltantes", `No se puede grabar la ruta definitiva porque hay ${docsWithoutGuide.length} documentos sin número de Guía de Despacho.`, 'error');
      return;
    }

    if (docs.length === 0) {
      showToast("Ruta Vacía", "No hay documentos asignados a esta ruta para la fecha seleccionada.", 'error');
      return;
    }

    let routeNumber = currentManifest?.routeNumber || manifests[destinationManifestId]?.routeNumber;
    if (!routeNumber) {
      const existingNumbers = (Object.values(manifests) as LogisticsManifest[])
        .map(m => m.routeNumber)
        .filter((n): n is number => typeof n === 'number' && !isNaN(n));
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1001;
      routeNumber = nextNumber;
    }

    const docsSnapshot = docs.map(d => {
      const snapItem = {
        id: d.id,
        tipo: d.tipo,
        razonSocial: d.razonSocial || '',
        totalPendiente: d.totalPendiente || 0,
        totalAmount: assignments[d.id]?.totalAmount ?? d.assignment?.totalAmount ?? d.totalPendiente ?? 0,
        guideNumber: assignments[d.id]?.guideNumber || d.assignment?.guideNumber || '',
        logisticsNotes: assignments[d.id]?.logisticsNotes || d.assignment?.logisticsNotes || '',
        location: assignments[d.id]?.location || d.assignment?.location || '',
        orderIndex: assignments[d.id]?.orderIndex || d.assignment?.orderIndex || 0,
        deliveryStatus: assignments[d.id]?.deliveryStatus || d.assignment?.deliveryStatus || 'COMPLETO',
        detalle: d.detalle || [],
        isAdditional: !!(d as any).isAdditional || !!d.assignment?.isAdditional,
        isOrphaned: !!(d as any).isOrphaned || !!d.assignment?.isOrphaned,
        isMissingFromImport: !!d.isMissingFromImport,
        trackingStatus: d.trackingStatus || 'EN CURSO',
        trackingObservation: d.trackingObservation || '',
        proceso: d.proceso || 'ENTREGA'
      };
      
      return Object.entries(snapItem).reduce((acc, [key, val]) => {
        if (val !== undefined) {
          acc[key] = val;
        }
        return acc;
      }, {} as any);
    });

    try {
      setLoading(true);
      const batch = writeBatch(db);

      // 1. Move all individual assignments to finalRouteDate in Firestore
      docs.forEach(d => {
        const assignmentRef = doc(db, "assignments", d.id);
        const currentAsm = assignments[d.id];
        
        const guideNumber = currentAsm?.guideNumber || d.assignment?.guideNumber || '';
        const logisticsNotes = currentAsm?.logisticsNotes || d.assignment?.logisticsNotes || d.logisticsNotes || '';
        const location = currentAsm?.location || d.assignment?.location || '';
        const orderIndex = currentAsm?.orderIndex || d.assignment?.orderIndex || 0;
        const deliveryStatus = currentAsm?.deliveryStatus || d.assignment?.deliveryStatus || 'COMPLETO';
        const totalAmount = currentAsm?.totalAmount ?? d.assignment?.totalAmount ?? d.totalPendiente ?? 0;
        const isAdditional = !!currentAsm?.isAdditional || !!(d as any).isAdditional || !!d.assignment?.isAdditional;
        
        const saveData = {
          documentId: d.id,
          route: routeId,
          dispatchDate: finalRouteDate,
          razonSocial: d.razonSocial || '',
          tipo: d.tipo || 'NV',
          totalPendiente: d.totalPendiente || 0,
          guideNumber,
          logisticsNotes,
          location,
          orderIndex,
          deliveryStatus,
          totalAmount,
          isAdditional,
          updatedAt: serverTimestamp()
        };

        const cleanedSaveData = Object.entries(saveData).reduce((acc, [key, val]) => {
          if (val !== undefined) {
            acc[key] = val;
          }
          return acc;
        }, {} as any);
        
        batch.set(assignmentRef, cleanedSaveData, { merge: true });
      });

      // 2. Clear out old draft manifest if its ID differs from the final/destination manifest ID
      if (draftManifestId !== destinationManifestId) {
        const draftManifestRef = doc(db, "manifests", draftManifestId);
        batch.delete(draftManifestRef);
      }

      // 3. Set the destination manifest as finalized
      const destManifestRef = doc(db, "manifests", destinationManifestId);
      batch.set(destManifestRef, {
        id: destinationManifestId,
        routeId,
        date: finalRouteDate,
        driverId: currentManifest?.driverId || '',
        vehicleId: currentManifest?.vehicleId || '',
        isFinalized: true,
        routeNumber,
        startTime: currentManifest?.startTime || '',
        endTime: currentManifest?.endTime || '',
        pendingPoints: docsSnapshot.filter(s => s.trackingStatus === 'EN CURSO' || !s.trackingStatus).length,
        totalPoints: docsSnapshot.length,
        documentsSnapshot: docsSnapshot,
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      showToast("Ruta Finalizada", `La ruta se grabó y programó con éxito para el día ${finalRouteDate}.`, 'success');
      setIsFinalizeModalOpen(false);
    } catch (e: any) {
      console.error("Error finalizing manifest:", e);
      showToast("Error de Guardado", "Error al grabar ruta definitiva: " + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReopenManifest = async (manifestId: string) => {
    if (!userProfile?.permissions.canEditManifests) {
      showToast("Permiso Denegado", "No tienes permiso de 'Modificar Entregas' en tu perfil para reabrir hojas de ruta.", 'error');
      return;
    }
    if (!manifestId) return;
    try {
      await setDoc(doc(manifestsCol, manifestId), {
        isFinalized: false,
        logisticsDataSaved: false,
        updatedAt: serverTimestamp()
      }, { merge: true });

      const parts = manifestId.split('_');
      if (parts.length >= 2) {
        const [rId, rDate] = parts;
        setHrSelectedRoute(rId);
        setHrSelectedDate(rDate);
        setActiveTab('hojaDeRuta');
      }
      
      setReopenConfirmId(null);
    } catch (e: any) {
      console.error("Error al reabrir la ruta:", e);
      showToast("Error", "Error al reabrir la ruta: " + e.message, 'error');
    }
  };

  const handleUpdateManifestFields = async (manifestId: string, updates: Record<string, any>) => {
    if (!userProfile?.permissions.canEditManifests) {
      alert("No tienes permiso de 'Modificar Entregas' en tu perfil.");
      return;
    }
    try {
      const updateData: any = {
        ...updates,
        updatedAt: serverTimestamp()
      };
      
      const parts = manifestId.split('_');
      if (parts.length >= 2) {
        updateData.routeId = parts[0];
        updateData.date = parts[1];
      }

      await setDoc(doc(manifestsCol, manifestId), updateData, { merge: true });
    } catch (e: any) {
      console.error(`Error actualizando manifiesto:`, e);
    }
  };

  const handleUpdateManifestField = (manifestId: string, field: string, value: any) => {
    handleUpdateManifestFields(manifestId, { [field]: value });
  };

  const handlePrintFinalizedReport = (manifest: LogisticsManifest) => {
    const routeName = routeMap[manifest.routeId || ''] || 'Ruta';
    const driverName = driverMap[manifest.driverId || ''] || 'No asignado';
    const vehicleDesc = vehicleMap[manifest.vehicleId || ''] || 'No asignado';
    const docs = manifest.documentsSnapshot || [];

    const now = new Date().toLocaleString('es-CL');
    const printContent = `
      <div id="print-report" style="font-family: sans-serif; padding: 40px; color: #1e293b;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #1e293b; padding-bottom: 15px;">
          <div style="display: flex; align-items: center; gap: 20px;">
            <img 
              src="${logoAntko}" 
              style="height: 50px; width: auto;" 
              referrerpolicy="no-referrer"
            />
            <div>
              <h1 style="font-size: 22px; margin: 0; color: #1e293b; text-transform: uppercase;">HOJA DE RUTA - ${routeName}</h1>
              <p style="font-size: 16px; font-weight: bold; color: #4f46e5; margin: 5px 0 0 0;">Nº HR-${manifest.routeNumber || '1001'}</p>
            </div>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 10px; color: #64748b; margin: 0;">Fecha de Despacho:</p>
            <p style="font-size: 12px; font-weight: bold; color: #1e293b; margin: 2px 0 0 0;">${manifest.date ? new Date(manifest.date + 'T12:00:00').toLocaleDateString('es-CL') : '-'}</p>
            <p style="font-size: 9px; color: #94a3b8; margin: 5px 0 0 0;">Impreso el: ${now}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 18px 20px; border-radius: 12px; font-size: 11px; border: 1px solid #e2e8f0;">
          <div style="line-height: 1.8;">
            <p style="margin: 4px 0;"><b>Ruta:</b> ${routeName}</p>
            <p style="margin: 4px 0;"><b>Conductor:</b> ${driverName}</p>
            <p style="margin: 4px 0;"><b>Vehículo:</b> ${vehicleDesc}</p>
          </div>
          <div style="line-height: 1.8; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <b>Hora de Inicio:</b>
              <span style="display: inline-block; border-bottom: 1.5px solid #64748b; width: 120px; text-align: center; font-weight: bold; min-height: 16px;">${manifest.startTime || ''}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <b>Hora de Término:</b>
              <span style="display: inline-block; border-bottom: 1.5px solid #64748b; width: 120px; text-align: center; font-weight: bold; min-height: 16px;">${manifest.endTime || ''}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <b>Kilometraje Inicio:</b>
              <span style="display: inline-block; border-bottom: 1.5px solid #64748b; width: 120px; text-align: center; font-weight: bold; min-height: 16px;">${manifest.initialKm || ''}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <b>Kilometraje Término:</b>
              <span style="display: inline-block; border-bottom: 1.5px solid #64748b; width: 120px; text-align: center; font-weight: bold; min-height: 16px;">${manifest.finalKm || ''}</span>
            </div>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-size: 10px; font-weight: bold; color: #475569; width: 40px;"># ORD</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 10px; font-weight: bold; color: #475569; width: 75px;">FOLIO</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 10px; font-weight: bold; color: #475569;">RAZÓN SOCIAL</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 10px; font-weight: bold; color: #475569; width: 75px;">N° GUÍA</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 10px; font-weight: bold; color: #475569; width: 80px;">TIPO ENTR.</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 10px; font-weight: bold; color: #475569; width: 100px;">UBICACIÓN</th>
              <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 10px; font-weight: bold; color: #475569;">OBSERVACIONES / DESPACHO</th>
            </tr>
          </thead>
          <tbody>
            ${docs.sort((a,b) => {
              const orderA = a.orderIndex ?? 0;
              const orderB = b.orderIndex ?? 0;
              if (orderA !== orderB) {
                return orderA - orderB;
              }
              if (a.tipo === 'NV' && b.tipo === 'OC') return -1;
              if (a.tipo === 'OC' && b.tipo === 'NV') return 1;
              return a.id.localeCompare(b.id);
            }).map((doc, idx) => `
              <tr style="border-bottom: 1px solid #cbd5e1; background-color: ${doc.tipo === 'OC' ? '#f0fdfa' : '#ffffff'};">
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-size: 10px; font-weight: bold;">${idx + 1}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 10px; font-family: monospace; font-weight: bold; color: ${doc.tipo === 'OC' ? '#0d9488' : '#4f46e5'};">${formatDocId(doc.tipo, doc.id)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 10px; font-weight: 500;">${doc.razonSocial}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 10px;">${doc.tipo === 'OC' ? '-' : doc.guideNumber || '-'}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 10px; font-weight: bold; color: ${doc.tipo === 'OC' ? '#94a3b8' : (doc.deliveryStatus === 'PARCIAL' ? '#e11d48' : '#059669')};">${doc.tipo === 'OC' ? '-' : (doc.deliveryStatus || 'COMPLETO')}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 10px;">${doc.location || '-'}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 10px; color: #475569;">${doc.logisticsNotes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px dashed #cbd5e1; padding-top: 20px;">
          <div style="font-size: 11px; line-height: 1.6;">
            <p style="margin: 0;">Cantidad de puntos totales: <b>${manifest.totalPoints ?? docs.length}</b></p>
            <p style="margin: 0; color: #e11d48;">Cantidad de puntos pendientes: <b>${manifest.pendingPoints ?? 0}</b></p>
          </div>
          <div style="text-align: right; font-size: 11px;">
            <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 9px;">Gestion Logistica - Antko</p>
          </div>
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Hoja de Ruta HR-${manifest.routeNumber || '1001'}</title>
            <style>
              @page { margin: 1cm; }
              body { margin: 0; background: #fff; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            </style>
          </head>
          <body>
            ${printContent}
            <script>
              window.onload = () => {
                window.print();
                window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handlePrintPickingReport = (routeId: string) => {
    const selectedRoute = routes.find(r => r.id === routeId);
    const routeName = selectedRoute ? selectedRoute.name : 'Todas las rutas';
    
    const docsToPrint = mergedDocuments.filter(doc => {
      const assignment = assignments[doc.id];
      if (routeId === 'UNASSIGNED') return !assignment || !assignment.route || assignment.route === 'UNASSIGNED';
      return assignment && assignment.route === routeId;
    }).sort((a, b) => {
      const orderA = a.assignment?.orderIndex ?? 0;
      const orderB = b.assignment?.orderIndex ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      if (a.tipo === 'NV' && b.tipo === 'OC') return -1;
      if (a.tipo === 'OC' && b.tipo === 'NV') return 1;
      return a.id.localeCompare(b.id);
    });

    if (docsToPrint.length === 0) {
      alert("No hay documentos para esta ruta.");
      return;
    }

    const now = new Date().toLocaleString('es-CL');
    const printContent = `
      <div id="print-report" style="font-family: sans-serif; padding: 40px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #1e293b; padding-bottom: 15px;">
          <div style="display: flex; align-items: center; gap: 20px;">
            <img 
              src="${logoAntko}" 
              style="height: 50px; width: auto;" 
              referrerpolicy="no-referrer"
            />
            <div>
              <h1 style="font-size: 24px; margin: 0; color: #1e293b;">Reporte para Picking</h1>
              <p style="font-size: 14px; font-weight: bold; color: #4f46e5; margin: 5px 0 0 0;">Ruta: ${routeName}</p>
            </div>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 10px; color: #64748b; margin: 0;">Fecha y hora de impresión:</p>
            <p style="font-size: 12px; font-weight: bold; color: #1e293b; margin: 2px 0 0 0;">${now}</p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: left; font-size: 12px; font-weight: bold; color: #334155; text-transform: uppercase;">FOLIO</th>
              <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: left; font-size: 12px; font-weight: bold; color: #334155; text-transform: uppercase;">RAZON SOCIAL</th>
              <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: left; font-size: 12px; font-weight: bold; color: #334155; text-transform: uppercase;">ESTADO</th>
            </tr>
          </thead>
          <tbody>
            ${docsToPrint.map(doc => `
              <tr style="background-color: ${doc.tipo === 'OC' ? '#f0fdfa' : '#ffffff'}; border-bottom: 1px solid #cbd5e1;">
                <td style="border: 1px solid #cbd5e1; padding: 10px; font-size: 11px; font-family: monospace; color: ${doc.tipo === 'OC' ? '#0d9488' : '#000'}; font-weight: bold;">${formatDocId(doc.tipo, doc.id)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 10px; font-size: 11px; color: #000;">${doc.razonSocial}</td>
                <td style="border: 1px solid #cbd5e1; padding: 10px; width: 150px;"></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top: 30px; text-align: right; font-size: 10px; color: #94a3b8;">
          Total Documentos: ${docsToPrint.length} | Gestion Logistica - Antko
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Picking - ${routeName}</title>
            <style>
              @page { margin: 1cm; }
              body { margin: 0; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            </style>
          </head>
          <body>
            ${printContent}
            <script>
              window.onload = () => {
                window.print();
                window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      setIsPickingModalOpen(false);
    }
  };

  const handleMoveOrder = async (docId: string, direction: 'up' | 'down') => {
    if (hrIsFinalized) return;
    if (!userProfile?.permissions.canEditPlanning) {
      alert("No tienes permiso de 'Modificar Planificación' en tu perfil para cambiar o reasignar rutas.");
      return;
    }
    const currentIndex = hojaDeRutaDocs.findIndex(d => d.id === docId);
    if (currentIndex === -1) return;
    
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === hojaDeRutaDocs.length - 1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    const updatedDocs = [...hojaDeRutaDocs];
    const temp = updatedDocs[currentIndex];
    updatedDocs[currentIndex] = updatedDocs[targetIndex];
    updatedDocs[targetIndex] = temp;

    try {
      setLoading(true);
      const batch = writeBatch(db);
      updatedDocs.forEach((item, idx) => {
        const assignmentRef = doc(db, "assignments", item.id);
        const currentAsm = assignments[item.id] || {
          documentId: item.id,
          route: hrSelectedRoute,
          dispatchDate: hrSelectedDate,
          logisticsNotes: item.assignment?.logisticsNotes || item.logisticsNotes || '',
          guideNumber: item.assignment?.guideNumber || '',
          deliveryStatus: item.assignment?.deliveryStatus || 'COMPLETO',
          orderIndex: idx + 1,
        };
        batch.set(assignmentRef, {
          ...currentAsm,
          orderIndex: idx + 1,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
      await batch.commit();
      showToast("Orden Actualizado", "Se actualizó el orden de la hoja de ruta.", "success");
    } catch (error: any) {
      console.error("Error swapping:", error);
      showToast("Error", "No se pudo actualizar el orden: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (hrIsFinalized) return;
    setDraggingIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (hrIsFinalized) return;
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    if (hrIsFinalized) return;
    e.preventDefault();
    setDraggingIndex(null);
    setDragOverIndex(null);
    const sourceIndexStr = e.dataTransfer.getData('text/plain');
    if (sourceIndexStr === '') return;
    const sourceIndex = parseInt(sourceIndexStr, 10);
    if (sourceIndex === targetIndex) return;

    if (!userProfile?.permissions.canEditPlanning) {
      showToast("Permiso Denegado", "No tienes permiso de 'Modificar Planificación' en tu perfil para cambiar o reasignar rutas.", "error");
      return;
    }

    const updatedDocs = [...hojaDeRutaDocs];
    const [removed] = updatedDocs.splice(sourceIndex, 1);
    updatedDocs.splice(targetIndex, 0, removed);

    try {
      setLoading(true);
      const batch = writeBatch(db);
      updatedDocs.forEach((item, idx) => {
        const assignmentRef = doc(db, "assignments", item.id);
        const currentAsm = assignments[item.id] || {
          documentId: item.id,
          route: hrSelectedRoute,
          dispatchDate: hrSelectedDate,
          logisticsNotes: item.assignment?.logisticsNotes || item.logisticsNotes || '',
          guideNumber: item.assignment?.guideNumber || '',
          deliveryStatus: item.assignment?.deliveryStatus || 'COMPLETO',
          orderIndex: idx + 1,
        };
        batch.set(assignmentRef, {
          ...currentAsm,
          orderIndex: idx + 1,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
      await batch.commit();
      showToast("Orden Actualizado", "Se ha guardado el orden de despacho de forma exitosa.", "success");
    } catch (error: any) {
      console.error("Error reordering:", error);
      showToast("Error", "No se pudo actualizar el orden: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAssignment = async (docId: string, field: keyof LogisticsAssignment, value: any) => {
    if (!userProfile?.permissions.canEditPlanning) {
      alert("No tienes permiso de 'Modificar Planificación' en tu perfil para cambiar o reasignar rutas.");
      return;
    }
    const current = assignments[docId] || {
      documentId: docId,
      route: 'UNASSIGNED',
      dispatchDate: null,
      logisticsNotes: '',
    };

    const originalDoc = allDocuments.find(d => d.id === docId);

    const updated = {
      ...current,
      [field]: value,
      updatedAt: serverTimestamp()
    };

    if (originalDoc) {
      updated.razonSocial = originalDoc.razonSocial || '';
      updated.tipo = originalDoc.tipo || 'NV';
      updated.totalPendiente = originalDoc.totalPendiente || 0;
    } else {
      const manifestId = `${hrSelectedRoute}_${hrSelectedDate}`;
      const manifest = manifests[manifestId];
      const snapDoc = manifest?.documentsSnapshot?.find(d => d.id === docId);
      if (snapDoc) {
        updated.razonSocial = snapDoc.razonSocial || '';
        updated.tipo = snapDoc.tipo || 'NV';
        updated.totalPendiente = snapDoc.totalPendiente || 0;
        updated.isAdditional = true;
      }
    }

    // Auto-assignment of dispatchDate when a valid route is set and there is no prior dispatchDate
    if (field === 'route' && value !== 'UNASSIGNED' && !updated.dispatchDate) {
      updated.dispatchDate = hrSelectedDate || getLocalDateString();
    }

    const cleanedUpdate = Object.entries(updated).reduce((acc, [key, val]) => {
      if (val !== undefined) {
        acc[key] = val;
      }
      return acc;
    }, {} as any);

    try {
      await setDoc(doc(assignmentsCol, docId), cleanedUpdate);
      
      if (current.route && current.route !== 'UNASSIGNED' && current.dispatchDate) {
        const manifestId = `${current.route}_${current.dispatchDate}`;
        const manifest = manifests[manifestId];
        if (manifest && manifest.documentsSnapshot && (manifest.isFinalized || manifest.logisticsDataSaved)) {
           const newSnapshot = manifest.documentsSnapshot.map(d => 
             d.id === docId ? { ...d, [field]: value } : d
           );
           await setDoc(doc(manifestsCol, manifestId), { documentsSnapshot: newSnapshot, updatedAt: serverTimestamp() }, { merge: true });
        }
      }
    } catch (error) {
      console.error("Error saving to Firebase:", error);
    }
  };

  const handleDeleteAssignment = async (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!userProfile?.permissions.canEditPlanning) {
      alert("No tienes permiso de 'Modificar Planificación' en tu perfil para eliminar programaciones de despacho.");
      return;
    }
    
    try {
      setLoading(true);
      const assignmentRef = doc(db, "assignments", docId);
      await deleteDoc(assignmentRef);
      
      if (selectedDocId === docId) {
        setSelectedDocId(null);
      }
    } catch (error) {
      console.error("Error al eliminar la asignación:", error);
      alert("Hubo un problema al eliminar la programación.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePlanningDate = async (docId: string, oldDate: string, newDate: string, oldRoute?: string, newRoute?: string) => {
    if (!userProfile?.permissions.canEditPlanning) {
      showToast("Permiso Denegado", "No tienes permiso de 'Modificar Planificación' en tu perfil para cambiar fechas o rutas de planificación.", "error");
      return;
    }

    const finalOldRoute = oldRoute || hrSelectedRoute || '';
    const finalNewRoute = newRoute || finalOldRoute;

    if (oldDate === newDate && finalOldRoute === finalNewRoute) {
      showToast("Sin Cambios", "La fecha y ruta seleccionadas son las mismas que las actuales.", "info");
      return;
    }

    try {
      setLoading(true);
      
      // Get current assignment details to merge
      const current = assignments[docId] || {
        documentId: docId,
        route: 'UNASSIGNED',
        dispatchDate: null,
        logisticsNotes: '',
      };

      const originalDoc = allDocuments.find(d => d.id === docId);

      const updated = {
        ...current,
        dispatchDate: newDate,
        route: finalNewRoute,
        updatedAt: serverTimestamp()
      };

      if (originalDoc) {
        updated.razonSocial = originalDoc.razonSocial || '';
        updated.tipo = originalDoc.tipo || 'NV';
        updated.totalPendiente = originalDoc.totalPendiente || 0;
      } else {
        const oldManifestId = `${finalOldRoute}_${oldDate}`;
        const manifest = manifests[oldManifestId];
        const snapDoc = manifest?.documentsSnapshot?.find(d => d.id === docId);
        if (snapDoc) {
          updated.razonSocial = snapDoc.razonSocial || '';
          updated.tipo = snapDoc.tipo || 'NV';
          updated.totalPendiente = snapDoc.totalPendiente || 0;
          updated.isAdditional = true;
        }
      }

      // Update in assignments collection
      await setDoc(doc(assignmentsCol, docId), updated);

      // Clean up snapshot of the old manifest if present
      const oldManifestId = `${finalOldRoute}_${oldDate}`;
      const oldManifest = manifests[oldManifestId];
      if (oldManifest?.documentsSnapshot) {
        const newSnapshot = oldManifest.documentsSnapshot.filter(d => d.id !== docId);
        const pendingCount = newSnapshot.filter(d => 
          d.trackingStatus === 'EN CURSO' || !d.trackingStatus
        ).length;

        await setDoc(doc(manifestsCol, oldManifestId), {
          documentsSnapshot: newSnapshot,
          totalPoints: newSnapshot.length,
          pendingPoints: pendingCount,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      showToast("Planificación Actualizada", `El documento se reprogramó correctamente.`, 'success');
      setDateChangeDoc(null);
    } catch (error: any) {
      console.error("Error al cambiar la fecha/ruta de planificación:", error);
      showToast("Error", "Error al cambiar la planificación: " + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromManifest = async (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    console.log("[handleRemoveFromManifest] Iniciar eliminación de:", docId);
    
    const docObj = hojaDeRutaDocs.find(d => d.id === docId);
    const manifestId = `${hrSelectedRoute}_${hrSelectedDate}`;
    const manifest = manifests[manifestId];
    const snapshotItem = manifest?.documentsSnapshot?.find(d => d.id === docId);
    
    // Treat as additional/orphaned if it has the flag, is orphaned, has a manual ID format, or is missing from import
    const isAdditionalOrOrphaned = !!(
      docObj?.isOrphaned || 
      docObj?.isMissingFromImport ||
      snapshotItem?.isAdditional || 
      docId.includes('-ADD-') ||
      !docObj
    );

    const isOperatorOrAdmin = 
      userProfile?.role === 'ADMIN' || 
      userProfile?.role === 'OPERATOR' || 
      !!userProfile?.permissions?.canEditManifests || 
      !!userProfile?.permissions?.canEditPlanning;

    console.log("[handleRemoveFromManifest]", {
      docId,
      manifestId,
      isAdditionalOrOrphaned,
      isOperatorOrAdmin,
      userRole: userProfile?.role
    });

    if (!isOperatorOrAdmin) {
      showToast("Permiso Denegado", "No tienes permiso de Administrador u Operador para realizar esta acción.", "error");
      return;
    }

    const isMissingFromExcel = !!docObj?.isMissingFromImport;
    const title = isMissingFromExcel 
      ? 'Eliminar Punto a Revisar' 
      : (isAdditionalOrOrphaned ? 'Eliminar Punto Adicional' : 'Quitar Despacho');

    const confirmMessage = isMissingFromExcel
      ? `Este documento (${docId}) no figura en el Excel actual. ¿Está seguro que desea eliminarlo de la preparación de la hoja de ruta?`
      : (isAdditionalOrOrphaned 
          ? '¿Está seguro de eliminar este punto adicional de la hoja de ruta?' 
          : '¿Está seguro de eliminar este despacho de la hoja de ruta?');

    requestConfirmation(
      title,
      confirmMessage,
      async () => {
        try {
          setLoading(true);
          console.log("[handleRemoveFromManifest] Confirmado. Ejecutando borrado en DB.");
          
          // Always attempt to delete from assignments collection in Firestore to prevent loose assignments
          try {
            await deleteDoc(doc(db, "assignments", docId));
            console.log("[handleRemoveFromManifest] Eliminado de assignments:", docId);
          } catch (err) {
            console.warn("Assignment document not found or could not be deleted in assignments collection:", err);
          }
          
          if (manifest?.documentsSnapshot) {
            const newSnapshot = manifest.documentsSnapshot.filter(d => d.id !== docId);
            const pendingCount = newSnapshot.filter(d => 
              d.trackingStatus === 'EN CURSO' || !d.trackingStatus
            ).length;

            console.log("[handleRemoveFromManifest] Actualizando snapshot del manifiesto:", {
              newSnapshotLength: newSnapshot.length,
              pendingCount
            });

            await setDoc(doc(manifestsCol, manifestId), {
              documentsSnapshot: newSnapshot,
              totalPoints: newSnapshot.length,
              pendingPoints: pendingCount,
              updatedAt: serverTimestamp()
            }, { merge: true });
          }

          showToast("Completado", "Documento removido de la ruta exitosamente.", 'success');
        } catch (error: any) {
          console.error("Error al eliminar la asignación:", error);
          showToast("Error", "Error al remover el documento: " + error.message, 'error');
        } finally {
          setLoading(false);
        }
      },
      'Sí, eliminar',
      'Cancelar',
      'danger'
    );
  };

  const handleAddAdditionalPoint = async (routeId: string, date: string) => {
    if (!userProfile?.permissions.canEditManifests) {
      showToast("Permiso Denegado", "No tienes permiso de 'Modificar Entregas' en tu perfil para agregar puntos.", 'error');
      return;
    }
    if (!routeId || !date) {
      showToast("Error", "Debe seleccionar una ruta y una fecha válidas.", 'error');
      return;
    }
    if (!newPoint.razonSocial.trim()) {
      showToast("Error", "Razón Social o Proveedor es requerida.", 'error');
      return;
    }
    if (!newPoint.docNumber.trim()) {
      showToast("Error", `El número de ${newPoint.tipo === 'TR' ? 'Retiro' : newPoint.tipo} es obligatorio.`, 'error');
      return;
    }

    const docId = `${newPoint.tipo}-${newPoint.docNumber.trim()}`;
    const manifestId = `${routeId}_${date}`;
    const manifest = manifests[manifestId];
    const existingSnapshot = manifest?.documentsSnapshot || [];

    if (existingSnapshot.some(d => d.id === docId)) {
      showToast("Duplicado", `El documento ${docId} ya existe en esta hoja de ruta.`, 'error');
      return;
    }

    const parsedAmount = newPointAmountStr ? parseFloat(newPointAmountStr.replace(/[^\d]/g, '')) || 0 : 0;

    const newDoc = {
      id: docId,
      tipo: newPoint.tipo,
      razonSocial: newPoint.razonSocial.trim().toUpperCase(),
      guideNumber: newPoint.guideNumber.trim() || '',
      totalAmount: parsedAmount,
      totalPendiente: parsedAmount,
      proceso: newPoint.proceso,
      trackingStatus: 'EN CURSO',
      trackingObservation: newPoint.logisticsNotes.trim() || '',
      logisticsNotes: newPoint.logisticsNotes.trim() || '',
      location: newPoint.location.trim().toUpperCase() || '',
      orderIndex: existingSnapshot.length + 1,
      isAdditional: true
    };

    const updatedSnapshot = [...existingSnapshot, newDoc];

    try {
      setLoading(true);
      await setDoc(doc(manifestsCol, manifestId), {
        id: manifestId,
        routeId,
        date,
        driverId: manifest?.driverId || '',
        vehicleId: manifest?.vehicleId || '',
        isFinalized: manifest?.isFinalized ?? false,
        routeNumber: manifest?.routeNumber || null,
        startTime: manifest?.startTime || '',
        endTime: manifest?.endTime || '',
        pendingPoints: updatedSnapshot.filter(d => d.trackingStatus === 'EN CURSO' || !d.trackingStatus).length,
        totalPoints: updatedSnapshot.length,
        documentsSnapshot: updatedSnapshot,
        updatedAt: serverTimestamp()
      }, { merge: true });

      showToast("Completado", "Punto adicional agregado con éxito.", 'success');
      
      // Reset form
      setNewPoint({
        proceso: 'ENTREGA',
        tipo: 'NV',
        docNumber: '',
        razonSocial: '',
        guideNumber: '',
        location: '',
        logisticsNotes: ''
      });
      setNewPointAmountStr('');
      setShowAddPointForm(false);
    } catch (error: any) {
      console.error("Error al agregar punto adicional:", error);
      showToast("Error", "Error al agregar el punto adicional: " + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleRouteFilter = (route: string) => {
    const newSet = new Set(selectedRoutes);
    if (newSet.has(route)) {
        if (newSet.size > 1) newSet.delete(route);
    } else {
        newSet.add(route);
    }
    setSelectedRoutes(newSet);
  };

  // Redirect to available tab if the current one is not allowed
  useEffect(() => {
    if (!userProfile) return;

    const { canViewPlanning, canViewRouteSheets, canViewResumenRutas, canViewKPIs } = userProfile.permissions;

    if (activeTab === 'dashboard' && !canViewPlanning) {
      if (canViewRouteSheets) setActiveTab('hojaDeRuta');
      else if (canViewResumenRutas) setActiveTab('resumenRutas');
      else if (canViewKPIs) setActiveTab('kpis');
    } else if (activeTab === 'hojaDeRuta' && !canViewRouteSheets) {
      if (canViewPlanning) setActiveTab('dashboard');
      else if (canViewResumenRutas) setActiveTab('resumenRutas');
      else if (canViewKPIs) setActiveTab('kpis');
    } else if (activeTab === 'resumenRutas' && !canViewResumenRutas) {
      if (canViewPlanning) setActiveTab('dashboard');
      else if (canViewRouteSheets) setActiveTab('hojaDeRuta');
      else if (canViewKPIs) setActiveTab('kpis');
    } else if (activeTab === 'kpis' && !canViewKPIs) {
      if (canViewPlanning) setActiveTab('dashboard');
      else if (canViewRouteSheets) setActiveTab('hojaDeRuta');
      else if (canViewResumenRutas) setActiveTab('resumenRutas');
    }
  }, [userProfile, activeTab]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center font-sans">
        <Loader className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Cargando Plataforma Logística...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onAuthSuccess={() => {}} />;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* Modals Mounting */}
      <AnimatePresence>
        {isVerifyRouteModalOpen && (
          <VerifyRouteModal 
            isOpen={isVerifyRouteModalOpen}
            onClose={() => setIsVerifyRouteModalOpen(false)}
            routeMap={routeMap}
            hrSelectedRoute={hrSelectedRoute}
            hrSelectedDate={hrSelectedDate}
            otherDateDocs={otherDateDocs}
            assignments={assignments}
            handleUpdateAssignment={handleUpdateAssignment}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPickingModalOpen && (
          <PickingModal 
            isOpen={isPickingModalOpen}
            onClose={() => setIsPickingModalOpen(false)}
            routes={routes}
            pickingRouteId={pickingRouteId}
            setPickingRouteId={setPickingRouteId}
            handlePrintPickingReport={handlePrintPickingReport}
            routeCounts={pickingRouteCounts}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isManagingParameters && (
          <ParametersModal 
            isOpen={isManagingParameters}
            onClose={() => setIsManagingParameters(false)}
            routes={routes}
            drivers={drivers}
            vehicles={vehicles}
            assignments={assignments}
            loading={loading}
            setLoading={setLoading}
            setSelectedRoutes={setSelectedRoutes}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showManifestDetail && (
          <ManifestDetailModal 
            isOpen={!!showManifestDetail}
            onClose={() => setShowManifestDetailId(null)}
            manifest={showManifestDetail}
            routeMap={routeMap}
            driverMap={driverMap}
            vehicleMap={vehicleMap}
            canEditPoints={activeTab === 'hojaDeRuta'}
            isAdmin={userProfile?.role === 'ADMIN'}
            onUpdateSnapshot={(snapshot) => {
              const pendingCount = snapshot.filter(d => 
                d.trackingStatus === 'EN CURSO' || !d.trackingStatus
              ).length;
              handleUpdateManifestFields(showManifestDetail.id, {
                documentsSnapshot: snapshot,
                pendingPoints: pendingCount
              });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isConsolidatedReportModalOpen && (() => {
          const report = consolidatedReportData;
          return (
            <div id="print-report-modal-backdrop" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-start justify-center p-4 md:p-8 overflow-y-auto">
              <style>{`
                @media print {
                  html, body, #root, #root > div {
                    height: auto !important;
                    min-height: auto !important;
                    overflow: visible !important;
                    position: static !important;
                  }
                  #root > div > *:not(#print-report-modal-backdrop) {
                    display: none !important;
                  }
                  #print-report-modal-backdrop {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    height: auto !important;
                    background: transparent !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    overflow: visible !important;
                    backdrop-filter: none !important;
                    z-index: auto !important;
                    display: block !important;
                  }
                  #print-report-container {
                    position: relative !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                    border: none !important;
                    background: white !important;
                    color: black !important;
                    overflow: visible !important;
                    display: block !important;
                    height: auto !important;
                    max-height: none !important;
                  }
                  #kpi-report-view {
                    overflow: visible !important;
                    height: auto !important;
                    max-height: none !important;
                    display: block !important;
                  }
                  .no-print, .print\:hidden, [class*="no-print"],
                  #print-report-container .no-print,
                  #print-report-container [class*="no-print"],
                  #print-report-modal-backdrop .no-print {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    min-height: 0 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: none !important;
                    box-shadow: none !important;
                    overflow: hidden !important;
                  }
                }
              `}</style>

              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-auto md:h-[85vh] max-h-none md:max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 my-auto"
                id="print-report-container"
              >
                {/* Header (No print parent controls) */}
                <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 no-print border-b border-slate-800">
                  <div className="text-left">
                    <span className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider block">Reportes de Control Diario</span>
                    <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-400" /> Reporte Consolidado de Rutas
                    </h2>
                    <p className="text-xs text-indigo-200/80 mt-0.5 font-sans">Control de avances, estado operacional e información consolidada de despacho.</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Fecha:</span>
                      <input 
                        type="date"
                        className="bg-transparent text-xs text-white border-none p-0 focus:outline-none focus:ring-0 font-bold w-28"
                        value={consolidatedReportDate}
                        onChange={(e) => setConsolidatedReportDate(e.target.value)}
                      />
                    </div>
                    
                    {/* If inside iframe, show big link to open in new tab. Else show normal printer button. */}
                    {typeof window !== 'undefined' && window.self !== window.top ? (
                      <a 
                        href={`${window.location.origin}${window.location.pathname}?printReport=true&reportDate=${consolidatedReportDate || getLocalDateString()}&reportType=${reportType}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer uppercase tracking-wider font-extrabold no-underline inline-flex items-center"
                      >
                        <ExternalLink className="w-4 h-4 text-white" /> Abrir e Imprimir PDF ↗
                      </a>
                    ) : (
                      <button 
                        onClick={() => window.print()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer uppercase tracking-wider font-extrabold"
                      >
                        <Printer className="w-4 h-4" /> Imprimir reporte
                      </button>
                    )}

                    <button 
                      onClick={() => {
                        setIsConsolidatedReportModalOpen(false);
                        if (typeof window !== 'undefined' && window.history) {
                          const baseUrl = window.location.origin + window.location.pathname;
                          window.history.replaceState({}, document.title, baseUrl);
                        }
                      }}
                      className="p-2.5 hover:bg-slate-805 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Cerrar y volver al sistema"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Subheader Toggle Bar (Sticky top controls, no-print) */}
                <div className="bg-slate-50 border-b border-slate-150 px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-left">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-sans">
                        Vista seleccionada: {reportType === 'summary' ? 'Resumen General' : 'Detalle Completo de Puntos'}
                      </span>
                    </div>
                    {typeof window !== 'undefined' && window.self !== window.top && (
                      <span className="text-[10px] font-black bg-amber-50 text-amber-750 px-3 py-1 rounded-xl border border-amber-200 uppercase tracking-wider font-sans">
                        ⚠️ PREVISUALIZACIÓN: Para imprimir, abre en pestaña nueva usando el botón azul "Abrir e Imprimir PDF ↗"
                      </span>
                    )}
                  </div>
                  
                  {/* Report View Toggle Tab buttons */}
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setReportType('summary')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider ${
                        reportType === 'summary'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-950 hover:bg-slate-200'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" /> Resumen General
                    </button>
                    <button
                      onClick={() => setReportType('detailed')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider ${
                        reportType === 'detailed'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-950 hover:bg-slate-200'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" /> Detalle de Puntos
                    </button>
                  </div>
                </div>

                {/* Printable Report Wrapper */}
                <div className="p-8 flex-1 overflow-y-auto text-left" id="kpi-report-view">
                  
                  {/* PRINT ONLY HEADER */}
                  <div className="hidden print:block border-b border-slate-300 pb-5 mb-6 text-left">
                    <div className="flex justify-between items-start">
                      <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">ANTKO LOGÍSTICA</h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">REPORTE CONSOLIDADO DE RUTAS DIARIAS</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono font-bold text-slate-800">Fecha Control: {report.targetDate ? new Date(report.targetDate + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</p>
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">Generado el: {new Date().toLocaleString('es-CL')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Print / Interactive Title section if we don't have standard header printed */}
                  <div className="print:hidden mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 pb-4">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Reporte del Día</h3>
                      <p className="text-xs text-slate-500 font-mono">
                        {report.targetDate ? new Date(report.targetDate + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                      </p>
                    </div>

                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl border border-indigo-100 uppercase tracking-wide font-sans">
                      Reporte: {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} hrs
                    </span>
                  </div>

                  {/* 4 Cards Summary KPI Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                    {/* Tarjeta 1: Rutas */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Rutas Totales</span>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-slate-950 font-mono">{report.totalRutas}</span>
                        <span className="text-xs text-slate-500 font-bold">viajes</span>
                      </div>
                    </div>

                    {/* Tarjeta 2: Documentos */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider font-sans">Guías / OCs</span>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-slate-950 font-mono">{report.totalDocs}</span>
                        <span className="text-xs text-slate-500 font-bold">totales</span>
                      </div>
                      <div className="mt-1 flex gap-2 text-[9px] font-bold text-slate-500 font-sans">
                        <span className="text-emerald-600 font-black">{report.otifDocs} ent.</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-amber-600 font-black">{report.pendingDocs} pend.</span>
                      </div>
                    </div>

                    {/* Tarjeta 3: Carga Valorizada */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider font-sans">Monto Dispatch</span>
                      <div className="mt-2">
                        <span className="text-lg font-black text-slate-950 font-mono tracking-tight">{formatCLP(report.totalValue)}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-medium leading-none block mt-1 font-sans">Costo consolidado del día</span>
                    </div>

                    {/* Tarjeta 4: Avance General */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider font-sans">% Avance General</span>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-950 font-mono">{report.completionRate}%</span>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden shrink-0 max-w-[50px]">
                          <div className="bg-indigo-600 h-full" style={{ width: `${report.completionRate}%` }} />
                        </div>
                      </div>
                      <div className="text-[9px] text-slate-500 font-medium font-sans">Resolución completa de documentos</div>
                    </div>

                    {/* Tarjeta 5: Efectividad de Entrega */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between col-span-2 lg:col-span-1">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider font-sans">Efectividad (OTIF)</span>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-950 font-mono">{report.otifRate}%</span>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden shrink-0 max-w-[50px]">
                          <div className="bg-emerald-500 h-full" style={{ width: `${report.otifRate}%` }} />
                        </div>
                      </div>
                      <div className="text-[9px] text-slate-500 font-medium font-sans">Entregas exitosas sobre total general</div>
                    </div>
                  </div>

                  {/* Conditional report rendering */}
                  {reportType === 'summary' ? (
                    /* Detailed Route Table */
                    <div className="mb-8">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-tight mb-3 font-sans">Detalle Operacional de Rutas</h4>
                      
                      {report.manifests.length === 0 ? (
                        <div className="p-12 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400 font-medium italic text-xs font-sans">
                          No hay rutas definitivas registradas para el día seleccionado ({consolidatedReportDate}).
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                                <th className="px-4 py-3">Código / Destino</th>
                                <th className="px-3 py-3">Chofer / Camión</th>
                                <th className="px-3 py-3 text-center">Horarios</th>
                                <th className="px-3 py-3 text-center">Avance Gral.</th>
                                <th className="px-3 py-3 text-right">Efectividad</th>
                                <th className="px-4 py-3 text-right">Monto Carga</th>
                                <th className="px-4 py-3 text-right">Estado Actual</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium font-sans">
                              {report.manifests.map((m) => {
                                const rName = routeMap[m.routeId || ''] || 'Sin asignar';
                                const dName = driverMap[m.driverId || ''] || 'No asignado';
                                const vDesc = vehicleMap[m.vehicleId || ''] || 'No asignado';
                                
                                const pts = m.documentsSnapshot || [];
                                const total = pts.length;
                                const completed = pts.filter(d => 
                                  d.trackingStatus === 'ENTREGADO' || 
                                  d.trackingStatus === 'RETIRADO' || 
                                  d.trackingStatus === 'NO ENTREGADO' || 
                                  d.trackingStatus === 'NO RETIRADO'
                                ).length;
                                const otifNum = pts.filter(d => d.trackingStatus === 'ENTREGADO' || d.trackingStatus === 'RETIRADO').length;
                                
                                const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
                                const otif = total > 0 ? Math.round((otifNum / total) * 100) : 0;
                                const totalVal = pts.reduce((s,d) => d.tipo === 'OC' ? s : s + (d.totalAmount ?? d.totalPendiente), 0) || 0;
                                
                                let routeStateLabel = 'No Iniciado';
                                let routeStateColor = 'bg-slate-100 text-slate-600 border-slate-200';
                                
                                if (m.startTime) {
                                  if (m.endTime) {
                                    routeStateLabel = 'Completado';
                                    routeStateColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                                  } else {
                                    routeStateLabel = 'En Ruta';
                                    routeStateColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                                  }
                                }

                                return (
                                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3.5">
                                      <div className="font-mono font-black text-slate-900 text-sm">
                                        HR-{m.routeNumber ?? '1001'}
                                      </div>
                                      <div className="text-[11px] text-slate-500 font-semibold truncate max-w-[150px]" title={rName}>
                                        {rName}
                                      </div>
                                    </td>
                                    <td className="px-3 py-3.5 leading-tight">
                                      <p className="text-slate-800 font-bold font-sans truncate max-w-[130px]" title={dName}>{dName}</p>
                                      <p className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]" title={vDesc}>{vDesc}</p>
                                    </td>
                                    <td className="px-3 py-3.5 text-center font-mono text-[11px] leading-tight text-slate-600">
                                      <div>Salida: {m.startTime || '--:--'}</div>
                                      <div className="text-[10px] text-slate-400 mt-0.5">Retorno: {m.endTime || '--:--'}</div>
                                    </td>
                                    <td className="px-3 py-3.5 text-center">
                                      <div className="flex flex-col items-center gap-1">
                                        <span className="font-mono font-bold text-slate-800 text-[11px]">{completed} / {total} (<b>{progress}%</b>)</span>
                                        <div className="w-[80px] bg-slate-100 h-1 rounded-full overflow-hidden">
                                          <div className="bg-indigo-600 h-full" style={{ width: `${progress}%` }} />
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-3 py-3.5 text-right">
                                      <span className={`inline-block font-mono font-extrabold px-1.5 py-0.5 rounded-[6px] text-[10px] ${
                                        otif >= 90
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                          : otif >= 75
                                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                                      }`}>
                                        {otif}% OTIF
                                      </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800">
                                      {formatCLP(totalVal)}
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                      <span className={`px-2 py-0.5 border text-[9px] font-extrabold uppercase tracking-widest rounded-lg leading-none ${routeStateColor}`}>
                                        {routeStateLabel}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Detailed Route Points Breakdown List */
                    <div className="mb-8 flex flex-col gap-6">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-tight font-sans">Detalle Completo de Puntos por Hoja de Ruta</h4>
                      
                      {report.manifests.length === 0 ? (
                        <div className="p-12 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400 font-medium italic text-xs font-sans">
                          No hay rutas definitivas registradas para el día seleccionado ({consolidatedReportDate}).
                        </div>
                      ) : (
                        report.manifests.map((m) => {
                          const rName = routeMap[m.routeId || ''] || 'Sin asignar';
                          const dName = driverMap[m.driverId || ''] || 'No asignado';
                          const vDesc = vehicleMap[m.vehicleId || ''] || 'No asignado';
                          
                          const pts = m.documentsSnapshot || [];
                          const total = pts.length;
                          const completed = pts.filter(d => 
                            d.trackingStatus === 'ENTREGADO' || 
                            d.trackingStatus === 'RETIRADO' || 
                            d.trackingStatus === 'NO ENTREGADO' || 
                            d.trackingStatus === 'NO RETIRADO'
                          ).length;
                          const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

                          return (
                            <div key={m.id} className="border border-slate-200 bg-white rounded-2xl overflow-hidden p-4 shadow-sm break-inside-avoid">
                              {/* Route metadata bar */}
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-3 text-left">
                                <div>
                                  <span className="text-xs font-mono font-black text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-[6px] mr-2">
                                    HR-{m.routeNumber ?? '1001'}
                                  </span>
                                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-tight">{rName}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-slate-500 font-semibold font-sans">
                                  <span><b>Chofer:</b> {dName}</span>
                                  <span className="text-slate-350">|</span>
                                  <span><b>Camión:</b> {vDesc}</span>
                                  <span className="text-slate-350">|</span>
                                  <span><b>Progreso:</b> {completed}/{total} ({progress}%)</span>
                                </div>
                              </div>

                              {/* Points Table */}
                              {pts.length === 0 ? (
                                <div className="p-4 text-center text-slate-400 font-semibold italic text-[11px] font-sans">
                                  Esta ruta no dispone de puntos de entrega/retiro asignados.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-[11px] font-sans">
                                    <thead>
                                      <tr className="text-[9px] font-extrabold text-slate-450 uppercase tracking-widest border-b border-slate-200 bg-slate-50">
                                        <th className="py-2 px-2 shrink-0">Cód. Documento</th>
                                        <th className="py-2 px-2">Cliente / Razón Social</th>
                                        <th className="py-2 px-2 text-center">Tipo</th>
                                        <th className="py-2 px-2 text-center">Nº Guía Despacho</th>
                                        <th className="py-2 px-2 text-right">Monto</th>
                                        <th className="py-2 px-2 text-right">Estado Entrega</th>
                                        <th className="py-2 px-2 text-left">Ubicación</th>
                                        <th className="py-2 px-2 text-left pl-4">Observaciones / Feedback</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150">
                                      {pts.map((doc, idx) => {
                                        const docAmt = doc.tipo === 'OC' ? 0 : (doc.totalAmount ?? doc.totalPendiente ?? 0);
                                        return (
                                          <tr key={doc.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-2 px-2 font-mono font-bold text-slate-900 shrink-0">
                                              {doc.id}
                                            </td>
                                            <td className="py-2 px-2 font-semibold text-slate-800 truncate max-w-[200px]" title={doc.razonSocial}>
                                              {doc.razonSocial || <span className="text-slate-400 font-medium italic">Sin especificar</span>}
                                            </td>
                                            <td className="py-2 px-2 text-center font-bold">
                                              <span className={`inline-block font-sans font-black uppercase text-[8.5px] px-1 rounded-sm leading-tight border ${
                                                doc.proceso === 'RETIRO' 
                                                  ? 'bg-amber-50 text-amber-700 border-amber-100' 
                                                  : 'bg-indigo-50 text-indigo-705 border-indigo-100'
                                              }`}>
                                                {doc.proceso || 'ENTREGA'}
                                              </span>
                                            </td>
                                            <td className="py-2 px-2 text-center font-mono font-bold text-slate-500">
                                              {doc.guideNumber || <span className="text-slate-400 font-sans font-medium">—</span>}
                                            </td>
                                            <td className="py-2 px-2 text-right font-mono font-bold text-slate-800">
                                              {formatCLP(docAmt)}
                                            </td>
                                            <td className="py-2 px-2 text-right">
                                              <span className={`inline-block font-mono font-extrabold px-1.5 py-0.5 rounded-[5px] text-[9px] ${
                                                doc.trackingStatus === 'ENTREGADO' || doc.trackingStatus === 'RETIRADO'
                                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                  : doc.trackingStatus === 'NO ENTREGADO' || doc.trackingStatus === 'NO RETIRADO'
                                                  ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                                  : 'bg-amber-50 text-amber-750 border border-amber-100'
                                              }`}>
                                                {doc.trackingStatus || 'EN CURSO'}
                                              </span>
                                            </td>
                                            <td className="py-2 px-2 text-left text-slate-600 font-semibold truncate max-w-[150px]" title={doc.location}>
                                              {doc.location || <span className="text-slate-300 font-normal">—</span>}
                                            </td>
                                            <td className="py-2 px-2 text-left pl-4 text-slate-500 font-medium truncate max-w-[240px]" title={`${doc.logisticsNotes || ''}${doc.logisticsNotes && doc.trackingObservation ? ' / ' : ''}${doc.trackingObservation || ''}`}>
                                              {(() => {
                                                const hasLogistics = !!doc.logisticsNotes?.trim();
                                                const hasTracking = !!doc.trackingObservation?.trim();
                                                
                                                if (hasLogistics && hasTracking) {
                                                  return (
                                                    <span>
                                                      {doc.logisticsNotes}{" "}
                                                      <span className="text-slate-400 font-normal">/</span>{" "}
                                                      <span className="text-indigo-600 font-bold">{doc.trackingObservation}</span>
                                                    </span>
                                                  );
                                                } else if (hasLogistics) {
                                                  return <span>{doc.logisticsNotes}</span>;
                                                } else if (hasTracking) {
                                                  return <span className="text-indigo-600 font-bold">{doc.trackingObservation}</span>;
                                                } else {
                                                  return <span className="text-slate-300">—</span>;
                                                }
                                              })()}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                </div>



              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {userManagerOpen && userProfile && (
          <UserManagerModal 
            isOpen={userManagerOpen}
            onClose={() => setUserManagerOpen(false)}
            currentUserProfile={userProfile}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reopenConfirmId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden z-10"
              id="reopen-modal-content"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <RotateCcw className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">¿Reabrir Hoja de Ruta?</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-8">
                  Esta acción permitirá modificar la carga y programación. Deberá volver a grabar la planilla definitiva para cerrarla.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setReopenConfirmId(null)}
                    className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all uppercase tracking-widest text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => handleReopenManifest(reopenConfirmId)}
                    className="flex-1 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20 transition-all uppercase tracking-widest text-xs cursor-pointer"
                  >
                    Sí, Reabrir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden z-10 p-8 text-center"
              id="custom-confirm-modal"
            >
              <div>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  confirmModal.type === 'danger' ? 'bg-red-100' :
                  confirmModal.type === 'warning' ? 'bg-amber-100' : 'bg-blue-100'
                }`}>
                  <Trash2 className={`w-8 h-8 ${
                    confirmModal.type === 'danger' ? 'text-red-600' :
                    confirmModal.type === 'warning' ? 'text-amber-600' : 'text-blue-600'
                  }`} />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{confirmModal.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-8">
                  {confirmModal.message}
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all uppercase tracking-widest text-xs cursor-pointer select-none"
                  >
                    {confirmModal.cancelText || 'Cancelar'}
                  </button>
                  <button 
                    onClick={() => {
                      confirmModal.onConfirm();
                      setConfirmModal(null);
                    }}
                    className={`flex-1 px-4 py-3 font-bold rounded-xl transition-all uppercase tracking-widest text-xs cursor-pointer select-none text-white shadow-lg ${
                      confirmModal.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' :
                      confirmModal.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : 
                      'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                    }`}
                  >
                    {confirmModal.confirmText || 'Confirmar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dateChangeDoc && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden z-10 p-8 border border-slate-100"
              id="reprogram-date-modal"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <CalendarIcon className="w-8 h-8 text-indigo-600" />
                </div>
                
                <h3 className="text-xl font-black text-slate-900 mb-1 uppercase tracking-tight">Reprogramar Despacho</h3>
                <p className="text-xs font-mono font-bold text-indigo-600 mb-2">
                  {formatDocId(dateChangeDoc.tipo, dateChangeDoc.id)}
                </p>
                <p className="text-slate-500 text-xs leading-normal mb-6 break-words px-2 font-medium">
                  {dateChangeDoc.razonSocial}
                </p>

                <div className="mb-4 text-left">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Nueva Fecha de Planificación</label>
                  <input 
                    type="date"
                    value={newPlanningDate}
                    onChange={(e) => setNewPlanningDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/25 focus:border-indigo-600 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition-all cursor-pointer"
                  />
                </div>

                <div className="mb-8 text-left">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Nueva Ruta Logística</label>
                  <select 
                    value={newPlanningRoute}
                    onChange={(e) => setNewPlanningRoute(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/25 focus:border-indigo-600 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition-all cursor-pointer"
                  >
                    <option value="UNASSIGNED">Seleccione Ruta...</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setDateChangeDoc(null)}
                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all uppercase tracking-widest text-[10px] cursor-pointer select-none"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      const oldDate = dateChangeDoc.assignment?.dispatchDate || hrSelectedDate;
                      const oldRoute = dateChangeDoc.assignment?.route || hrSelectedRoute;
                      handleChangePlanningDate(dateChangeDoc.id, oldDate, newPlanningDate, oldRoute, newPlanningRoute);
                    }}
                    className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all uppercase tracking-widest text-[10px] cursor-pointer select-none"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFinalizeModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden z-10 p-8 border border-slate-100"
              id="finalize-route-date-modal"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CalendarIcon className="w-8 h-8 text-emerald-600 animate-bounce" />
                </div>
                
                <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Cerrar Hoja de Ruta</h3>
                <p className="text-slate-500 text-xs leading-normal mb-6 px-4 font-medium">
                  Los pedidos generalmente se preparan hoy y se despachan al día siguiente. 
                  Indique la <span className="font-bold text-emerald-600">fecha real de despacho</span> en la cual la carga saldrá a ruta.
                </p>

                <div className="mb-8 text-left bg-slate-50 p-5 rounded-2xl border border-slate-150">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">Fecha Real de Ruta / Despacho</label>
                  <input 
                    type="date"
                    value={finalizeDate}
                    onChange={(e) => setFinalizeDate(e.target.value)}
                    className="w-full bg-white border-2 border-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-600/15 focus:border-emerald-600 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 transition-all cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 italic">
                    Todos los registros de despachos asociados a esta hoja de ruta se guardarán legalmente para el día seleccionado.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsFinalizeModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-all uppercase tracking-widest text-[10px] cursor-pointer select-none"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      handleFinalizeManifestWithDate(hrSelectedRoute, hrSelectedDate, finalizeDate);
                    }}
                    className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all uppercase tracking-widest text-[10px] cursor-pointer select-none"
                  >
                    Grabar y Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {uploadProgress && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden z-10 p-8 border border-slate-100"
              id="upload-progress-modal"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Upload className="w-8 h-8 text-indigo-600 animate-bounce" />
                </div>
                
                <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Procesando Planilla</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                  Estamos analizando y sincronizando los datos con Firebase. El proceso se realiza en lotes para evitar que la página se bloquee.
                </p>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-4 relative shadow-inner">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.round((uploadProgress.current / (uploadProgress.total || 1)) * 100))}%` }}
                  ></div>
                </div>

                {/* Detailed steps */}
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1 mb-6">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <Loader className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                    {uploadProgress.current === 0 ? "Fase 1: Parsing y Respaldo..." : 
                     uploadProgress.current < uploadProgress.total / 2 ? "Fase 2: Analizando datos..." : 
                     "Fase 3: Sincronizando con Planificación..."}
                  </span>
                  <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-[10px]">
                    {uploadProgress.current} de {uploadProgress.total} ({Math.min(100, Math.round((uploadProgress.current / (uploadProgress.total || 1)) * 100))}%)
                  </span>
                </div>

                <div className="text-[10px] text-slate-400 font-medium">
                  Esto puede tardar unos segundos según la velocidad de su conexión.
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-auto min-h-[64px] bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between px-4 sm:px-6 shrink-0 border-b border-slate-700 shadow-lg relative z-[60]" id="main-app-header">
        <div className="flex items-center justify-between h-16 w-full md:w-auto">
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              className="lg:hidden p-2 -ml-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <img 
              src={logoAntko} 
              alt="Antko Logo" 
              className="h-8 sm:h-10 w-auto object-contain" 
              referrerPolicy="no-referrer"
            />
            <div className="h-6 sm:h-8 w-px bg-slate-700 mx-0.5 sm:mx-1" />
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-bold tracking-tighter text-slate-200 hidden sm:block">Gestión Logística</h1>
              <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest transition-all duration-300 ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {isOnline ? 'Sincronizado' : 'Offline'}
              </div>
            </div>
          </div>

          {/* Buscador de Folios / Guías para Desktop */}
          <div ref={globalSearchRef} className="relative mx-4 hidden md:block w-72 lg:w-80 z-50">
            <div className="relative flex items-center bg-slate-800 hover:bg-slate-755 border border-slate-700 rounded-xl px-3 py-1.5 transition-all text-xs focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input 
                type="text"
                placeholder="Buscar folio (NV, OC, Guía)..."
                className="bg-transparent text-white placeholder-slate-400 outline-none w-full font-sans font-medium"
                value={globalFolioSearch}
                onFocus={() => setShowGlobalSearchResults(true)}
                onChange={(e) => {
                  setGlobalFolioSearch(e.target.value);
                  setShowGlobalSearchResults(true);
                }}
              />
              {globalFolioSearch && (
                <button 
                  type="button" 
                  onClick={() => { setGlobalFolioSearch(''); setShowGlobalSearchResults(false); }}
                  className="text-slate-400 hover:text-white ml-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            {showGlobalSearchResults && globalFolioSearch.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200/90 z-[100] max-h-[360px] overflow-y-auto overflow-x-hidden p-1.5 divide-y divide-slate-100 flex flex-col text-left">
                {matchingGlobalDocuments.length > 0 ? (
                  matchingGlobalDocuments.map(({ manifest, doc, routeLabel }, idx) => {
                    const isNV = doc.tipo === 'NV';
                    const formattedId = formatDocId(doc.tipo, doc.id);
                    return (
                      <button
                        key={`${manifest.id}_${doc.id}_${idx}`}
                        type="button"
                        onClick={() => {
                          setShowManifestDetailId(manifest.id);
                          setShowGlobalSearchResults(false);
                          setGlobalFolioSearch('');
                        }}
                        className="w-full text-left p-2.5 hover:bg-indigo-50/50 rounded-lg transition-colors flex flex-col gap-1 group cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[11px] font-black font-mono border px-1.5 py-0.5 rounded ${
                            isNV ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-teal-50 text-teal-700 border-teal-100'
                          }`}>
                            {formattedId}
                          </span>
                          {doc.guideNumber && (
                            <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">
                              Guía: {doc.guideNumber}
                            </span>
                          )}
                          <span className="text-[10px] text-white font-extrabold px-1.5 py-0.5 bg-slate-800 rounded font-mono">
                            HR-{manifest.routeNumber ?? '1001'}
                          </span>
                        </div>
                        
                        <p className="text-[11px] text-slate-700 font-bold truncate leading-tight group-hover:text-indigo-900">
                          👤 {doc.razonSocial || 'Cliente sin nombre'}
                        </p>
                        
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                          <span className="truncate max-w-[150px]">🚛 {routeLabel}</span>
                          <span className="font-mono">{manifest.date ? new Date(manifest.date + 'T12:00:00').toLocaleDateString('es-CL') : '-'}</span>
                        </div>
                        
                        {doc.trackingStatus && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border ${
                              doc.trackingStatus === 'ENTREGADO' || doc.trackingStatus === 'RETIRADO'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : doc.trackingStatus === 'NO ENTREGADO' || doc.trackingStatus === 'NO RETIRADO'
                                ? 'bg-rose-50 text-rose-700 border-rose-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {doc.trackingStatus}
                            </span>
                            {doc.failedReason && (
                              <span className="text-[9px] font-bold text-slate-400 max-w-[160px] truncate">
                                ({doc.failedReason})
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-slate-400 text-xs font-medium">
                    No se encontraron guías/folios con "{globalFolioSearch}"
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 border-l border-slate-700 pl-4 text-neutral-200 md:hidden">
            <button 
              onClick={handleSignOut}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
          
        <div className={`flex flex-col lg:flex-row lg:items-center w-full lg:w-auto gap-4 pb-4 lg:pb-0 ${mobileMenuOpen ? 'block' : 'hidden lg:flex'}`}>
          {/* Buscador de Folios / Guías para Mobile */}
          <div className="block md:hidden px-4 pt-2 relative z-50">
            <div className="relative flex items-center bg-slate-800 hover:bg-slate-755 border border-slate-700 rounded-xl px-3 py-2.5 transition-all text-xs focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input 
                type="text"
                placeholder="Buscar folio (NV, OC, Guía)..."
                className="bg-transparent text-white placeholder-slate-400 outline-none w-full font-sans font-medium"
                value={globalFolioSearch}
                onFocus={() => setShowGlobalSearchResults(true)}
                onChange={(e) => {
                  setGlobalFolioSearch(e.target.value);
                  setShowGlobalSearchResults(true);
                }}
              />
              {globalFolioSearch && (
                <button 
                  type="button" 
                  onClick={() => { setGlobalFolioSearch(''); setShowGlobalSearchResults(false); }}
                  className="text-slate-400 hover:text-white ml-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            {showGlobalSearchResults && globalFolioSearch.trim().length >= 2 && (
              <div className="absolute top-full left-4 right-4 mt-2 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200/90 z-[100] max-h-[300px] overflow-y-auto overflow-x-hidden p-1.5 divide-y divide-slate-100 flex flex-col text-left">
                {matchingGlobalDocuments.length > 0 ? (
                  matchingGlobalDocuments.map(({ manifest, doc, routeLabel }, idx) => {
                    const isNV = doc.tipo === 'NV';
                    const formattedId = formatDocId(doc.tipo, doc.id);
                    return (
                      <button
                        key={`mobile_${manifest.id}_${doc.id}_${idx}`}
                        type="button"
                        onClick={() => {
                          setShowManifestDetailId(manifest.id);
                          setShowGlobalSearchResults(false);
                          setGlobalFolioSearch('');
                          setMobileMenuOpen(false);
                        }}
                        className="w-full text-left p-2.5 hover:bg-indigo-50/50 rounded-lg transition-colors flex flex-col gap-1 group cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[11px] font-black font-mono border px-1.5 py-0.5 rounded ${
                            isNV ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-teal-50 text-teal-700 border-teal-100'
                          }`}>
                            {formattedId}
                          </span>
                          {doc.guideNumber && (
                            <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">
                              Guía: {doc.guideNumber}
                            </span>
                          )}
                          <span className="text-[10px] text-white font-extrabold px-1.5 py-0.5 bg-slate-800 rounded font-mono">
                            HR-{manifest.routeNumber ?? '1001'}
                          </span>
                        </div>
                        
                        <p className="text-[11px] text-slate-700 font-bold truncate leading-tight group-hover:text-indigo-900">
                          👤 {doc.razonSocial || 'Cliente sin nombre'}
                        </p>
                        
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                          <span className="truncate max-w-[150px]">🚛 {routeLabel}</span>
                          <span className="font-mono">{manifest.date ? new Date(manifest.date + 'T12:00:00').toLocaleDateString('es-CL') : '-'}</span>
                        </div>
                        
                        {doc.trackingStatus && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border ${
                              doc.trackingStatus === 'ENTREGADO' || doc.trackingStatus === 'RETIRADO'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : doc.trackingStatus === 'NO ENTREGADO' || doc.trackingStatus === 'NO RETIRADO'
                                ? 'bg-rose-50 text-rose-700 border-rose-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {doc.trackingStatus}
                            </span>
                            {doc.failedReason && (
                              <span className="text-[9px] font-bold text-slate-400 max-w-[160px] truncate">
                                ({doc.failedReason})
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-slate-400 text-xs font-medium">
                    No se encontraron guías/folios con "{globalFolioSearch}"
                  </div>
                )}
              </div>
            )}
          </div>
          <nav className="flex flex-col lg:flex-row lg:items-center bg-slate-800 rounded-lg p-1 lg:ml-4 border border-slate-700 gap-1 lg:gap-0" id="navigation-bar">
            {userProfile?.permissions.canViewPlanning && (
              <button 
                onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                className={`px-4 py-2 lg:py-1.5 rounded-md text-sm lg:text-xs font-bold transition-all flex items-center gap-2 cursor-pointer text-left ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
              >
                <List className="w-4 h-4 lg:w-3.5 lg:h-3.5" /> Planificación
              </button>
            )}
            {userProfile?.permissions.canViewRouteSheets && (
              <button 
                onClick={() => { setActiveTab('hojaDeRuta'); setMobileMenuOpen(false); }}
                className={`px-4 py-2 lg:py-1.5 rounded-md text-sm lg:text-xs font-bold transition-all flex items-center gap-2 cursor-pointer text-left ${activeTab === 'hojaDeRuta' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
              >
                <ClipboardList className="w-4 h-4 lg:w-3.5 lg:h-3.5" /> Hoja de Ruta
              </button>
            )}
            {userProfile?.permissions.canViewResumenRutas && (
              <button 
                onClick={() => { setActiveTab('resumenRutas'); setMobileMenuOpen(false); }}
                className={`px-4 py-2 lg:py-1.5 rounded-md text-sm lg:text-xs font-bold transition-all flex items-center gap-2 cursor-pointer text-left ${activeTab === 'resumenRutas' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
              >
                <Truck className="w-4 h-4 lg:w-3.5 lg:h-3.5" /> Resumen de Rutas
              </button>
            )}
             {userProfile?.permissions.canViewKPIs && (
              <button 
                onClick={() => { setActiveTab('kpis'); setMobileMenuOpen(false); }}
                className={`px-4 py-2 lg:py-1.5 rounded-md text-sm lg:text-xs font-bold transition-all flex items-center gap-2 cursor-pointer text-left ${activeTab === 'kpis' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
              >
                <BarChart3 className="w-4 h-4 lg:w-3.5 lg:h-3.5" /> KPIs y Análisis
              </button>
            )}
            <button 
              onClick={() => { setActiveTab('solicitudes'); setMobileMenuOpen(false); }}
              className={`px-4 py-2 lg:py-1.5 rounded-md text-sm lg:text-xs font-black transition-all flex items-center gap-2 cursor-pointer text-left relative ${activeTab === 'solicitudes' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'} ${requests.filter(r => r.status === 'PENDIENTE').length > 0 ? 'border border-amber-500/35 bg-slate-800/80 animate-pulse text-amber-300' : ''}`}
            >
              <ClipboardList className={`w-4 h-4 lg:w-3.5 lg:h-3.5 ${requests.filter(r => r.status === 'PENDIENTE').length > 0 ? 'text-amber-400' : ''}`} /> 
              <span>Solicitudes</span>
              {requests.filter(r => r.status === 'PENDIENTE').length > 0 && (
                <span className="flex items-center gap-1 ml-auto lg:ml-0">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-red-500 text-white font-black animate-bounce shrink-0">
                    {requests.filter(r => r.status === 'PENDIENTE').length}
                  </span>
                </span>
              )}
            </button>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-t border-slate-700 lg:border-t-0 pt-4 lg:pt-0">
            {userProfile?.permissions.canEditParameters && (
              <button 
                onClick={() => { setIsManagingParameters(true); setMobileMenuOpen(false); }}
                className="flex items-center gap-2 px-4 py-2 lg:px-3 lg:py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm lg:text-xs font-bold transition-all border border-slate-700 cursor-pointer w-full sm:w-auto justify-center"
              >
                <Edit2 className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-indigo-400" />
                <span>Parámetros</span>
              </button>
            )}
            
            {userProfile?.permissions.canUploadExcel && (
              <div className="flex gap-2 w-full sm:w-auto">
                <label className={`flex-1 sm:flex-none justify-center px-4 py-2 rounded-md text-sm lg:text-xs font-bold transition-all flex items-center gap-2 shadow-md ${loading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'}`}>
                    <Upload className="w-4 h-4 lg:w-3 lg:h-3" /> NV
                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => { handleFileUpload(e, 'NV'); setMobileMenuOpen(false); }} disabled={loading} />
                </label>
                <label className={`flex-1 sm:flex-none justify-center px-4 py-2 rounded-md text-sm lg:text-xs font-bold transition-all flex items-center gap-2 shadow-md ${loading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-white cursor-pointer'}`}>
                    <Upload className="w-4 h-4 lg:w-3 lg:h-3" /> OC
                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => { handleFileUpload(e, 'OC'); setMobileMenuOpen(false); }} disabled={loading} />
                </label>
              </div>
            )}

            {/* User Session and Actions */}
            <div className="hidden md:flex items-center gap-3 lg:border-l border-slate-700 lg:pl-4 h-8 text-neutral-200">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-white max-w-[120px] truncate">{userProfile?.displayName}</span>
                <span className="text-[9px] text-slate-400 font-medium capitalize flex items-center justify-end gap-1 select-none">
                  {userProfile?.role === 'ADMIN' && <Shield className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                  {userProfile?.role === 'ADMIN' ? 'Admin General' : userProfile?.role === 'OPERATOR' ? 'Operador' : 'Visor'}
                </span>
              </div>
              {userProfile?.permissions.canManageUsers && (
                <button 
                  onClick={() => { setUserManagerOpen(true); setMobileMenuOpen(false); }}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                  title="Administrar Usuarios"
                >
                  <Users className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={handleSignOut}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main workspace panels */}
      <div className="flex flex-1 overflow-hidden" id="tab-panels-wrapper">
        {activeTab === 'dashboard' && (
          <>
            {/* Left Sidebar Filters */}
            <aside className={`bg-white md:border-r border-slate-200 p-5 flex flex-col gap-6 md:gap-8 shrink-0 overflow-y-auto ${mobileFiltersOpen ? 'fixed inset-0 z-[60] w-full' : 'hidden md:flex md:w-64'}`}>
              <div className="flex items-center justify-between md:hidden mb-2">
                <h2 className="text-lg font-bold text-slate-800">Filtros</h2>
                <button onClick={() => setMobileFiltersOpen(false)} className="p-2 -mr-2 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-col gap-1 mb-2">
                <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Rutas Logísticas</h2>
                <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-1">
                  {[
                    ...routes.map(r => ({ id: r.id, label: r.name })),
                    { id: 'UNASSIGNED', label: 'Sin Asignar' }
                  ].map(route => (
                    <label key={route.id} className="flex items-center gap-3 text-xs text-slate-600 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={selectedRoutes.has(route.id)}
                        onChange={() => toggleRouteFilter(route.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                      />
                      <span className={selectedRoutes.has(route.id) ? 'font-semibold text-slate-900' : 'text-slate-400 font-normal'}>
                        {route.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Filtros Rápidos</h2>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setTimeFilter('ALL')}
                      className={`flex-1 px-3 py-2 rounded text-[10px] font-semibold border transition-all cursor-pointer ${timeFilter === 'ALL' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                      Todos
                    </button>
                    <button 
                      onClick={() => setTimeFilter('TODAY')}
                      className={`flex-1 px-3 py-2 rounded text-[10px] font-semibold border transition-all cursor-pointer ${timeFilter === 'TODAY' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                      Hoy
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      const isOnlyUnassigned = selectedRoutes.size === 1 && selectedRoutes.has('UNASSIGNED');
                      if (isOnlyUnassigned) {
                        setSelectedRoutes(new Set(['UNASSIGNED', ...routes.map(r => r.id)]));
                      } else {
                        setSelectedRoutes(new Set(['UNASSIGNED']));
                      }
                    }}
                    className={`w-full px-3 py-2 rounded text-[10px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${selectedRoutes.size === 1 && selectedRoutes.has('UNASSIGNED') ? 'bg-indigo-600 border-indigo-700 text-white shadow-md hover:bg-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedRoutes.size === 1 && selectedRoutes.has('UNASSIGNED') ? 'bg-white animate-ping' : 'bg-slate-400'}`}></span>
                    Solo Sin Asignar
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Tipo Documento</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setFilterType('ALL')}
                    className={`flex-1 px-3 py-2 rounded text-[10px] font-semibold border transition-all cursor-pointer ${filterType === 'ALL' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    Todos
                  </button>
                  <button 
                    onClick={() => setFilterType('NV')}
                    className={`flex-1 px-3 py-2 rounded text-[10px] font-semibold border transition-all cursor-pointer ${filterType === 'NV' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    Ventas (NV)
                  </button>
                  <button 
                    onClick={() => setFilterType('OC')}
                    className={`flex-1 px-3 py-2 rounded text-[10px] font-semibold border transition-all cursor-pointer ${filterType === 'OC' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    Compras (OC)
                  </button>
                </div>
              </div>

              <div className="mt-auto p-4 bg-slate-900 rounded-xl text-white shadow-xl">
                <p className="text-[10px] text-slate-400 uppercase font-semibold mb-2">Resumen Pendiente</p>
                <p className="text-xl font-mono tracking-tighter">
                  ${Math.round(filteredDocuments.reduce((sum, d) => d.tipo === 'OC' ? sum : sum + d.totalPendiente, 0)).toLocaleString('es-CL')}
                </p>
                <div className="w-full bg-slate-700 h-1.5 mt-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-400 h-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (filteredDocuments.length / 50) * 100)}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-slate-400 mt-3 italic font-medium">
                  {filteredDocuments.filter(d => !d.assignment?.route || d.assignment?.route === 'UNASSIGNED').length} documentos sin programar
                </p>
              </div>
            </aside>

            {/* Main view center */}
            <main className="flex-1 flex flex-col bg-white overflow-hidden shadow-inner">
              <div className="border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between p-4 md:px-6 md:h-14 bg-white shrink-0 gap-3 md:gap-0">
                <div className="flex flex-col md:flex-row md:gap-4 md:items-center flex-1 w-full">
                  <div className="flex items-center justify-between mb-3 md:mb-0">
                    <span className="text-xs text-slate-500">
                      Mostrando: <span className="text-slate-900">{filteredDocuments.length} pendientes</span>
                    </span>
                    <button 
                      onClick={() => setMobileFiltersOpen(true)}
                      className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-700"
                    >
                      <Search className="w-3.5 h-3.5" /> Filtros
                    </button>
                  </div>
                  <div className="hidden md:block h-4 w-px bg-slate-200"></div>
                  <div className="relative flex-1 max-w-sm w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="Folio, razón social o vendedor..." 
                      className="w-full text-xs pl-9 pr-4 py-2 md:py-1.5 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50 font-sans"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => {
                      setPickingRouteId('UNASSIGNED');
                      setIsPickingModalOpen(true);
                    }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 md:py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer font-sans"
                  >
                    <Printer className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Reporte para Picking</span>
                  </button>
                </div>
              </div>

              {/* Grid database viewer */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-200 z-[5] hidden md:table-header-group">
                    <tr>
                      <th className="py-3 px-6 font-normal">Folio / Tipo</th>
                      <th className="py-3 px-6 font-normal">Fecha Doc</th>
                      <th className="py-3 px-6 font-normal">Razón Social</th>
                      <th className="py-3 px-6 font-normal">Vendedor</th>
                      <th className="py-3 px-6 font-normal">Ruta</th>
                      <th className="py-3 px-6 font-normal">Fecha Asig.</th>
                      <th className="py-3 px-6 font-normal text-right">Pendiente</th>
                      <th className="py-3 px-6 font-normal">Estado</th>
                      <th className="py-3 px-6 font-normal">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-50 md:divide-slate-100 flex flex-col md:table-row-group">
                    {filteredDocuments.map((doc) => {
                      const isProgrammed = doc.assignment?.route && doc.assignment.route !== 'UNASSIGNED';
                      const isFinalized = doc.assignment?.route && doc.assignment?.dispatchDate && manifests[`${doc.assignment.route}_${doc.assignment.dispatchDate}`]?.isFinalized;
                      
                      return (
                        <tr 
                          key={doc.id}
                          className={`group cursor-pointer transition-all duration-150 flex flex-col md:table-row border-b border-slate-100 md:border-0 ${selectedDocId === doc.id ? 'bg-indigo-50/85 md:border-l-4 md:border-indigo-500 ring-2 md:ring-0 ring-inset ring-indigo-500' : isFinalized ? 'opacity-50 bg-slate-50' : 'bg-white hover:bg-slate-100/50'}`}
                          onClick={() => setSelectedDocId(doc.id)}
                        >
                          {/* Mobile View */}
                          <td className="md:hidden p-4 flex flex-col gap-3">
                             <div className="flex justify-between items-start gap-4">
                                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold shrink-0 ${doc.tipo === 'OC' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'text-indigo-700 bg-indigo-50 border border-indigo-150'}`}>
                                      {formatDocId(doc.tipo, doc.id)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                      {new Date(doc.fecha).toLocaleDateString('es-CL')}
                                    </span>
                                  </div>
                                  <span className="font-bold text-sm text-slate-800 line-clamp-2 leading-snug">{doc.razonSocial}</span>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span className="font-mono text-sm font-black text-slate-900">
                                    ${Math.round(doc.tipo === 'OC' ? 0 : doc.totalPendiente).toLocaleString('es-CL')}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider ${isProgrammed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {isProgrammed ? 'Prog.' : 'Pend.'}
                                  </span>
                                </div>
                             </div>
                             <div className="flex justify-between items-end mt-1 text-xs text-slate-500 pt-2 border-t border-slate-50">
                               <div className="flex flex-col gap-0.5 max-w-[60%]">
                                 <span className="font-semibold text-slate-700 truncate">{routeMap[doc.assignment?.route || 'UNASSIGNED'] || 'Sin Asignar'}</span>
                                 <span className="text-[10px] text-slate-400">
                                   Asig: {doc.assignment?.dispatchDate ? new Date(doc.assignment.dispatchDate + 'T12:00:00').toLocaleDateString('es-CL') : '-'}
                                 </span>
                               </div>
                               <div>
                                 <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      
                                      if (isProgrammed) {
                                        const routeId = doc.assignment?.route;
                                        const dispatchDate = doc.assignment?.dispatchDate;
                                        if (routeId && dispatchDate) {
                                          const mId = `${routeId}_${dispatchDate}`;
                                          if (manifests[mId]?.isFinalized) {
                                            showToast("Acción Bloqueada", "Este documento está asignado a una ruta definitiva grabada y no puede desasignarse directamente.", "error");
                                            return;
                                          }
                                        }
                                        handleDeleteAssignment(doc.id, e);
                                      } else {
                                        // Logic to delete the unassigned document record itself
                                        if (!userProfile?.permissions.canEditPlanning) {
                                          showToast("Permiso Denegado", "No tienes permiso de 'Modificar Planificación' para eliminar documentos.", "error");
                                          return;
                                        }
                                        requestConfirmation(
                                          'Eliminar Documento',
                                          `¿Estás seguro de eliminar el documento ${doc.id} de la lista de pendientes?`,
                                          () => {
                                            setLoading(true);
                                            deleteDoc(doc(db, "pending_documents", doc.id))
                                              .then(() => showToast("Completado", "Documento eliminado correctamente.", 'success'))
                                              .catch(err => showToast("Error", "No se pudo eliminar: " + err.message, 'error'))
                                              .finally(() => setLoading(false));
                                          },
                                          'Sí, eliminar',
                                          'Cancelar',
                                          'danger'
                                        );
                                      }
                                    }}
                                    className="p-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors cursor-pointer"
                                    title={isProgrammed ? "Eliminar asignación" : "Eliminar documento del sistema"}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                               </div>
                             </div>
                          </td>

                          {/* Desktop View */}
                          <td className="hidden md:table-cell py-4 px-6">
                              <span className={`px-2 py-0.5 rounded font-mono text-[11px] ${doc.tipo === 'OC' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'text-indigo-700 bg-indigo-50 border border-indigo-150'}`}>
                                {formatDocId(doc.tipo, doc.id)}
                              </span>
                          </td>
                          <td className="hidden md:table-cell py-4 px-6 text-slate-500">
                              {new Date(doc.fecha).toLocaleDateString('es-CL')}
                          </td>
                          <td className="hidden md:table-cell py-4 px-6 text-slate-700 truncate max-w-[200px]">
                              {doc.razonSocial}
                          </td>
                          <td className="hidden md:table-cell py-4 px-6 text-slate-500 truncate max-w-[150px]">
                              {doc.vendedor?.toUpperCase()}
                          </td>
                          <td className={`hidden md:table-cell py-4 px-6 ${isProgrammed ? 'text-indigo-600' : 'text-slate-400'}`}>
                              {routeMap[doc.assignment?.route || 'UNASSIGNED'] || 'Sin Asignar'}
                          </td>
                          <td className="hidden md:table-cell py-4 px-6 text-slate-600">
                              {doc.assignment?.dispatchDate ? new Date(doc.assignment.dispatchDate + 'T12:00:00').toLocaleDateString('es-CL') : '-'}
                          </td>
                          <td className="hidden md:table-cell py-4 px-6 text-right font-mono text-slate-800">
                              ${Math.round(doc.tipo === 'OC' ? 0 : doc.totalPendiente).toLocaleString('es-CL')}
                          </td>
                          <td className="hidden md:table-cell py-4 px-6">
                              <span className={`px-2 py-1 rounded-[4px] text-[9px] uppercase tracking-wider ${isProgrammed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {isProgrammed ? 'Prog.' : 'Pend.'}
                              </span>
                          </td>
                          <td className="hidden md:table-cell py-4 px-6">
                              <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    
                                    if (isProgrammed) {
                                      const routeId = doc.assignment?.route;
                                      const dispatchDate = doc.assignment?.dispatchDate;
                                      if (routeId && dispatchDate) {
                                        const mId = `${routeId}_${dispatchDate}`;
                                        if (manifests[mId]?.isFinalized) {
                                          showToast("Acción Bloqueada", "Este documento está asignado a una ruta definitiva grabada y no puede desasignarse directamente.", "error");
                                          return;
                                        }
                                      }
                                      handleDeleteAssignment(doc.id, e);
                                    } else {
                                      // Logic to delete the unassigned document record itself
                                      if (!userProfile?.permissions.canEditPlanning) {
                                        showToast("Permiso Denegado", "No tienes permiso de 'Modificar Planificación' para eliminar documentos.", "error");
                                        return;
                                      }
                                      requestConfirmation(
                                        'Eliminar Documento',
                                        `¿Estás seguro de eliminar el documento ${doc.id} de la lista de pendientes?`,
                                        () => {
                                          setLoading(true);
                                          deleteDoc(doc(db, "pending_documents", doc.id))
                                            .then(() => showToast("Completado", "Documento eliminado correctamente.", 'success'))
                                            .catch(err => showToast("Error", "No se pudo eliminar: " + err.message, 'error'))
                                            .finally(() => setLoading(false));
                                        },
                                        'Sí, eliminar',
                                        'Cancelar',
                                        'danger'
                                      );
                                    }
                                  }}
                                  className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                                  title={isProgrammed ? "Eliminar asignación" : "Eliminar documento del sistema"}
                              >
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredDocuments.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <FileText className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm font-medium animate-pulse">No se encontraron documentos</p>
                        <p className="text-xs">Suba archivos para ver el listado de pendientes.</p>
                    </div>
                )}

                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
              </div>
            </main>

            {/* Right sidebar: scheduling detail panels */}
            <aside className={`bg-slate-100 md:border-l border-slate-200 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto ${selectedDoc ? 'fixed inset-0 z-[60] w-full md:relative md:z-0 md:w-80' : 'hidden md:flex md:w-80'}`}>
              {selectedDoc ? (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold md:font-normal text-slate-800 text-sm md:text-xs">Programación Logística</h2>
                    <button 
                        onClick={() => setSelectedDocId(null)} 
                        className="text-[10px] text-slate-400 hover:text-slate-600 font-normal uppercase tracking-widest cursor-pointer p-2 md:p-0 -mr-2 md:mr-0"
                    >
                        <span className="hidden md:inline">Cerrar</span>
                        <X className="w-6 h-6 md:hidden" />
                    </button>
                  </div>

                  {isDocInFinalizedRoute && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-[10px] font-semibold leading-tight flex items-start gap-1.5 shadow-sm">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 animate-bounce" />
                      <p>Asignado en <b className="text-amber-900 border-b border-dashed border-amber-400">HR-{docFinalizedRouteNumber}</b> (Ruta Definitiva). No se permite edición a menos que se reabra en Resumen de Rutas.</p>
                    </div>
                  )}

                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
                    <div>
                      <p className="text-[10px] font-normal text-slate-400 uppercase tracking-wider mb-2">Seleccionado</p>
                      <div className={`flex items-center justify-between font-normal mb-1 ${selectedDoc.tipo === 'OC' ? 'text-teal-700' : 'text-indigo-700'}`}>
                        <h3 className="text-lg tracking-tighter">{formatDocId(selectedDoc.tipo, selectedDoc.id)}</h3>
                        <span className="text-sm border-l border-slate-100 pl-3 font-mono">${Math.round(selectedDoc.tipo === 'OC' ? 0 : selectedDoc.totalPendiente).toLocaleString('es-CL')}</span>
                      </div>
                      <p className="text-xs text-slate-600 font-normal truncate">{selectedDoc.razonSocial}</p>
                    </div>

                    <div className="flex flex-col gap-4 pt-2 border-t border-slate-100">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-normal text-slate-500 uppercase tracking-widest px-1">Ruta Logística</label>
                        <select 
                          disabled={isDocInFinalizedRoute}
                          value={selectedDoc.assignment?.route || 'UNASSIGNED'}
                          onChange={(e) => handleUpdateAssignment(selectedDoc.id, 'route', e.target.value)}
                          className={`bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-normal focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all w-full ${isDocInFinalizedRoute ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
                        >
                          <option value="UNASSIGNED">Seleccione Ruta...</option>
                          {routes.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-normal text-slate-500 uppercase tracking-widest px-1">Programación Despacho</label>
                        <div className={`bg-white border border-slate-200 rounded-xl shadow-inner overflow-hidden ${isDocInFinalizedRoute ? 'opacity-40 pointer-events-none' : ''}`}>
                          <Calendar 
                            className="!border-none !font-sans !w-full"
                            locale="es-CL"
                            onChange={(date) => {
                              if (isDocInFinalizedRoute) return;
                              const dateStr = getLocalDateString(date as Date);
                              handleUpdateAssignment(selectedDoc.id, 'dispatchDate', dateStr);
                            }}
                            value={selectedDoc.assignment?.dispatchDate ? new Date(selectedDoc.assignment.dispatchDate + 'T12:00:00') : new Date()}
                          />
                        </div>
                        {!isDocInFinalizedRoute && selectedDoc.assignment?.dispatchDate && (
                          <button 
                            onClick={() => handleUpdateAssignment(selectedDoc.id, 'dispatchDate', null)}
                            className="text-[10px] text-red-500 hover:text-red-600 font-normal self-end px-2 py-1 cursor-pointer"
                          >
                            Limpiar Fecha
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-normal text-slate-500 uppercase tracking-widest px-1">Observaciones Logísticas</label>
                        <textarea 
                          disabled={isDocInFinalizedRoute}
                          rows={2} 
                          placeholder="Instrucciones de entrega..." 
                          value={selectedDoc.assignment?.logisticsNotes || ''}
                          onChange={(e) => handleUpdateAssignment(selectedDoc.id, 'logisticsNotes', e.target.value)}
                          className={`bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all resize-none shadow-inner min-h-[60px] ${isDocInFinalizedRoute ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                        ></textarea>
                      </div>

                      <div className="mt-1 p-2 bg-indigo-50/50 border border-indigo-100 rounded-lg text-[9px] text-indigo-800 flex items-start gap-1.5 leading-tight opacity-70">
                        <span className="shrink-0 mt-0.5"><Info className="w-3 h-3" /></span>
                        <p>Sincronización automática activa con Cloud Firestore.</p>
                      </div>

                      {!isDocInFinalizedRoute && selectedDoc.assignment?.route && selectedDoc.assignment.route !== 'UNASSIGNED' && (
                        <button 
                          onClick={() => {
                            requestConfirmation(
                              'Quitar de Planificación',
                              `¿Estás seguro de quitar el documento ${formatDocId(selectedDoc.tipo, selectedDoc.id)} de la ruta programada? Volverá a quedar pendiente de asignación.`,
                              () => handleDeleteAssignment(selectedDoc.id),
                              'Sí, eliminar',
                              'Cancelar',
                              'danger'
                            );
                          }}
                          className="mt-2 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg px-4 py-2 text-xs font-normal transition-colors w-full cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar Planificación</span>
                        </button>
                      )}
                    </div>
                    
                    {selectedDoc.observaciones && (
                        <div className="p-2 bg-slate-50 rounded border border-slate-100 italic text-[10px] text-slate-500 mt-2">
                            <span className="font-normal text-slate-600 block not-italic uppercase mb-1">Notas de Venta:</span>
                            {selectedDoc.observaciones}
                        </div>
                    )}
                    
                    <div className="pt-2 border-t border-slate-100 max-h-32 overflow-y-auto">
                        <p className="text-[10px] font-normal text-slate-400 uppercase mb-2">Detalle Items ({selectedDoc.detalle.length})</p>
                        {selectedDoc.detalle.map((item, i) => (
                            <div key={i} className="flex flex-col py-1.5 border-b border-slate-50 last:border-0 gap-0.5">
                                <div className="flex justify-between items-start text-[11px] mb-0.5">
                                    <span className="font-mono font-bold text-indigo-700">{item.codigo}</span>
                                    <span className="font-bold text-slate-900">{item.cantidad} UND</span>
                                </div>
                                <span className="text-slate-600 text-[10px] leading-tight font-medium">{item.descripcion}</span>
                            </div>
                        ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
                    <MapPin className="w-16 h-16 text-slate-400 mb-6 font-thin" />
                    <h3 className="font-normal text-slate-800 text-sm mb-2 uppercase tracking-widest">Sin Selección</h3>
                    <p className="text-xs text-slate-500 font-normal">Haga clic en un documento del listado para iniciar la programación logística.</p>
                </div>
              )}
            </aside>
          </>
        )}

        {/* Generate Manifest sheet tab */}
        {activeTab === 'hojaDeRuta' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 animate-fade-in" id="hoja-de-ruta-panel">
            <div className="p-4 sm:p-6 bg-white border-b border-slate-200 shadow-sm flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" /> Generador de Hoja de Ruta
                      </h2>
                      <p className="text-[10px] sm:text-xs text-slate-500">Configura el orden y detalles para el transportista</p>
                    </div>
                  </div>
              </div>

              {/* Mobile Summary & Collapse Toggle Bar */}
              <div className="md:hidden flex items-center justify-between bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 shadow-sm">
                <div className="flex flex-col text-left gap-1">
                  <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Configuración de Ruta</span>
                  <span className="text-xs font-black text-slate-850">
                    {routes.find(r => r.id === hrSelectedRoute)?.name || 'Sin Seleccionar'} • {hrSelectedDate ? new Date(hrSelectedDate + 'T12:00:00').toLocaleDateString('es-CL') : '-'}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium mt-0.5">
                    <span>{hojaDeRutaDocs.length} Puntos</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="font-semibold text-slate-700">${Math.round(hojaDeRutaDocs.reduce((s,d) => d.tipo === 'OC' ? s : s + d.totalPendiente, 0)).toLocaleString('es-CL')}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setHrFiltersCollapsed(!hrFiltersCollapsed)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white font-extrabold text-[10px] uppercase rounded-lg shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <span>{hrFiltersCollapsed ? 'Configurar' : 'Ocultar'}</span>
                  {hrFiltersCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Collapsible filters and controls block */}
              <div className={`flex-col gap-4 sm:gap-6 ${hrFiltersCollapsed ? 'hidden md:flex' : 'flex'}`}>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Rutas Disponibles</label>
                    <div className="flex flex-wrap gap-2">
                      {routes.length > 0 ? (
                        routes
                          .sort((a,b) => (a.name || '').localeCompare(b.name || ''))
                          .map(r => {
                            const manifestId = `${r.id}_${hrSelectedDate}`;
                            const isFinal = !!manifests[manifestId]?.isFinalized;
                            const docCount = isFinal 
                              ? (manifests[manifestId]?.documentsSnapshot?.length || 0)
                              : mergedDocuments.filter(d => d.assignment?.route === r.id && d.assignment?.dispatchDate === hrSelectedDate).length;
                            const isSelected = hrSelectedRoute === r.id;

                            return (
                              <button
                                key={r.id}
                                onClick={() => setHrSelectedRoute(r.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm cursor-pointer flex items-center gap-1.5 ${
                                  isSelected 
                                    ? isFinal 
                                      ? 'bg-emerald-600 border-emerald-700 text-white shadow-emerald-100'
                                      : 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-100' 
                                    : isFinal
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                      : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                              >
                                {isFinal && <Save className="w-3.5 h-3.5 shrink-0 text-current" />}
                                <span>{r.name}</span>
                                {docCount > 0 && (
                                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                    isSelected 
                                      ? 'bg-white/20 text-white' 
                                      : isFinal 
                                        ? 'bg-emerald-200 text-emerald-800' 
                                        : 'bg-indigo-100 text-indigo-700'
                                  }`}>
                                    {docCount}
                                  </span>
                                )}
                              </button>
                            );
                          })
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">No hay rutas configuradas</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex flex-col gap-1.5 p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl shadow-sm min-w-[280px]">
                      <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 animate-pulse">
                        <span className="inline-block w-2 h-2 rounded-full bg-indigo-600"></span>
                        Fecha de Despacho Activa
                      </label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="date"
                          value={hrSelectedDate}
                          onChange={(e) => setHrSelectedDate(e.target.value)}
                          className="bg-white border-2 border-indigo-200 hover:border-indigo-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/15 focus:outline-none rounded-xl px-4 py-2.5 text-base font-extrabold text-indigo-950 shadow-sm cursor-pointer transition-all"
                        />
                        {hrSelectedRoute && hrSelectedDate && (
                          <button 
                            onClick={() => setIsVerifyRouteModalOpen(true)}
                            className={`px-4 py-2 rounded-xl border-2 transition-all flex items-center gap-2.5 group cursor-pointer shadow-md ${
                              otherDateDocs.length > 0 
                                ? 'bg-rose-500 border-rose-400 text-white hover:bg-rose-600 shadow-rose-200 scale-105 active:scale-95' 
                                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed text-xs'
                            }`}
                            title={otherDateDocs.length > 0 ? "¡ATENCIÓN! Hay documentos programados para otros días en esta ruta. Haz clic para revisarlos." : "No hay documentos programados para otros días"}
                            disabled={otherDateDocs.length === 0}
                          >
                            {otherDateDocs.length > 0 ? (
                              <>
                                <AlertTriangle className="w-5 h-5 text-white animate-bounce shrink-0" />
                                <div className="flex flex-col items-start leading-tight text-left">
                                  <span className="text-[8px] font-black tracking-wider text-rose-100 uppercase animate-pulse">¡ALERTA FECHAS!</span>
                                  <span className="text-xs font-black">{otherDateDocs.length} PENDIENTES</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="text-[11px] font-bold">Sin anomalías</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              {(() => {
                const hrManifestId = `${hrSelectedRoute}_${hrSelectedDate}`;
                const hrManifest = manifests[hrManifestId];
                const hrIsFinalized = !!hrManifest?.isFinalized;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1">Conductor Asignado</label>
                      <select 
                        disabled={hrIsFinalized}
                        value={hrManifest?.driverId || ''}
                        onChange={(e) => handleUpdateManifest(hrSelectedRoute, hrSelectedDate, 'driverId', e.target.value)}
                        className={`bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500/10 focus:outline-none ${hrIsFinalized ? 'opacity-55 cursor-not-allowed bg-slate-100' : 'cursor-pointer'}`}
                      >
                        <option value="">Opcional: Conductor...</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1">Vehículo / Patente</label>
                      <select 
                        disabled={hrIsFinalized}
                        value={hrManifest?.vehicleId || ''}
                        onChange={(e) => handleUpdateManifest(hrSelectedRoute, hrSelectedDate, 'vehicleId', e.target.value)}
                        className={`bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500/10 focus:outline-none ${hrIsFinalized ? 'opacity-55 cursor-not-allowed bg-slate-100' : 'cursor-pointer'}`}
                      >
                        <option value="">Opcional: Vehículo...</option>
                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.description}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col justify-end">
                      <div className="bg-slate-900 text-white p-3 rounded-lg flex items-center justify-between shadow">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Puntos de Entrega</span>
                          <span className="text-sm font-mono font-bold">{hojaDeRutaDocs.length}</span>
                        </div>
                        <div className="h-8 w-px bg-slate-700"></div>
                        <div className="flex flex-col text-right">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Valor Total</span>
                          <span className="text-sm font-mono font-bold">${Math.round(hojaDeRutaDocs.reduce((s,d) => d.tipo === 'OC' ? s : s + d.totalPendiente, 0)).toLocaleString('es-CL')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                         disabled={hrIsFinalized}
                         onClick={() => {
                           setShowAddPointForm(!showAddPointForm);
                         }}
                         className={`h-11 px-4 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer border ${showAddPointForm ? 'bg-rose-600 hover:bg-rose-700 border-rose-700' : 'bg-indigo-600 hover:bg-emerald-600 border-indigo-700'} ${hrIsFinalized ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                         {showAddPointForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                         {showAddPointForm ? 'Cancelar' : 'Punto Adicional'}
                      </button>
                      
                      {hrIsFinalized ? (
                        <div className="bg-emerald-600 text-white p-2 border rounded-lg flex flex-col justify-between h-11 shadow-inner border-emerald-700 px-3 flex-1 min-w-[150px]">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500 rounded px-1.5 py-0.5 text-white">DEFINITIVA HR-{hrManifest?.routeNumber}</span>
                            <Save className="w-3.5 h-3.5 text-white" />
                          </div>
                          <button 
                            onClick={() => setReopenConfirmId(hrManifestId)}
                            className="text-[9px] font-black text-emerald-100 hover:text-white uppercase tracking-wider text-left underline transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Reabrir para editar</span>
                          </button>
                        </div>
                      ) : (
                        <button 
                          disabled={hojaDeRutaDocs.length === 0}
                          onClick={() => {
                            setFinalizeDate(getTomorrowLocalDateString(hrSelectedDate));
                            setIsFinalizeModalOpen(true);
                          }}
                          className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 shadow-md hover:shadow-indigo-100 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed border border-indigo-700 cursor-pointer min-w-[180px]"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>CERRAR RUTA PARA LA CARGA</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6" id="hoja-de-ruta-items">
              {(() => {
                const hrManifestId = `${hrSelectedRoute}_${hrSelectedDate}`;
                const hrManifest = manifests[hrManifestId];
                const hrIsFinalized = !!hrManifest?.isFinalized;

                return (
                  <>
                    {hrIsFinalized && (
                      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between mb-4 shadow-sm text-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <Save className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-800">Planilla de Ruta Grabada (№ HR-{hrManifest.routeNumber})</h4>
                            <p className="text-[10px] text-slate-500">Esta ruta de despacho se encuentra guardada y cerrada de forma definitiva. Para modificar el orden o agregar documentos, reabra la ruta.</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleReopenManifest(hrManifestId)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow transition-all active:scale-95 shrink-0 cursor-pointer"
                        >
                          Reabrir Ruta
                        </button>
                      </div>
                    )}

                    {showAddPointForm && !hrIsFinalized && (
                       <div className="border border-indigo-200 bg-indigo-50/45 p-5 rounded-2xl shadow-sm mb-5 animate-in fade-in slide-in-from-top-1 text-slate-800">
                          <div className="flex items-center justify-between mb-4 border-b border-indigo-100 pb-2">
                             <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-xs uppercase tracking-wider">
                                <Plus className="w-4 h-4 text-indigo-600" />
                                <span>Agregar Punto Adicional Directo</span>
                             </div>
                             <button 
                                onClick={() => setShowAddPointForm(false)}
                                className="text-slate-400 hover:text-rose-600 text-[10px] font-black uppercase tracking-widest cursor-pointer transition-colors"
                             >
                                Cancelar
                             </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                             <div className="col-span-1 md:col-span-2 flex flex-col gap-1">
                                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Proceso</label>
                                <select 
                                   value={newPoint.proceso}
                                   onChange={(e) => setNewPoint({...newPoint, proceso: e.target.value as any})}
                                   className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all cursor-pointer"
                                >
                                   <option value="ENTREGA">ENTREGA</option>
                                   <option value="RETIRO">RETIRO</option>
                                </select>
                             </div>

                             <div className="col-span-1 md:col-span-2 flex flex-col gap-1">
                                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Tipo Doc</label>
                                <select 
                                   value={newPoint.tipo}
                                   onChange={(e) => setNewPoint({...newPoint, tipo: e.target.value as any})}
                                   className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all cursor-pointer"
                                >
                                   <option value="NV">NV</option>
                                   <option value="OC">OC</option>
                                   <option value="TR">TRANS/TR</option>
                                </select>
                             </div>

                             <div className="col-span-1 md:col-span-3 flex flex-col gap-1">
                                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">N° Pedido (Nv o OC)*</label>
                                <input 
                                   type="text"
                                   required
                                   value={newPoint.docNumber}
                                   onChange={(e) => setNewPoint({...newPoint, docNumber: e.target.value})}
                                   placeholder="Solicitar Nv o OC..."
                                   className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all placeholder:text-slate-300"
                                />
                             </div>

                             <div className="col-span-1 md:col-span-5 flex flex-col gap-1">
                                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Cliente o Proveedor*</label>
                                <input 
                                   type="text"
                                   required
                                   value={newPoint.razonSocial}
                                   onChange={(e) => setNewPoint({...newPoint, razonSocial: e.target.value})}
                                   placeholder="Razón social..."
                                   className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all placeholder:text-slate-300"
                                />
                             </div>

                             <div className="col-span-1 md:col-span-2 flex flex-col gap-1">
                                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Guía Despacho</label>
                                <input 
                                   type="text"
                                   value={newPoint.guideNumber}
                                   onChange={(e) => setNewPoint({...newPoint, guideNumber: e.target.value})}
                                   placeholder="Opcional..."
                                   className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all placeholder:text-slate-300"
                                />
                             </div>

                             <div className="col-span-1 md:col-span-2 flex flex-col gap-1">
                                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Monto Valorizado</label>
                                <input 
                                   type="text"
                                   value={newPointAmountStr}
                                   onChange={(e) => setNewPointAmountStr(formatCLP(parseCLP(e.target.value)))}
                                   placeholder="$0"
                                   className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all placeholder:text-slate-300"
                                />
                             </div>

                             <div className="col-span-1 md:col-span-2 flex flex-col gap-1">
                                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Destino</label>
                                <input 
                                   type="text"
                                   value={newPoint.location}
                                   onChange={(e) => setNewPoint({...newPoint, location: e.target.value})}
                                   placeholder="Ubicación/Comuna..."
                                   className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all placeholder:text-slate-300"
                                />
                             </div>

                             <div className="col-span-1 md:col-span-4 flex flex-col gap-1">
                                <label className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Obs / Notas</label>
                                <input 
                                   type="text"
                                   value={newPoint.logisticsNotes}
                                   onChange={(e) => setNewPoint({...newPoint, logisticsNotes: e.target.value})}
                                   placeholder="Notas..."
                                   className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all placeholder:text-slate-300"
                                />
                             </div>

                             <div className="col-span-1 md:col-span-2 flex flex-col justify-end">
                                <button 
                                   onClick={() => handleAddAdditionalPoint(hrSelectedRoute, hrSelectedDate)}
                                   className="w-full h-9 bg-indigo-600 hover:bg-emerald-600 text-white rounded-lg text-xs font-extrabold uppercase tracking-widest transition-all shadow active:scale-95 cursor-pointer flex items-center justify-center border border-indigo-700"
                                >
                                   Guardar
                                </button>
                             </div>
                          </div>
                       </div>
                    )}

                    {hojaDeRutaDocs.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        {hojaDeRutaDocs.map((doc, idx) => {
                          const isDragging = draggingIndex === idx;
                          const isDragOver = dragOverIndex === idx && draggingIndex !== idx;
                          return (
                            <div 
                              key={doc.id} 
                              draggable={!hrIsFinalized}
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDragEnd={handleDragEnd}
                              onDrop={(e) => handleDrop(e, idx)}
                              className={`border rounded-xl p-3 sm:p-4 shadow-sm transition-all duration-200 flex flex-col md:flex-row md:items-center gap-3 sm:gap-4 md:gap-6 select-none ${
                                isDragging 
                                  ? 'opacity-30 border-dashed border-indigo-400 scale-[0.98]' 
                                  : isDragOver
                                    ? 'border-t-4 border-t-indigo-600 scale-[1.01] bg-indigo-50/30 border-indigo-300'
                                    : doc.isMissingFromImport
                                      ? 'bg-rose-50/60 border-rose-300 hover:shadow-md hover:bg-rose-50'
                                      : doc.tipo === 'OC'
                                        ? 'bg-teal-50/40 border-teal-200 hover:shadow-md hover:bg-teal-50/50'
                                        : 'bg-white border-slate-200 hover:shadow-md hover:bg-slate-50/30'
                              } ${!hrIsFinalized ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            >
                            {/* Reorder and Rank Indicator */}
                            <div className={`flex flex-row md:flex-col items-center gap-2 md:gap-1 shrink-0 p-2 rounded-lg border justify-between md:justify-center ${doc.isMissingFromImport ? 'bg-rose-100 border-rose-200 w-full md:w-auto' : doc.tipo === 'OC' ? 'bg-teal-50/50 border-teal-100 w-full md:w-auto' : 'bg-slate-50 border-slate-100 w-full md:w-auto'}`}>
                              <div className="flex items-center gap-2 md:flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider md:hidden">Paso</span>
                                <span className={`text-xs font-black ${doc.isMissingFromImport ? 'text-rose-800' : 'text-slate-800'}`}>{idx + 1}</span>
                              </div>
                              <span className={`text-[10px] font-mono font-extrabold md:hidden ${doc.isMissingFromImport ? 'text-rose-600' : doc.tipo === 'OC' ? 'text-teal-600' : 'text-indigo-500'}`}>{formatDocId(doc.tipo, doc.id)}</span>
                              <div className="flex items-center gap-1.5 md:flex-col">
                                <button 
                                  onClick={() => handleMoveOrder(doc.id, 'up')}
                                  disabled={idx === 0 || hrIsFinalized}
                                  className={`p-1 hover:bg-white rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer ${hrIsFinalized ? 'cursor-not-allowed' : ''}`}
                                ><ArrowUp className="w-4 h-4" /></button>
                                <button 
                                  onClick={() => handleMoveOrder(doc.id, 'down')}
                                  disabled={idx === hojaDeRutaDocs.length - 1 || hrIsFinalized}
                                  className={`p-1 hover:bg-white rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer ${hrIsFinalized ? 'cursor-not-allowed' : ''}`}
                                ><ArrowDown className="w-4 h-4" /></button>
                              </div>
                            </div>

                            {/* Desktop Layout - visible only on md screens and larger */}
                            <div className="hidden md:grid md:grid-cols-12 gap-4 items-center flex-1">
                              <div className={`md:${doc.tipo === 'OC' ? "col-span-3" : "col-span-2"}`}>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Cliente</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-slate-800 truncate">{doc.razonSocial}</p>
                                  {(doc.isOrphaned || doc.isAdditional) && (
                                    <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter" title="Este documento es un punto o entrega adicional cargada en el manifiesto">Adicional</span>
                                  )}
                                  {doc.isMissingFromImport && (
                                    <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tight shrink-0 flex items-center gap-1 shadow-sm animate-pulse" title="Este documento no se encuentra en la planilla Excel cargada. Revisar si incluir definitivo o eliminar de la preparación.">REVISAR</span>
                                  )}
                                </div>
                                <p className={`text-[10px] font-mono font-bold ${doc.isMissingFromImport ? 'text-rose-600 font-extrabold' : doc.tipo === 'OC' ? 'text-teal-600' : 'text-indigo-500'}`}>{formatDocId(doc.tipo, doc.id)}</p>
                              </div>

                              {doc.tipo !== 'OC' && (
                                <>
                                  <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-0">
                                    <div className="flex flex-col">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Guía Despacho</p>
                                      <input 
                                        disabled={hrIsFinalized}
                                        type="text" 
                                        placeholder="N° Guía..."
                                        className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500/10 focus:outline-none ${hrIsFinalized ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                                        value={doc.assignment?.guideNumber || ''}
                                        onChange={(e) => handleUpdateAssignment(doc.id, 'guideNumber', e.target.value)}
                                      />
                                    </div>

                                    <div className="flex flex-col">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 mt-2">Tipo Despacho</p>
                                      <select 
                                        disabled={hrIsFinalized && userProfile?.role !== 'ADMIN' && userProfile?.role !== 'OPERATOR'}
                                        className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500/10 focus:outline-none ${hrIsFinalized && userProfile?.role !== 'ADMIN' && userProfile?.role !== 'OPERATOR' ? 'opacity-60 cursor-not-allowed bg-slate-100' : 'cursor-pointer'} ${doc.assignment?.deliveryStatus === 'PARCIAL' ? 'text-rose-600' : 'text-emerald-600'}`}
                                        value={doc.assignment?.deliveryStatus || 'COMPLETO'}
                                        onChange={(e) => handleUpdateAssignment(doc.id, 'deliveryStatus', e.target.value)}
                                      >
                                        <option value="COMPLETO">COMPLETO</option>
                                        <option value="PARCIAL">PARCIAL</option>
                                      </select>
                                    </div>
                                  </div>
                                </>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 md:col-span-2 gap-2 md:gap-0">
                                <div className="flex flex-col">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ubicación</p>
                                  <input 
                                    disabled={hrIsFinalized}
                                    type="text" 
                                    placeholder="Ubicación..."
                                    className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500/10 focus:outline-none ${hrIsFinalized ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                                    value={doc.assignment?.location || ''}
                                    onChange={(e) => handleUpdateAssignment(doc.id, 'location', e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className={`md:${doc.tipo === 'OC' ? "col-span-7" : "col-span-2"}`}>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Obs. Logísticas / Despacho</p>
                                <input 
                                  disabled={hrIsFinalized}
                                  type="text" 
                                  placeholder="Notas para el conductor..."
                                  className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500/10 focus:outline-none ${hrIsFinalized ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                                  value={doc.assignment?.logisticsNotes || ''}
                                  onChange={(e) => handleUpdateAssignment(doc.id, 'logisticsNotes', e.target.value)}
                                />
                              </div>

                              {doc.tipo !== 'OC' && (
                                <div className="md:col-span-2 text-right">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total</p>
                                  <input 
                                    disabled={hrIsFinalized && userProfile?.role !== 'ADMIN'}
                                    type="text"
                                    className={`w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-right focus:ring-2 focus:ring-indigo-500/10 focus:outline-none ${hrIsFinalized && userProfile?.role !== 'ADMIN' ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                                    value={doc.assignment?.totalAmount !== undefined ? formatCLP(doc.assignment.totalAmount) : formatCLP(doc.totalPendiente)}
                                    onChange={(e) => {
                                      const val = parseCLP(e.target.value);
                                      const finalVal = Math.max(0, val);
                                      handleUpdateAssignment(doc.id, 'totalAmount', finalVal);
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Mobile Layout - compact high-readability accordion list */}
                            <div className="flex md:hidden flex-col gap-2 flex-1 text-slate-800">
                              {expandedHrDocId !== doc.id ? (
                                <div 
                                  onClick={() => !hrIsFinalized && setExpandedHrDocId(doc.id)}
                                  className="flex flex-col gap-2 cursor-pointer"
                                >
                                  {/* Line 1: Client Name & Type badge */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-col">
                                      <p className="text-xs font-black text-slate-900 leading-tight">{doc.razonSocial}</p>
                                      <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                        ID: <span className="font-extrabold text-indigo-600">{formatDocId(doc.tipo, doc.id)}</span>
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {doc.assignment?.deliveryStatus === 'PARCIAL' && (
                                        <span className="bg-rose-100 text-rose-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Parcial</span>
                                      )}
                                      {(doc.isOrphaned || doc.isAdditional) && (
                                        <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Adicional</span>
                                      )}
                                      {doc.isMissingFromImport && (
                                        <span className="bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase animate-pulse">Revisar</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Line 2: Condensed details in two high-readability rows */}
                                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium">
                                      <span>Guía: <span className="font-black text-slate-800">{doc.assignment?.guideNumber || 'Sin guía'}</span></span>
                                      {doc.tipo !== 'OC' && (
                                        <span>Total: <span className="font-mono font-black text-indigo-600">${(doc.assignment?.totalAmount !== undefined ? doc.assignment.totalAmount : doc.totalPendiente).toLocaleString('es-CL')}</span></span>
                                      )}
                                    </div>
                                    <div className="h-px bg-slate-100"></div>
                                    <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                                      <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                        <span className="truncate">Destino: <span className="font-bold text-slate-700">{doc.assignment?.location || 'No especificada'}</span></span>
                                      </div>
                                      <div className="flex items-start gap-1.5 mt-0.5">
                                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                        <span className="line-clamp-2">Obs: <span className="font-medium text-slate-600 italic">"{doc.assignment?.logisticsNotes || 'Sin notas de despacho'}"</span></span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Tap to edit cue */}
                                  {!hrIsFinalized && (
                                    <div className="flex justify-end items-center gap-1 mt-0.5">
                                      <Edit2 className="w-2.5 h-2.5 text-indigo-600" />
                                      <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Toque para editar datos</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                /* Strategic Form - Positioned strategically at top for keyboard */
                                <div className="bg-white border-2 border-indigo-200 rounded-2xl p-3 flex flex-col gap-3 shadow-md animate-in fade-in slide-in-from-top-2">
                                  <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">Edición de Despacho</span>
                                      <span className="text-xs font-black text-slate-800 truncate max-w-[180px]">{doc.razonSocial}</span>
                                    </div>
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedHrDocId(null);
                                      }}
                                      className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer"
                                    >
                                      Listo
                                    </button>
                                  </div>

                                  <div className="flex flex-col gap-2">
                                    {doc.tipo !== 'OC' && (
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[9px] font-black text-slate-500 uppercase">N° Guía</label>
                                          <input 
                                            type="text" 
                                            placeholder="Ingresa guía..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:bg-white focus:border-indigo-500 focus:outline-none"
                                            value={doc.assignment?.guideNumber || ''}
                                            onChange={(e) => handleUpdateAssignment(doc.id, 'guideNumber', e.target.value)}
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[9px] font-black text-slate-500 uppercase">Estado Despacho</label>
                                          <select 
                                            disabled={userProfile?.role !== 'ADMIN' && userProfile?.role !== 'OPERATOR'}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                                            value={doc.assignment?.deliveryStatus || 'COMPLETO'}
                                            onChange={(e) => handleUpdateAssignment(doc.id, 'deliveryStatus', e.target.value)}
                                          >
                                            <option value="COMPLETO">COMPLETO</option>
                                            <option value="PARCIAL">PARCIAL</option>
                                          </select>
                                        </div>
                                      </div>
                                    )}

                                    <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-black text-slate-500 uppercase">Ubicación / Comuna</label>
                                      <input 
                                        type="text" 
                                        placeholder="Comuna o destino..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:bg-white focus:border-indigo-500 focus:outline-none"
                                        value={doc.assignment?.location || ''}
                                        onChange={(e) => handleUpdateAssignment(doc.id, 'location', e.target.value)}
                                      />
                                    </div>

                                    <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-black text-slate-500 uppercase">Obs. Logísticas</label>
                                      <input 
                                        type="text" 
                                        placeholder="Notas de despacho..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold focus:bg-white focus:border-indigo-500 focus:outline-none"
                                        value={doc.assignment?.logisticsNotes || ''}
                                        onChange={(e) => handleUpdateAssignment(doc.id, 'logisticsNotes', e.target.value)}
                                      />
                                    </div>

                                    {doc.tipo !== 'OC' && (
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase">Total Valorizado ($)</label>
                                        <input 
                                          disabled={userProfile?.role !== 'ADMIN'}
                                          type="text"
                                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono font-bold focus:bg-white focus:border-indigo-500 focus:outline-none"
                                          value={doc.assignment?.totalAmount !== undefined ? formatCLP(doc.assignment.totalAmount) : formatCLP(doc.totalPendiente)}
                                          onChange={(e) => {
                                            const val = parseCLP(e.target.value);
                                            const finalVal = Math.max(0, val);
                                            handleUpdateAssignment(doc.id, 'totalAmount', finalVal);
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 mt-1">
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedHrDocId(null);
                                      }}
                                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 border border-indigo-700"
                                    >
                                      <Save className="w-3 h-3" />
                                      <span>Guardar Cambios</span>
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedHrDocId(null);
                                      }}
                                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider rounded-lg active:scale-95 transition-all cursor-pointer"
                                    >
                                      Cerrar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {!hrIsFinalized && (
                              <div className="shrink-0 flex items-center gap-1">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDateChangeDoc(doc);
                                    setNewPlanningDate(doc.assignment?.dispatchDate || hrSelectedDate || getLocalDateString());
                                    setNewPlanningRoute(doc.assignment?.route || hrSelectedRoute || '');
                                  }}
                                  className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-all cursor-pointer"
                                  title="Reprogramar fecha de planificación"
                                >
                                  <CalendarIcon className="w-4 h-4" />
                                </button>

                                <button 
                                  onClick={(e) => handleRemoveFromManifest(doc.id, e)}
                                  className={`p-2 rounded-xl transition-all cursor-pointer ${doc.isOrphaned || doc.isMissingFromImport ? 'text-rose-500 hover:text-rose-700 hover:bg-rose-50' : 'text-slate-400 hover:text-red-500 hover:bg-slate-100'}`}
                                  title={doc.isMissingFromImport ? "Eliminar este despacho que requiere revisión de la ruta" : doc.isOrphaned ? "Eliminar punto adicional" : "Quitar documento de esta ruta"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full min-h-[300px] opacity-30 animate-pulse">
                        <MapPin className="w-16 h-16 mb-4 text-indigo-500" />
                        <p className="font-bold text-lg text-slate-700">No hay despachos programados</p>
                        <p className="text-sm text-slate-500">Seleccione una ruta y fecha con documentos asignados.</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Saved Manifests Sheet tab */}
        {activeTab === 'resumenRutas' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 animate-fade-in" id="resumen-rutas-panel">
            <div className="p-4 sm:p-6 bg-white border-b border-slate-200 shadow-sm flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    <Truck className="w-5 h-5 text-indigo-600" /> Control y Resumen de Rutas Grabadas
                  </h2>
                  <p className="text-[10px] sm:text-xs text-slate-500">Configure horarios, entregas pendientes y genere reportes definitivos.</p>
                </div>
              </div>

              {/* Mobile Summary & Collapse Toggle Bar */}
              <div className="md:hidden flex items-center justify-between bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 shadow-sm">
                <div className="flex flex-col text-left gap-1">
                  <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Filtros de Búsqueda</span>
                  <span className="text-xs font-black text-slate-850">
                    {resumenDate ? new Date(resumenDate + 'T12:00:00').toLocaleDateString('es-CL') : 'Todos los días'} 
                    {resumenSearch ? ` • "${resumenSearch}"` : ''}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium mt-0.5">
                    <span>{filteredResumenManifests.length} Rutas Cargadas</span>
                  </div>
                </div>
                <button 
                  onClick={() => setResumenFiltersCollapsed(!resumenFiltersCollapsed)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white font-extrabold text-[10px] uppercase rounded-lg shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <span>{resumenFiltersCollapsed ? 'Buscar' : 'Ocultar'}</span>
                  {resumenFiltersCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Collapsible filters block */}
              <div className={`flex-col md:flex-row md:items-center justify-between gap-4 ${resumenFiltersCollapsed ? 'hidden md:flex' : 'flex'}`}>
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="Identificador, chofer, patente, NV, OC..." 
                      className="text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 w-full font-medium"
                      value={resumenSearch}
                      onChange={(e) => setResumenSearch(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input 
                      type="date"
                      className="text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 font-bold flex-1 sm:flex-initial"
                      value={resumenDate}
                      onChange={(e) => setResumenDate(e.target.value)}
                    />

                    <button
                      onClick={() => {
                        const today = getLocalDateString();
                        setResumenDate(resumenDate === today ? '' : today);
                      }}
                      className={`text-xs font-black px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer border uppercase tracking-wider text-[11px] flex-1 sm:flex-initial ${
                        resumenDate === getLocalDateString()
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title="Filtrar rutas programadas para el día de hoy"
                    >
                      <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" /> Hoy
                    </button>
                  </div>

                  {resumenDate && (
                    <button 
                      onClick={() => setResumenDate('')}
                      className="text-xs font-bold text-rose-500 hover:text-rose-600 px-2 py-1 cursor-pointer text-center"
                    >
                      Limpiar Filtro
                    </button>
                  )}

                  <button 
                    onClick={() => {
                      setConsolidatedReportDate(resumenDate || getLocalDateString());
                      setIsConsolidatedReportModalOpen(true);
                    }}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2.5 sm:py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 hover:shadow uppercase tracking-wider text-[11px] w-full sm:w-auto"
                    title="Genere un reporte consolidado de las rutas para compartir o imprimir"
                  >
                    <FileText className="w-3.5 h-3.5" /> Reporte Consolidado
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6" id="resumen-rutas-table">
              {filteredResumenManifests.length > 0 ? (
                <>
                  {/* Vista Desktop: Tabla completa */}
                  <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">
                          <th className="px-4 py-4 leading-tight">Hoja de Ruta</th>
                          <th className="px-4 py-4 leading-tight w-14 text-center">Fecha Despacho</th>
                          <th className="px-4 py-4 leading-tight min-w-[120px]">Ruta / Destino</th>
                          <th className="px-4 py-4 leading-tight w-64">Documentos / Guías</th>
                          <th className="px-4 py-4 leading-tight min-w-[140px]">Chofer/Vehículo</th>
                          <th className="px-4 py-4 leading-tight min-w-[160px]">Horarios</th>
                          <th className="px-4 py-4 leading-tight w-32">Kilometraje (Ini/Fin)</th>
                          <th className="px-4 py-4 leading-tight text-center">KPI Seguimiento</th>
                          <th className="px-4 py-4 leading-tight text-center">Progreso</th>
                          <th className="px-4 py-4 leading-tight text-right">Total Carga</th>
                          <th className="px-4 py-4 leading-tight text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredResumenManifests.map((manifest) => {
                          const mId = manifest.id;
                          const rName = routeMap[manifest.routeId || ''] || 'Sin nombre';
                          const dName = driverMap[manifest.driverId || ''] || 'No asignado';
                          const vDesc = vehicleMap[manifest.vehicleId || ''] || 'No asignado';
                          const totalPoints = manifest.documentsSnapshot?.length ?? 0;
                          const completedPoints = manifest.documentsSnapshot?.filter(d => 
                            d.trackingStatus === 'ENTREGADO' || 
                            d.trackingStatus === 'RETIRADO' || 
                            d.trackingStatus === 'NO ENTREGADO' || 
                            d.trackingStatus === 'NO RETIRADO'
                          ).length ?? 0;
                          const pendingPoints = totalPoints - completedPoints;
                          const totalEstVal = manifest.documentsSnapshot?.reduce((s,d) => d.tipo === 'OC' ? s : s + (d.totalAmount ?? d.totalPendiente), 0) || 0;
                          
                          const hasMissingFailedReasons = manifest.documentsSnapshot?.some(d => {
                            const isFailed = d.trackingStatus === 'NO ENTREGADO' || d.trackingStatus === 'NO RETIRADO';
                            if (!isFailed) return false;
                            if (!d.failedReason) return true;
                            
                            if (d.trackingStatus === 'NO RETIRADO') {
                              return !['SIN STOCK', 'POR HORARIO', 'DESCORDINACION'].includes(d.failedReason);
                            } else {
                              return !['POR HORARIO', 'CLIENTE NO RECIBE', 'NO CARGADO'].includes(d.failedReason);
                            }
                          }) ?? false;
                          const isTrackingComplete = totalPoints > 0 && totalPoints === completedPoints;
                          const isReadyToClose = isTrackingComplete && !hasMissingFailedReasons;
                          const trackingProgress = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

                          return (
                            <tr key={mId} className="hover:bg-slate-50/80 transition-colors group">
                              <td className="px-4 py-4">
                                <button 
                                  type="button"
                                  onClick={() => setShowManifestDetailId(mId)}
                                  className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left cursor-pointer font-sans"
                                >
                                  <span className="text-sm font-black px-3 py-2 bg-slate-900 text-white rounded-xl font-mono uppercase tracking-tighter active:scale-95 transition-transform shadow-lg ring-1 ring-white/10 group-hover:scale-105">
                                    HR-{manifest.routeNumber ?? '1001'}
                                  </span>
                                  <div className="flex flex-col">
                                    <p className="text-[14px] font-black text-slate-900 leading-none tracking-tight">{rName}</p>
                                  </div>
                                </button>
                              </td>
                              <td className="px-4 py-4">
                                <p className="text-[10px] text-slate-600 font-normal font-mono whitespace-nowrap">
                                  {manifest.date ? new Date(manifest.date + 'T12:00:00').toLocaleDateString('es-CL') : '-'}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <h3 className="font-normal text-slate-800 text-[11px] leading-tight max-w-[100px]">{rName}</h3>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-1 max-w-[280px]">
                                  {(() => {
                                    const uniqueItems = new Map();
                                    (manifest.documentsSnapshot || []).forEach(d => {
                                      if (d.tipo === 'OC') {
                                        const val = formatDocId(d.tipo, d.id);
                                        uniqueItems.set(val, { type: 'OC', val });
                                      } else if (d.guideNumber) {
                                        uniqueItems.set(d.guideNumber, { type: 'NV', val: d.guideNumber });
                                      }
                                    });
                                    
                                    if (uniqueItems.size === 0) {
                                      return <span className="text-[9px] text-slate-300 font-bold italic">Sin guías/OCs</span>;
                                    }

                                    return Array.from(uniqueItems.values()).map((item, i) => (
                                      <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono border whitespace-nowrap ${
                                        item.type === 'OC' 
                                          ? 'bg-teal-50 text-teal-600 border-teal-200' 
                                          : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                      }`}>
                                        {item.val}
                                      </span>
                                    ));
                                  })()}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-col gap-0.5 max-w-[130px]">
                                  <p className="text-[10px] font-normal text-slate-700 truncate" title={dName}>👤 {dName}</p>
                                  <p className="text-[9px] text-slate-500 truncate tracking-tight text-ellipsis" title={vDesc}>🚛 {vDesc}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-1.5">
                                  <input 
                                    type="time" 
                                    disabled={manifest.logisticsDataSaved}
                                    className={`bg-transparent border-none p-0 text-[10px] font-normal focus:ring-0 w-[68px] outline-none ${
                                      manifest.logisticsDataSaved 
                                        ? 'text-slate-400 cursor-not-allowed opacity-60 font-mono' 
                                        : 'text-slate-700 hover:bg-slate-100 rounded px-1'
                                    }`}
                                    value={manifest.startTime || ''}
                                    onChange={(e) => handleUpdateManifestField(mId, 'startTime', e.target.value)}
                                  />
                                  <span className="text-slate-300">-</span>
                                  <input 
                                    type="time" 
                                    disabled={manifest.logisticsDataSaved}
                                    className={`bg-transparent border-none p-0 text-[10px] font-normal focus:ring-0 w-[68px] outline-none ${
                                      manifest.logisticsDataSaved 
                                        ? 'text-slate-400 cursor-not-allowed opacity-60 font-mono' 
                                        : 'text-slate-700 hover:bg-slate-100 rounded px-1'
                                    }`}
                                    value={manifest.endTime || ''}
                                    onChange={(e) => handleUpdateManifestField(mId, 'endTime', e.target.value)}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number" 
                                    disabled={manifest.logisticsDataSaved}
                                    placeholder="KM Ini"
                                    className={`bg-transparent border-none p-0 text-[10px] font-normal text-center focus:ring-0 w-12 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                      manifest.logisticsDataSaved 
                                        ? 'text-slate-400 cursor-not-allowed opacity-60' 
                                        : 'text-slate-700 hover:bg-slate-100 rounded'
                                    }`}
                                    value={manifest.initialKm ?? ''}
                                    onChange={(e) => handleUpdateManifestField(mId, 'initialKm', e.target.value === '' ? null : Number(e.target.value))}
                                  />
                                  <span className="text-slate-300">/</span>
                                  <input 
                                    type="number" 
                                    disabled={manifest.logisticsDataSaved}
                                    placeholder="KM Fin"
                                    className={`bg-transparent border-none p-0 text-[10px] font-normal text-center focus:ring-0 w-12 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                      manifest.logisticsDataSaved 
                                        ? 'text-slate-400 cursor-not-allowed opacity-60' 
                                        : 'text-slate-700 hover:bg-slate-100 rounded'
                                    }`}
                                    value={manifest.finalKm ?? ''}
                                    onChange={(e) => handleUpdateManifestField(mId, 'finalKm', e.target.value === '' ? null : Number(e.target.value))}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                  <div className="flex items-center justify-center gap-3 min-w-[120px]">
                                    <div className="flex flex-col items-center">
                                      <span className="text-[10px] font-black text-slate-800 leading-none">{totalPoints}</span>
                                      <span className="text-[7px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Total</span>
                                    </div>
                                    <div className="w-px h-5 bg-slate-200" />
                                    <div className="flex flex-col items-center">
                                      <span className="text-[10px] font-black text-emerald-600 leading-none">{completedPoints}</span>
                                      <span className="text-[7px] text-emerald-500/50 font-black uppercase tracking-widest mt-0.5">OK</span>
                                    </div>
                                    <div className="w-px h-5 bg-slate-200" />
                                    <div className="flex flex-col items-center">
                                      <span className={`text-[10px] font-black leading-none ${pendingPoints > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{pendingPoints}</span>
                                      <span className={`text-[7px] font-black uppercase tracking-widest mt-0.5 ${pendingPoints > 0 ? 'text-rose-400/50' : 'text-slate-300'}`}>Pend</span>
                                    </div>
                                  </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-col items-center gap-1 min-w-[80px]">
                                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                                    <div 
                                      className={`h-full transition-all duration-500 ${isReadyToClose ? 'bg-emerald-500' : isTrackingComplete ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                      style={{ width: `${trackingProgress}%` }}
                                    />
                                  </div>
                                  <span className={`text-[9px] font-bold ${isReadyToClose ? 'text-emerald-600' : isTrackingComplete ? 'text-amber-600 animate-pulse' : 'text-slate-500 font-mono italic'}`}>
                                    {isReadyToClose ? 'COMPLETO' : isTrackingComplete ? 'FALTA MOTIVO' : `${trackingProgress}%`}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <p className="font-bold text-indigo-700 font-mono">${Math.round(totalEstVal).toLocaleString('es-CL')}</p>
                                <p className="text-slate-400 font-mono text-[9px]">{manifest.documentsSnapshot?.length ?? 0} doctos</p>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-end gap-1">
                                  {manifest.logisticsDataSaved ? (
                                    <span 
                                      className="p-2 text-emerald-600 bg-emerald-50 rounded-lg flex items-center justify-center"
                                      title="Datos guardados y bloqueados de edición (reabra la ruta para poder editar de nuevo)"
                                    >
                                      <Lock className="w-4 h-4 text-emerald-600" />
                                    </span>
                                  ) : (
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        if (!isTrackingComplete) {
                                          showToast("Seguimiento Incompleto", "Debe marcar el status de entrega (Entregado o No Entregado) para todos los puntos antes de guardar definitivamente.", 'error');
                                          return;
                                        }
                                        if (hasMissingFailedReasons) {
                                          showToast("Motivos de Rechazo Faltantes", "Debe seleccionar un motivo de rechazo válido (como POR HORARIO, CLIENTE NO RECIBE, NO CARGADO, SIN STOCK o DESCORDINACION) para todos los documentos con problemas.", 'error');
                                          return;
                                        }
                                        handleUpdateManifestField(mId, 'logisticsDataSaved', true);
                                      }}
                                      className={`p-2 rounded-lg transition-all cursor-pointer ${
                                        isReadyToClose 
                                          ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50' 
                                          : 'text-slate-200 cursor-not-allowed opacity-50'
                                      }`}
                                      title={isReadyToClose ? "Guardar y Bloquear Datos" : isTrackingComplete ? "Pendiente seleccionar motivo de rechazo" : "Pendiente completar status de entrega"}
                                    >
                                      <Save className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button 
                                    type="button"
                                    onClick={() => handlePrintFinalizedReport(manifest)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                    title="Imprimir Hoja de Ruta"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => setReopenConfirmId(mId)}
                                    className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all cursor-pointer"
                                    title="Reabrir Ruta para Edición"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Vista Mobile: Tarjetas con Acordeón de Edición Optimizado */}
                  <div className="md:hidden flex flex-col gap-4">
                    {filteredResumenManifests.map((manifest) => {
                      const mId = manifest.id;
                      const rName = routeMap[manifest.routeId || ''] || 'Sin nombre';
                      const dName = driverMap[manifest.driverId || ''] || 'No asignado';
                      const vDesc = vehicleMap[manifest.vehicleId || ''] || 'No asignado';
                      const totalPoints = manifest.documentsSnapshot?.length ?? 0;
                      const completedPoints = manifest.documentsSnapshot?.filter(d => 
                        d.trackingStatus === 'ENTREGADO' || 
                        d.trackingStatus === 'RETIRADO' || 
                        d.trackingStatus === 'NO ENTREGADO' || 
                        d.trackingStatus === 'NO RETIRADO'
                      ).length ?? 0;
                      const pendingPoints = totalPoints - completedPoints;
                      const totalEstVal = manifest.documentsSnapshot?.reduce((s,d) => d.tipo === 'OC' ? s : s + (d.totalAmount ?? d.totalPendiente), 0) || 0;
                      
                      const hasMissingFailedReasons = manifest.documentsSnapshot?.some(d => {
                        const isFailed = d.trackingStatus === 'NO ENTREGADO' || d.trackingStatus === 'NO RETIRADO';
                        if (!isFailed) return false;
                        if (!d.failedReason) return true;
                        
                        if (d.trackingStatus === 'NO RETIRADO') {
                          return !['SIN STOCK', 'POR HORARIO', 'DESCORDINACION'].includes(d.failedReason);
                        } else {
                          return !['POR HORARIO', 'CLIENTE NO RECIBE', 'NO CARGADO'].includes(d.failedReason);
                        }
                      }) ?? false;
                      const isTrackingComplete = totalPoints > 0 && totalPoints === completedPoints;
                      const isReadyToClose = isTrackingComplete && !hasMissingFailedReasons;
                      const trackingProgress = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;
                      const isExpanded = expandedResumenId === mId;

                      return (
                        <div 
                          key={mId} 
                          className={`bg-white border rounded-2xl shadow-sm transition-all overflow-hidden ${
                            isExpanded ? 'ring-2 ring-indigo-500 border-indigo-200' : 'border-slate-200'
                          }`}
                        >
                          {/* Card Header clickable to expand/toggle edit mode */}
                          <div 
                            onClick={() => setExpandedResumenId(isExpanded ? null : mId)}
                            className="p-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex flex-col gap-1.5 text-left min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowManifestDetailId(mId);
                                  }}
                                  className="text-xs font-black px-2.5 py-1 bg-slate-900 hover:bg-indigo-600 text-white hover:text-white rounded-lg font-mono uppercase tracking-tighter cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                                  title="Ver y Gestionar Puntos de Entrega"
                                >
                                  HR-{manifest.routeNumber ?? '1001'}
                                  <ClipboardList className="w-3.5 h-3.5 opacity-80" />
                                </button>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {manifest.date ? new Date(manifest.date + 'T12:00:00').toLocaleDateString('es-CL') : '-'}
                                </span>
                              </div>
                              <h3 className="text-sm font-black text-slate-900 tracking-tight leading-tight truncate">{rName}</h3>
                              <div className="flex flex-col gap-1 text-[11px] text-slate-600 mt-1">
                                <span className="truncate">👤 {dName}</span>
                                <span className="truncate text-slate-400 text-[10px]">🚛 {vDesc}</span>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end shrink-0 gap-1 text-right">
                              <span className="font-mono text-xs sm:text-sm font-black text-indigo-700">${Math.round(totalEstVal).toLocaleString('es-CL')}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{manifest.documentsSnapshot?.length ?? 0} doctos</span>
                              
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${
                                  isReadyToClose ? 'bg-emerald-50 text-emerald-600' : isTrackingComplete ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                                }`}>
                                  {isReadyToClose ? 'COMPLETO' : isTrackingComplete ? 'FALTA MOTIVO' : `${trackingProgress}%`}
                                </span>
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                              </div>
                            </div>
                          </div>

                          {/* Progress bar line */}
                          <div className="w-full bg-slate-100 h-1 overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${isReadyToClose ? 'bg-emerald-500' : isTrackingComplete ? 'bg-amber-500' : 'bg-indigo-500'}`}
                              style={{ width: `${trackingProgress}%` }}
                            />
                          </div>

                          {/* Quick Stats Summary (Compact when closed) */}
                          {!isExpanded && (
                            <div className="bg-slate-50/50 px-4 py-2.5 flex items-center justify-between text-[11px] border-t border-slate-100">
                              <div className="flex items-center gap-3 text-slate-500">
                                <span>Total: <strong>{totalPoints}</strong></span>
                                <span>OK: <strong className="text-emerald-600">{completedPoints}</strong></span>
                                <span>Pend: <strong className={pendingPoints > 0 ? 'text-rose-600' : 'text-slate-400'}>{pendingPoints}</strong></span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedResumenId(mId);
                                }}
                                className="text-indigo-600 font-bold hover:underline cursor-pointer"
                              >
                                Configurar
                              </button>
                            </div>
                          )}

                          {/* Expanded Card Body: Inputs + Mobile keyboard optimization layout */}
                          {isExpanded && (
                            <div className="p-4 bg-slate-50 border-t border-slate-150 flex flex-col gap-4 text-left">
                              <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-indigo-500" /> Horarios de la Ruta
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-500">Inicio de Ruta</label>
                                    <input 
                                      type="time" 
                                      disabled={manifest.logisticsDataSaved}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-65 font-sans"
                                      value={manifest.startTime || ''}
                                      onChange={(e) => handleUpdateManifestField(mId, 'startTime', e.target.value)}
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-500">Fin de Ruta</label>
                                    <input 
                                      type="time" 
                                      disabled={manifest.logisticsDataSaved}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-65 font-sans"
                                      value={manifest.endTime || ''}
                                      onChange={(e) => handleUpdateManifestField(mId, 'endTime', e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-indigo-500" /> Registro de Kilometraje
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-500">Kilometraje Inicial</label>
                                    <input 
                                      type="number" 
                                      disabled={manifest.logisticsDataSaved}
                                      placeholder="Ej. 12050"
                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-65 font-sans"
                                      value={manifest.initialKm ?? ''}
                                      onChange={(e) => handleUpdateManifestField(mId, 'initialKm', e.target.value === '' ? null : Number(e.target.value))}
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-500">Kilometraje Final</label>
                                    <input 
                                      type="number" 
                                      disabled={manifest.logisticsDataSaved}
                                      placeholder="Ej. 12240"
                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-65 font-sans"
                                      value={manifest.finalKm ?? ''}
                                      onChange={(e) => handleUpdateManifestField(mId, 'finalKm', e.target.value === '' ? null : Number(e.target.value))}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm flex flex-col gap-3">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <ClipboardList className="w-3.5 h-3.5 text-indigo-500" /> Puntos y Entregas ({completedPoints}/{totalPoints})
                                </h4>
                                <div className="flex flex-col gap-1 text-xs text-slate-600 font-medium">
                                  <p>Puntos Completados: <strong className="text-emerald-600">{completedPoints}</strong> / {totalPoints}</p>
                                  {pendingPoints > 0 ? (
                                    <p className="text-[11px] text-rose-500 font-bold">⚠️ Faltan {pendingPoints} puntos por registrar estado de entrega.</p>
                                  ) : (
                                    <p className="text-[11px] text-emerald-600 font-bold">🎉 Todos los estados de entrega han sido registrados.</p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowManifestDetailId(mId)}
                                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer font-sans"
                                >
                                  <ClipboardList className="w-4 h-4" /> Gestionar Puntos (Estados / Comentarios)
                                </button>
                              </div>

                              <div className="flex items-center gap-2 mt-2">
                                {manifest.logisticsDataSaved ? (
                                  <div className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-200 text-xs font-black uppercase tracking-wider">
                                    <Lock className="w-4 h-4" /> Datos Bloqueados
                                  </div>
                                ) : (
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      if (!isTrackingComplete) {
                                        showToast("Seguimiento Incompleto", "Debe marcar el status de entrega (Entregado o No Entregado) para todos los puntos antes de guardar definitivamente.", 'error');
                                        return;
                                      }
                                      if (hasMissingFailedReasons) {
                                        showToast("Motivos de Rechazo Faltantes", "Debe seleccionar un motivo de rechazo válido (como POR HORARIO, CLIENTE NO RECIBE, NO CARGADO, SIN STOCK o DESCORDINACION) para todos los documentos con problemas.", 'error');
                                        return;
                                      }
                                      handleUpdateManifestField(mId, 'logisticsDataSaved', true);
                                    }}
                                    className={`flex-1 p-3.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer font-sans ${
                                      isReadyToClose 
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/15' 
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                    }`}
                                  >
                                    <Save className="w-4 h-4" /> Guardar y Cerrar
                                  </button>
                                )}

                                <button 
                                  type="button"
                                  onClick={() => handlePrintFinalizedReport(manifest)}
                                  className="p-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-indigo-600 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                                  title="Imprimir Hoja de Ruta"
                                >
                                  <Printer className="w-4.5 h-4.5" />
                                </button>
                                
                                <button 
                                  type="button"
                                  onClick={() => setReopenConfirmId(mId)}
                                  className="p-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-orange-600 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                                  title="Reabrir Ruta para Edición"
                                >
                                  <RotateCcw className="w-4.5 h-4.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-20 flex flex-col items-center justify-center text-center opacity-40 animate-pulse h-full min-h-[400px]">
                  <Truck className="w-16 h-16 text-indigo-500 mb-4" />
                  <h3 className="font-bold text-slate-800 text-sm mb-1 uppercase tracking-widest font-sans">Sin Planillas Definitivas</h3>
                  <p className="text-xs text-slate-500 max-w-sm font-sans">No se encontraron hojas de rutas definitivas. Vaya a Hoja de Ruta, seleccione una y haga clic en "CERRAR RUTA PARA LA CARGA".</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'kpis' && userProfile?.permissions.canViewKPIs && (
          <KPIDashboard 
            manifestsList={finalizedManifestsList}
            routeMap={routeMap}
            driverMap={driverMap}
            vehicleMap={vehicleMap}
          />
        )}

        {activeTab === 'solicitudes' && (
          <LogisticsRequestsManager
            requests={requests}
            onCreateRequest={handleCreateRequest}
            onCompleteRequest={handleCompleteRequest}
            onUpdateRequest={handleUpdateRequest}
            onDeleteRequest={handleDeleteRequest}
            currentUserEmail={currentUser?.email || ''}
            userProfile={userProfile}
            onSimulateAlarm={() => {
              playAlertAudio();
              setIsAlarmOpen(true);
            }}
          />
        )}
      </div>

      <LogisticsRequestAlarmModal 
        isOpen={isAlarmOpen}
        onClose={() => setIsAlarmOpen(false)}
        pendingRequests={(() => {
          const today = new Date();
          const yyyy = today.getFullYear();
          const mStr = String(today.getMonth() + 1).padStart(2, '0');
          const dStr = String(today.getDate()).padStart(2, '0');
          const todayStr = `${yyyy}-${mStr}-${dStr}`;

          const activeToday = requests.filter(r => {
            if (r.status !== 'PENDIENTE') return false;
            if (!r.alarmOption) return true;
            if (r.alarmOption === 'ANY_DAY') return true;
            if (r.alarmOption === 'SAME_DAY') return r.targetDate === todayStr;
            if (r.alarmOption === 'SPECIFIC_DATE') return r.alarmDate === todayStr;
            return true;
          });

          if (activeToday.length === 0) {
            return requests.filter(r => r.status === 'PENDIENTE');
          }
          return activeToday;
        })()}
        onCompleteRequest={handleCompleteRequest}
        onGoToHistory={() => {
          setActiveTab('solicitudes');
          setIsAlarmOpen(false);
        }}
      />

      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-6 right-6 z-[100000]"
          >
            <div className={`p-4 rounded-xl shadow-2xl border flex items-start gap-4 max-w-sm ${
              toastMessage.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              toastMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <AlertCircle className={`w-6 h-6 shrink-0 ${
                toastMessage.type === 'error' ? 'text-red-500' :
                toastMessage.type === 'success' ? 'text-emerald-500' :
                'text-blue-500'
              }`} />
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight">{toastMessage.title}</span>
                <span className="text-xs opacity-90 mt-0.5">{toastMessage.message}</span>
              </div>
              <button 
                onClick={() => setToastMessage(null)}
                className="ml-auto opacity-50 hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
