import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X, ClipboardList, CheckCircle2, XCircle, Clock, Plus, Trash2, Edit2 } from 'lucide-react';
import { LogisticsManifest, LogisticsDocumentType } from '../types';
import logoAntko from '../assets/images/logo_antko.png';

interface ManifestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: LogisticsManifest | null;
  routeMap: Record<string, string>;
  driverMap: Record<string, string>;
  vehicleMap: Record<string, string>;
  onUpdateSnapshot?: (updatedSnapshot: any[]) => void;
  canEditPoints?: boolean;
  isAdmin?: boolean;
}

export default function ManifestDetailModal({
  isOpen,
  onClose,
  manifest,
  routeMap,
  driverMap,
  vehicleMap,
  onUpdateSnapshot,
  canEditPoints = false,
  isAdmin = false,
}: ManifestDetailModalProps) {
  const [localSnapshot, setLocalSnapshot] = useState(manifest?.documentsSnapshot || []);
  const lastLocalSnapshotRef = useRef<any[] | null>(null);

  // Sync local snapshot when manifest prop updates (e.g. from Firestore)
  useEffect(() => {
    if (manifest?.documentsSnapshot) {
      if (lastLocalSnapshotRef.current) {
        const isSameAsLocal = JSON.stringify(manifest.documentsSnapshot) === JSON.stringify(lastLocalSnapshotRef.current);
        if (isSameAsLocal) {
          lastLocalSnapshotRef.current = null;
        }
        return;
      }
      setLocalSnapshot(manifest.documentsSnapshot);
    }
  }, [manifest?.documentsSnapshot]);

  if (!isOpen || !manifest) return null;

  const handleStatusChange = (docId: string, newStatus: string) => {
    const updatedSnapshot = localSnapshot.map(d => {
      if (d.id === docId) {
        const isFailed = newStatus === 'NO ENTREGADO' || newStatus === 'NO RETIRADO';
        return { 
          ...d, 
          trackingStatus: newStatus as any,
          failedReason: isFailed ? (d.failedReason || '') : null
        };
      }
      return d;
    });
    lastLocalSnapshotRef.current = updatedSnapshot;
    setLocalSnapshot(updatedSnapshot);
    if (onUpdateSnapshot) {
      onUpdateSnapshot(updatedSnapshot);
    }
  };

  const handleFailedReasonChange = (docId: string, newReason: string) => {
    const updatedSnapshot = localSnapshot.map(d => 
      d.id === docId ? { ...d, failedReason: newReason as any } : d
    );
    lastLocalSnapshotRef.current = updatedSnapshot;
    setLocalSnapshot(updatedSnapshot);
    if (onUpdateSnapshot) {
      onUpdateSnapshot(updatedSnapshot);
    }
  };

  const handleObservationChange = (docId: string, observation: string) => {
    const updatedSnapshot = localSnapshot.map(d => 
      d.id === docId ? { ...d, trackingObservation: observation } : d
    );
    lastLocalSnapshotRef.current = updatedSnapshot;
    setLocalSnapshot(updatedSnapshot);
  };

  const handleDeliveryStatusChange = (docId: string, status: string) => {
    const updatedSnapshot = localSnapshot.map(d => 
      d.id === docId ? { ...d, deliveryStatus: status as any } : d
    );
    lastLocalSnapshotRef.current = updatedSnapshot;
    setLocalSnapshot(updatedSnapshot);
    if (onUpdateSnapshot) {
      onUpdateSnapshot(updatedSnapshot);
    }
  };

  const handleTotalAmountChange = (docId: string, amount: number) => {
    const updatedSnapshot = localSnapshot.map(d => 
      d.id === docId ? { ...d, totalAmount: amount } : d
    );
    lastLocalSnapshotRef.current = updatedSnapshot;
    setLocalSnapshot(updatedSnapshot);
  };

  const persistObservation = () => {
    if (onUpdateSnapshot) {
      lastLocalSnapshotRef.current = localSnapshot;
      onUpdateSnapshot(localSnapshot);
    }
  };

  const parseCLP = (val: string) => parseInt(val.replace(/[^0-9]/g, '')) || 0;
  const formatCLP = (val: number) => `$${Math.round(val).toLocaleString('es-CL')}`;

  const formatDocId = (tipo: string, id: string) => {
    if (id.startsWith(tipo + '-')) return id;
    return `${tipo}-${id}`;
  };

  const totalPoints = localSnapshot.length;
  const completedPoints = localSnapshot.filter(d => 
    ['ENTREGADO', 'RETIRADO', 'NO ENTREGADO', 'NO RETIRADO'].includes(d.trackingStatus || '')
  ).length;
  const pendingPoints = totalPoints - completedPoints;

  const sortedDocs = React.useMemo(() => {
    return [...(localSnapshot || [])].sort((a, b) => {
      if (a.tipo === 'NV' && b.tipo === 'OC') return -1;
      if (a.tipo === 'OC' && b.tipo === 'NV') return 1;
      return (a.orderIndex || 0) - (b.orderIndex || 0);
    });
  }, [localSnapshot]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div 
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="bg-white w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-5xl md:rounded-3xl rounded-none shadow-2xl overflow-hidden flex flex-col z-10"
        id="manifest-detail-modal"
      >
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="w-12 h-9 md:w-16 md:h-12 flex items-center justify-center p-1 md:p-2 bg-white rounded-lg border border-slate-200/50 shrink-0">
              <img 
                src={logoAntko} 
                alt="Antko Logo" 
                className="h-full w-auto object-contain" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="h-8 md:h-10 w-px bg-slate-200" />
            <div className="min-w-0">
              <h2 className="text-sm md:text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 md:gap-2">
                <span className="truncate">DETALLE HOJA DE RUTA</span>
                <span className="text-[10px] md:text-sm font-black px-2 py-0.5 md:px-3 md:py-2 bg-slate-900 text-white rounded-lg font-mono uppercase tracking-tighter shrink-0">
                  HR-{manifest.routeNumber ?? '1001'}
                </span>
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                <span className="text-indigo-600 text-[11px] font-black truncate max-w-[150px] md:max-w-none">{routeMap[manifest.routeId || ''] || 'Sin nombre'}</span>
                <span className="opacity-30">•</span>
                <span>{manifest.date ? new Date(manifest.date + 'T12:00:00').toLocaleDateString('es-CL') : 'Pendiente'}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 active:bg-slate-200 rounded-full transition-colors group cursor-pointer shrink-0"
          >
            <X className="w-6 h-6 text-slate-400 group-hover:text-slate-600" />
          </button>
        </div>

        {/* Stats Section */}
        <div className="px-4 py-3 md:px-6 md:py-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-3.5 sm:items-center sm:justify-between shrink-0">
          <div className="flex items-center justify-between sm:justify-start gap-4 md:gap-6">
            <div className="flex flex-col">
              <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Estado General</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${pendingPoints === 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="text-xs font-black text-slate-700">{pendingPoints === 0 ? 'COMPLETADO' : 'EN PROCESO'}</span>
              </div>
            </div>
            
            <div className="h-8 w-px bg-slate-100 hidden sm:block" />

            <div className="flex items-center gap-4 md:gap-6">
              <div className="flex flex-col items-center">
                <span className="text-base md:text-lg font-black text-slate-900 leading-none">{totalPoints}</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Ptos Totales</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-base md:text-lg font-black text-emerald-600 leading-none">{completedPoints}</span>
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">Entregados</span>
              </div>
              <div className="flex flex-col items-center">
                <span className={`text-base md:text-lg font-black leading-none ${pendingPoints > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{pendingPoints}</span>
                <span className={`text-[9px] font-black uppercase tracking-widest mt-1 ${pendingPoints > 0 ? 'text-amber-500' : 'text-slate-300'}`}>Pendientes</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-slate-50 pt-2 sm:pt-0 sm:border-0">
            <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Progreso</span>
            <div className="flex items-center gap-3 flex-1 sm:flex-initial">
              <div className="w-full sm:w-32 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div 
                  className={`h-full transition-all duration-700 ${pendingPoints === 0 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                  style={{ width: `${totalPoints > 0 ? (completedPoints/totalPoints)*100 : 0}%` }}
                />
              </div>
              <span className="text-xs font-black text-slate-900 font-mono shrink-0">
                {totalPoints > 0 ? Math.round((completedPoints/totalPoints)*100) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide bg-slate-50/30">
          
          {/* Vista Desktop (md:block) */}
          <div className="hidden md:block">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                <tr className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Razón Social</th>
                  <th className="px-4 py-3">Guía</th>
                  <th className="px-4 py-3 min-w-[110px]">Tipo Desp.</th>
                  <th className="px-4 py-3 min-w-[130px]">Status Entrega/Retiro</th>
                  <th className="px-4 py-3">Observaciones Seguimiento</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs bg-white">
                {sortedDocs.map((doc, idx) => {
                  const isNV = doc.tipo === 'NV';
                  const isOC = doc.tipo === 'OC';
                  const isTR = doc.tipo === 'TR';
                  return (
                    <tr key={`${doc.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-[10px] font-normal text-slate-400">{idx + 1}</td>
                      <td className={`px-4 py-3 text-[10px] font-normal font-mono ${isOC ? 'text-teal-600' : isTR ? 'text-amber-600' : 'text-indigo-600'}`}>{formatDocId(doc.tipo, doc.id)}</td>
                      <td className="px-4 py-3 font-normal text-slate-700 truncate max-w-[200px]" title={doc.razonSocial}>{doc.razonSocial}</td>
                      <td className="px-4 py-3 text-[10px] font-normal text-slate-600 font-mono">{(isOC || isTR) ? (doc.guideNumber || '-') : doc.guideNumber || '-'}</td>
                      <td className="px-4 py-3">
                        {!isOC && (
                          <select
                            value={doc.deliveryStatus || 'COMPLETO'}
                            onChange={(e) => handleDeliveryStatusChange(doc.id, e.target.value)}
                            className={`text-[9px] font-bold py-1 px-2 rounded-lg border focus:ring-2 focus:ring-opacity-20 transition-all outline-none appearance-none cursor-pointer ${
                              doc.deliveryStatus === 'PARCIAL' ? 'bg-rose-50 text-rose-700 border-rose-200 focus:ring-rose-500' : 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-500'
                            }`}
                          >
                            <option value="COMPLETO">COMPLETO</option>
                            <option value="PARCIAL">PARCIAL</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5 min-w-[150px]">
                          <div className="flex items-center gap-1">
                            <select
                              disabled={manifest.logisticsDataSaved && !isAdmin}
                              value={doc.trackingStatus || 'EN CURSO'}
                              onChange={(e) => handleStatusChange(doc.id, e.target.value)}
                              className={`text-[9px] font-bold py-1 px-2 rounded-lg border focus:ring-2 focus:ring-opacity-20 transition-all outline-none appearance-none cursor-pointer ${
                                (doc.trackingStatus === 'ENTREGADO' || doc.trackingStatus === 'RETIRADO')
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-500' 
                                  : (doc.trackingStatus === 'NO ENTREGADO' || doc.trackingStatus === 'NO RETIRADO')
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 focus:ring-rose-500'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 focus:ring-slate-500'
                              }`}
                            >
                              <option value="EN CURSO">🟡 EN CURSO</option>
                              {isOC || (isTR && doc.proceso === 'RETIRO') ? (
                                <>
                                  <option value="RETIRADO">🟢 RETIRADO</option>
                                  <option value="NO RETIRADO">🔴 NO RETIRADO</option>
                                </>
                              ) : (
                                <>
                                  <option value="ENTREGADO">🟢 ENTREGADO</option>
                                  <option value="NO ENTREGADO">🔴 NO ENTREGADO</option>
                                </>
                              )}
                            </select>
                            
                            {(doc.trackingStatus === 'ENTREGADO' || doc.trackingStatus === 'RETIRADO') && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                            {(doc.trackingStatus === 'NO ENTREGADO' || doc.trackingStatus === 'NO RETIRADO') && <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                            {(doc.trackingStatus === 'EN CURSO' || !doc.trackingStatus) && <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                          </div>

                          {(doc.trackingStatus === 'NO ENTREGADO' || doc.trackingStatus === 'NO RETIRADO') && (
                            <select
                              disabled={manifest.logisticsDataSaved && !isAdmin}
                              value={doc.failedReason || ''}
                              onChange={(e) => handleFailedReasonChange(doc.id, e.target.value)}
                              className={`text-[9px] font-black py-1 px-2 rounded-lg border focus:ring-2 focus:ring-opacity-20 transition-all outline-none appearance-none cursor-pointer ${
                                doc.failedReason 
                                  ? 'bg-rose-100 text-rose-900 border-rose-300 focus:ring-rose-500' 
                                  : 'bg-amber-100 text-amber-900 border-amber-300 focus:ring-amber-500 animate-pulse'
                              }`}
                            >
                              <option value="">⚠️ SELECCIONAR MOTIVO...</option>
                              {doc.trackingStatus === 'NO RETIRADO' ? (
                                <>
                                  <option value="SIN STOCK">SIN STOCK</option>
                                  <option value="POR HORARIO">POR HORARIO</option>
                                  <option value="DESCORDINACION">DESCORDINACION</option>
                                  <option value="BLOQUEADOS POR PAGO">BLOQUEADOS POR PAGO</option>
                                </>
                              ) : (
                                <>
                                  <option value="POR HORARIO">POR HORARIO</option>
                                  <option value="CLIENTE NO RECIBE">CLIENTE NO RECIBE</option>
                                  <option value="NO CARGADO">NO CARGADO</option>
                                </>
                              )}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          disabled={manifest.logisticsDataSaved && !isAdmin}
                          type="text"
                          placeholder="Agregar observación..."
                          className="w-full text-[10px] bg-white border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-600 font-normal placeholder:text-slate-300 transition-all"
                          value={doc.trackingObservation || ''}
                          onChange={(e) => handleObservationChange(doc.id, e.target.value)}
                          onBlur={() => persistObservation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-normal font-mono text-slate-900">
                        {isOC ? (
                          '$0'
                        ) : isAdmin ? (
                          <input 
                            type="text"
                            className={`w-[80px] bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold text-right focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all ml-auto`}
                            value={doc.totalAmount !== undefined ? formatCLP(doc.totalAmount) : formatCLP(doc.totalPendiente)}
                            onChange={(e) => {
                              const val = parseCLP(e.target.value);
                              const finalVal = Math.max(0, val);
                              handleTotalAmountChange(doc.id, finalVal);
                            }}
                            onBlur={() => persistObservation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        ) : (
                          `$${Math.round(doc.totalAmount ?? doc.totalPendiente).toLocaleString('es-CL')}`
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista Mobile / Tablet (md:hidden) */}
          <div className="block md:hidden flex flex-col gap-4">
            {sortedDocs.map((doc, idx) => {
              const isNV = doc.tipo === 'NV';
              const isOC = doc.tipo === 'OC';
              const isTR = doc.tipo === 'TR';
              const formattedId = formatDocId(doc.tipo, doc.id);
              return (
                <div 
                  key={`card-${doc.id}-${idx}`} 
                  className="bg-white rounded-2xl border border-slate-200/70 p-4 flex flex-col gap-3.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all shadow-sm"
                >
                  {/* Card Header: Doc ID, Badges y Total */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-black font-mono border px-2 py-0.5 rounded-md ${
                          isNV ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : isOC ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {formattedId}
                        </span>
                        {doc.guideNumber && (
                          <span className="text-[9px] text-slate-500 font-mono font-bold bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 shrink-0">
                            Guía: {doc.guideNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-black text-slate-800 leading-tight truncate mt-1" title={doc.razonSocial}>
                        {doc.razonSocial || 'Cliente sin nombre'}
                      </p>
                    </div>
                    
                    {/* Total */}
                    <div className="text-right shrink-0">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total</span>
                      {isOC ? (
                        <span className="text-xs font-black text-slate-400 font-mono">$0</span>
                      ) : isAdmin ? (
                        <div className="relative mt-0.5">
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold font-mono">$</span>
                          <input 
                            type="text"
                            className="w-[85px] bg-white border border-slate-200 focus:border-indigo-500 rounded-lg pl-3.5 pr-1.5 py-1 text-xs font-mono font-bold text-right focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
                            value={doc.totalAmount !== undefined ? doc.totalAmount.toLocaleString('es-CL') : doc.totalPendiente.toLocaleString('es-CL')}
                            onChange={(e) => {
                              const val = parseCLP(e.target.value);
                              const finalVal = Math.max(0, val);
                              handleTotalAmountChange(doc.id, finalVal);
                            }}
                            onBlur={() => persistObservation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <span className="text-xs font-black text-slate-900 font-mono">
                          {formatCLP(doc.totalAmount ?? doc.totalPendiente)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body: Interactive Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Tipo Despacho (only for NV or TR) */}
                    {!isOC && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Tipo Despacho</label>
                        <select
                          value={doc.deliveryStatus || 'COMPLETO'}
                          onChange={(e) => handleDeliveryStatusChange(doc.id, e.target.value)}
                          className={`w-full text-xs font-bold py-2 px-2.5 rounded-xl border focus:ring-2 focus:ring-opacity-20 transition-all outline-none appearance-none cursor-pointer h-10 ${
                            doc.deliveryStatus === 'PARCIAL' ? 'bg-rose-50 text-rose-700 border-rose-200 focus:ring-rose-500' : 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-500'
                          }`}
                        >
                          <option value="COMPLETO">COMPLETO</option>
                          <option value="PARCIAL">PARCIAL</option>
                        </select>
                      </div>
                    )}

                    {/* Status Entrega / Retiro */}
                    <div className={`flex flex-col gap-1 ${isOC ? 'col-span-2' : ''}`}>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Estado Entrega</label>
                      <div className="relative">
                        <select
                          disabled={manifest.logisticsDataSaved && !isAdmin}
                          value={doc.trackingStatus || 'EN CURSO'}
                          onChange={(e) => handleStatusChange(doc.id, e.target.value)}
                          className={`w-full text-xs font-bold py-2 px-2.5 rounded-xl border focus:ring-2 focus:ring-opacity-20 transition-all outline-none appearance-none cursor-pointer h-10 pr-7 ${
                            (doc.trackingStatus === 'ENTREGADO' || doc.trackingStatus === 'RETIRADO')
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-500' 
                              : (doc.trackingStatus === 'NO ENTREGADO' || doc.trackingStatus === 'NO RETIRADO')
                              ? 'bg-rose-50 text-rose-700 border-rose-200 focus:ring-rose-500'
                              : 'bg-slate-50 text-slate-600 border-slate-200 focus:ring-slate-500'
                          }`}
                        >
                          <option value="EN CURSO">🟡 EN CURSO</option>
                          {isOC || (isTR && doc.proceso === 'RETIRO') ? (
                            <>
                              <option value="RETIRADO">🟢 RETIRADO</option>
                              <option value="NO RETIRADO">🔴 NO RETIRADO</option>
                            </>
                          ) : (
                            <>
                              <option value="ENTREGADO">🟢 ENTREGADO</option>
                              <option value="NO ENTREGADO">🔴 NO ENTREGADO</option>
                            </>
                          )}
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          {(doc.trackingStatus === 'ENTREGADO' || doc.trackingStatus === 'RETIRADO') && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                          {(doc.trackingStatus === 'NO ENTREGADO' || doc.trackingStatus === 'NO RETIRADO') && <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                          {(doc.trackingStatus === 'EN CURSO' || !doc.trackingStatus) && <Clock className="w-4 h-4 text-slate-400 shrink-0" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Motivo de Falla (only if status is NO ENTREGADO or NO RETIRADO) */}
                  {(doc.trackingStatus === 'NO ENTREGADO' || doc.trackingStatus === 'NO RETIRADO') && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-rose-500 uppercase tracking-wider">Motivo No Entrega/Retiro</label>
                      <select
                        disabled={manifest.logisticsDataSaved && !isAdmin}
                        value={doc.failedReason || ''}
                        onChange={(e) => handleFailedReasonChange(doc.id, e.target.value)}
                        className={`w-full text-xs font-black py-2.5 px-3 rounded-xl border focus:ring-2 focus:ring-opacity-20 transition-all outline-none appearance-none cursor-pointer h-10 ${
                          doc.failedReason 
                            ? 'bg-rose-100 text-rose-900 border-rose-300 focus:ring-rose-500' 
                            : 'bg-amber-100 text-amber-900 border-amber-300 focus:ring-amber-500 animate-pulse'
                        }`}
                      >
                        <option value="">⚠️ SELECCIONAR MOTIVO...</option>
                        {doc.trackingStatus === 'NO RETIRADO' ? (
                          <>
                            <option value="SIN STOCK">SIN STOCK</option>
                            <option value="POR HORARIO">POR HORARIO</option>
                            <option value="DESCORDINACION">DESCORDINACION</option>
                            <option value="BLOQUEADOS POR PAGO">BLOQUEADOS POR PAGO</option>
                          </>
                        ) : (
                          <>
                            <option value="POR HORARIO">POR HORARIO</option>
                            <option value="CLIENTE NO RECIBE">CLIENTE NO RECIBE</option>
                            <option value="NO CARGADO">NO CARGADO</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}

                  {/* Observación de Seguimiento */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Observaciones</label>
                    <input 
                      disabled={manifest.logisticsDataSaved && !isAdmin}
                      type="text"
                      placeholder="Agregar observación de entrega..."
                      className="w-full text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/10 outline-none text-slate-700 font-medium placeholder:text-slate-300 transition-all h-10"
                      value={doc.trackingObservation || ''}
                      onChange={(e) => handleObservationChange(doc.id, e.target.value)}
                      onBlur={() => persistObservation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {/* Generous bottom padding to allow scrolling past keyboard space */}
            <div className="h-64" />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between shrink-0">
          <div className="flex gap-6 justify-between sm:justify-start w-full sm:w-auto">
            <div className="flex flex-col">
              <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider">Chofer</span>
              <span className="text-xs font-bold text-slate-700">{driverMap[manifest.driverId] || 'No definido'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider">Vehículo</span>
              <span className="text-xs font-bold text-slate-700">{vehicleMap[manifest.vehicleId] || 'No definido'}</span>
            </div>
          </div>
          <div className="text-right w-full sm:w-auto flex items-center sm:flex-col justify-between sm:justify-end border-t border-slate-200/50 sm:border-0 pt-3 sm:pt-0">
            <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Despachado</p>
            <p className="text-base md:text-xl font-black text-indigo-600 font-mono">
              ${Math.round((localSnapshot || []).reduce((sum, d) => d.tipo === 'OC' ? sum : sum + (d.totalAmount ?? d.totalPendiente), 0)).toLocaleString('es-CL')}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
