import React from 'react';
import { motion } from 'motion/react';
import { X, CalendarDays, MapPin, Printer, Info, CheckCircle2 } from 'lucide-react';
import logoAntko from '../assets/images/logo_antko.png';

interface WeeklyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WeeklyScheduleModal({ isOpen, onClose }: WeeklyScheduleModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #weekly-schedule-print-content, #weekly-schedule-print-content * {
            visibility: visible;
          }
          #weekly-schedule-print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 15px;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-6xl w-full flex flex-col my-auto max-h-[96vh] overflow-hidden"
      >
        {/* Modal Top Control Bar (Hidden on Print) */}
        <div className="p-3 sm:p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 no-print border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
                Programación Semanal Operativa
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Calendario oficial de cobertura y frecuencias de rutas por día
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Imprimir o guardar como PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Content Container */}
        <div 
          id="weekly-schedule-print-content"
          className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-white text-slate-900"
        >
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <img 
                src={logoAntko} 
                alt="ANTKO" 
                className="h-12 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="flex flex-col">
                <span className="text-lg font-black text-sky-700 tracking-tight leading-tight">ANTKO</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SOLUCIONES EN AGUA</span>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end">
              <h1 className="text-xl sm:text-2xl font-black text-[#0f2942] tracking-tight uppercase">
                PROGRAMACIÓN DE RUTAS
              </h1>
              <div className="mt-1 inline-flex items-center px-3 py-1 rounded-full bg-sky-500 text-white font-extrabold text-[10px] sm:text-xs uppercase tracking-wider shadow-sm">
                CALENDARIO SEMANAL OPERATIVO | ÁREA DE LOGÍSTICA Y DISTRIBUCIÓN
              </div>
            </div>
          </div>

          {/* Top 3 Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                COBERTURA PERMANENTE
              </span>
              <span className="text-xs sm:text-sm font-black text-[#0f2942] block">
                Región Metropolitana (RM CN - CS)
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                FRECUENCIA ALTA (4 DÍAS)
              </span>
              <span className="text-xs sm:text-sm font-black text-[#0f2942] block">
                6ª Región (Rancagua - San Fernando)
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                RETIROS ADQUISICIONES
              </span>
              <span className="text-xs sm:text-sm font-black text-[#0f2942] block">
                Lunes a Viernes (Programación Diaria)
              </span>
            </div>
          </div>

          {/* Weekly Grid (5 Columns) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-white">
              
              {/* LUNES */}
              <div className="flex flex-col">
                <div className="bg-[#0f2942] text-white py-2 px-3 text-center text-xs font-black tracking-wider uppercase">
                  LUNES
                </div>
                <div className="p-2.5 space-y-3 flex-1 bg-slate-50/40">
                  {/* RUTAS METROPOL. */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS METROPOL.
                    </span>
                    <div className="p-2 bg-sky-50 border-l-4 border-sky-500 rounded-r-lg text-sky-950 font-black text-xs">
                      RM (CN - CS)
                    </div>
                  </div>

                  {/* RUTAS REGIONALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS REGIONALES
                    </span>
                    <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-bold text-xs">
                      <span className="font-black block">6ª Región</span>
                      <span className="text-[10px] text-slate-500 font-medium">Rancagua - San Fernando</span>
                    </div>
                  </div>

                  {/* TAREAS ESPECIALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      TAREAS ESPECIALES
                    </span>
                    <div className="p-2 bg-lime-50 border border-lime-200 rounded-lg text-lime-900 font-bold text-xs">
                      Retiros Adquisiciones
                    </div>
                  </div>
                </div>
              </div>

              {/* MARTES */}
              <div className="flex flex-col">
                <div className="bg-[#0f2942] text-white py-2 px-3 text-center text-xs font-black tracking-wider uppercase">
                  MARTES
                </div>
                <div className="p-2.5 space-y-3 flex-1 bg-slate-50/40">
                  {/* RUTAS METROPOL. */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS METROPOL.
                    </span>
                    <div className="p-2 bg-sky-50 border-l-4 border-sky-500 rounded-r-lg text-sky-950 font-black text-xs">
                      RM (CN - CS)
                    </div>
                  </div>

                  {/* RUTAS REGIONALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS REGIONALES
                    </span>
                    <div className="space-y-1">
                      <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-bold text-xs">
                        <span className="font-black block">6ª Región</span>
                        <span className="text-[10px] text-slate-500 font-medium">Rancagua - San Fernando</span>
                      </div>
                      <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-bold text-xs">
                        Ruta V Región Norte
                      </div>
                    </div>
                  </div>

                  {/* RUTAS CONDICIONALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS CONDICIONALES
                    </span>
                    <div className="p-2 bg-amber-50/60 border border-amber-200 rounded-lg text-amber-950 font-bold text-xs space-y-1">
                      <div>
                        <span className="font-black block text-xs">Sexta Costa</span>
                        <span className="text-[9px] text-amber-800 font-medium leading-tight block">
                          Placilla - Sta. Cruz - Peralillo - Pumanque
                        </span>
                      </div>
                      <span className="inline-block px-1.5 py-0.5 bg-amber-200/80 text-amber-900 border border-amber-300 text-[8px] font-black uppercase tracking-wider rounded">
                        SEGÚN CONSOLIDADO
                      </span>
                    </div>
                  </div>

                  {/* TAREAS ESPECIALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      TAREAS ESPECIALES
                    </span>
                    <div className="p-2 bg-lime-50 border border-lime-200 rounded-lg text-lime-900 font-bold text-xs">
                      Retiros Adquisiciones
                    </div>
                  </div>
                </div>
              </div>

              {/* MIÉRCOLES */}
              <div className="flex flex-col">
                <div className="bg-[#0f2942] text-white py-2 px-3 text-center text-xs font-black tracking-wider uppercase">
                  MIÉRCOLES
                </div>
                <div className="p-2.5 space-y-3 flex-1 bg-slate-50/40">
                  {/* RUTAS METROPOL. */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS METROPOL.
                    </span>
                    <div className="p-2 bg-sky-50 border-l-4 border-sky-500 rounded-r-lg text-sky-950 font-black text-xs">
                      RM (CN - CS)
                    </div>
                  </div>

                  {/* RUTAS REGIONALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS REGIONALES
                    </span>
                    <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-bold text-xs">
                      <span className="font-black block">7ª Región</span>
                      <span className="text-[10px] text-slate-500 font-medium">Curicó - Molina - Talca</span>
                    </div>
                  </div>

                  {/* RUTAS CONDICIONALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS CONDICIONALES
                    </span>
                    <div className="space-y-1.5">
                      <div className="p-2 bg-amber-50/60 border border-amber-200 rounded-lg text-amber-950 font-bold text-xs flex items-center justify-between gap-1">
                        <span className="font-black">V Costa</span>
                        <span className="px-1.5 py-0.5 bg-amber-200/80 text-amber-900 border border-amber-300 text-[8px] font-black uppercase tracking-wider rounded">
                          SEGÚN CONSOLIDADO
                        </span>
                      </div>
                      <div className="p-2 bg-amber-50/60 border border-amber-200 rounded-lg text-amber-950 font-bold text-xs flex items-center justify-between gap-1">
                        <span className="font-black">Ruta Melipilla</span>
                        <span className="px-1.5 py-0.5 bg-amber-200/80 text-amber-900 border border-amber-300 text-[8px] font-black uppercase tracking-wider rounded">
                          SEGÚN CONSOLIDADO
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* TAREAS ESPECIALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      TAREAS ESPECIALES
                    </span>
                    <div className="p-2 bg-lime-50 border border-lime-200 rounded-lg text-lime-900 font-bold text-xs">
                      Retiros Adquisiciones
                    </div>
                  </div>
                </div>
              </div>

              {/* JUEVES */}
              <div className="flex flex-col">
                <div className="bg-[#0f2942] text-white py-2 px-3 text-center text-xs font-black tracking-wider uppercase">
                  JUEVES
                </div>
                <div className="p-2.5 space-y-3 flex-1 bg-slate-50/40">
                  {/* RUTAS METROPOL. */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS METROPOL.
                    </span>
                    <div className="p-2 bg-sky-50 border-l-4 border-sky-500 rounded-r-lg text-sky-950 font-black text-xs">
                      RM (CN - CS)
                    </div>
                  </div>

                  {/* RUTAS REGIONALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS REGIONALES
                    </span>
                    <div className="space-y-1">
                      <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-bold text-xs">
                        <span className="font-black block">6ª Región</span>
                        <span className="text-[10px] text-slate-500 font-medium">Rancagua - San Fernando</span>
                      </div>
                      <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-bold text-xs">
                        <span className="font-black block">Ruta Sur</span>
                        <span className="text-[10px] text-slate-500 font-medium">Linares - Parral - Chillán</span>
                      </div>
                    </div>
                  </div>

                  {/* RUTAS CONDICIONALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS CONDICIONALES
                    </span>
                    <div className="p-2 bg-amber-50/60 border border-amber-200 rounded-lg text-amber-950 font-bold text-xs flex items-center justify-between gap-1">
                      <span className="font-black">V Región Norte</span>
                      <span className="px-1.5 py-0.5 bg-amber-200/80 text-amber-900 border border-amber-300 text-[8px] font-black uppercase tracking-wider rounded">
                        SEGÚN CONSOLIDADO
                      </span>
                    </div>
                  </div>

                  {/* TAREAS ESPECIALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      TAREAS ESPECIALES
                    </span>
                    <div className="p-2 bg-lime-50 border border-lime-200 rounded-lg text-lime-900 font-bold text-xs">
                      Retiros Adquisiciones
                    </div>
                  </div>
                </div>
              </div>

              {/* VIERNES */}
              <div className="flex flex-col">
                <div className="bg-[#0f2942] text-white py-2 px-3 text-center text-xs font-black tracking-wider uppercase">
                  VIERNES
                </div>
                <div className="p-2.5 space-y-3 flex-1 bg-slate-50/40">
                  {/* RUTAS METROPOL. */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS METROPOL.
                    </span>
                    <div className="p-2 bg-sky-50 border-l-4 border-sky-500 rounded-r-lg text-sky-950 font-black text-xs">
                      RM (CN - CS)
                    </div>
                  </div>

                  {/* RUTAS REGIONALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS REGIONALES
                    </span>
                    <div className="space-y-1">
                      <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-bold text-xs">
                        <span className="font-black block">6ª Región</span>
                        <span className="text-[10px] text-slate-500 font-medium">Rancagua - San Fernando</span>
                      </div>
                      <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-bold text-xs">
                        <span className="font-black block">7ª Región</span>
                        <span className="text-[10px] text-slate-500 font-medium">Curicó - Molina - Talca</span>
                      </div>
                    </div>
                  </div>

                  {/* RUTAS CONDICIONALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      RUTAS CONDICIONALES
                    </span>
                    <div className="space-y-1.5">
                      <div className="p-2 bg-amber-50/60 border border-amber-200 rounded-lg text-amber-950 font-bold text-xs flex items-center justify-between gap-1">
                        <span className="font-black">V Costa</span>
                        <span className="px-1.5 py-0.5 bg-amber-200/80 text-amber-900 border border-amber-300 text-[8px] font-black uppercase tracking-wider rounded">
                          SEGÚN CONSOLIDADO
                        </span>
                      </div>
                      <div className="p-2 bg-amber-50/60 border border-amber-200 rounded-lg text-amber-950 font-bold text-xs flex items-center justify-between gap-1">
                        <span className="font-black">Ruta Melipilla</span>
                        <span className="px-1.5 py-0.5 bg-amber-200/80 text-amber-900 border border-amber-300 text-[8px] font-black uppercase tracking-wider rounded">
                          SEGÚN CONSOLIDADO
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* TAREAS ESPECIALES */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                      TAREAS ESPECIALES
                    </span>
                    <div className="p-2 bg-lime-50 border border-lime-200 rounded-lg text-lime-900 font-bold text-xs">
                      Retiros Adquisiciones
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Special Route Banner */}
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-950 flex items-start gap-2 text-xs font-medium">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-black text-sky-900">📍 Ruta Especial (La Serena - IV Región):</span>{' '}
              <span className="text-sky-950">
                Programación exclusiva sujeta a volumen consolidado y coordinación previa con el Área Logística.
              </span>
            </div>
          </div>

          {/* Footer Legend & Operational Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
            {/* Simbología */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                SIMBOLOGÍA DE RUTAS
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-sky-500 shrink-0" />
                  <span>Región Metropolitana</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-slate-600 shrink-0" />
                  <span>Rutas Fijas Regionales</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-amber-500 shrink-0" />
                  <span>Rutas Según Consolidado</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-lime-500 shrink-0" />
                  <span>Retiros / Adquisiciones</span>
                </div>
              </div>
            </div>

            {/* Notas Operativas */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                NOTAS OPERATIVAS
              </span>
              <ul className="text-[11px] text-slate-600 space-y-1 font-medium">
                <li className="flex items-start gap-1">
                  <span>•</span>
                  <span>
                    Las rutas marcadas como <strong className="text-slate-800">"Según Consolidado"</strong> requieren confirmación de carga antes de las 16:00 hrs del día previo.
                  </span>
                </li>
                <li className="flex items-start gap-1">
                  <span>•</span>
                  <span>
                    Para consultas o modificaciones sobre esta programación, dirigirse directamente a la Jefatura de Logística y Operaciones.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Document Bottom Footer */}
          <div className="text-center pt-3 border-t border-slate-100 text-[10px] font-medium text-slate-400">
            Documento Oficial de Operaciones — Antko Soluciones en Agua | Todos los derechos reservados
          </div>
        </div>

        {/* Modal Bottom Footer Action */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0 no-print">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
