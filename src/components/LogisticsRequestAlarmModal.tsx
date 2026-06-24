import React, { useState } from 'react';
import { 
  AlertTriangle, 
  X, 
  Volume2, 
  Clock, 
  CheckCircle,
  History,
  FileText,
  User,
  MapPin
} from 'lucide-react';
import { LogisticsRequest } from '../types';

interface LogisticsRequestAlarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingRequests: LogisticsRequest[];
  onCompleteRequest: (id: string, observation: string) => Promise<void>;
  onGoToHistory: () => void;
}

export const LogisticsRequestAlarmModal: React.FC<LogisticsRequestAlarmModalProps> = ({
  isOpen,
  onClose,
  pendingRequests,
  onCompleteRequest,
  onGoToHistory
}) => {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [observation, setObservation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleResolveSubmit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!observation.trim()) return;

    try {
      setSubmitting(true);
      await onCompleteRequest(id, observation.trim());
      setResolvingId(null);
      setObservation('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-strong animate-fade-in">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl border-2 border-red-500 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" 
        id="alarm-popup-modal"
      >
        {/* Animated flashing header stripes */}
        <div className="bg-gradient-to-r from-red-600 via-orange-500 to-red-600 h-2 animate-pulse" />

        {/* Modal body */}
        <div className="p-6 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 border-2 border-red-500 rounded-2xl flex items-center justify-center text-red-600 shrink-0 animate-bounce">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200/55 inline-block mb-1">
                  Atención Requerida
                </span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">
                  Surgieron Alertas Pendientes que requieren Atención Urgente
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-medium select-none">
                  Alerta programada del sistema logístico. Registre observaciones para cerrar y detener alarmas.
                </p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Pending items to clear inside the alert */}
          <div className="my-5 flex-1 overflow-y-auto space-y-4 max-h-[45vh]">
            {pendingRequests.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-800">¡Todas las alertas han sido resueltas!</p>
                <p className="text-[10px] text-slate-400 mt-1">Ya no quedan tareas pendientes por procesar en esta ventana.</p>
              </div>
            ) : (
              pendingRequests.map(req => {
                const isCrit = req.priority === 'CRITICA' || req.priority === 'ALTA';
                return (
                  <div 
                    key={req.id} 
                    className={`border rounded-2xl p-4 text-left transition-all relative overflow-hidden ${isCrit ? 'bg-rose-50/20 border-rose-200' : 'bg-slate-50 border-slate-200'}`}
                  >
                    {/* Urgency indicator strip */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isCrit ? 'bg-rose-500' : 'bg-indigo-500'}`} />

                    <div className="pl-2">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                          {req.title}
                        </h4>
                        <span className={`px-2 py-0.5 text-[8px] font-black tracking-widest rounded uppercase ${req.priority === 'CRITICA' ? 'bg-rose-500 text-white' : req.priority === 'ALTA' ? 'bg-orange-400 text-white' : 'bg-slate-200 text-slate-600'}`}>
                          {req.priority}
                        </span>
                      </div>

                      {/* Client / Address specs */}
                      {(req.clientName || req.address) && (
                        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 font-semibold font-sans">
                          {req.clientName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {req.clientName}
                            </span>
                          )}
                          {req.address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {req.address}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Target Date Details inside Alarm Modal */}
                      <div className="mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-500 font-bold">
                        <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Requerido: <strong className="text-slate-800">{req.targetDate ? req.targetDate.split('-').reverse().join('/') : 'Sin fecha'}</strong></span>
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium">
                          (Alarma: {req.alarmOption === 'SAME_DAY' ? 'Mismo día de ruta' : req.alarmOption === 'ANY_DAY' ? 'Todos los días' : `El ${req.alarmDate ? req.alarmDate.split('-').reverse().join('/') : ''}`})
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-sans leading-relaxed">
                        {req.description}
                      </p>

                      {/* Observations form */}
                      <div className="mt-3.5 pt-3.5 border-t border-slate-200/50">
                        {resolvingId === req.id ? (
                          <form 
                            onSubmit={(e) => handleResolveSubmit(e, req.id)} 
                            className="bg-white border border-slate-200 p-3 rounded-xl space-y-2 animate-fade-in"
                          >
                            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Anotar Observación</span>
                            <input 
                              type="text"
                              required
                              placeholder="Ej: Acoplado a ruta #5 de Jorge Orozco, completado"
                              value={observation}
                              onChange={(e) => setObservation(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500 rounded-lg p-2 text-xs font-medium text-slate-800"
                            />
                            <div className="flex justify-end gap-2 text-[10px] font-black">
                              <button 
                                type="button"
                                onClick={() => {
                                  setResolvingId(null);
                                  setObservation('');
                                }}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button 
                                type="submit"
                                disabled={submitting || !observation.trim()}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer disabled:opacity-40"
                              >
                                {submitting ? 'Resolviendo...' : 'Cerrar Alerta'}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button 
                            onClick={() => {
                              setResolvingId(req.id);
                              setObservation('');
                            }}
                            className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-black py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/10"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Resolver / Anotar Observación
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer controls */}
          <div className="border-t border-slate-100 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button 
              onClick={onGoToHistory}
              className="text-[10px] font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" /> Ver Historial de Solicitudes y Observaciones
            </button>

            <button 
              onClick={onClose}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all cursor-pointer text-center"
            >
              Cerrar Diálogo
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
