import React from 'react';
import { motion } from 'motion/react';
import { X, MapPin, Printer } from 'lucide-react';
import { LogisticsRoute } from '../types';

interface PickingModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: LogisticsRoute[];
  pickingRouteId: string;
  setPickingRouteId: (id: string) => void;
  handlePrintPickingReport: (routeId: string) => void;
  routeCounts?: Record<string, number>;
}

export default function PickingModal({
  isOpen,
  onClose,
  routes,
  pickingRouteId,
  setPickingRouteId,
  handlePrintPickingReport,
  routeCounts,
}: PickingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        id="picking-backdrop"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 40 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 z-10"
        id="picking-modal-content"
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-sm font-normal text-slate-900">Seleccionar Ruta para Picking</h2>
            <p className="text-[10px] text-slate-500 font-normal tracking-tight">Elija la ruta que desea incluir en el reporte impreso</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            <button 
              onClick={() => setPickingRouteId('UNASSIGNED')}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${pickingRouteId === 'UNASSIGNED' ? 'border-indigo-600 bg-indigo-50/50 shadow-inner' : 'border-slate-100 hover:border-slate-300 bg-white'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-normal text-slate-600 italic">Documentos SIN RUTA</span>
                  {routeCounts !== undefined && (
                    <span className="text-[10px] text-slate-400 font-normal">
                      {routeCounts['UNASSIGNED'] || 0} {routeCounts['UNASSIGNED'] === 1 ? 'registro' : 'registros'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {routeCounts !== undefined && routeCounts['UNASSIGNED'] > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-normal ${pickingRouteId === 'UNASSIGNED' ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
                    {routeCounts['UNASSIGNED']}
                  </span>
                )}
                {pickingRouteId === 'UNASSIGNED' && <div className="w-2 h-2 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]"></div>}
              </div>
            </button>

            {[...routes].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(r => {
              const count = routeCounts?.[r.id] ?? 0;
              return (
                <button 
                  key={r.id}
                  onClick={() => setPickingRouteId(r.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${pickingRouteId === r.id ? 'border-indigo-600 bg-indigo-50/50 shadow-inner' : 'border-slate-100 hover:border-slate-300 bg-white'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-normal text-slate-800">{r.name}</span>
                      {routeCounts !== undefined && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          {count} {count === 1 ? 'registro' : 'registros'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {count > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-normal ${pickingRouteId === r.id ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
                        {count}
                      </span>
                    )}
                    {pickingRouteId === r.id && <div className="w-2 h-2 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]"></div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-normal text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            disabled={!pickingRouteId}
            onClick={() => handlePrintPickingReport(pickingRouteId)}
            className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-500 font-normal text-xs shadow-lg shadow-indigo-200/50 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Generar Reporte</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
