import React, { useState, useMemo } from 'react';
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
  Search
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
        } else if (status === 'NO ENTREGADO') {
          failedDocs++;
        } else if (status === 'RETIRADO') {
          deliveredDocs++; // Retirado is also a successful action points
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
      failedDocuments: failedDocs,
      totalValue,
      totalKilometers,
      avgKmPerRoute,
      avgDurationHours,
      successRate,
      failureRate
    };
  }, [processedData]);

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
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest block mb-0.5">Nivel de Servicio</span>
                    <h4 className="text-2xl font-black text-slate-900 leading-none">{metrics.successRate}%</h4>
                  </div>
                  <div className={`p-3 rounded-xl ${metrics.successRate >= 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} group-hover:scale-110 transition-transform`}>
                    <CheckCircle2 className="w-5 h-5 font-bold" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-wider">Entregas Exitosas</span>
                  <span className="text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded-lg">
                    {metrics.deliveredDocuments} / {metrics.totalDocuments} Doc.
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
                              <Cell key={`cell-${index}`} fill={entry.color} />
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
                          <div key={index} className="flex flex-col p-2 bg-slate-50 border border-slate-100 rounded-xl">
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
                        <Bar dataKey="Carga (M$)" fill="#4f46e5" radius={[0, 4, 4, 0]} maxBarSize={16} />
                        <Bar dataKey="Efectividad (%)" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={6} />
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
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
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
                          <Bar name="Km Totales" dataKey="Km Totales" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={25} />
                          <Bar name="Carga Total (M$)" dataKey="Carga Total (M$)" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={25} />
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
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
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
    </div>
  );
};
