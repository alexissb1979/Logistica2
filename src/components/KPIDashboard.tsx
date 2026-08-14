import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown,
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
  XCircle,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Layers,
  Percent,
  ArrowUpDown,
  Coins,
  Table
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
import { LogisticsManifest, LogisticsVehicle, LogisticsRoute } from '../types';

interface KPIDashboardProps {
  manifestsList: LogisticsManifest[];
  routeMap: Record<string, string>;
  driverMap: Record<string, string>;
  vehicleMap: Record<string, string>;
  fuelCosts?: Record<string, Record<string, Record<string, number>>>;
  vehicles?: LogisticsVehicle[];
  routes?: LogisticsRoute[];
}

export const KPIDashboard: React.FC<KPIDashboardProps> = ({
  manifestsList,
  routeMap,
  driverMap,
  vehicleMap,
  fuelCosts = {},
  vehicles = [],
  routes = []
}) => {
  // Filters
  const [selectedDriver, setSelectedDriver] = useState<string>('ALL');
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [timeSpan, setTimeSpan] = useState<'ALL' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH' | 'UNTIL_YESTERDAY'>('ALL');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  // Table Sorting States
  const [driverSortField, setDriverSortField] = useState<'Chofer' | 'Rutas' | 'Documentos' | 'Entregas' | 'Entregas (%)' | 'Retiros' | 'Retiros (%)' | 'Km Promedio' | 'Efectividad (%)'>('Efectividad (%)');
  const [driverSortDir, setDriverSortDir] = useState<'asc' | 'desc'>('desc');
  const [driverViewMode, setDriverViewMode] = useState<'TABLE' | 'CHART'>('TABLE');

  const [vehicleSortField, setVehicleSortField] = useState<'Vehiculo' | 'Rutas' | 'Km Totales' | 'Carga Total Valor ($)' | 'Costo Combustible ($)' | 'Efectividad (%)'>('Rutas');
  const [vehicleSortDir, setVehicleSortDir] = useState<'asc' | 'desc'>('desc');

  const [fleetFuelSortField, setFleetFuelSortField] = useState<'Vehiculo' | 'Km Totales' | 'Rendimiento Nominal' | 'Litros Teoricos' | 'Costo Combustible ($)' | 'Litros Reales Est' | 'Rendimiento Observado' | 'Desviacion Pct'>('Km Totales');
  const [fleetFuelSortDir, setFleetFuelSortDir] = useState<'asc' | 'desc'>('desc');

  const [routeSortField, setRouteSortField] = useState<'Ruta' | 'Viajes' | 'Documentos' | 'Carga Total ($)' | 'Efectividad (%)'>('Viajes');
  const [routeSortDir, setRouteSortDir] = useState<'asc' | 'desc'>('desc');
  const [routeViewMode, setRouteViewMode] = useState<'TABLE' | 'CHART'>('TABLE');

  // Monthly Comparison View Controls
  const [selectedMonthRange, setSelectedMonthRange] = useState<'ALL' | 'LAST_3' | 'LAST_6' | 'THIS_YEAR'>('ALL');
  const [monthlyTab, setMonthlyTab] = useState<'CHARTS' | 'TABLE'>('CHARTS');

  // Available Months for Dropdown Filter
  const availableMonthFilters = useMemo(() => {
    const monthSet = new Set<string>();
    manifestsList.forEach(m => {
      if (m.date && m.date.length >= 7) {
        monthSet.add(m.date.substring(0, 7)); // "YYYY-MM"
      }
    });
    return Array.from(monthSet).sort().reverse();
  }, [manifestsList]);

  // Destination Normalization Helper
  const normalizeDestinationName = (name: string): string => {
    if (!name) return 'Sin asignar';
    let cleaned = name.replace(/\s*\(\d+\)\s*$/g, '');
    cleaned = cleaned.replace(/\s*-\s*\d+\s*$/g, '');
    cleaned = cleaned.trim().toUpperCase();
    return cleaned || 'Sin asignar';
  };

  // Modal detail states for clicking charts
  const [activeDetailFilter, setActiveDetailFilter] = useState<{
    type: 'date' | 'status' | 'route' | 'vehicle' | 'driver' | 'month';
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
    setSelectedMonthFilter('ALL');
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
      
      // Month filter
      if (selectedMonthFilter !== 'ALL') {
        if (!m.date || !m.date.startsWith(selectedMonthFilter)) return false;
      }

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
        } else if (timeSpan === 'UNTIL_YESTERDAY') {
          const today = new Date(now);
          if (manifestDate >= today) return false;
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
  }, [manifestsList, selectedDriver, selectedRoute, selectedMonthFilter, timeSpan, searchQuery, routeMap, driverMap, vehicleMap]);

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
    const valuePerKm = totalKilometers > 0 ? Math.round(totalValue / totalKilometers) : 0;
    const avgDocsPerRoute = processedData.length > 0 ? Number((rawTotalDocs / processedData.length).toFixed(1)) : 0;
    const avgValuePerRoute = processedData.length > 0 ? Math.round(totalValue / processedData.length) : 0;
    
    // Average duration in hours and minutes
    const avgDurationHours = routesWithTime > 0 ? (totalTimeInMinutes / routesWithTime / 60) : 0;

    // Calculate Fuel Costs for current scope
    let totalFuelCost = 0;
    if (fuelCosts && Object.keys(fuelCosts).length > 0) {
      if (selectedMonthFilter !== 'ALL') {
        const [yr, mo] = selectedMonthFilter.split('-');
        const yearCosts = fuelCosts[yr];
        if (yearCosts) {
          Object.values(yearCosts).forEach(plateObj => {
            if (plateObj && plateObj[mo]) {
              totalFuelCost += Number(plateObj[mo]) || 0;
            }
          });
        }
      } else {
        const monthsInFilteredData = new Set<string>();
        processedData.forEach(m => {
          if (m.date && m.date.length >= 7) {
            monthsInFilteredData.add(m.date.substring(0, 7));
          }
        });
        if (monthsInFilteredData.size > 0) {
          monthsInFilteredData.forEach(ym => {
            const [yr, mo] = ym.split('-');
            const yearCosts = fuelCosts[yr];
            if (yearCosts) {
              Object.values(yearCosts).forEach(plateObj => {
                if (plateObj && plateObj[mo]) {
                  totalFuelCost += Number(plateObj[mo]) || 0;
                }
              });
            }
          });
        } else {
          Object.values(fuelCosts).forEach(yearObj => {
            Object.values(yearObj).forEach(plateObj => {
              Object.values(plateObj).forEach(val => {
                totalFuelCost += Number(val) || 0;
              });
            });
          });
        }
      }
    }

    const fuelCostPerKm = totalKilometers > 0 ? Math.round(totalFuelCost / totalKilometers) : 0;
    const fuelCostPerRoute = processedData.length > 0 ? Math.round(totalFuelCost / processedData.length) : 0;
    const fuelCostPerDoc = rawTotalDocs > 0 ? Math.round(totalFuelCost / rawTotalDocs) : 0;
    const fuelCostToValuePct = totalValue > 0 ? Number(((totalFuelCost / totalValue) * 100).toFixed(2)) : 0;

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
      valuePerKm,
      avgDocsPerRoute,
      avgValuePerRoute,
      avgDurationHours,
      successRate,
      failureRate,
      totalFuelCost,
      fuelCostPerKm,
      fuelCostPerRoute,
      fuelCostPerDoc,
      fuelCostToValuePct
    };
  }, [processedData, fuelCosts, selectedMonthFilter]);

  // Month Name Formatting Helper
  const MONTH_NAMES_ES = useMemo(() => [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ], []);

  const formatMonthKey = (yearMonthKey: string) => {
    if (!yearMonthKey || !yearMonthKey.includes('-')) return yearMonthKey || '';
    const [y, m] = yearMonthKey.split('-');
    const monthIdx = parseInt(m, 10) - 1;
    if (isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return yearMonthKey;
    return `${MONTH_NAMES_ES[monthIdx]} ${y}`;
  };

  // Multi-Month Aggregations & MoM Variance Calculations
  const monthlyStatsData = useMemo(() => {
    const monthGroups: Record<string, {
      yearMonth: string;
      totalRoutes: number;
      totalDocuments: number;
      deliveredDocs: number;
      retiradosDocs: number;
      failedDocs: number;
      totalValue: number;
      totalKm: number;
      routesWithKm: number;
      totalTimeMinutes: number;
      routesWithTime: number;
    }> = {};

    processedData.forEach(m => {
      if (!m.date) return;
      const yearMonth = m.date.substring(0, 7); // "YYYY-MM"
      if (!monthGroups[yearMonth]) {
        monthGroups[yearMonth] = {
          yearMonth,
          totalRoutes: 0,
          totalDocuments: 0,
          deliveredDocs: 0,
          retiradosDocs: 0,
          failedDocs: 0,
          totalValue: 0,
          totalKm: 0,
          routesWithKm: 0,
          totalTimeMinutes: 0,
          routesWithTime: 0
        };
      }

      const grp = monthGroups[yearMonth];
      grp.totalRoutes++;

      const docs = m.documentsSnapshot || [];
      grp.totalDocuments += docs.length;

      docs.forEach(d => {
        const status = d.trackingStatus;
        if (status === 'ENTREGADO' || status === 'COMPLETO') {
          grp.deliveredDocs++;
        } else if (status === 'RETIRADO') {
          grp.deliveredDocs++;
          grp.retiradosDocs++;
        } else if (status === 'NO ENTREGADO' || status === 'NO RETIRADO') {
          grp.failedDocs++;
        }

        const amt = d.tipo === 'OC' ? 0 : (d.totalAmount ?? d.totalPendiente ?? 0);
        grp.totalValue += amt;
      });

      if (m.initialKm !== undefined && m.finalKm !== undefined && m.finalKm >= m.initialKm) {
        grp.totalKm += (m.finalKm - m.initialKm);
        grp.routesWithKm++;
      }

      if (m.startTime && m.endTime) {
        const parseTime = (t: string) => {
          const [h, min] = t.split(':').map(Number);
          return (h * 60) + (min || 0);
        };
        const startMin = parseTime(m.startTime);
        const endMin = parseTime(m.endTime);
        if (endMin > startMin) {
          grp.totalTimeMinutes += (endMin - startMin);
          grp.routesWithTime++;
        }
      }
    });

    const sortedKeys = Object.keys(monthGroups).sort();

    return sortedKeys.map((key, idx) => {
      const current = monthGroups[key];
      const prev = idx > 0 ? monthGroups[sortedKeys[idx - 1]] : null;

      const otifRate = current.totalDocuments > 0 
        ? Math.round((current.deliveredDocs / current.totalDocuments) * 100) 
        : 0;
      
      const prevOtifRate = prev && prev.totalDocuments > 0 
        ? Math.round((prev.deliveredDocs / prev.totalDocuments) * 100) 
        : null;

      const avgValPerRoute = current.totalRoutes > 0 
        ? Math.round(current.totalValue / current.totalRoutes) 
        : 0;

      const avgKmPerRoute = current.routesWithKm > 0 
        ? Math.round(current.totalKm / current.routesWithKm) 
        : 0;

      const valuePerKm = current.totalKm > 0 
        ? Math.round(current.totalValue / current.totalKm) 
        : 0;
      
      const prevValuePerKm = prev && prev.totalKm > 0 
        ? Math.round(current.totalValue / current.totalKm) 
        : null;

      const avgDocsPerRoute = current.totalRoutes > 0 
        ? Number((current.totalDocuments / current.totalRoutes).toFixed(1)) 
        : 0;

      const avgTimeHours = current.routesWithTime > 0 
        ? Number((current.totalTimeMinutes / current.routesWithTime / 60).toFixed(1)) 
        : 0;

      // MoM Percentage Calculations
      const valueMoM = prev && prev.totalValue > 0 
        ? Number((((current.totalValue - prev.totalValue) / prev.totalValue) * 100).toFixed(1)) 
        : null;

      const otifMoM = prevOtifRate !== null 
        ? Number((otifRate - prevOtifRate).toFixed(1)) 
        : null;

      const routesMoM = prev && prev.totalRoutes > 0 
        ? Number((((current.totalRoutes - prev.totalRoutes) / prev.totalRoutes) * 100).toFixed(1)) 
        : null;

      const valPerKmMoM = prevValuePerKm !== null && prevValuePerKm > 0 
        ? Number((((valuePerKm - prevValuePerKm) / prevValuePerKm) * 100).toFixed(1)) 
        : null;

      return {
        yearMonth: key,
        monthLabel: formatMonthKey(key),
        shortMonthLabel: formatMonthKey(key).split(' ')[0],
        totalRoutes: current.totalRoutes,
        totalDocuments: current.totalDocuments,
        deliveredDocs: current.deliveredDocs,
        retiradosDocs: current.retiradosDocs,
        failedDocs: current.failedDocs,
        otifRate,
        totalValue: current.totalValue,
        totalValueM: Math.round(current.totalValue / 1000), // M$
        avgValPerRoute,
        totalKm: current.totalKm,
        avgKmPerRoute,
        valuePerKm,
        avgDocsPerRoute,
        avgTimeHours,
        // MoM metadata
        prevMonthLabel: prev ? formatMonthKey(prev.yearMonth) : null,
        valueMoM,
        otifMoM,
        routesMoM,
        valPerKmMoM
      };
    });
  }, [processedData, MONTH_NAMES_ES]);

  // Filtered dataset for monthly comparison
  const filteredMonthlyStats = useMemo(() => {
    if (selectedMonthRange === 'LAST_3') {
      return monthlyStatsData.slice(-3);
    }
    if (selectedMonthRange === 'LAST_6') {
      return monthlyStatsData.slice(-6);
    }
    if (selectedMonthRange === 'THIS_YEAR') {
      const currentYear = new Date().getFullYear().toString();
      return monthlyStatsData.filter(m => m.yearMonth.startsWith(currentYear));
    }
    return monthlyStatsData;
  }, [monthlyStatsData, selectedMonthRange]);

  // Latest month MoM summary
  const latestMoM = useMemo(() => {
    if (monthlyStatsData.length < 2) return null;
    return monthlyStatsData[monthlyStatsData.length - 1];
  }, [monthlyStatsData]);

  // Compute manifests list when a chart element is clicked
  const filteredManifestsForDetail = useMemo(() => {
    if (!activeDetailFilter) return [];
    const { type, value } = activeDetailFilter;
    
    return processedData.filter(m => {
      if (type === 'month') {
        return m.date ? m.date.startsWith(value) : false;
      }
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
          proceso: d.proceso ? (d.proceso.trim().toUpperCase() as 'ENTREGA' | 'RETIRO') : (d.tipo === 'OC' ? 'RETIRO' : 'ENTREGA'),
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
      
      if (deviationsTypeFilter !== 'ALL' && item.proceso !== deviationsTypeFilter) {
        return false;
      }

      const reason = item.failedReason || '';
      if (zoomedReason === 'OTRO / SIN ESPECIFICAR') {
        return !['POR HORARIO', 'CLIENTE NO RECIBE', 'NO CARGADO', 'SIN STOCK', 'DESCORDINACION', 'DESCOORDINACION'].includes(reason);
      }
      if (zoomedReason === 'DESCORDINACION') {
        return reason === 'DESCORDINACION' || reason === 'DESCOORDINACION';
      }
      return reason === zoomedReason;
    });
  }, [allServiceLevelDocuments, zoomedReason, deviationsTypeFilter]);

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

  // 5. Group Performance & Trips Count by Geographical Route/Destination
  const routePerformanceData = useMemo(() => {
    const routeGroups: Record<string, { routeName: string; countRoutes: number; totalLoad: number; finishedDocs: number; totalDocs: number; totalKm: number }> = {};

    processedData.forEach(m => {
      const rId = m.routeId || 'UNKNOWN';
      const rawRName = routeMap[rId] || 'Sin asignar';
      const routeObj = routes.find(r => r.id === rId || r.name === rawRName);
      const normName = routeObj?.group?.trim() || normalizeDestinationName(rawRName);

      if (!routeGroups[normName]) {
        routeGroups[normName] = { routeName: normName, countRoutes: 0, totalLoad: 0, finishedDocs: 0, totalDocs: 0, totalKm: 0 };
      }

      routeGroups[normName].countRoutes++;
      routeGroups[normName].totalKm += (m.kilometers || 0);

      const docs = m.documentsSnapshot || [];
      routeGroups[normName].totalDocs += docs.length;

      docs.forEach(d => {
        const amt = d.tipo === 'OC' ? 0 : (d.totalAmount ?? d.totalPendiente ?? 0);
        routeGroups[normName].totalLoad += amt;

        if (d.trackingStatus === 'ENTREGADO' || d.trackingStatus === 'RETIRADO') {
          routeGroups[normName].finishedDocs++;
        }
      });
    });

    return Object.values(routeGroups)
      .map(item => {
        const rate = item.totalDocs > 0 ? Math.round((item.finishedDocs / item.totalDocs) * 100) : 0;
        return {
          Ruta: item.routeName,
          Viajes: item.countRoutes,
          Documentos: item.totalDocs,
          'Carga Total ($)': item.totalLoad,
          'Carga (M$)': Math.round(item.totalLoad / 1000),
          'Efectividad (%)': rate,
          Km: item.totalKm
        };
      })
      .sort((a,b) => b.Viajes - a.Viajes || b['Carga Total ($)'] - a['Carga Total ($)']);
  }, [processedData, routeMap, routes]);

  // 6. Driver Efficiency & Operation Breakdown Leaderboard
  const driverPerformanceData = useMemo(() => {
    const driverGroups: Record<string, { 
      driverName: string; 
      countRoutes: number; 
      totalDocs: number; 
      deliveredDocs: number; 
      totalKm: number; 
      kmCount: number;
      totalEntregas: number;
      entregasExitosas: number;
      totalRetiros: number;
      retirosExitosos: number;
    }> = {};

    processedData.forEach(m => {
      const dId = m.driverId || 'UNKNOWN';
      const dName = driverMap[dId] || 'Chofer no especificado';

      if (!driverGroups[dId]) {
        driverGroups[dId] = { 
          driverName: dName, 
          countRoutes: 0, 
          totalDocs: 0, 
          deliveredDocs: 0, 
          totalKm: 0, 
          kmCount: 0,
          totalEntregas: 0,
          entregasExitosas: 0,
          totalRetiros: 0,
          retirosExitosos: 0
        };
      }

      driverGroups[dId].countRoutes++;
      
      const docs = m.documentsSnapshot || [];
      driverGroups[dId].totalDocs += docs.length;

      docs.forEach(d => {
        const isRetiro = d.proceso === 'RETIRO' || d.tipo === 'OC' || d.trackingStatus === 'RETIRADO' || d.trackingStatus === 'NO RETIRADO';

        if (isRetiro) {
          driverGroups[dId].totalRetiros++;
          if (d.trackingStatus === 'RETIRADO' || d.trackingStatus === 'ENTREGADO' || d.trackingStatus === 'COMPLETO') {
            driverGroups[dId].deliveredDocs++;
            driverGroups[dId].retirosExitosos++;
          }
        } else {
          driverGroups[dId].totalEntregas++;
          if (d.trackingStatus === 'ENTREGADO' || d.trackingStatus === 'COMPLETO') {
            driverGroups[dId].deliveredDocs++;
            driverGroups[dId].entregasExitosas++;
          }
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
        const pctEntregas = item.totalDocs > 0 ? Math.round((item.totalEntregas / item.totalDocs) * 100) : 0;
        const pctRetiros = item.totalDocs > 0 ? Math.round((item.totalRetiros / item.totalDocs) * 100) : 0;
        const efectividadEntregas = item.totalEntregas > 0 ? Math.round((item.entregasExitosas / item.totalEntregas) * 100) : 0;
        const efectividadRetiros = item.totalRetiros > 0 ? Math.round((item.retirosExitosos / item.totalRetiros) * 100) : 0;

        return {
          Chofer: item.driverName,
          Rutas: item.countRoutes,
          Documentos: item.totalDocs,
          'Efectividad (%)': successRate,
          'Km Promedio': avgKm,
          Entregas: item.totalEntregas,
          'Entregas (%)': pctEntregas,
          'Entregas Exitosas': item.entregasExitosas,
          'Efectividad Entregas (%)': efectividadEntregas,
          Retiros: item.totalRetiros,
          'Retiros (%)': pctRetiros,
          'Retiros Exitosos': item.retirosExitosos,
          'Efectividad Retiros (%)': efectividadRetiros
        };
      })
      .sort((a,b) => b['Efectividad (%)'] - a['Efectividad (%)'] || b.Rutas - a.Rutas);
  }, [processedData, driverMap]);

  // Total deliveries vs pickups aggregated across all drivers
  const driverTeamTotals = useMemo(() => {
    let totalDocs = 0;
    let totalEntregas = 0;
    let totalRetiros = 0;
    let totalEntregasExitosas = 0;
    let totalRetirosExitosos = 0;

    driverPerformanceData.forEach(d => {
      totalDocs += d.Documentos;
      totalEntregas += d.Entregas;
      totalRetiros += d.Retiros;
      totalEntregasExitosas += d['Entregas Exitosas'];
      totalRetirosExitosos += d['Retiros Exitosos'];
    });

    const pctEntregas = totalDocs > 0 ? Math.round((totalEntregas / totalDocs) * 100) : 0;
    const pctRetiros = totalDocs > 0 ? Math.round((totalRetiros / totalDocs) * 100) : 0;
    const efectividadEntregas = totalEntregas > 0 ? Math.round((totalEntregasExitosas / totalEntregas) * 100) : 0;
    const efectividadRetiros = totalRetiros > 0 ? Math.round((totalRetirosExitosos / totalRetiros) * 100) : 0;

    return {
      totalDocs,
      totalEntregas,
      pctEntregas,
      totalEntregasExitosas,
      efectividadEntregas,
      totalRetiros,
      pctRetiros,
      totalRetirosExitosos,
      efectividadRetiros
    };
  }, [driverPerformanceData]);

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

        // Calculate fuel cost and nominal performance for this vehicle
        let fuelCost = 0;
        const plateKey = item.vehicleName.split(' - ')[0]?.trim().toUpperCase() || item.vehicleName.trim().toUpperCase();
        if (fuelCosts && Object.keys(fuelCosts).length > 0) {
          if (selectedMonthFilter !== 'ALL') {
            const [yr, mo] = selectedMonthFilter.split('-');
            fuelCost = Number(fuelCosts[yr]?.[plateKey]?.[mo]) || 0;
          } else {
            Object.keys(fuelCosts).forEach(yr => {
              const pCosts = fuelCosts[yr]?.[plateKey];
              if (pCosts) {
                Object.values(pCosts).forEach(c => {
                  fuelCost += Number(c) || 0;
                });
              }
            });
          }
        }

        const vObj = vehicles.find(v => v.plate && v.plate.trim().toUpperCase() === plateKey);
        const nominalKmL = vObj?.nominalKmPerLiter || 0;
        const litrosTeoricos = nominalKmL > 0 ? (item.totalKm / nominalKmL) : 0;
        const litrosRealesEst = fuelCost > 0 ? (fuelCost / 1050) : 0;
        const rendimientoObservado = litrosRealesEst > 0 ? (item.totalKm / litrosRealesEst) : 0;
        const desviacionPct = (nominalKmL > 0 && litrosTeoricos > 0 && litrosRealesEst > 0)
          ? (((litrosRealesEst - litrosTeoricos) / litrosTeoricos) * 100)
          : null;

        return {
          Vehiculo: item.vehicleName,
          Plate: plateKey,
          Model: vObj?.description || '',
          Rutas: item.countRoutes,
          Documentos: item.totalDocs,
          'Efectividad (%)': successRate,
          'Km Totales': item.totalKm,
          'Km Promedio': avgKm,
          'Carga Total Valor ($)': item.totalValue,
          'Carga Total (M$)': Math.round(item.totalValue / 1000),
          'Carga Promedio (M$)': Math.round(valorPorViaje / 1000),
          'Horas Totales': totalHours,
          'Horas Promedio': avgTimeHrs,
          'Costo Combustible ($)': fuelCost,
          'Rendimiento Nominal': nominalKmL,
          'Litros Teoricos': litrosTeoricos,
          'Litros Reales Est': litrosRealesEst,
          'Rendimiento Observado': rendimientoObservado,
          'Desviacion Pct': desviacionPct
        };
      })
      .sort((a,b) => b.Rutas - a.Rutas || b['Km Totales'] - a['Km Totales'] || b['Carga Total Valor ($)'] - a['Carga Total Valor ($)']);
  }, [processedData, vehicleMap, fuelCosts, selectedMonthFilter, vehicles]);

  // Handler functions for sorting table columns
  const handleSortDriver = (field: string) => {
    if (driverSortField === field) {
      setDriverSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setDriverSortField(field);
      setDriverSortDir('desc');
    }
  };

  const handleSortVehicle = (field: string) => {
    if (vehicleSortField === field) {
      setVehicleSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setVehicleSortField(field as any);
      setVehicleSortDir('desc');
    }
  };

  const handleSortFleetFuel = (field: string) => {
    if (fleetFuelSortField === field) {
      setFleetFuelSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setFleetFuelSortField(field as any);
      setFleetFuelSortDir('desc');
    }
  };

  const handleSortRoute = (field: 'Ruta' | 'Viajes' | 'Documentos' | 'Carga Total ($)' | 'Efectividad (%)') => {
    if (routeSortField === field) {
      setRouteSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setRouteSortField(field);
      setRouteSortDir('desc');
    }
  };

  const sortedRoutePerformanceData = useMemo(() => {
    return [...routePerformanceData].sort((a, b) => {
      let valA: any = a[routeSortField as keyof typeof a];
      let valB: any = b[routeSortField as keyof typeof b];
      if (valA === null || valA === undefined) valA = -999999;
      if (valB === null || valB === undefined) valB = -999999;
      if (typeof valA === 'string') {
        return routeSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return routeSortDir === 'asc' ? (valA - valB) : (valB - valA);
    });
  }, [routePerformanceData, routeSortField, routeSortDir]);

  const sortedDriverPerformanceData = useMemo(() => {
    return [...driverPerformanceData].sort((a, b) => {
      let valA: any = a[driverSortField as keyof typeof a];
      let valB: any = b[driverSortField as keyof typeof b];
      if (typeof valA === 'string') {
        return driverSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return driverSortDir === 'asc' ? ((valA || 0) - (valB || 0)) : ((valB || 0) - (valA || 0));
    });
  }, [driverPerformanceData, driverSortField, driverSortDir]);

  const sortedVehiclePerformanceData = useMemo(() => {
    return [...vehiclePerformanceData].sort((a, b) => {
      let valA: any = a[vehicleSortField as keyof typeof a];
      let valB: any = b[vehicleSortField as keyof typeof b];
      if (typeof valA === 'string') {
        return vehicleSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return vehicleSortDir === 'asc' ? ((valA || 0) - (valB || 0)) : ((valB || 0) - (valA || 0));
    });
  }, [vehiclePerformanceData, vehicleSortField, vehicleSortDir]);

  const sortedFleetFuelPerformanceData = useMemo(() => {
    return [...vehiclePerformanceData].sort((a, b) => {
      let valA: any = a[fleetFuelSortField as keyof typeof a];
      let valB: any = b[fleetFuelSortField as keyof typeof b];
      if (valA === null || valA === undefined) valA = -999999;
      if (valB === null || valB === undefined) valB = -999999;
      if (typeof valA === 'string') {
        return fleetFuelSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return fleetFuelSortDir === 'asc' ? (valA - valB) : (valB - valA);
    });
  }, [vehiclePerformanceData, fleetFuelSortField, fleetFuelSortDir]);

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

        {/* Mobile Summary & Collapse Toggle Bar */}
        <div className="md:hidden flex items-center justify-between bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 shadow-sm">
          <div className="flex flex-col text-left gap-1">
            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Filtros Activos</span>
            <span className="text-xs font-black text-slate-850 line-clamp-1">
              {selectedDriver === 'ALL' ? 'Todos' : (driverMap[selectedDriver] || selectedDriver).split(' ')[0]} • {selectedRoute === 'ALL' ? 'Todas' : (routeMap[selectedRoute] || selectedRoute)} • {timeSpan === 'ALL' ? 'Histórico' : timeSpan === 'LAST_7' ? '7 Días' : timeSpan === 'LAST_30' ? '30 Días' : timeSpan === 'THIS_MONTH' ? 'Este Mes' : 'Hasta Ayer'}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium mt-0.5">
              <span>{processedData.length} Rutas</span>
            </div>
          </div>
          <button 
            onClick={() => setFiltersCollapsed(!filtersCollapsed)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white font-extrabold text-[10px] uppercase rounded-lg shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <span>{filtersCollapsed ? 'Filtrar' : 'Ocultar'}</span>
            {filtersCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Filters Panel */}
        <div className={`grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 ${filtersCollapsed ? 'hidden md:grid' : 'grid'}`}>
          {/* Month filter */}
          <div className="flex flex-col gap-1 text-left">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Filtrar por Mes</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <select 
                value={selectedMonthFilter}
                onChange={(e) => setSelectedMonthFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-800 transition-all cursor-pointer"
              >
                <option value="ALL">Todos los Meses</option>
                {availableMonthFilters.map(ym => (
                  <option key={ym} value={ym}>{formatMonthKey(ym)}</option>
                ))}
              </select>
            </div>
          </div>

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
                <option value="UNTIL_YESTERDAY">Hasta Ayer</option>
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
              
              {/* Card 1: Deliveries Success Rate (OTIF Index) */}
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
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest">Nivel de Servicio (OTIF)</span>
                      {latestMoM && latestMoM.otifMoM !== null && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black font-mono flex items-center ${
                          latestMoM.otifMoM >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {latestMoM.otifMoM >= 0 ? `+${latestMoM.otifMoM}% MoM` : `${latestMoM.otifMoM}% MoM`}
                        </span>
                      )}
                    </div>
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

              {/* Card 2: Managed Financial Volume */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest">Carga Valorizada</span>
                      {latestMoM && latestMoM.valueMoM !== null && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black font-mono flex items-center ${
                          latestMoM.valueMoM >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {latestMoM.valueMoM >= 0 ? `+${latestMoM.valueMoM}% MoM` : `${latestMoM.valueMoM}% MoM`}
                        </span>
                      )}
                    </div>
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

              {/* Card 3: Fleet Monetization ($/Km) & Distance */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest">Densidad ($ / Km)</span>
                      {latestMoM && latestMoM.valPerKmMoM !== null && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black font-mono flex items-center ${
                          latestMoM.valPerKmMoM >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {latestMoM.valPerKmMoM >= 0 ? `+${latestMoM.valPerKmMoM}% MoM` : `${latestMoM.valPerKmMoM}% MoM`}
                        </span>
                      )}
                    </div>
                    <h4 className="text-2xl font-black text-slate-900 leading-none">
                      {metrics.valuePerKm > 0 ? formatCLP(metrics.valuePerKm) : `${metrics.totalKilometers.toLocaleString('es-CL')} Km`}
                    </h4>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl group-hover:scale-110 transition-transform">
                    <Milestone className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-wider">Km Totales ({metrics.avgKmPerRoute} km/ruta)</span>
                  <span className="text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded-lg">{metrics.totalKilometers.toLocaleString('es-CL')} Km</span>
                </div>
              </div>

              {/* Card 4: Operational Tempo & Density */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest">Densidad Despacho</span>
                      {latestMoM && latestMoM.routesMoM !== null && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black font-mono flex items-center ${
                          latestMoM.routesMoM >= 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {latestMoM.routesMoM >= 0 ? `+${latestMoM.routesMoM}% MoM` : `${latestMoM.routesMoM}% MoM`}
                        </span>
                      )}
                    </div>
                    <h4 className="text-2xl font-black text-slate-900 leading-none">
                      {metrics.avgDocsPerRoute} <span className="text-xs font-bold text-slate-500">doc/ruta</span>
                    </h4>
                  </div>
                  <div className="p-3 bg-sky-50 text-sky-600 rounded-xl group-hover:scale-110 transition-transform">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-wider">Total Rutas ({metrics.avgDurationHours > 0 ? `${metrics.avgDurationHours.toFixed(1)}h/ruta` : 'S/H'})</span>
                  <span className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg font-mono">{metrics.totalRoutes} HR</span>
                </div>
              </div>

            </div>

            {/* 1.B Monthly Comparative & Historical Trend Section */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-6" id="monthly-comparison-section">
              {/* Section Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <BarChart2 className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                        Análisis Comparativo Mensual (Evolución Histórica & Variaciones MoM)
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Comparativa intermensual de volumen de carga (M$), efectividad OTIF, volumen de rutas y rendimiento monetario por kilómetro.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Range Controls & View Mode Toggle */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Time Range Selector */}
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setSelectedMonthRange('ALL')}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                        selectedMonthRange === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Histórico ({monthlyStatsData.length} Meses)
                    </button>
                    <button
                      onClick={() => setSelectedMonthRange('LAST_3')}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                        selectedMonthRange === 'LAST_3' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Últimos 3 Meses
                    </button>
                    <button
                      onClick={() => setSelectedMonthRange('LAST_6')}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                        selectedMonthRange === 'LAST_6' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Últimos 6 Meses
                    </button>
                    <button
                      onClick={() => setSelectedMonthRange('THIS_YEAR')}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                        selectedMonthRange === 'THIS_YEAR' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Año Actual
                    </button>
                  </div>

                  {/* Mode View Switcher (Charts vs Detailed Table) */}
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setMonthlyTab('CHARTS')}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        monthlyTab === 'CHARTS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Gráficos
                    </button>
                    <button
                      onClick={() => setMonthlyTab('TABLE')}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        monthlyTab === 'TABLE' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Tabla Comparativa
                    </button>
                  </div>
                </div>
              </div>

              {/* Headline MoM Summary Highlights if latestMoM is available */}
              {latestMoM && latestMoM.prevMonthLabel && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                  
                  {/* MoM Card 1: Carga Valorizada */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                      <span>Carga Despachada (MoM)</span>
                      <span className="text-slate-500 font-mono text-[9px]">{latestMoM.monthLabel} vs {latestMoM.prevMonthLabel}</span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base font-black text-slate-900 font-mono">{formatCLP(latestMoM.totalValue)}</span>
                      {latestMoM.valueMoM !== null && (
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[11px] font-black font-mono ${
                          latestMoM.valueMoM >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {latestMoM.valueMoM >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {latestMoM.valueMoM >= 0 ? `+${latestMoM.valueMoM}%` : `${latestMoM.valueMoM}%`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* MoM Card 2: Nivel de Servicio OTIF */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                      <span>Tasa OTIF (MoM)</span>
                      <span className="text-slate-500 font-mono text-[9px]">{latestMoM.monthLabel} vs {latestMoM.prevMonthLabel}</span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base font-black text-slate-900 font-mono">{latestMoM.otifRate}%</span>
                      {latestMoM.otifMoM !== null && (
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[11px] font-black font-mono ${
                          latestMoM.otifMoM >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {latestMoM.otifMoM >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {latestMoM.otifMoM >= 0 ? `+${latestMoM.otifMoM} pts` : `${latestMoM.otifMoM} pts`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* MoM Card 3: Hojas de Ruta Finalizadas */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                      <span>Volumen Rutas (MoM)</span>
                      <span className="text-slate-500 font-mono text-[9px]">{latestMoM.monthLabel} vs {latestMoM.prevMonthLabel}</span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base font-black text-slate-900 font-mono">{latestMoM.totalRoutes} HR</span>
                      {latestMoM.routesMoM !== null && (
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[11px] font-black font-mono ${
                          latestMoM.routesMoM >= 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {latestMoM.routesMoM >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {latestMoM.routesMoM >= 0 ? `+${latestMoM.routesMoM}%` : `${latestMoM.routesMoM}%`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* MoM Card 4: Rendimiento ($/Km) */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                      <span>Densidad Monetaria ($/Km)</span>
                      <span className="text-slate-500 font-mono text-[9px]">{latestMoM.monthLabel} vs {latestMoM.prevMonthLabel}</span>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base font-black text-slate-900 font-mono">{formatCLP(latestMoM.valuePerKm)}/km</span>
                      {latestMoM.valPerKmMoM !== null && (
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[11px] font-black font-mono ${
                          latestMoM.valPerKmMoM >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {latestMoM.valPerKmMoM >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {latestMoM.valPerKmMoM >= 0 ? `+${latestMoM.valPerKmMoM}%` : `${latestMoM.valPerKmMoM}%`}
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* Monthly Visual Charts vs Comparative Table */}
              {monthlyTab === 'CHARTS' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Monthly Chart 1: Evolución Carga (M$) vs OTIF (%) */}
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 shadow-2xs flex flex-col justify-between h-[360px] lg:col-span-2">
                    <div className="mb-3 text-left flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-extrabold uppercase text-indigo-600 tracking-wider block">Evolución Intermensual</span>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Carga Total Despachada (M$) vs Nivel de Servicio OTIF (%)</h4>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        {filteredMonthlyStats.length} {filteredMonthlyStats.length === 1 ? 'Mes' : 'Meses'}
                      </span>
                    </div>

                    {filteredMonthlyStats.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-slate-400 text-xs italic">
                        Sin datos mensuales para mostrar
                      </div>
                    ) : (
                      <div className="flex-1 h-full w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={filteredMonthlyStats} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="shortMonthLabel" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} 
                            />
                            <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} unit="k" />
                            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#10b981' }} domain={[0, 100]} unit="%" />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                              formatter={(val, name) => {
                                if (name === 'Carga (M$)') return [`$${(Number(val) * 1000).toLocaleString('es-CL')}`, 'Carga Total'];
                                if (name === 'OTIF (%)') return [`${val}%`, 'Nivel de Servicio'];
                                return [val, name];
                              }}
                            />
                            <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }} />
                            <Bar yAxisId="left" name="Carga (M$)" dataKey="totalValueM" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={35} cursor="pointer" onClick={(e) => {
                              if (e?.yearMonth) setActiveDetailFilter({ type: 'month', value: e.yearMonth, title: `Hojas de Ruta de ${e.monthLabel}` });
                            }} />
                            <Line yAxisId="right" type="monotone" name="OTIF (%)" dataKey="otifRate" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} cursor="pointer" onClick={(e) => {
                              if (e?.yearMonth) setActiveDetailFilter({ type: 'month', value: e.yearMonth, title: `Hojas de Ruta de ${e.monthLabel}` });
                            }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Monthly Chart 2: Volume Comparison (Routes vs Delivered vs Failed) */}
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 shadow-2xs flex flex-col justify-between h-[360px]">
                    <div className="mb-3 text-left">
                      <span className="text-[9px] font-extrabold uppercase text-emerald-600 tracking-wider block">Volumen Operacional</span>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Puntos Retirados, Entregas y Rechazos por Mes</h4>
                    </div>

                    {filteredMonthlyStats.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-slate-400 text-xs italic">
                        Sin registros
                      </div>
                    ) : (
                      <div className="flex-1 h-full w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={filteredMonthlyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="shortMonthLabel" tickLine={false} axisLine={false} tick={{ fill: '#475569', fontSize: 9, fontWeight: 'bold' }} />
                            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }} />
                            <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }} />
                            <Bar name="Puntos Retirados" dataKey="retiradosDocs" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={18} />
                            <Bar name="Entregados" dataKey="deliveredDocs" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={18} />
                            <Bar name="Rechazados" dataKey="failedDocs" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={18} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                /* Monthly Comparison Detailed Table View */
                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs bg-white overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
                        <th className="px-4 py-3">Mes / Periodo</th>
                        <th className="px-3 py-3 text-center">Hojas Ruta</th>
                        <th className="px-3 py-3 text-center">Doc. Totales</th>
                        <th className="px-3 py-3 text-center">Entregados</th>
                        <th className="px-3 py-3 text-center">Rechazados</th>
                        <th className="px-3 py-3 text-center">% OTIF</th>
                        <th className="px-4 py-3 text-right">Carga Total ($)</th>
                        <th className="px-3 py-3 text-right">Carga / Ruta</th>
                        <th className="px-3 py-3 text-center">Km Recorridos</th>
                        <th className="px-3 py-3 text-right">Rendimiento ($/Km)</th>
                        <th className="px-3 py-3 text-center">Var. Carga MoM</th>
                        <th className="px-3 py-3 text-center">Var. OTIF MoM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMonthlyStats.map((row) => {
                        return (
                          <tr 
                            key={row.yearMonth}
                            onClick={() => {
                              setActiveDetailFilter({
                                type: 'month',
                                value: row.yearMonth,
                                title: `Hojas de Ruta de ${row.monthLabel}`
                              });
                            }}
                            className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-3 font-extrabold text-slate-800 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-indigo-500" />
                              {row.monthLabel}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-slate-700 font-mono">
                              {row.totalRoutes}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-slate-600 font-mono">
                              {row.totalDocuments}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-emerald-600 font-mono">
                              {row.deliveredDocs}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-rose-600 font-mono">
                              {row.failedDocs}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-block font-mono font-extrabold px-2 py-0.5 rounded-lg text-[10px] ${
                                row.otifRate >= 90 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}>
                                {row.otifRate}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-black font-mono text-slate-800">
                              {formatCLP(row.totalValue)}
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-semibold text-slate-600 text-[11px]">
                              {formatCLP(row.avgValPerRoute)}
                            </td>
                            <td className="px-3 py-3 text-center font-mono font-semibold text-slate-500">
                              {row.totalKm.toLocaleString('es-CL')} km
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-bold text-indigo-600">
                              {formatCLP(row.valuePerKm)}/km
                            </td>
                            <td className="px-3 py-3 text-center">
                              {row.valueMoM !== null ? (
                                <span className={`inline-flex items-center gap-0.5 text-[10px] font-black font-mono px-1.5 py-0.5 rounded ${
                                  row.valueMoM >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {row.valueMoM >= 0 ? `+${row.valueMoM}%` : `${row.valueMoM}%`}
                                </span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {row.otifMoM !== null ? (
                                <span className={`inline-flex items-center gap-0.5 text-[10px] font-black font-mono px-1.5 py-0.5 rounded ${
                                  row.otifMoM >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {row.otifMoM >= 0 ? `+${row.otifMoM} pts` : `${row.otifMoM} pts`}
                                </span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

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
              
              {/* Route Performers (Cantidad de Viajes y Rendimiento por Destino) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-[400px]">
                <div className="mb-4 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Navigation className="w-4 h-4 text-indigo-600" /> Cantidad de Viajes por Destino / Ruta
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium font-sans">Frecuencia de viajes (HR), entregas e importe despachado por destino o agrupador de ruta.</p>
                  </div>

                  {/* View mode toggle */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                    <button
                      onClick={() => setRouteViewMode('TABLE')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                        routeViewMode === 'TABLE' 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Table className="w-3.5 h-3.5" />
                      <span>Tabla de Viajes</span>
                    </button>
                    <button
                      onClick={() => setRouteViewMode('CHART')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                        routeViewMode === 'CHART' 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      <span>Gráfico</span>
                    </button>
                  </div>
                </div>

                {sortedRoutePerformanceData.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-xs italic">
                    Sin rutas o destinos asignados
                  </div>
                ) : routeViewMode === 'TABLE' ? (
                  <div className="flex-1 overflow-auto border border-slate-100 rounded-2xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-100 select-none">
                        <tr className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
                          <th className="px-4 py-3 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortRoute('Ruta')}>
                            <div className="flex items-center gap-1">
                              <span>Destino / Ruta</span>
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                            </div>
                          </th>
                          <th className="px-3 py-3 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortRoute('Viajes')}>
                            <div className="flex items-center justify-center gap-1">
                              <span>Cant. Viajes</span>
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                            </div>
                          </th>
                          <th className="px-3 py-3 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortRoute('Documentos')}>
                            <div className="flex items-center justify-center gap-1">
                              <span>Docs / Pts</span>
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                            </div>
                          </th>
                          <th className="px-3 py-3 text-right cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortRoute('Carga Total ($)')}>
                            <div className="flex items-center justify-end gap-1">
                              <span>Carga Total ($)</span>
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                            </div>
                          </th>
                          <th className="px-4 py-3 text-right cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortRoute('Efectividad (%)')}>
                            <div className="flex items-center justify-end gap-1">
                              <span>Efectividad</span>
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedRoutePerformanceData.map((r, idx) => (
                          <tr 
                            key={idx} 
                            onClick={() => {
                              setActiveDetailFilter({
                                type: 'route',
                                value: r.Ruta,
                                title: `Hojas de Ruta - Destino: ${r.Ruta}`
                              });
                            }}
                            className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-2.5 flex items-center gap-2">
                              <span className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-bold font-mono">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-slate-800 truncate max-w-[130px]" title={r.Ruta}>{r.Ruta}</span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-black font-mono text-[11px] border border-indigo-200/60 shadow-2xs">
                                {r.Viajes} {r.Viajes === 1 ? 'viaje' : 'viajes'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold text-slate-600 font-mono">
                              {r.Documentos}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">
                              {formatCLP(r['Carga Total ($)'])}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="font-mono font-black text-slate-900">{r['Efectividad (%)']}%</span>
                                <div className="w-8 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${r['Efectividad (%)'] >= 90 ? 'bg-emerald-500' : r['Efectividad (%)'] >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                    style={{ width: `${r['Efectividad (%)']}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex-1 h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={sortedRoutePerformanceData}
                        layout="vertical"
                        margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
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
                            if (name === 'Viajes') return [`${value} viajes`, 'Cantidad de Viajes'];
                            if (name === 'Carga (M$)') return [`$${(Number(value) * 1000).toLocaleString('es-CL')}`, 'Volumen de Carga'];
                            if (name === 'Efectividad (%)') return [`${value}%`, 'Efectividad'];
                            return [value, name];
                          }}
                        />
                        <Bar 
                          dataKey="Viajes" 
                          name="Viajes"
                          fill="#6366f1" 
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
                          name="Efectividad (%)"
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
                <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-500" /> Desempeño y Productividad de Choferes
                      </h3>
                      {/* Summary badges */}
                      <div className="hidden xl:flex items-center gap-1.5 ml-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                          <Truck className="w-2.5 h-2.5 text-emerald-600" /> {driverTeamTotals.totalEntregas} Entregas ({driverTeamTotals.pctEntregas}%)
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                          <RotateCcw className="w-2.5 h-2.5 text-indigo-600" /> {driverTeamTotals.totalRetiros} Retiros ({driverTeamTotals.pctRetiros}%)
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium font-sans">
                      Evaluación de volumen de entregas vs. retiros (cantidad y %), efectividad de cumplimiento y kilometraje.
                    </p>
                  </div>

                  {/* Toggle between Table and Chart */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-xl self-start sm:self-auto shrink-0">
                    <button
                      onClick={() => setDriverViewMode('TABLE')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                        driverViewMode === 'TABLE'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Table className="w-3 h-3" />
                      <span>Tabla</span>
                    </button>
                    <button
                      onClick={() => setDriverViewMode('CHART')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                        driverViewMode === 'CHART'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <BarChart2 className="w-3 h-3" />
                      <span>Gráfico</span>
                    </button>
                  </div>
                </div>

                {driverPerformanceData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                    Sin datos de operadores
                  </div>
                ) : driverViewMode === 'TABLE' ? (
                  <div className="flex-1 overflow-auto border border-slate-100 rounded-2xl">
                    <table className="w-full text-left border-collapse text-xs min-w-[560px]">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-100 select-none">
                        <tr className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
                          <th className="px-3 py-2.5 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortDriver('Chofer')}>
                            <div className="flex items-center gap-1">
                              <span>Conductor</span>
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                            </div>
                          </th>
                          <th className="px-2 py-2.5 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortDriver('Rutas')}>
                            <div className="flex items-center justify-center gap-1">
                              <span>Viajes</span>
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                            </div>
                          </th>
                          <th className="px-2.5 py-2.5 text-center cursor-pointer hover:text-emerald-700 transition-colors bg-emerald-50/40" onClick={() => handleSortDriver('Entregas')}>
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-emerald-700">Entregas</span>
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60 text-emerald-600" />
                            </div>
                          </th>
                          <th className="px-2.5 py-2.5 text-center cursor-pointer hover:text-indigo-700 transition-colors bg-indigo-50/40" onClick={() => handleSortDriver('Retiros')}>
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-indigo-700">Retiros</span>
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60 text-indigo-600" />
                            </div>
                          </th>
                          <th className="px-2 py-2.5 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortDriver('Documentos')}>
                            <div className="flex items-center justify-center gap-1">
                              <span>Total Pts</span>
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                            </div>
                          </th>
                          <th className="px-2 py-2.5 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortDriver('Km Promedio')}>
                            <div className="flex items-center justify-center gap-1">
                              <span>Km Prom.</span>
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                            </div>
                          </th>
                          <th className="px-3 py-2.5 text-right cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortDriver('Efectividad (%)')}>
                            <div className="flex items-center justify-end gap-1">
                              <span>OTIF (%)</span>
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedDriverPerformanceData.map((d, idx) => (
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
                            <td className="px-3 py-2 text-left">
                              <div className="flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center text-[9px] font-bold font-mono shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="font-bold text-slate-800 truncate max-w-[110px]" title={d.Chofer}>{d.Chofer}</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center font-bold text-slate-600 font-mono text-[11px]">
                              {d.Rutas}
                            </td>
                            <td className="px-2.5 py-2 text-center bg-emerald-50/20">
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-black text-slate-800 font-mono text-xs">{d.Entregas}</span>
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/70 px-1 py-0.2 rounded font-mono">
                                  {d['Entregas (%)']}%
                                </span>
                              </div>
                            </td>
                            <td className="px-2.5 py-2 text-center bg-indigo-50/20">
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-black text-slate-800 font-mono text-xs">{d.Retiros}</span>
                                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100/70 px-1 py-0.2 rounded font-mono">
                                  {d['Retiros (%)']}%
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center font-bold text-slate-600 font-mono text-[11px]">
                              {d.Documentos}
                            </td>
                            <td className="px-2 py-2 text-center font-semibold text-slate-400 font-mono text-[10px]">
                              {d['Km Promedio'] > 0 ? `${d['Km Promedio']} km` : '-'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className={`inline-block font-mono font-black text-[11px] ${
                                  d['Efectividad (%)'] >= 90 ? 'text-emerald-700' : d['Efectividad (%)'] >= 75 ? 'text-amber-700' : 'text-rose-700'
                                }`}>
                                  {d['Efectividad (%)']}%
                                </span>
                                <div className="w-6 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0">
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
                  </div>
                ) : (
                  <div className="flex-1 h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={sortedDriverPerformanceData}
                        layout="vertical"
                        margin={{ top: 5, right: 15, left: -15, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                        <YAxis 
                          type="category" 
                          dataKey="Chofer" 
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
                            if (name === 'Entregas') return [`${value} entregas`, 'Entregas (Cant)'];
                            if (name === 'Retiros') return [`${value} retiros`, 'Retiros (Cant)'];
                            return [value, name];
                          }}
                        />
                        <Legend 
                          verticalAlign="top" 
                          height={26} 
                          iconSize={8}
                          wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                        />
                        <Bar 
                          dataKey="Entregas" 
                          name="Entregas" 
                          fill="#10b981" 
                          stackId="ops"
                          radius={[0, 0, 0, 0]} 
                          maxBarSize={16} 
                        />
                        <Bar 
                          dataKey="Retiros" 
                          name="Retiros" 
                          fill="#6366f1" 
                          stackId="ops"
                          radius={[0, 4, 4, 0]} 
                          maxBarSize={16} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
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
                            interval={0}
                            height={48}
                            tick={(props: any) => {
                              const { x, y, payload } = props;
                              const rawValue = payload?.value || '';
                              const parts = rawValue.split(' - ');
                              const plate = parts[0]?.trim() || rawValue;
                              const model = parts.slice(1).join(' - ').trim();

                              return (
                                <g transform={`translate(${x},${y})`}>
                                  <text x={0} y={0} dy={8} textAnchor="middle" fill="#334155" fontSize={9} fontWeight="800" fontFamily="sans-serif">
                                    <tspan x={0} dy="0">{plate}</tspan>
                                    {model ? <tspan x={0} dy="11" fill="#64748b" fontSize={8} fontWeight="600">{model}</tspan> : null}
                                  </text>
                                </g>
                              );
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
                        <thead className="bg-slate-50 border-b border-slate-150 sticky top-0 select-none">
                          <tr className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
                            <th className="px-3 py-2 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortVehicle('Vehiculo')}>
                              <div className="flex items-center gap-1">
                                <span>Patente / Modelo</span>
                                <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                              </div>
                            </th>
                            <th className="px-2 py-2 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortVehicle('Rutas')}>
                              <div className="flex items-center justify-center gap-1">
                                <span>Viajes</span>
                                <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                              </div>
                            </th>
                            <th className="px-2 py-2 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortVehicle('Km Totales')}>
                              <div className="flex items-center justify-center gap-1">
                                <span>Km Tot.</span>
                                <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                              </div>
                            </th>
                            <th className="px-2 py-2 text-right cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortVehicle('Carga Total Valor ($)')}>
                              <div className="flex items-center justify-end gap-1">
                                <span>Carga Total</span>
                                <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                              </div>
                            </th>
                            <th className="px-3 py-2 text-right cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortVehicle('Efectividad (%)')}>
                              <div className="flex items-center justify-end gap-1">
                                <span>OTIF (%)</span>
                                <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sortedVehiclePerformanceData.map((v, idx) => (
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

              {/* Fleet Fuel Performance & Control Table */}
              <div className="border border-slate-200/70 rounded-2xl p-5 bg-slate-50/50 mt-2 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider block">Control de Consumo y Eficiencia</span>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Tabla de Desempeño Energético y Rendimiento de la Flota</h4>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Control de consumo de combustible en ruta vs. rendimiento nominal (km/L) configurado por vehículo.
                  </p>
                </div>

                <div className="overflow-x-auto border border-slate-200/80 rounded-xl bg-white shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100/80 border-b border-slate-200 sticky top-0 select-none">
                      <tr className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">
                        <th className="px-3 py-2.5 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortFleetFuel('Vehiculo')}>
                          <div className="flex items-center gap-1">
                            <span>Vehículo (Patente / Modelo)</span>
                            <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                          </div>
                        </th>
                        <th className="px-2 py-2.5 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortFleetFuel('Km Totales')}>
                          <div className="flex items-center justify-center gap-1">
                            <span>Km en Ruta</span>
                            <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                          </div>
                        </th>
                        <th className="px-2 py-2.5 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortFleetFuel('Rendimiento Nominal')}>
                          <div className="flex items-center justify-center gap-1">
                            <span>Rend. Nominal</span>
                            <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                          </div>
                        </th>
                        <th className="px-2 py-2.5 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortFleetFuel('Litros Teoricos')}>
                          <div className="flex items-center justify-center gap-1">
                            <span>Consumo Teórico</span>
                            <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                          </div>
                        </th>
                        <th className="px-2 py-2.5 text-right cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortFleetFuel('Costo Combustible ($)')}>
                          <div className="flex items-center justify-end gap-1">
                            <span>Gasto Real ($)</span>
                            <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                          </div>
                        </th>
                        <th className="px-2 py-2.5 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortFleetFuel('Litros Reales Est')}>
                          <div className="flex items-center justify-center gap-1">
                            <span>Litros Est. Reales</span>
                            <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                          </div>
                        </th>
                        <th className="px-2 py-2.5 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortFleetFuel('Rendimiento Observado')}>
                          <div className="flex items-center justify-center gap-1">
                            <span>Rend. Observado</span>
                            <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                          </div>
                        </th>
                        <th className="px-3 py-2.5 text-center cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSortFleetFuel('Desviacion Pct')}>
                          <div className="flex items-center justify-center gap-1">
                            <span>Desempeño / Control</span>
                            <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedFleetFuelPerformanceData.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">
                            Sin datos de vehículos o rutas registradas
                          </td>
                        </tr>
                      ) : (
                        sortedFleetFuelPerformanceData.map((v, idx) => {
                          const hasNominal = v['Rendimiento Nominal'] > 0;
                          const hasCost = v['Costo Combustible ($)'] > 0;
                          const dev = v['Desviacion Pct'];

                          return (
                            <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="px-3 py-2.5">
                                <div className="flex flex-col">
                                  <span className="font-black text-slate-800 font-mono text-xs">{v.Plate}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">{v.Model || 'Sin modelo'}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2.5 text-center font-bold text-slate-700 font-mono text-xs">
                                {v['Km Totales'].toLocaleString('es-CL')} km
                              </td>
                              <td className="px-2 py-2.5 text-center font-bold font-mono">
                                {hasNominal ? (
                                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md text-[11px]">
                                    {v['Rendimiento Nominal'].toFixed(1)} km/L
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">Sin Config.</span>
                                )}
                              </td>
                              <td className="px-2 py-2.5 text-center font-semibold text-slate-600 font-mono text-xs">
                                {hasNominal ? `${v['Litros Teoricos'].toFixed(1)} L` : '-'}
                              </td>
                              <td className="px-2 py-2.5 text-right font-extrabold text-amber-700 font-mono text-xs">
                                {hasCost ? formatCLP(v['Costo Combustible ($)']) : '-'}
                              </td>
                              <td className="px-2 py-2.5 text-center font-semibold text-slate-600 font-mono text-xs">
                                {hasCost ? `${v['Litros Reales Est'].toFixed(1)} L` : '-'}
                              </td>
                              <td className="px-2 py-2.5 text-center font-mono font-bold">
                                {hasCost && v['Rendimiento Observado'] > 0 ? (
                                  <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                                    hasNominal && v['Rendimiento Observado'] >= v['Rendimiento Nominal'] * 0.95
                                      ? 'text-emerald-700 bg-emerald-50'
                                      : hasNominal
                                      ? 'text-amber-700 bg-amber-50'
                                      : 'text-slate-700 bg-slate-100'
                                  }`}>
                                    {v['Rendimiento Observado'].toFixed(1)} km/L
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {!hasNominal ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-400">
                                    Sin Rend. Nominal
                                  </span>
                                ) : !hasCost ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-400">
                                    Sin Gasto Registrado
                                  </span>
                                ) : dev !== null && dev > 5 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                                    ▲ +{dev.toFixed(1)}% Exceso Lts
                                  </span>
                                ) : dev !== null && dev < -5 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                    ▼ {dev.toFixed(1)}% Ahorro Lts
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                    ✓ Normal / Eficiente
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
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
