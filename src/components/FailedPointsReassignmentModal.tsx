import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BellRing, 
  X, 
  Truck, 
  Calendar as CalendarIcon, 
  Search, 
  CheckSquare, 
  Square, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  MapPin, 
  FileText,
  DollarSign,
  Send
} from 'lucide-react';
import { LogisticsRoute, LogisticsDocumentType } from '../types';

export interface FailedPointItem {
  id: string;
  tipo: LogisticsDocumentType;
  razonSocial: string;
  totalAmount: number;
  failedReason?: string;
  trackingObservation?: string;
  trackingStatus?: string;
  originManifestId: string;
  originRouteId: string;
  originRouteName: string;
  originDate: string;
  originRouteNumber?: number;
  location?: string;
  guideNumber?: string;
  proceso?: string;
  isAdditional?: boolean;
}

interface FailedPointsReassignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  failedDocs: FailedPointItem[];
  routes: LogisticsRoute[];
  routeMap: Record<string, string>;
  defaultTargetRoute?: string;
  defaultTargetDate?: string;
  onReassign: (items: FailedPointItem[], targetRoute: string, targetDate: string) => Promise<void>;
  formatDocId: (tipo: string, id: string) => string;
  formatCLP: (val: number) => string;
}

export default function FailedPointsReassignmentModal({
  isOpen,
  onClose,
  failedDocs,
  routes,
  routeMap,
  defaultTargetRoute = '',
  defaultTargetDate = '',
  onReassign,
  formatDocId,
  formatCLP
}: FailedPointsReassignmentModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetRoute, setTargetRoute] = useState<string>(defaultTargetRoute || (routes[0]?.id || ''));
  const [targetDate, setTargetDate] = useState<string>(
    defaultTargetDate || new Date().toISOString().split('T')[0]
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [individualRouteMap, setIndividualRouteMap] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  // Sync default target route if empty
  if (!targetRoute && routes.length > 0) {
    setTargetRoute(routes[0].id);
  }

  const filteredDocs = failedDocs.filter(d => {
    const q = searchTerm.toLowerCase();
    return (
      d.id.toLowerCase().includes(q) ||
      d.razonSocial.toLowerCase().includes(q) ||
      d.originRouteName.toLowerCase().includes(q) ||
      (d.failedReason && d.failedReason.toLowerCase().includes(q)) ||
      (d.location && d.location.toLowerCase().includes(q))
    );
  });

  const isAllSelected = filteredDocs.length > 0 && filteredDocs.every(d => selectedIds.includes(d.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDocs.map(d => d.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkReassign = async () => {
    if (selectedIds.length === 0) return;
    const itemsToAssign = failedDocs.filter(d => selectedIds.includes(d.id));
    setIsSubmitting(true);
    try {
      await onReassign(itemsToAssign, targetRoute, targetDate);
      setSelectedIds([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSingleReassign = async (item: FailedPointItem) => {
    const rId = individualRouteMap[item.id] || targetRoute;
    if (!rId) return;
    setIsSubmitting(true);
    try {
      await onReassign([item], rId, targetDate);
      setSelectedIds(prev => prev.filter(i => i !== item.id));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl shadow-2xl border-2 border-rose-500 max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden"
        id="failed-points-reassignment-modal"
      >
        {/* Animated Top Flashing Stripe */}
        <div className="bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 h-2.5 w-full animate-pulse shrink-0" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 border-2 border-rose-400 flex items-center justify-center text-rose-600 shadow-md shadow-rose-100 shrink-0 animate-bounce">
              <BellRing className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-600 text-white shadow-sm">
                  Alerta de Entregas Fallidas
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                  {failedDocs.length} {failedDocs.length === 1 ? 'punto pendiente' : 'puntos pendientes'}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Puntos con Estado "No Entregado" para Reasignar
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Seleccione los puntos fallidos de hojas de ruta anteriores para programarlos en una nueva ruta del día.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer shrink-0"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Reassignment Control Panel */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white shrink-0 shadow-inner flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-[10px] font-black uppercase text-indigo-300 tracking-wider flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" /> Ruta Destino
              </label>
              <select 
                value={targetRoute}
                onChange={(e) => setTargetRoute(e.target.value)}
                className="bg-slate-800 text-white border border-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer"
              >
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-[10px] font-black uppercase text-indigo-300 tracking-wider flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5" /> Fecha Despacho
              </label>
              <input 
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="bg-slate-800 text-white border border-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={selectedIds.length === 0 || isSubmitting}
              onClick={handleBulkReassign}
              className="flex-1 md:flex-none px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed border border-emerald-400/30"
            >
              <Send className="w-4 h-4" />
              <span>Reasignar Seleccionados ({selectedIds.length})</span>
            </button>
          </div>
        </div>

        {/* Filter bar & List header */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer select-none"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>{isAllSelected ? 'Desmarcar Todos' : 'Seleccionar Todos'}</span>
            </button>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-500 font-semibold">
              Mostrando {filteredDocs.length} de {failedDocs.length}
            </span>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <input 
              type="text"
              placeholder="Buscar por folio, cliente o motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Points Cards Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-100/60">
          {filteredDocs.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3 animate-pulse" />
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">¡No hay puntos pendientes por reasignar!</h4>
              <p className="text-xs text-slate-400 mt-1">Todos los despachos "No Entregados" han sido resueltos o reasignados a nuevas rutas.</p>
            </div>
          ) : (
            filteredDocs.map(item => {
              const isSelected = selectedIds.includes(item.id);
              const customRoute = individualRouteMap[item.id] || targetRoute;

              return (
                <div 
                  key={`${item.originManifestId}_${item.id}`}
                  onClick={() => toggleSelect(item.id)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSelected 
                      ? 'bg-indigo-50/90 border-indigo-500 shadow-md ring-1 ring-indigo-500/20' 
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  {/* Left Column: Checkbox, Badges, Doc Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                      className="mt-1 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300" />
                      )}
                    </button>

                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded font-mono text-xs font-black border ${
                          item.tipo === 'OC' 
                            ? 'bg-teal-50 text-teal-700 border-teal-200' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {formatDocId(item.tipo, item.id)}
                        </span>

                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                          {item.trackingStatus || 'NO ENTREGADO'}
                        </span>

                        <span className="text-[10px] text-slate-500 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Origen: HR-{item.originRouteNumber || '1000'} ({item.originRouteName}) • {item.originDate}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {item.razonSocial}
                      </h4>

                      {item.location && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </p>
                      )}

                      {/* Motivo de Falla Highlight */}
                      <div className="mt-1 p-2.5 bg-rose-50/80 border border-rose-150 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-extrabold uppercase text-[9px] text-rose-700 block tracking-wider">Motivo Registrado:</span>
                          <span className="font-semibold text-rose-950">{item.failedReason || 'Sin motivo de falla especificado'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Amount & Single Reassign Action */}
                  <div className="flex flex-col sm:flex-row md:flex-col items-end justify-between md:justify-center gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Monto Pendiente</span>
                      <span className="text-base font-mono font-black text-slate-900">
                        {formatCLP(item.totalAmount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <select 
                        value={customRoute}
                        onChange={(e) => setIndividualRouteMap(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800 outline-none focus:border-indigo-500"
                      >
                        {routes.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleSingleReassign(item)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg shadow transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                        title="Reasignar solo este punto"
                      >
                        <span>Asignar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            💡 Al reasignar, el documento volverá a estar disponible en la hoja de ruta seleccionada para la fecha elegida.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
