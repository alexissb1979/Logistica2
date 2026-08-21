import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Gauge, Save, AlertTriangle, CheckCircle2, Shield, 
  Truck, User, Calendar, Info, ArrowRight, RotateCcw
} from 'lucide-react';
import { LogisticsManifest } from '../types';

interface AdminMileageModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: LogisticsManifest | null;
  routeName: string;
  driverName: string;
  vehiclePlate: string;
  onSave: (manifestId: string, initialKm: number | null, finalKm: number | null) => Promise<void> | void;
}

export const AdminMileageModal: React.FC<AdminMileageModalProps> = ({
  isOpen,
  onClose,
  manifest,
  routeName,
  driverName,
  vehiclePlate,
  onSave,
}) => {
  const [initialKm, setInitialKm] = useState<string>('');
  const [finalKm, setFinalKm] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (manifest) {
      setInitialKm(manifest.initialKm !== undefined && manifest.initialKm !== null ? String(manifest.initialKm) : '');
      setFinalKm(manifest.finalKm !== undefined && manifest.finalKm !== null ? String(manifest.finalKm) : '');
      setErrorMsg(null);
    }
  }, [manifest]);

  if (!isOpen || !manifest) return null;

  const numInitial = initialKm.trim() === '' ? null : Number(initialKm);
  const numFinal = finalKm.trim() === '' ? null : Number(finalKm);

  const hasBoth = numInitial !== null && numFinal !== null && !isNaN(numInitial) && !isNaN(numFinal);
  const distance = hasBoth ? (numFinal! - numInitial!) : null;
  const isNegative = distance !== null && distance < 0;
  const isExcessive = distance !== null && distance > 2500;

  // Detect likely typo like 718222 vs 71994 (differing number of digits)
  const initialDigits = initialKm.trim().replace(/\D/g, '').length;
  const finalDigits = finalKm.trim().replace(/\D/g, '').length;
  const digitMismatch = initialDigits > 0 && finalDigits > 0 && Math.abs(initialDigits - finalDigits) >= 1;

  const handleSave = async () => {
    if (numInitial !== null && isNaN(numInitial)) {
      setErrorMsg('El kilometraje inicial debe ser un número válido.');
      return;
    }
    if (numFinal !== null && isNaN(numFinal)) {
      setErrorMsg('El kilometraje final debe ser un número válido.');
      return;
    }
    if (numInitial !== null && numInitial < 0) {
      setErrorMsg('El kilometraje inicial no puede ser negativo.');
      return;
    }
    if (numFinal !== null && numFinal < 0) {
      setErrorMsg('El kilometraje final no puede ser negativo.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      await onSave(
        manifest.id,
        numInitial !== null ? Math.round(numInitial) : null,
        numFinal !== null ? Math.round(numFinal) : null
      );
      onClose();
    } catch (err: any) {
      console.error('Error saving admin mileage:', err);
      setErrorMsg('Ocurrió un error al guardar el kilometraje en la base de datos.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToOriginal = () => {
    setInitialKm(manifest.initialKm !== undefined && manifest.initialKm !== null ? String(manifest.initialKm) : '');
    setFinalKm(manifest.finalKm !== undefined && manifest.finalKm !== null ? String(manifest.finalKm) : '');
    setErrorMsg(null);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 text-white flex items-center justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-6 opacity-15 pointer-events-none">
              <Gauge className="w-36 h-36" />
            </div>

            <div className="relative z-10 flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner text-white border border-white/20">
                <Gauge className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black tracking-tight leading-none">
                    Modificar Registro de Kilometraje
                  </h3>
                  <span className="inline-flex items-center gap-1 bg-amber-900/40 text-amber-100 border border-amber-300/30 text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                    <Shield className="w-2.5 h-2.5" /> Admin
                  </span>
                </div>
                <p className="text-[11px] text-amber-100/90 font-medium mt-1">
                  Permite corregir exclusivamente el odómetro inicial y final sin afectar otros datos de la ruta.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="relative z-10 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 sm:p-6 overflow-y-auto flex flex-col gap-4 text-left">
            {/* Route Summary Box */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black px-2.5 py-1 bg-slate-900 text-white rounded-lg font-mono tracking-tight">
                    HR-{manifest.routeNumber ?? '1001'}
                  </span>
                  <span className="text-xs font-black text-slate-800 tracking-tight">
                    {routeName}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-500">
                  <Calendar className="w-3 h-3 text-indigo-500" />
                  {manifest.date ? new Date(manifest.date + 'T12:00:00').toLocaleDateString('es-CL') : '-'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-600 truncate">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate"><strong>Chofer:</strong> {driverName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 truncate">
                  <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate"><strong>Vehículo:</strong> {vehiclePlate}</span>
                </div>
              </div>
            </div>

            {/* Error Message if any */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Input Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Initial Km */}
              <div className="flex flex-col gap-1.5 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-amber-400 transition-colors">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Kilometraje Inicial (KM)</span>
                  <span className="text-[9px] font-bold text-slate-400 font-mono">Salida</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Ej. 71822"
                    value={initialKm}
                    onChange={(e) => {
                      setInitialKm(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-black font-mono text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all placeholder:text-slate-300"
                  />
                  {initialKm && (
                    <button
                      type="button"
                      onClick={() => setInitialKm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 text-xs cursor-pointer"
                      title="Borrar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  Odómetro al iniciar la jornada.
                </span>
              </div>

              {/* Final Km */}
              <div className="flex flex-col gap-1.5 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-amber-400 transition-colors">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Kilometraje Final (KM)</span>
                  <span className="text-[9px] font-bold text-slate-400 font-mono">Llegada</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Ej. 71994"
                    value={finalKm}
                    onChange={(e) => {
                      setFinalKm(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-black font-mono text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all placeholder:text-slate-300"
                  />
                  {finalKm && (
                    <button
                      type="button"
                      onClick={() => setFinalKm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 text-xs cursor-pointer"
                      title="Borrar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  Odómetro al finalizar la jornada.
                </span>
              </div>
            </div>

            {/* Live Calculation / Validation Preview */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isNegative
                ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                : isExcessive
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : distance !== null && distance >= 0
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {isNegative ? (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  ) : distance !== null && distance >= 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider">
                      {distance !== null ? 'Cálculo de Distancia Recorrida' : 'Estado del Odómetro'}
                    </h4>
                    <p className="text-[11px] font-medium mt-0.5">
                      {isNegative ? (
                        <span className="text-rose-700 font-bold">
                          Inconsistencia: El KM final ({numFinal}) es menor al inicial ({numInitial}).
                          {digitMismatch && ' Posible error de dígito extra (ej. 6 cifras vs 5 cifras).'}
                        </span>
                      ) : isExcessive ? (
                        <span className="text-amber-800 font-bold">
                          Distancia calculada: {distance} KM. Atención: es un valor inusualmente alto para un solo día de ruta.
                        </span>
                      ) : distance !== null ? (
                        <span>
                          Distancia calculada: <strong className="font-mono text-emerald-700 text-xs">{distance} KM</strong> recorridos en esta ruta.
                        </span>
                      ) : (
                        <span>Ingrese ambos kilometrajes para computar la distancia total del viaje.</span>
                      )}
                    </p>
                  </div>
                </div>

                {distance !== null && (
                  <div className="text-right shrink-0">
                    <span className={`font-mono text-lg font-black ${isNegative ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {distance > 0 ? `+${distance}` : distance} <span className="text-xs font-sans">km</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick helper tip */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-medium">
              <span>* Los cambios se aplicarán inmediatamente en la hoja de ruta y en las estadísticas de choferes.</span>
              <button
                type="button"
                onClick={handleResetToOriginal}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-bold transition-colors cursor-pointer"
                title="Restaurar valores originales"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Restaurar
              </button>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-200/70 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Kilometraje</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
export default AdminMileageModal;
