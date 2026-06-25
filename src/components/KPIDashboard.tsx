import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  DollarSign, 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Navigation, 
  Users, 
  Calendar, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  Award,
  Milestone,
  FileBarChart2,
  Filter,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  MapPin,
  RotateCcw,
  FileText,
  XCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  ComposedChart
} from 'recharts';
import { LogisticsManifest } from '../types';

interface KPIDashboardProps {
  manifestsList: LogisticsManifest[];
  routeMap: Record<string, string>;
  driverMap: Record<string, string>;
  vehicleMap: Record<string, string>;
}

export const KPIDashboard: React.FC<KPIDashboardProps> = ({
  manifestsList,
  routeMap,
  driverMap,
  vehicleMap
}) => {
  // Filters
  const [selectedDriver, setSelectedDriver] = useState<string>('ALL');
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [timeSpan, setTimeSpan] = useState<'ALL' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal detail states for clicking charts
  const [activeDetailFilter, setActiveDetailFilter] = useState<{
    type: 'date' | 'status' | 'route' | 'vehicle' | 'driver';
    value: string;
    title: string;
  } | null>(null);
  const [expandedManifestId, setExpandedManifestId] = useState<string | null>(null);

  // States for Service Level modal
  const [showServiceLevelModal, setShowServiceLevelModal] = useState<boolean>(false);
  const [serviceLevelTab, setServiceLevelTab] = useState<'FAILED' | 'ALL'>('FAILED');
  const [serviceLevelSearch, setServiceLevelSearch] = useState<string>('');
  const [zoomedReason, setZoomedReason] = useState<string | null>(null);
  const [deviationsTypeFilter, setDeviationsTypeFilter] = useState<'ALL' | 'ENTREGA' | 'RETIRO'>('ALL');

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedDriver('ALL');
    setSelectedRoute('ALL');
    setTimeSpan('ALL');
    setSearchQuery('');
  };

  // Helper for currency formatting
  const formatCLP = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(value);
  };

  // 1. Process Finished Manifests under Filter constraints
  const processedData = useMemo(() => {
    return manifestsList.filter(m => {
      // Driver filter
      if (selectedDriver !== 'ALL' && m.driverId !== selectedDriver) return false;
      
      // Route filter
      if (selectedRoute !== 'ALL' && m.routeId !== selectedRoute) return false;
      
      // Time span filter
      if (m.date) {
        const manifestDate = new Date(m.date + 'T12:00:00');
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (timeSpan === 'LAST_7') {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(now.getDate() - 7);
          if (manifestDate < sevenDaysAgo) return false;
        } else if (timeSpan === 'LAST_30') {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(now.getDate() - 30);
          if (manifestDate < thirtyDaysAgo) return false;
        } else if (timeSpan === 'THIS_MONTH') {
          // Compare year and month
          if (manifestDate.getMonth() !== now.getMonth() || manifestDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        }
      }

      // Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const rName = (routeMap[m.routeId || ''] || '').toLowerCase();
        const dName = (driverMap[m.driverId || ''] || '').toLowerCase();
        const vDesc = (vehicleMap[m.vehicleId || ''] || '').toLowerCase();
        const hrLabel = `hr-${m.routeNumber ?? ''}`.toLowerCase();
        if (!rName.includes(q) && !dName.includes(q) && !vDesc.includes(q) && !hrLabel.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [manifestsList, selectedDriver, selectedRoute, timeSpan, searchQuery, routeMap, driverMap, vehicleMap]);

  // Unique list of drivers and routes for select dropdowns
  const availableDrivers = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    manifestsList.forEach(m => {
      if (m.driverId && !seen.has(m.driverId)) {
        seen.add(m.driverId);
        list.push({ id: m.driverId, name: driverMap[m.driverId] || m.driverId });
      }
    });
    return list.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  }, [manifestsList, driverMap]);

  const availableRoutes = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    manifestsList.forEach(m => {
      if (m.routeId && !seen.has(m.routeId)) {
        seen.add(m.routeId);
        list.push({ id: m.routeId, name: routeMap[m.routeId] || m.routeId });
      }
    });
    return list.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  }, [manifestsList, routeMap]);

  // 2. Metrics & KPI calculations
  const metrics = useMemo(() => {
    let rawTotalDocs = 0;
    let deliveredDocs = 0;
    let entregadosOnlyDocs = 0;
    let retiradosOnlyDocs = 0;
    let failedDocs = 0;
    let returnedDocs = 0;
    let totalValue = 0;
    let totalKilometers = 0;
    let routesWithKm = 0;
    let totalTimeInMinutes = 0;
    let routesWithTime = 0;

    processedData.forEach(m => {
      const docs = m.documentsSnapshot || [];
      rawTotalDocs += docs.length;

      docs.forEach(d => {
        // Classified tracking status
        const status = d.trackingStatus;
        if (status === 'ENTREGADO' || status === 'COMPLETO') {
          deliveredDocs++;
          entregadosOnlyDocs++;
        } else if (status === 'NO ENTREGADO') {
          failedDocs++;
        } else if (status === 'RETIRADO') {
          deliveredDocs++;
          retiradosOnlyDocs++;
        } else if (status === 'NO RETIRADO') {
          failedDocs++;
        }

        const amt = d.tipo === 'OC' ? 0 : (d.totalAmount ?? d.totalPendiente ?? 0);
        totalValue += amt;
      });

      // Calculate km
      if (m.initialKm !== undefined && m.finalKm !== undefined && m.finalKm >= m.initialKm) {
        totalKilometers += (m.finalKm - m.initialKm);
        routesWithKm++;
      }

      // Calculate time
      if (m.startTime && m.endTime) {
        const parseTime = (t: string) => {
          const [h, min] = t.split(':').map(Number);
          return (h * 60) + (min || 0);
        };
        const startMin = parseTime(m.startTime);
        const endMin = parseTime(m.endTime);
        if (endMin > startMin) {
          totalTimeInMinutes += (endMin - startMin);
          routesWithTime++;
        }
      }
    });

    const successRate = rawTotalDocs > 0 ? Math.round((deliveredDocs / rawTotalDocs) * 100) : 0;
    const failureRate = rawTotalDocs > 0 ? Math.round((failedDocs / rawTotalDocs) * 100) : 0;
    const avgKmPerRoute = routesWithKm > 0 ? Math.round(totalKilometers / routesWithKm) : 0;
    
    // Average duration in hours and minutes
    const avgDurationHours = routesWithTime > 0 ? (totalTimeInMinutes / routesWithTime / 60) : 0;

    return {
      totalRoutes: processedData.length,
      totalDocuments: rawTotalDocs,
      deliveredDocuments: deliveredDocs,
      entregadosOnlyDocs,
      retiradosOnlyDocs,
      failedDocuments: failedDocs,
      totalValue,
      totalKilometers,
      avgKmPerRoute,
      avgDurationHours,
      successRate,
      failureRate
    };
  }, [processedData]);

  // Compute manifests list when a chart element is clicked
  const filteredManifestsForDetail = useMemo(() => {
    if (!activeDetailFilter) return [];
    const { type, value } = activeDetailFilter;
    
    return processedData.filter(m => {
      if (type === 'date') {
        return m.date === value;
      }
      if (type === 'route') {
        const routeIdMatch = Object.entries(routeMap).find(([id, name]) => name === value)?.[0] || value;
        return m.routeId === routeIdMatch;
      }
      if (type === 'vehicle') {
        const vehicleIdMatch = Object.entries(vehicleMap).find(([id, name]) => name === value)?.[0] || value;
        return m.vehicleId === vehicleIdMatch;
      }
      if (type === 'driver') {
        const driverIdMatch = Object.entries(driverMap).find(([id, name]) => name === value)?.[0] || value;
        return m.driverId === driverIdMatch;
      }
      if (type === 'status') {
        return (m.documentsSnapshot || []).some(d => {
          const st = d.trackingStatus || 'EN CURSO';
          if (value === 'Entregados') return st === 'ENTREGADO';
          if (value === 'Retirados') return st === 'RETIRADO';
          if (value === 'No Entregados') return st === 'NO ENTREGADO';
          if (value === 'No Retirados') return st === 'NO RETIRADO';
          if (value === 'Pendientes (En Ruta)') return st === 'EN CURSO' || !d.trackingStatus;
          return false;
        });
      }
      return false;
    });
  }, [activeDetailFilter, processedData, routeMap, vehicleMap, driverMap]);

  // Compute all documents for Service Level Detail modal
  const allServiceLevelDocuments = useMemo(() => {
    const docsList: Array<{
      id: string;
      tipo: string;
      razonSocial: string;
      totalPendiente: number;
      totalAmount?: number;
      guideNumber?: string;
      logisticsNotes?: string;
      deliveryStatus?: 'COMPLETO' | 'PARCIAL';
      trackingStatus?: 'ENTREGADO' | 'NO ENTREGADO' | 'RETIRADO' | 'NO RETIRADO' | 'EN CURSO';
      trackingObservation?: string;
      failedReason?: string;
      location?: string;
      proceso?: 'ENTREGA' | 'RETIRO';
      // Parent route properties for context
      routeNumber?: number;
      date?: string;
      driverName: string;
      vehiclePlate: string;
      routeName: string;
      manifestId: string;
    }> = [];

    processedData.forEach(m => {
      const docs = m.documentsSnapshot || [];
      docs.forEach(d => {
        docsList.push({
          ...d,
          routeNumber: m.routeNumber,
          date: m.date,
          driverName: driverMap[m.driverId] || m.driverId,
          vehiclePlate: vehicleMap[m.vehicleId] || m.vehicleId,
          routeName: routeMap[m.routeId || ''] || 'Sin asignar',
          manifestId: m.id
        });
      });
    });

    return docsList;
  }, [processedData, driverMap, vehicleMap, routeMap]);

  // Compute failed reasons distribution for the chart
  const failedReasonsChartData = useMemo(() => {
    const counts: Record<string, number> = {
      'POR HORARIO': 0,
      'CLIENTE NO RECIBE': 0,
      'NO CARGADO': 0,
      'SIN STOCK': 0,
      'DESCORDINACION': 0,
      'OTRO / SIN ESPECIFICAR': 0
    };

    let filteredFailedCount = 0;

    allServiceLevelDocuments.forEach(d => {
      const isFailed = d.trackingStatus === 'NO ENTREGADO' || d.trackingStatus === 'NO RETIRADO';
      if (isFailed) {
        const typeMatch = deviationsTypeFilter === 'ALL' || d.proceso === deviationsTypeFilter;
        if (!typeMatch) return;

        filteredFailedCount++;
        const reason = d.failedReason ? d.failedReason.trim().toUpperCase() : '';
        if (reason === 'POR HORARIO') {
          counts['POR HORARIO']++;
        } else if (reason === 'CLIENTE NO RECIBE') {
          counts['CLIENTE NO RECIBE']++;
        } else if (reason === 'NO CARGADO') {
          counts['NO CARGADO']++;
        } else if (reason === 'SIN STOCK') {
          counts['SIN STOCK']++;
        } else if (reason === 'DESCORDINACION' || reason === 'DESCOORDINACION') {
          counts['DESCORDINACION']++;
        } else {
          counts['OTRO / SIN ESPECIFICAR']++;
        }
      }
    });

    return {
      data: Object.entries(counts).map(([name, value]) => ({
        name,
        value
      })),
      totalFiltered: filteredFailedCount
    };
  }, [allServiceLevelDocuments, deviationsTypeFilter]);

  // Filter service level documents based on tab and search query
  const filteredServiceLevelDocuments = useMemo(() => {
    return allServiceLevelDocuments.filter(item => {
      // 1. Tab filter
      if (serviceLevelTab === 'FAILED') {
        const isFailed = item.trackingStatus === 'NO ENTREGADO' || item.trackingStatus === 'NO RETIRADO';
        if (!isFailed) return false;
        
        if (deviationsTypeFilter !== 'ALL' && item.proceso !== deviationsTypeFilter) {
          return false;
        }
      }

      // 2. Search filter
      if (serviceLevelSearch.trim() !== '') {
        const query = serviceLevelSearch.toLowerCase();
        const docId = (item.id || '').toLowerCase();
        const client = (item.razonSocial || '').toLowerCase();
        const guide = (item.guideNumber || '').toLowerCase();
        const driver = (item.driverName || '').toLowerCase();
        const route = (item.routeName || '').toLowerCase();
        const plate = (item.vehiclePlate || '').toLowerCase();
        const obs = (item.trackingObservation || '').toLowerCase();
        const location = (item.location || '').toLowerCase();

        return (
          docId.includes(query) ||
          client.includes(query) ||
          guide.includes(query) ||
          driver.includes(query) ||
          route.includes(query) ||
          plate.includes(query) ||
          obs.includes(query) ||
          location.includes(query)
        );
      }

      return true;
    });
  }, [allServiceLevelDocuments, serviceLevelTab, serviceLevelSearch]);

  // Memo to filter documents corresponding to the clicked/zoomed reason
  const zoomedDocuments = useMemo(() => {
    if (!zoomedReason) return [];
    return allServiceLevelDocuments.filter(item => {
      const isFailed = item.trackingStatus === 'NO ENTREGADO' || item.trackingStatus === 'NO RETIRADO';
      if (!isFailed) return false;
      
      const reason = item.failedReason || '';
      if (zoomedReason === 'OTRO / SIN ESPECIFICAR') {
        return !['POR HORARIO', 'CLIENTE NO RECIBE', 'NO CARGADO', 'SIN STOCK', 'DESCORDINACION', 'DESCOORDINACION'].includes(reason);
      }
      if (zoomedReason === 'DESCORDINACION') {
        return reason === 'DESCORDINACION' || reason === 'DESCOORDINACION';
      }
      return reason === zoomedReason;
    });
  }, [allServiceLevelDocuments, zoomedReason]);

  // 3. Prepare Chart Data grouped by dispatch date for Trends
  const dateTrendData = useMemo(() => {
    const groups: Record<string, { date: string; load: number; successfulDocs: number; totalDocs: number }> = {};
    
    processedData.forEach(m => {
      if (!m.date) return;
      if (!groups[m.date]) {
        groups[m.date] = { date: m.date, load: 0, successfulDocs: 0, totalDocs: 0 };
      }
      
      const docs = m.documentsSnapshot || [];
      groups[m.date].totalDocs += docs.length;
      
      docs.forEach(d => {
        const amt = d.tipo === 'OC' ? 0 : (d.totalAmount ?? d.totalPendiente ?? 0);
        groups[m.date].load += amt;
        
        if (d.trackingStatus === 'ENTREGADO' || d.trackingStatus === 'RETIRADO') {
          groups[m.date].successfulDocs++;
        }
      });
    });

    return Object.values(groups)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(item => {
        // Format to readable Spanish date
        const [y, m, d] = item.date.split('-');
        const dateFormatted = `${d}/${m}`;
        const successRate = item.totalDocs > 0 ? Math.round((item.successfulDocs / item.totalDocs) * 100) : 0;
        return {
          fechaRaw: item.date,
          fecha: dateFormatted,
          Carga: Math.round(item.load / 1000), // in thousands for visual neatness
          ClpTotal: item.load,
          'Efectividad (%)': successRate,
          documentos: item.totalDocs
        };
      });
  }, [processedData]);

  // 4. Distribution of order tracking status for Pie Chart
  const trackingStatusDistribution = useMemo(() => {
    let entregados = 0;
    let retirados = 0;
    let noEntregados = 0;
    let noRetirados = 0;
    let enCurso = 0;

    processedData.forEach(m => {
      (m.documentsSnapshot || []).forEach(d => {
        const st = d.trackingStatus || 'EN CURSO';
        if (st === 'ENTREGADO') entregados++;
        else if (st === 'RETIRADO') retirados++;
        else if (st === 'NO ENTREGADO') noEntregados++;
        else if (st === 'NO RETIRADO') noRetirados++;
        else enCurso++;
      });
    });

    const dataList = [
      { name: 'Entregados', value: entregados, color: '#10b981' }, // emerald-500
      { name: 'Retirados', value: retirados, color: '#6366f1' },    // indigo-500
      { name: 'No Entregados', value: noEntregados, color: '#f43f5e' }, // rose-500
      { name: 'No Retirados', value: noRetirados, color: '#f59e0b' },   // amber-500
      { name: 'Pendientes (En Ruta)', value: enCurso, color: '#94a3b8' }  // slate-400
    ];

    return dataList.filter(item => item.value > 0);
  }, [processedData]);

  // 5. Group Performance by Geographical Route/Destination for horizontal bar chart
  const routePerformanceData = useMemo(() => {
    const routeGroups: Record<string, { routeName: string; totalLoad: number; finishedDocs: number; totalDocs: number }> = {};

    processedData.forEach(m => {
      const rId = m.routeId || 'UNKNOWN';
      const rName = routeMap[rId] || 'Sin asignar';
      
      if (!routeGroups[rId]) {
        routeGroups[rId] = { routeName: rName, totalLoad: 0, finishedDocs: 0, totalDocs: 0 };
      }

      const docs = m.documentsSnapshot || [];
      routeGroups[rId].totalDocs += docs.length;

      docs.forEach(d => {
        const amt = d.tipo === 'OC' ? 0 : (d.totalAmount ?? d.totalPendiente ?? 0);
        routeGroups[rId].totalLoad += amt;

        if (d.trackingStatus === 'ENTREGADO' || d.trackingStatus === 'RETIRADO') {
          routeGroups[rId].finishedDocs++;
        }
      });
    });

    return Object.values(routeGroups)
      .map(item => {
        const rate = item.totalDocs > 0 ? Math.round((item.finishedDocs / item.totalDocs) * 100) : 0;
        return {
          Ruta: item.routeName,
          'Carga Total ($)': item.totalLoad,
          'Carga (M$)': Math.round(item.totalLoad / 1000),
          'Efectividad (%)': rate,
          Documentos: item.totalDocs
        };
      })
      .sort((a,b) => b['Carga Total ($)'] - a['Carga Total ($)'])
      .slice(0, 8); // Top 8 routes
  }, [processedData, routeMap]);

  // 6. Driver Efficiency Leaderboard
  const driverPerformanceData = useMemo(() => {
    const driverGroups: Record<string, { driverName: string; countRoutes: number; totalDocs: number; deliveredDocs: number; totalKm: number; kmCount: number }> = {};

    processedData.forEach(m => {
      const dId = m.driverId || 'UNKNOWN';
      const dName = driverMap[dId] || 'Chofer no especificado';

      if (!driverGroups[dId]) {
        driverGroups[dId] = { driverName: dName, countRoutes: 0, totalDocs: 0, deliveredDocs: 0, totalKm: 0, kmCount: 0 };
      }

      driverGroups[dId].countRoutes++;
      
      const docs = m.documentsSnapshot || [];
      driverGroups[dId].totalDocs += docs.length;

      docs.forEach(d => {
        if (d.trackingStatus === 'ENTREGADO' || d.trackingStatus === 'RETIRADO') {
          driverGroups[dId].deliveredDocs++;
        }
      });

      if (m.initialKm !== undefined && m.finalKm !== undefined && m.finalKm >= m.initialKm) {
        driverGroups[dId].totalKm += (m.finalKm - m.initialKm);
        driverGroups[dId].kmCount++;
      }
    });

    return Object.values(driverGroups)
      .map(item => {
        const successRate = item.totalDocs > 0 ? Math.round((item.deliveredDocs / item.totalDocs) * 100) : 0;
        const avgKm = item.kmCount > 0 ? Math.round(item.totalKm / item.kmCount) : 0;
        return {
          Chofer: item.driverName,
          Rutas: item.countRoutes,
          Documentos: item.totalDocs,
          'Efectividad (%)': successRate,
          'Km Promedio': avgKm
        };
      })
      .sort((a,b) => b['Efectividad (%)'] - a['Efectividad (%)'] || b.Rutas - a.Rutas);
  }, [processedData, driverMap]);

  // 6b. Vehicle Efficiency & Productivity Data
  const vehiclePerformanceData = useMemo(() => {
    const vehicleGroups: Record<string, { 
      vehicleName: string; 
      countRoutes: number; 
      totalDocs: number; 
      deliveredDocs: number; 
      totalKm: number; 
      kmCount: number;
      totalValue: number;
      totalTimeInMinutes: number;
      timeCount: number;
    }> = {};

    processedData.forEach(m => {
      const vId = m.vehicleId || 'UNKNOWN';
      const vName = vehicleMap[vId] || (vId === 'UNKNOWN' ? 'Vehículo no especificado' : vId);

      if (!vehicleGroups[vId]) {
        vehicleGroups[vId] = { 
          vehicleName: vName, 
          countRoutes: 0, 
          totalDocs: 0, 
          deliveredDocs: 0, 
          totalKm: 0, 
          kmCount: 0,
          totalValue: 0,
          totalTimeInMinutes: 0,
          timeCount: 0
        };
      }

      vehicleGroups[vId].countRoutes++;
      
      const docs = m.documentsSnapshot || [];
      vehicleGroups[vId].totalDocs += docs.length;

      docs.forEach(d => {
        if (d.trackingStatus === 'ENTREGADO' || d.trackingStatus === 'RETIRADO') {
          vehicleGroups[vId].deliveredDocs++;
        }
        const amt = d.tipo === 'OC' ? 0 : (d.totalAmount ?? d.totalPendiente ?? 0);
        vehicleGroups[vId].totalValue += amt;
      });

      if (m.initialKm !== undefined && m.finalKm !== undefined && m.finalKm >= m.initialKm) {
        vehicleGroups[vId].totalKm += (m.finalKm - m.initialKm);
        vehicleGroups[vId].kmCount++;
      }

      if (m.startTime && m.endTime) {
        const parseTime = (t: string) => {
          const [h, min] = t.split(':').map(Number);
          return (h * 60) + (min || 0);
        };
        const startMin = parseTime(m.startTime);
        const endMin = parseTime(m.endTime);
        if (endMin > startMin) {
          vehicleGroups[vId].totalTimeInMinutes += (endMin - startMin);
          vehicleGroups[vId].timeCount++;
        }
      }
    });

    return Object.values(vehicleGroups)
      .map(item => {
        const successRate = item.totalDocs > 0 ? Math.round((item.deliveredDocs / item.totalDocs) * 100) : 0;
        const avgKm = item.kmCount > 0 ? Math.round(item.totalKm / item.kmCount) : 0;
        const totalHours = item.timeCount > 0 ? (item.totalTimeInMinutes / 60) : 0;
        const avgTimeHrs = item.timeCount > 0 ? (item.totalTimeInMinutes / item.timeCount / 60) : 0;
        const valorPorViaje = item.countRoutes > 0 ? Math.round(item.totalValue / item.countRoutes) : 0;

        return {
          Vehiculo: item.vehicleName,
          Rutas: item.countRoutes,
          Documentos: item.totalDocs,
          'Efectividad (%)': successRate,
          'Km Totales': item.totalKm,
          'Km Promedio': avgKm,
          'Carga Total Valor ($)': item.totalValue,
          'Carga Total (M$)': Math.round(item.totalValue / 1000),
          'Carga Promedio (M$)': Math.round(valorPorViaje / 1000),
          'Horas Totales': totalHours,
          'Horas Promedio': avgTimeHrs
        };
      })
      .sort((a,b) => b.Rutas - a.Rutas || b['Km Totales'] - a['Km Totales'] || b['Carga Total Valor ($)'] - a['Carga Total Valor ($)']);
  }, [processedData, vehicleMap]);

  // Helper function to calculate OTIF/Efectividad for a specific manifest
  const calculateManifestOTIF = (manifest: LogisticsManifest) => {
    const docs = manifest.documentsSnapshot || [];
    if (docs.length === 0) return 0;
    const deliveredCount = docs.filter(d => d.trackingStatus === 'ENTREGADO' || d.trackingStatus === 'RETIRADO').length;
    return Math.round((deliveredCount / docs.length) * 100);
  };

  // Helper function to calculate total load value for a specific manifest
  const calculateManifestLoad = (manifest: LogisticsManifest) => {
    const docs = manifest.documentsSnapshot || [];
    return docs.reduce((acc, d) => {
      const amt = d.tipo === 'OC' ? 0 : (d.totalAmount ?? d.totalPendiente ?? 0);
      return acc + amt;
    }, 0);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 animate-fade-in" id="kpi-dashboard-panel">
      {/* Upper header section */}
      <div className="p-6 bg-white border-b border-slate-200 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FileBarChart2 className="w-5 h-5 text-indigo-600 animate-pulse" /> Cuadro de Mando & KPIs Logísticos
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Análisis avanzado de eficiencia de despacho, rutas finalizadas y efectividad de entrega (OTIF).
            </p>
          </div>

          {/* Quick Stats Summary badges */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex bg-slate-100 hover:bg-slate-200/80 transition-all font-mono font-bold text-[11px] text-slate-700 px-3.5 py-1.5 rounded-xl border border-slate-200">
              MUESTRA: {processedData.length} {processedData.length === 1 ? 'Ruta' : 'Rutas'}
            </div>
            {(selectedDriver !== 'ALL' || selectedRoute !== 'ALL' || timeSpan !== 'ALL' || searchQuery) && (
              <button 
                onClick={handleResetFilters}
                className="text-[10px] font-black tracking-wider uppercase bg-pink-50 hover:bg-pink-100 text-pink-600 px-3.5 py-1.5 rounded-xl border border-pink-200/50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" /> Limpiar Filtros
              </button>
            )}
          </div>
        </div>

        {/* Filters Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
          {/* Driver filter */}
          <div className="flex flex-col gap-1 text-left">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Filtrar por Chofer</span>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <select 
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-800 transition-all cursor-pointer"
              >
                <option value="ALL">Todos los Choferes</option>
                {availableDrivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Route filter */}
          <div className="flex flex-col gap-1 text-left">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Filtrar por Destino</span>
            <div className="relative">
              <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <select 
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-800 transition-all cursor-pointer"
              >
                <option value="ALL">Todas las Rutas</option>
                {availableRoutes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Time range filter */}
          <div className="flex flex-col gap-1 text-left">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Período de Tiempo</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <select 
                value={timeSpan}
                onChange={(e) => setTimeSpan(e.target.value as any)}
                className="w-full bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-800 transition-all cursor-pointer"
              >
                <option value="ALL">Histórico Completo</option>
                <option value="LAST_7">Últimos 7 Días</option>
                <option value="LAST_30">Últimos 30 Días</option>
                <option value="THIS_MONTH">Este Mes</option>
              </select>
            </div>
          </div>

          {/* Keyword search input */}
          <div className="flex flex-col gap-1 text-left">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Búsqueda Rápida</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input 
                type="text"
                placeholder="Chofer, patente, código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-800 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        
        {processedData.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center shadow-sm max-w-2xl mx-auto my-12 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-center text-slate-400">
              <AlertTriangle className="w-8 h-8 text-indigo-500 animate-bounce" />
            </div>
            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Sin Datos Disponibles</h3>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed mx-auto">
              No se han encontrado hojas de ruta terminadas con los criterios de búsqueda o filtrado actuales. Modifica los filtros o selecciona fechas con rutas grabadas.
            </p>
            <button 
              onClick={handleResetFilters}
              className="mt-2 text-xs px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/15 uppercase tracking-wider transition-all cursor-pointer"
            >
              Restablecer Filtros
            </button>
          </div>
        ) : (
          <>
            {/* 1. Core KPIs Metric Cards (Logistics Engineer Perspective) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Deliveries Success Rate (OTIF Index equivalent) */}
              <div 
                onClick={() => {
                  setServiceLevelTab('FAILED');
                  setServiceLevelSearch('');
                  setShowServiceLevelModal(true);
                }}
                className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest block mb-0.5">Nivel de Servicio</span>
                    <h4 className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-none">{metrics.successRate}%</h4>
                  </div>
                  <div className={`p-3 rounded-xl ${metrics.successRate >= 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} group-hover:scale-110 transition-transform`}>
                    <CheckCircle2 className="w-5 h-5 font-bold" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-wider">Entregas Exitosas</span>
                  <span className="text-indigo-600 group-hover:bg-indigo-50 font-mono bg-slate-100 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1">
                    {metrics.deliveredDocuments} / {metrics.totalDocuments} Doc.
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Managed Financial Volume */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest block mb-0.5">Carga Valorizada</span>
                    <h4 className="text-2xl font-black text-indigo-600 leading-none">{formatCLP(metrics.totalValue)}</h4>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
                    <DollarSign className="w-5 h-5 font-semibold" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-wider">Valor Promedio / Doc.</span>
                  <span className="text-slate-800 font-mono">
                    {metrics.totalDocuments > 0 ? formatCLP(Math.round(metrics.totalValue / metrics.totalDocuments)) : '$0'}
                  </span>
                </div>
              </div>

              {/* Total Mileage & Mileage Efficiency */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest block mb-0.5">Distancia Recorrida</span>
                    <h4 className="text-2xl font-black text-slate-900 leading-none">{metrics.totalKilometers.toLocaleString('es-CL')} Km</h4>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl group-hover:scale-110 transition-transform">
                    <Milestone className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-wider">Promedio por Ruta</span>
                  <span className="text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded-lg">{metrics.avgKmPerRoute} Km</span>
                </div>
              </div>

              {/* Duration / Operational Tempo */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest block mb-0.5">Tiempo de Operación</span>
                    <h4 className="text-2xl font-black text-slate-900 leading-none">
                      {metrics.avgDurationHours > 0 ? `${metrics.avgDurationHours.toFixed(1)} hrs` : 'N/D'}
                    </h4>
                  </div>
                  <div className="p-3 bg-sky-50 text-sky-600 rounded-xl group-hover:scale-110 transition-transform">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-wider">Rutas Completas</span>
                  <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg">{metrics.totalRoutes} Planificadas</span>
                </div>
              </div>

            </div>

            {/* 2. Visual Charts Container (Recharts) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Chart A: Dispatch Trends & Delivery Success Rate (2/3 width or 2 cols on lg) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between lg:col-span-2 h-[420px]">
                <div className="mb-4">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 leading-none">
                    <TrendingUp className="w-4 h-4 text-indigo-600" /> Tendencia de Despacho e Índice de Efectividad
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Relación entre la carga valorizada despachada (M$) y el % de entregas exitosas por fecha.</p>
                </div>
                
                {dateTrendData.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-xs italic">
                    Sin datos en serie temporal
                  </div>
                ) : (
                  <div className="flex-1 h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={dateTrendData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="fecha" 
                          tickLine={false} 
                          axisLine={false}
                          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' }} 
                        />
                        <YAxis 
                          yAxisId="left" 
                          tickLine={false} 
                          axisLine={false}
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          unit="k"
                          label={{ value: 'Carga despachada (M$ CLP)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 9, fontWeight: 'bold', style: { textAnchor: 'middle', transform: 'translateY(15px)' } }}
                        />
                        <YAxis 
                          yAxisId="right" 
                          orientation="right" 
                          tickLine={false} 
                          axisLine={false}
                          tick={{ fill: '#10b981', fontSize: 10, fontWeight: 'bold' }}
                          domain={[0, 100]}
                          unit="%"
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#0f172a', 
                            border: 'none', 
                            borderRadius: '16px', 
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', 
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }} 
                          formatter={(value, name) => {
                            if (name === 'Carga') return [`$${(Number(value) * 1000).toLocaleString('es-CL')}`, 'Carga Total'];
                            return [`${value}%`, name];
                          }}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }} />
                        
                        {/* Area bar for Load valued */}
                        <Bar 
                          yAxisId="left" 
                          dataKey="Carga" 
                          name="Carga" 
                          fill="#818cf8" 
                          radius={[6, 6, 0, 0]} 
                          maxBarSize={45}
                          cursor="pointer"
                          onClick={(entry) => {
                            const payload = entry?.payload || entry;
                            if (payload?.fechaRaw) {
                              setActiveDetailFilter({
                                type: 'date',
                                value: payload.fechaRaw,
                                title: `Hojas de Ruta del día ${payload.fecha}`
                              });
                            }
                          }}
                        />

                        {/* Spline line for service accuracy */}
                        <Line 
                          yAxisId="right" 
                          type="monotone" 
                          dataKey="Efectividad (%)" 
                          stroke="#10b981" 
                          strokeWidth={3} 
                          dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }} 
                          activeDot={{ r: 6 }} 
                          cursor="pointer"
                          onClick={(entry) => {
                            const payload = entry?.payload || entry;
                            if (payload?.fechaRaw) {
                              setActiveDetailFilter({
                                type: 'date',
                                value: payload.fechaRaw,
                                title: `Hojas de Ruta del día ${payload.fecha}`
                              });
                            }
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Chart B: Order Tracking Distribution (Pie chart showing delivery metrics) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between h-[420px]">
                <div className="mb-4">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 leading-none">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Distribución de Estados (OTIF)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Estado final de entrega de la totalidad de mercancía transportada.</p>
                </div>

                {trackingStatusDistribution.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-xs italic">
                    Sin documentos cargados
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="h-44 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={trackingStatusDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={75}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {trackingStatusDistribution.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.color} 
                                cursor="pointer"
                                onClick={() => {
                                  setActiveDetailFilter({
                                    type: 'status',
                                    value: entry.name,
                                    title: `Hojas de Ruta con Entregas en estado: ${entry.name}`
                                  });
                                }}
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#0f172a', 
                              border: 'none', 
                              borderRadius: '12px', 
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black text-slate-800 tracking-tighter leading-none">{metrics.totalDocuments}</span>
                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">ITEMS TOTAL</span>
                      </div>
                    </div>

                    {/* Explanatory Legend with item count and percentages */}
                    <div className="mt-4 grid grid-cols-2 gap-2 text-left">
                      {trackingStatusDistribution.map((item, index) => {
                        const percent = metrics.totalDocuments > 0 ? Math.round((item.value / metrics.totalDocuments) * 100) : 0;
                        return (
                          <div 
                            key={index} 
                            onClick={() => {
                              setActiveDetailFilter({
                                type: 'status',
                                value: item.name,
                                title: `Hojas de Ruta con Entregas en estado: ${item.name}`
                              });
                            }}
                            className="flex flex-col p-2 bg-slate-50 hover:bg-indigo-50/40 cursor-pointer border border-slate-100 rounded-xl transition-all"
                          >
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="truncate max-w-[80px]">{item.name}</span>
                            </div>
                            <div className="mt-1 flex items-baseline gap-1.5 font-mono">
                              <span className="text-slate-800 font-extrabold text-[12px]">{item.value}</span>
                              <span className="text-slate-400 font-bold text-[9px]">({percent}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* 3. Bottom Grid: Geographical efficiency and Driver statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Route Performers (Horizontal Bar Chart) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-[400px]">
                <div className="mb-4 text-left">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-indigo-600" /> Rendimiento y Eficacia por Destino / Ruta
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Volumen financiero despachado (M$) y tasa de éxito por ruta geográfica principal.</p>
                </div>

                {routePerformanceData.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-xs italic">
                    Sin rutas asignadas
                  </div>
                ) : (
                  <div className="flex-1 h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={routePerformanceData}
                        layout="vertical"
                        margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} unit="k" />
                        <YAxis 
                          type="category" 
                          dataKey="Ruta" 
                          tickLine={false} 
                          axisLine={false} 
                          tick={{ fill: '#334155', fontSize: 9, fontWeight: 'bold' }} 
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#0f172a', 
                            border: 'none', 
                            borderRadius: '12px', 
                            color: '#fff',
                            fontSize: '11px'
                          }}
                          formatter={(value, name) => {
                            if (name === 'Carga (M$)') return [`$${(Number(value) * 1000).toLocaleString('es-CL')}`, 'Volumen de Carga'];
                            if (name === 'Efectividad (%)') return [`${value}%`, 'Efectividad'];
                            return [value, name];
                          }}
                        />
                        <Bar 
                          dataKey="Carga (M$)" 
                          fill="#4f46e5" 
                          radius={[0, 4, 4, 0]} 
                          maxBarSize={16} 
                          cursor="pointer"
                          onClick={(entry) => {
                            const payload = entry?.payload || entry;
                            if (payload?.Ruta) {
                              setActiveDetailFilter({
                                type: 'route',
                                value: payload.Ruta,
                                title: `Hojas de Ruta - Destino: ${payload.Ruta}`
                              });
                            }
                          }}
                        />
                        <Bar 
                          dataKey="Efectividad (%)" 
                          fill="#10b981" 
                          radius={[0, 4, 4, 0]} 
                          maxBarSize={6} 
                          cursor="pointer"
                          onClick={(entry) => {
                            const payload = entry?.payload || entry;
                            if (payload?.Ruta) {
                              setActiveDetailFilter({
                                type: 'route',
                                value: payload.Ruta,
                                title: `Hojas de Ruta - Destino: ${payload.Ruta}`
                              });
                            }
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Driver Efficiency Leaderboard Table */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-[400px]">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-left">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-500" /> Desempeño y Productividad de Operadores / Choferes
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium font-sans">Métricas logísticas por operador de flota (rutas conducidas, eficacia de entrega y viajes promedio).</p>
                  </div>
                </div>

                <div className="flex-1 overflow-auto border border-slate-100 rounded-2xl">
                  {driverPerformanceData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                      Sin datos de operadores
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-100">
                        <tr className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
                          <th className="px-4 py-3">Operador / Conductor</th>
                          <th className="px-3 py-3 text-center">Viajes</th>
                          <th className="px-3 py-3 text-center">Entregas (Pts)</th>
                          <th className="px-3 py-3 text-center">Km Prom.</th>
                          <th className="px-4 py-3 text-right">Efectividad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {driverPerformanceData.map((d, idx) => (
                          <tr 
                            key={idx} 
                            onClick={() => {
                              setActiveDetailFilter({
                                type: 'driver',
                                value: d.Chofer,
                                title: `Hojas de Ruta - Chofer: ${d.Chofer}`
                              });
                            }}
                            className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3 flex items-center gap-2">
                              <span className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-bold font-mono">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-slate-800 truncate max-w-[120px]">{d.Chofer}</span>
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-slate-600 font-mono">
                              {d.Rutas}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-slate-600 font-mono">
                              {d.Documentos}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-slate-400 font-mono">
                              {d['Km Promedio'] > 0 ? `${d['Km Promedio']} km` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="font-mono font-black text-slate-900">{d['Efectividad (%)']}%</span>
                                <div className="w-8 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${d['Efectividad (%)'] >= 90 ? 'bg-emerald-500' : d['Efectividad (%)'] >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                    style={{ width: `${d['Efectividad (%)']}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>

            {/* 4. Fleet and Vehicles Productivity Dashboard Section */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-6 mt-6" id="fleet-productivity-section">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="text-left">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <Truck className="w-5 h-5 text-indigo-600" /> Control de Productividad y Desempeño de la Flota (Vehículos)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium font-sans">
                    Análisis detallado de kilómetros acumulados, cantidad de viajes, volumen financiero transportado y nivel de efectividad por patente de vehículo.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Vehicle Mileage & Load Chart */}
                <div className="border border-slate-100 rounded-2xl p-4 flex flex-col justify-between h-[360px]" id="fleet-chart-container">
                  <div className="mb-4 text-left">
                    <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider block">Gráfico Comparativo de Flota</span>
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-tight">Km Totales vs Carga Valorizada (M$) por Vehículo</h4>
                  </div>
                  
                  {vehiclePerformanceData.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400 text-xs italic">
                      Sin datos de vehículos
                    </div>
                  ) : (
                    <div className="flex-1 h-full w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={vehiclePerformanceData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="Vehiculo" 
                            tickLine={false} 
                            axisLine={false} 
                            tick={{ fill: '#475569', fontSize: 8, fontWeight: 'bold' }} 
                            formatter={(value: string) => {
                              return value.split(' - ')[0] || value;
                            }}
                          />
                          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                          <Tooltip
                            contentStyle={{ 
                              backgroundColor: '#0f172a', 
                              border: 'none', 
                              borderRadius: '12px', 
                              color: '#fff',
                              fontSize: '11px'
                            }}
                            formatter={(value, name) => {
                              if (name === 'Km Totales') return [`${value} km`, 'Distancia Total'];
                              if (name === 'Carga Total (M$)') return [`$${(Number(value) * 1000).toLocaleString('es-CL')}`, 'Carga Total'];
                              return [value, name];
                            }}
                          />
                          <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }} />
                          <Bar 
                            name="Km Totales" 
                            dataKey="Km Totales" 
                            fill="#06b6d4" 
                            radius={[4, 4, 0, 0]} 
                            maxBarSize={25} 
                            cursor="pointer"
                            onClick={(entry) => {
                              const payload = entry?.payload || entry;
                              if (payload?.Vehiculo) {
                                setActiveDetailFilter({
                                  type: 'vehicle',
                                  value: payload.Vehiculo,
                                  title: `Hojas de Ruta - Vehículo: ${payload.Vehiculo}`
                                });
                              }
                            }}
                          />
                          <Bar 
                            name="Carga Total (M$)" 
                            dataKey="Carga Total (M$)" 
                            fill="#6366f1" 
                            radius={[4, 4, 0, 0]} 
                            maxBarSize={25} 
                            cursor="pointer"
                            onClick={(entry) => {
                              const payload = entry?.payload || entry;
                              if (payload?.Vehiculo) {
                                setActiveDetailFilter({
                                  type: 'vehicle',
                                  value: payload.Vehiculo,
                                  title: `Hojas de Ruta - Vehículo: ${payload.Vehiculo}`
                                });
                              }
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Vehicle Performance Leaderboard Table */}
                <div className="border border-slate-100 rounded-2xl p-4 flex flex-col justify-between h-[360px] overflow-hidden" id="fleet-table-container">
                  <div className="mb-4 text-left flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider block">Tabla de Desempeño</span>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-tight">Rendimiento Operacional de la Flota</h4>
                    </div>
                    <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg border border-indigo-100 font-mono font-bold">
                      Flota Activa: {vehiclePerformanceData.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-auto border border-slate-100 rounded-xl">
                    {vehiclePerformanceData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                        Sin datos operativos de vehículos
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 border-b border-slate-150 sticky top-0">
                          <tr className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
                            <th className="px-3 py-2">Patente / Modelo</th>
                            <th className="px-2 py-2 text-center">Viajes</th>
                            <th className="px-2 py-2 text-center">Km Tot.</th>
                            <th className="px-2 py-2 text-right">Carga Total</th>
                            <th className="px-3 py-2 text-right">OTIF (%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {vehiclePerformanceData.map((v, idx) => (
                            <tr 
                              key={idx} 
                              onClick={() => {
                                setActiveDetailFilter({
                                  type: 'vehicle',
                                  value: v.Vehiculo,
                                  title: `Hojas de Ruta - Vehículo: ${v.Vehiculo}`
                                });
                              }}
                              className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                            >
                              <td className="px-3 py-2 text-left">
                                <div className="font-bold text-slate-800 flex items-center gap-1.5 leading-tight">
                                  <span className="w-4 h-4 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center text-[9px] font-mono font-bold shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="truncate max-w-[140px]" title={v.Vehiculo}>
                                    {v.Vehiculo}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-center font-bold text-slate-700 font-mono text-[11px]">
                                {v.Rutas}
                              </td>
                              <td className="px-2 py-2 text-center font-semibold text-slate-500 font-mono text-[11px]">
                                {v['Km Totales'].toLocaleString('es-CL')} km
                              </td>
                              <td className="px-2 py-2 text-right font-bold text-slate-800 font-mono text-[11px]">
                                {formatCLP(v['Carga Total Valor ($)'])}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className={`inline-block font-mono font-extrabold px-1.5 py-0.5 rounded-[6px] text-[10px] ${
                                  v['Efectividad (%)'] >= 90
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : v['Efectividad (%)'] >= 75
                                    ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                    : 'bg-rose-50 text-rose-700 border border-rose-100'
                                }`}>
                                  {v['Efectividad (%)']}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </>
        )}
      </div>

      {/* Interactive Detail Modal for KPI Chart Elements */}
      <AnimatePresence>
        {activeDetailFilter && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden border border-slate-100"
            >
              {/* Modal Header */}
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider block mb-1">Detalle del Indicador</span>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                    <FileBarChart2 className="w-5 h-5 text-indigo-600" /> {activeDetailFilter.title}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    Muestra de {filteredManifestsForDetail.length} {filteredManifestsForDetail.length === 1 ? 'Hoja de Ruta' : 'Hojas de Ruta'} que componen este indicador.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setActiveDetailFilter(null);
                    setExpandedManifestId(null);
                  }}
                  className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-all cursor-pointer shadow-sm hover:scale-105"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                {filteredManifestsForDetail.length === 0 ? (
                  <div className="text-center py-12 flex flex-col items-center gap-3">
                    <AlertTriangle className="w-12 h-12 text-slate-300 animate-bounce" />
                    <p className="text-xs font-bold text-slate-500 uppercase">Sin Hojas de Ruta registradas</p>
                    <p className="text-[10px] text-slate-400 max-w-xs">No se encontraron hojas de ruta para esta selección en el conjunto filtrado.</p>
                  </div>
                ) : (
                  filteredManifestsForDetail.map((m) => {
                    const otif = calculateManifestOTIF(m);
                    const totalLoad = calculateManifestLoad(m);
                    const isExpanded = expandedManifestId === m.id;

                    return (
                      <div 
                        key={m.id} 
                        className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-700">
                              <FileText className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-slate-800">
                                  HR-{m.routeNumber ?? 'S/N'}
                                </h4>
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  m.isFinalized 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                  {m.isFinalized ? 'FINALIZADA' : 'EN PROCESO'}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium flex flex-wrap items-center gap-2 mt-0.5">
                                <span>Fecha: {m.date ? m.date.split('-').reverse().join('/') : '-'}</span>
                                <span className="text-slate-300">•</span>
                                <span>KM Inicial: {m.initialKm !== undefined ? `${m.initialKm} km` : '-'}</span>
                                <span className="text-slate-300">•</span>
                                <span>KM Final: {m.finalKm !== undefined ? `${m.finalKm} km` : '-'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 self-end sm:self-auto">
                            <div className="text-right">
                              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block leading-none">Carga Total</span>
                              <span className="text-sm font-black text-slate-800 font-mono">
                                {formatCLP(totalLoad)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
                              <div className="text-right">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block leading-none">OTIF</span>
                                <span className="text-[11px] font-black text-slate-700 font-mono">
                                  {otif}%
                                </span>
                              </div>
                              <div className="w-5 bg-slate-200 h-1.5 rounded-full overflow-hidden shrink-0">
                                <div 
                                  className={`h-full rounded-full ${otif >= 90 ? 'bg-emerald-500' : otif >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                  style={{ width: `${otif}%` }}
                                />
                              </div>
                            </div>

                            <button
                              onClick={() => setExpandedManifestId(isExpanded ? null : m.id)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-lg transition-all cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* General stats bar */}
                        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                          <div>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Chofer</span>
                            <span className="text-[10px] font-bold text-slate-700 truncate block max-w-[180px]">
                              {driverMap[m.driverId] || m.driverId}
                            </span>
                          </div>
                          <div>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Vehículo</span>
                            <span className="text-[10px] font-bold text-slate-700 truncate block max-w-[180px]">
                              {vehicleMap[m.vehicleId] || m.vehicleId}
                            </span>
                          </div>
                          <div>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Ruta / Destino</span>
                            <span className="text-[10px] font-bold text-indigo-600 truncate block max-w-[180px]">
                              {routeMap[m.routeId || ''] || 'Sin asignar'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Horario & Distancia</span>
                            <span className="text-[10px] font-bold text-slate-600 block">
                              {m.startTime || 'S/H'} - {m.endTime || 'S/H'} {m.initialKm !== undefined && m.finalKm !== undefined ? `(${m.finalKm - m.initialKm} km)` : ''}
                            </span>
                          </div>
                        </div>

                        {/* Expanded details list of documents */}
                        {isExpanded && (
                          <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-4 overflow-x-auto text-left animate-fade-in">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                              Planilla de Despacho ({m.documentsSnapshot?.length || 0} Documentos)
                            </div>
                            <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                              <thead>
                                <tr className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                                  <th className="pb-2">Tipo / Nº</th>
                                  <th className="pb-2">Cliente (Razón Social)</th>
                                  <th className="pb-2">Guía</th>
                                  <th className="pb-2">Proceso</th>
                                  <th className="pb-2">Localidad</th>
                                  <th className="pb-2 text-right">Monto</th>
                                  <th className="pb-2 text-center">Estado</th>
                                  <th className="pb-2">Observación</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-150">
                                {(m.documentsSnapshot || []).map((doc, docIdx) => {
                                  const isMatchStatus = activeDetailFilter?.type === 'status' && (
                                    (activeDetailFilter.value === 'Entregados' && doc.trackingStatus === 'ENTREGADO') ||
                                    (activeDetailFilter.value === 'Retirados' && doc.trackingStatus === 'RETIRADO') ||
                                    (activeDetailFilter.value === 'No Entregados' && doc.trackingStatus === 'NO ENTREGADO') ||
                                    (activeDetailFilter.value === 'No Retirados' && doc.trackingStatus === 'NO RETIRADO') ||
                                    (activeDetailFilter.value === 'Pendientes (En Ruta)' && (doc.trackingStatus === 'EN CURSO' || !doc.trackingStatus))
                                  );

                                  return (
                                    <tr 
                                      key={docIdx} 
                                      className={`transition-colors ${isMatchStatus ? 'bg-indigo-50/70 font-bold' : 'hover:bg-slate-100/50'}`}
                                    >
                                      <td className="py-2.5 font-mono text-[10px] font-bold text-slate-700">
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded mr-1 text-[9px] font-sans text-slate-500">{doc.tipo}</span>
                                        {doc.id}
                                      </td>
                                      <td className="py-2.5 text-slate-800 truncate max-w-[150px]" title={doc.razonSocial}>
                                        {doc.razonSocial}
                                      </td>
                                      <td className="py-2.5 font-mono text-[10px] text-slate-600">
                                        {doc.guideNumber || <span className="text-slate-300">—</span>}
                                      </td>
                                      <td className="py-2.5 text-slate-600">
                                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${doc.proceso === 'RETIRO' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                          {doc.proceso === 'RETIRO' ? <RotateCcw className="w-2.5 h-2.5" /> : <Truck className="w-2.5 h-2.5" />}
                                          {doc.proceso || 'ENTREGA'}
                                        </span>
                                      </td>
                                      <td className="py-2.5 text-slate-500 text-[10px] truncate max-w-[120px]" title={doc.location}>
                                        {doc.location || '-'}
                                      </td>
                                      <td className="py-2.5 text-right font-mono font-bold text-slate-700 text-[11px]">
                                        {formatCLP(doc.tipo === 'OC' ? 0 : (doc.totalAmount ?? doc.totalPendiente ?? 0))}
                                      </td>
                                      <td className="py-2.5 text-center">
                                        <span className={`inline-block font-mono font-extrabold px-1.5 py-0.5 rounded-[4px] text-[9px] ${
                                          doc.trackingStatus === 'ENTREGADO' || doc.trackingStatus === 'RETIRADO'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                            : doc.trackingStatus === 'NO ENTREGADO' || doc.trackingStatus === 'NO RETIRADO'
                                            ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                        }`}>
                                          {doc.trackingStatus || 'EN CURSO'}
                                        </span>
                                      </td>
                                      <td className="py-2.5 text-slate-500 text-[10px] truncate max-w-[140px]" title={doc.trackingObservation}>
                                        {doc.trackingObservation || '-'}
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

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => {
                    setActiveDetailFilter(null);
                    setExpandedManifestId(null);
                  }}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal for Service Level (Nivel de Servicio) - Unsuccessful Deliveries & General Stats */}
        {showServiceLevelModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-5xl w-full h-[85vh] flex flex-col overflow-hidden border border-slate-100"
            >
              {/* Modal Header */}
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider block mb-1">Análisis de Nivel de Servicio</span>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-indigo-600" /> Nivel de Servicio General: {metrics.successRate}%
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Detalle analítico de efectividad de despacho con enfoque en desviaciones y observaciones.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setShowServiceLevelModal(false);
                      setServiceLevelSearch('');
                    }}
                    className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-all cursor-pointer shadow-sm hover:scale-105"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* KPI Summary Cards inside the Header */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-white border border-slate-150 p-3 rounded-2xl text-left">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Total Documentos</span>
                    <span className="text-base font-black text-slate-800 font-mono">{metrics.totalDocuments}</span>
                  </div>
                  <div className="bg-white border border-slate-150 p-3 rounded-2xl text-left flex items-center justify-between">
                    <div>
                      <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider block mb-0.5">Entregados</span>
                      <span className="text-base font-black text-emerald-600 font-mono">{metrics.entregadosOnlyDocs}</span>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-150 p-3 rounded-2xl text-left flex items-center justify-between">
                    <div>
                      <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider block mb-0.5">Retirados</span>
                      <span className="text-base font-black text-emerald-600 font-mono">{metrics.retiradosOnlyDocs}</span>
                    </div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded-lg">
                      {metrics.successRate}%
                    </span>
                  </div>
                  <div className="bg-white border border-slate-150 p-3 rounded-2xl text-left flex items-center justify-between">
                    <div>
                      <span className="text-[8px] font-bold text-rose-600 uppercase tracking-wider block mb-0.5">No Exitosos (Rechazados)</span>
                      <span className="text-base font-black text-rose-600 font-mono">{metrics.failedDocuments}</span>
                    </div>
                    <span className="text-[10px] bg-rose-50 text-rose-700 font-extrabold px-1.5 py-0.5 rounded-lg">
                      {metrics.failureRate}%
                    </span>
                  </div>
                  <div className="bg-white border border-slate-150 p-3 rounded-2xl text-left">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Pendientes en Ruta</span>
                    <span className="text-base font-black text-amber-600 font-mono">
                      {metrics.totalDocuments - metrics.deliveredDocuments - metrics.failedDocuments}
                    </span>
                  </div>
                </div>

                {/* Sub-Header actions: Tabs & Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  {/* Tabs */}
                  <div className="flex bg-slate-100 p-1 rounded-xl self-start">
                    <button
                      onClick={() => setServiceLevelTab('FAILED')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        serviceLevelTab === 'FAILED'
                          ? 'bg-white text-rose-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Puntos No Exitosos ({metrics.failedDocuments})
                    </button>
                    <button
                      onClick={() => setServiceLevelTab('ALL')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        serviceLevelTab === 'ALL'
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Todos los Puntos ({metrics.totalDocuments})
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="relative w-full sm:max-w-xs">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Buscar por Nº, Cliente, Chofer..."
                      value={serviceLevelSearch}
                      onChange={(e) => setServiceLevelSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all"
                    />
                    {serviceLevelSearch && (
                      <button 
                        onClick={() => setServiceLevelSearch('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Content - Table list & Charts */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 text-left custom-scrollbar">
                
                {/* Visual Chart Panel: Motivos de Despacho No Exitosos */}
                <div className="flex flex-wrap items-center justify-between mb-4">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setDeviationsTypeFilter('ALL')}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${deviationsTypeFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Ambos
                    </button>
                    <button
                      onClick={() => setDeviationsTypeFilter('ENTREGA')}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${deviationsTypeFilter === 'ENTREGA' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Entregas
                    </button>
                    <button
                      onClick={() => setDeviationsTypeFilter('RETIRO')}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${deviationsTypeFilter === 'RETIRO' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Retiros
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Reasons Bar Chart */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col h-[200px] justify-between">
                    <div className="text-left">
                      <span className="text-[9px] font-extrabold uppercase text-rose-600 tracking-wider block mb-0.5">Distribución de Rechazos</span>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5 leading-none">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Desviaciones por Motivo
                      </h4>
                      <p className="text-[9px] text-slate-400 font-medium mt-0.5">Métrica acumulada de motivos de rechazo.</p>
                    </div>

                    <div className="flex-1 min-h-[110px] mt-2 relative">
                      {failedReasonsChartData.totalFiltered === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-400 italic">
                          No hay desviaciones registradas
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={failedReasonsChartData.data}
                            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                          >
                            <XAxis type="number" hide />
                            <YAxis 
                              type="category" 
                              dataKey="name" 
                              width={120} 
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 7, fontWeight: 'black', fill: '#475569' }} 
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#0f172a', 
                                border: 'none', 
                                borderRadius: '12px', 
                                color: '#fff',
                                fontSize: '10px',
                                fontWeight: 'bold'
                              }} 
                              formatter={(value) => [`${value} doctos`, 'Cantidad']}
                            />
                            <Bar 
                              dataKey="value" 
                              radius={[0, 4, 4, 0]}
                              barSize={12}
                              label={{ position: 'right', fill: '#1e293b', fontSize: 9, fontWeight: 'black' }}
                            >
                              {failedReasonsChartData.data.map((entry, idx) => {
                                let color = '#94a3b8'; // grey
                                if (entry.name === 'POR HORARIO') color = '#f59e0b'; // amber
                                if (entry.name === 'CLIENTE NO RECIBE') color = '#f43f5e'; // rose
                                if (entry.name === 'NO CARGADO') color = '#6366f1'; // indigo
                                if (entry.name === 'SIN STOCK') color = '#ec4899'; // pink
                                if (entry.name === 'DESCORDINACION') color = '#0d9488'; // teal
                                return <Cell key={`cell-${idx}`} fill={color} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Mini Stats Breakdown */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between lg:col-span-2">
                    <div className="flex items-center justify-between mb-2 text-left">
                      <div>
                        <span className="text-[9px] font-extrabold uppercase text-indigo-600 tracking-wider block mb-0.5">Resumen de Desviaciones</span>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Motivos de Desviación / Rechazo</h4>
                      </div>
                      <span className="text-[9px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-lg">
                        Total Filtrados: {failedReasonsChartData.totalFiltered}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-1 text-left">
                      {failedReasonsChartData.data.map((entry) => {
                        let colorClass = 'bg-slate-100/50 text-slate-800 border-slate-200';
                        let textColorClass = 'text-slate-500';
                        let percentage = failedReasonsChartData.totalFiltered > 0 ? Math.round((entry.value / failedReasonsChartData.totalFiltered) * 100) : 0;
                        
                        if (entry.name === 'POR HORARIO') {
                          colorClass = 'bg-amber-50/50 text-amber-900 border-amber-200';
                          textColorClass = 'text-amber-600';
                        } else if (entry.name === 'CLIENTE NO RECIBE') {
                          colorClass = 'bg-rose-50/50 text-rose-900 border-rose-200';
                          textColorClass = 'text-rose-600';
                        } else if (entry.name === 'NO CARGADO') {
                          colorClass = 'bg-indigo-50/50 text-indigo-900 border-indigo-200';
                          textColorClass = 'text-indigo-600';
                        } else if (entry.name === 'SIN STOCK') {
                          colorClass = 'bg-pink-50/50 text-pink-900 border-pink-200';
                          textColorClass = 'text-pink-600';
                        } else if (entry.name === 'DESCORDINACION') {
                          colorClass = 'bg-teal-50/50 text-teal-900 border-teal-200';
                          textColorClass = 'text-teal-600';
                        }

                        return (
                          <div 
                            key={entry.name} 
                            onClick={() => setZoomedReason(entry.name)}
                            className={`border rounded-xl p-2.5 flex flex-col justify-between cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm hover:shadow-md ${colorClass}`}
                            title={`Haga clic para expandir y ver documentos de: ${entry.name}`}
                          >
                            <span className="text-[8px] font-black tracking-wider uppercase truncate block" title={entry.name}>{entry.name}</span>
                            <div className="flex items-baseline justify-between mt-1.5">
                              <span className="text-sm font-black font-mono leading-none">{entry.value}</span>
                              <span className={`text-[9px] font-bold ${textColorClass}`}>{percentage}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {filteredServiceLevelDocuments.length === 0 ? (
                  <div className="text-center py-16 flex flex-col items-center gap-3">
                    <AlertTriangle className="w-12 h-12 text-slate-300 animate-bounce" />
                    <p className="text-xs font-bold text-slate-500 uppercase">Sin registros encontrados</p>
                    <p className="text-[10px] text-slate-400 max-w-xs">
                      No se encontraron entregas que coincidan con los criterios de búsqueda o filtro aplicados.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                          <th className="px-4 py-3 text-center">Fecha</th>
                          <th className="px-4 py-3">HR Nº</th>
                          <th className="px-4 py-3">Chofer & Patente</th>
                          <th className="px-4 py-3">Documento</th>
                          <th className="px-4 py-3">Guía</th>
                          <th className="px-4 py-3">Cliente (Razón Social)</th>
                          <th className="px-4 py-3">Localidad</th>
                          <th className="px-4 py-3 text-right">Monto</th>
                          <th className="px-4 py-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredServiceLevelDocuments.map((item, idx) => {
                          const isFailed = item.trackingStatus === 'NO ENTREGADO' || item.trackingStatus === 'NO RETIRADO';
                          
                          return (
                            <React.Fragment key={`${item.manifestId}-${item.id}-${idx}`}>
                              <tr className={`transition-colors ${isFailed ? 'bg-rose-50/20 hover:bg-rose-50/45 font-medium' : 'hover:bg-slate-50/50'}`}>
                                <td className="px-4 py-3 text-center text-slate-500 text-[10px] font-mono leading-none">
                                  {item.date ? item.date.split('-').reverse().join('/') : '-'}
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-700 font-mono text-[10px]">
                                  HR-{item.routeNumber ?? 'S/N'}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  <div className="font-bold text-slate-700 leading-tight truncate max-w-[140px]">{item.driverName}</div>
                                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">{item.vehiclePlate}</div>
                                </td>
                                <td className="px-4 py-3 font-mono text-[10px] font-bold text-slate-700">
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded mr-1 text-[9px] font-sans text-slate-500 font-normal">{item.tipo}</span>
                                  {item.id}
                                </td>
                                <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                                  {item.guideNumber || <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-4 py-3 text-slate-800">
                                  <div className="truncate max-w-[180px] font-bold text-slate-700" title={item.razonSocial}>{item.razonSocial}</div>
                                  <div className="text-[9px] text-indigo-500 font-semibold truncate max-w-[180px]" title={item.routeName}>{item.routeName}</div>
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-[10px] truncate max-w-[120px]" title={item.location}>
                                  {item.location || '-'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 text-[11px]">
                                  {formatCLP(item.tipo === 'OC' ? 0 : (item.totalAmount ?? item.totalPendiente ?? 0))}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-block font-mono font-extrabold px-1.5 py-0.5 rounded-[4px] text-[9px] ${
                                    item.trackingStatus === 'ENTREGADO' || item.trackingStatus === 'RETIRADO'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      : isFailed
                                      ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}>
                                    {item.trackingStatus || 'EN CURSO'}
                                  </span>
                                </td>
                              </tr>

                              {/* Observation details row (specifically styled for deviations/failed points) */}
                              {isFailed && (
                                <tr className="bg-rose-50/10">
                                  <td colSpan={9} className="px-4 py-2 border-t border-rose-100/30">
                                    <div className="flex items-start gap-2 bg-rose-50/60 border border-rose-100/50 p-2.5 rounded-xl text-left ml-4 mr-4 mb-1">
                                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="text-[9px] font-extrabold text-rose-700 uppercase tracking-wider block mb-0.5">Motivo del Rechazo / Observación:</span>
                                        <p className="text-[11px] text-slate-600 font-bold leading-relaxed flex items-center flex-wrap gap-1.5">
                                          {item.failedReason && (
                                            <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">
                                              {item.failedReason}
                                            </span>
                                          )}
                                          <span>
                                            {item.trackingObservation || 'No se ingresó ninguna observación descriptiva en el registro.'}
                                          </span>
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}

                              {/* Optionally show observations for successful items if they have notes */}
                              {!isFailed && item.trackingObservation && (
                                <tr className="bg-slate-50/20">
                                  <td colSpan={9} className="px-4 py-1.5 border-t border-slate-100/30">
                                    <div className="flex items-start gap-2 bg-slate-50/80 border border-slate-100/60 p-2 rounded-xl text-left ml-4 mr-4 mb-1">
                                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="text-[8px] font-bold text-slate-500 uppercase block">Observación de Entrega:</span>
                                        <p className="text-[10px] text-slate-600 font-medium leading-normal">
                                          {item.trackingObservation}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => {
                    setShowServiceLevelModal(false);
                    setServiceLevelSearch('');
                  }}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md hover:scale-105"
                >
                  Cerrar
                </button>
              </div>

              {/* Zoom Overlay for Clicked/Zoomed Reason Cards */}
              <AnimatePresence>
                {zoomedReason && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/65 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6"
                  >
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 15 }}
                      className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90%] flex flex-col overflow-hidden border border-slate-100"
                    >
                      {/* Zoom Modal Header */}
                      <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="text-left">
                          <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider block mb-1">
                            Detalle de Desviación Zoom
                          </span>
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight">
                              Motivo: {zoomedReason}
                            </h3>
                            <span className="bg-rose-50 text-rose-700 border border-rose-100 font-extrabold font-mono text-[10px] px-2 py-0.5 rounded-full">
                              {zoomedDocuments.length} {zoomedDocuments.length === 1 ? 'Punto' : 'Puntos'}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setZoomedReason(null)}
                          className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-all cursor-pointer shadow-sm hover:scale-105"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Zoom Modal Content */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left custom-scrollbar">
                        {/* Massive Stat Block */}
                        <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
                              <AlertTriangle className="w-7 h-7" />
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registros Totales</span>
                              <div className="text-3xl font-black text-slate-800 font-mono tracking-tight leading-none mt-1">
                                {zoomedDocuments.length}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                              <DollarSign className="w-7 h-7" />
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Monto Total Estimado</span>
                              <div className="text-2xl font-black text-slate-800 font-mono tracking-tight leading-none mt-1">
                                {formatCLP(zoomedDocuments.reduce((sum, item) => sum + (item.tipo === 'OC' ? 0 : (item.totalAmount ?? item.totalPendiente ?? 0)), 0))}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                              <Truck className="w-7 h-7" />
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rutas Afectadas</span>
                              <div className="text-2xl font-black text-slate-800 font-mono tracking-tight leading-none mt-1">
                                {new Set(zoomedDocuments.map(d => d.manifestId)).size}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* List of matching documents */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-slate-700 uppercase tracking-tight mb-2">Documentos con esta desviación:</h4>
                          {zoomedDocuments.length === 0 ? (
                            <p className="text-xs font-medium text-slate-400 py-4 text-center">No hay documentos con este motivo.</p>
                          ) : (
                            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                                <thead>
                                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                                    <th className="px-4 py-2 text-center">Fecha</th>
                                    <th className="px-4 py-2">HR Nº</th>
                                    <th className="px-4 py-2">Chofer</th>
                                    <th className="px-4 py-2">Documento</th>
                                    <th className="px-4 py-2">Cliente</th>
                                    <th className="px-4 py-2 text-right">Monto</th>
                                    <th className="px-4 py-2 text-center">Estado</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {zoomedDocuments.map((item, idx) => {
                                    return (
                                      <React.Fragment key={idx}>
                                        <tr className="hover:bg-slate-50/50">
                                          <td className="px-4 py-2.5 text-center text-slate-500 font-mono text-[10px]">
                                            {item.date ? item.date.split('-').reverse().join('/') : '-'}
                                          </td>
                                          <td className="px-4 py-2.5 font-bold text-slate-700 font-mono text-[10px]">
                                            HR-{item.routeNumber ?? 'S/N'}
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-600">
                                            <div className="font-bold text-slate-700 leading-tight truncate max-w-[120px]">{item.driverName}</div>
                                            <div className="text-[9px] text-slate-400 font-mono">{item.vehiclePlate}</div>
                                          </td>
                                          <td className="px-4 py-2.5 font-mono text-[10px] font-bold text-slate-700">
                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded mr-1 text-[9px] font-sans text-slate-500 font-normal">{item.tipo}</span>
                                            {item.id}
                                          </td>
                                          <td className="px-4 py-2.5 text-slate-800">
                                            <div className="truncate max-w-[160px] font-bold text-slate-700" title={item.razonSocial}>{item.razonSocial}</div>
                                            <div className="text-[9px] text-indigo-500 font-semibold truncate max-w-[160px]">{item.routeName}</div>
                                          </td>
                                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-700 text-[10px]">
                                            {formatCLP(item.tipo === 'OC' ? 0 : (item.totalAmount ?? item.totalPendiente ?? 0))}
                                          </td>
                                          <td className="px-4 py-2.5 text-center">
                                            <span className="bg-rose-50 text-rose-700 border border-rose-100 font-mono font-extrabold px-1.5 py-0.5 rounded text-[9px]">
                                              {item.trackingStatus || 'NO ENTREGADO'}
                                            </span>
                                          </td>
                                        </tr>
                                        {item.trackingObservation && (
                                          <tr className="bg-slate-50/10">
                                            <td colSpan={7} className="px-4 py-1.5 border-t border-slate-100/50">
                                              <div className="flex items-start gap-2 bg-slate-50/60 border border-slate-100/30 p-2 rounded-xl text-left ml-4 mr-4 mb-1">
                                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                <div>
                                                  <span className="text-[8px] font-bold text-slate-500 uppercase block">Observación descriptiva:</span>
                                                  <p className="text-[10px] text-slate-600 font-medium leading-normal">
                                                    {item.trackingObservation}
                                                  </p>
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Zoom Modal Footer */}
                      <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button 
                          onClick={() => setZoomedReason(null)}
                          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md hover:scale-105"
                        >
                          Cerrar Zoom
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
