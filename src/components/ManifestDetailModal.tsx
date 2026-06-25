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
          failedReason: isFailed ? (d.failedReason || '') : undefined
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

  const persistObservation = () => {
    if (onUpdateSnapshot) {
      lastLocalSnapshotRef.current = localSnapshot;
      onUpdateSnapshot(localSnapshot);
    }
  };

  const formatDocId = (tipo: string, id: string) => {
    if (id.startsWith(tipo + '-')) return id;
    return `${tipo}-${id}`;
  };

  const totalPoints = localSnapshot.length;
  const completedPoints = localSnapshot.filter(d => 
    ['ENTREGADO', 'RETIRADO', 'NO ENTREGADO', 'NO RETIRADO'].includes(d.trackingStatus || '')
  ).length;
  const pendingPoints = totalPoints - completedPoints;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-xl max-w-5xl w-full overflow-hidden flex flex-col max-h-[90vh] z-10"
        id="manifest-detail-modal"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-16 h-12 flex items-center justify-center p-2">
              <img 
                src={logoAntko} 
                alt="Antko Logo" 
                className="h-full w-auto object-contain" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                DETALLE HOJA DE RUTA 
                <span className="text-sm font-black px-3 py-2 bg-slate-900 text-white rounded-xl font-mono uppercase tracking-tighter">HR-{manifest.routeNumber ?? '1001'}</span>
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="text-indigo-600 text-sm font-black">{routeMap[manifest.routeId || ''] || 'Sin nombre'}</span>
                <span className="opacity-30">•</span>
                {manifest.date ? new Date(manifest.date + 'T12:00:00').toLocaleDateString('es-CL') : 'Pendiente'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors group cursor-pointer"
          >
            <X className="w-6 h-6 text-slate-400 group-hover:text-slate-600" />
          </button>
        </div>

        <div className="px-6 py-4 bg-white border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Estado General</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${pendingPoints === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-xs font-black text-slate-700">{pendingPoints === 0 ? 'COMPLETADO' : 'EN PROCESO'}</span>
              </div>
            </div>
            
            <div className="h-8 w-px bg-slate-100" />

            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center">
                <span className="text-lg font-black text-slate-900 leading-none">{totalPoints}</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Ptos Totales</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-black text-emerald-600 leading-none">{completedPoints}</span>
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">Entregados</span>
              </div>
              <div className="flex flex-col items-center">
                <span className={`text-lg font-black leading-none ${pendingPoints > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{pendingPoints}</span>
                <span className={`text-[9px] font-black uppercase tracking-widest mt-1 ${pendingPoints > 0 ? 'text-amber-500' : 'text-slate-300'}`}>Pendientes</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Progreso de Ruta</span>
            <div className="flex items-center gap-3">
              <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div 
                  className={`h-full transition-all duration-700 ${pendingPoints === 0 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                  style={{ width: `${totalPoints > 0 ? (completedPoints/totalPoints)*100 : 0}%` }}
                />
              </div>
              <span className="text-xs font-black text-slate-900 font-mono">
                {totalPoints > 0 ? Math.round((completedPoints/totalPoints)*100) : 0}%
              </span>
            </div>
          </div>
        </div>


        
        <div className="overflow-auto p-6 scrollbar-hide">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
              <tr className="text-[10px] font-normal text-slate-400 uppercase tracking-widest">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Razón Social</th>
                <th className="px-4 py-3">Guía</th>
                <th className="px-4 py-3 min-w-[130px]">Status Entrega/Retiro</th>
                <th className="px-4 py-3">Observaciones Seguimiento</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {[...(localSnapshot || [])].sort((a,b) => {
                if (a.tipo === 'NV' && b.tipo === 'OC') return -1;
                if (a.tipo === 'OC' && b.tipo === 'NV') return 1;
                return (a.orderIndex || 0) - (b.orderIndex || 0);
              }).map((doc, idx) => (
                <tr key={`${doc.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-[10px] font-normal text-slate-400">{idx + 1}</td>
                  <td className={`px-4 py-3 text-[10px] font-normal font-mono ${doc.tipo === 'OC' ? 'text-teal-600' : doc.tipo === 'TR' ? 'text-amber-600' : 'text-indigo-600'}`}>{formatDocId(doc.tipo, doc.id)}</td>
                  <td className="px-4 py-3 font-normal text-slate-700 truncate max-w-[200px]">{doc.razonSocial}</td>
                  <td className="px-4 py-3 text-[10px] font-normal text-slate-600 font-mono">{ (doc.tipo === 'OC' || doc.tipo === 'TR') ? (doc.guideNumber || '-') : doc.guideNumber || '-' }</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5 min-w-[150px]">
                      <div className="flex items-center gap-1">
                        <select
                          disabled={manifest.logisticsDataSaved}
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
                          {doc.tipo === 'OC' || (doc.tipo === 'TR' && doc.proceso === 'RETIRO') ? (
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
                    {doc.tipo === 'OC' ? '$0' : `$${Math.round(doc.totalAmount ?? doc.totalPendiente).toLocaleString('es-CL')}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex gap-6">
             <div className="flex flex-col">
              <span className="text-[10px] font-normal text-slate-400 uppercase">Chofer</span>
              <span className="text-xs font-normal text-slate-700">{driverMap[manifest.driverId] || 'No definido'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-normal text-slate-400 uppercase">Vehículo</span>
              <span className="text-xs font-normal text-slate-700">{vehicleMap[manifest.vehicleId] || 'No definido'}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-normal text-slate-400 uppercase">Valor Total Despachado</p>
            <p className="text-xl font-normal text-indigo-600 font-mono">
              ${Math.round((localSnapshot || []).reduce((sum, d) => d.tipo === 'OC' ? sum : sum + (d.totalAmount ?? d.totalPendiente), 0)).toLocaleString('es-CL')}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
