import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle, X, Calendar as CalendarIcon, Package } from 'lucide-react';
import { MergedDocument, LogisticsAssignment } from '../types';

interface VerifyRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeMap: Record<string, string>;
  hrSelectedRoute: string;
  hrSelectedDate: string;
  otherDateDocs: MergedDocument[];
  assignments: Record<string, LogisticsAssignment>;
  handleUpdateAssignment: (docId: string, field: keyof LogisticsAssignment, value: any) => Promise<void>;
}

export default function VerifyRouteModal({
  isOpen,
  onClose,
  routeMap,
  hrSelectedRoute,
  hrSelectedDate,
  otherDateDocs,
  assignments,
  handleUpdateAssignment,
}: VerifyRouteModalProps) {
  if (!isOpen) return null;

  const formatDocId = (tipo: string, id: string) => {
    if (id.startsWith(tipo + '-')) return id;
    return `${tipo}-${id}`;
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        id="verify-route-backdrop"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 40 }}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 z-10"
        id="verify-route-content"
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shadow-sm border border-amber-200">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-normal text-slate-900">Validación de Fecha: {routeMap[hrSelectedRoute]}</h2>
              <p className="text-[10px] text-slate-500 font-normal tracking-tight">Documentos programados en esta ruta para otros días</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-amber-100 rounded-full transition-colors text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-0 max-h-[400px] overflow-y-auto">
          {otherDateDocs.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-normal text-slate-500 uppercase tracking-widest border-b border-slate-200">
                <tr>
                  <th className="py-3 px-6">Documento</th>
                  <th className="py-3 px-6">Cliente</th>
                  <th className="py-3 px-6">Fecha Actual</th>
                  <th className="py-3 px-6 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {otherDateDocs.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className={`py-4 px-6 font-mono text-xs font-normal ${doc.tipo === 'OC' ? 'text-teal-600' : 'text-indigo-600'}`}>
                      {formatDocId(doc.tipo, doc.id)}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-700 font-normal truncate max-w-[200px]">{doc.razonSocial}</td>
                    <td className="py-4 px-6 text-xs font-normal text-amber-600">
                      {assignments[doc.id]?.dispatchDate ? new Date(assignments[doc.id].dispatchDate + 'T12:00:00').toLocaleDateString('es-CL') : '-'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button 
                        onClick={() => {
                          handleUpdateAssignment(doc.id, 'dispatchDate', hrSelectedDate);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-normal hover:bg-indigo-500 transition-all shadow-sm active:scale-95 flex items-center gap-2 ml-auto cursor-pointer"
                      >
                        <CalendarIcon className="w-3 h-3" />
                        Mover a {new Date(hrSelectedDate + 'T12:00:00').toLocaleDateString()}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-20 flex flex-col items-center justify-center text-slate-400 gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                <Package className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-sm font-normal">No hay otros documentos en esta ruta</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-xs font-normal text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cerrar Panel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
