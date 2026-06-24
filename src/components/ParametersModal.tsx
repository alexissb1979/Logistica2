import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, MapPin, Plus, Edit2, Trash2, User, Truck, Save } from 'lucide-react';
import { LogisticsRoute, LogisticsDriver, LogisticsVehicle, LogisticsAssignment } from '../types';
import { db } from '../firebase';
import { collection, addDoc, setDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const routesCol = collection(db, "routes");
const driversCol = collection(db, "drivers");
const vehiclesCol = collection(db, "vehicles");

interface ParametersModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: LogisticsRoute[];
  drivers: LogisticsDriver[];
  vehicles: LogisticsVehicle[];
  assignments: Record<string, LogisticsAssignment>;
  loading: boolean;
  setLoading: (val: boolean) => void;
  setSelectedRoutes: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export default function ParametersModal({
  isOpen,
  onClose,
  routes,
  drivers,
  vehicles,
  assignments,
  loading,
  setLoading,
  setSelectedRoutes,
}: ParametersModalProps) {
  const [paramsTab, setParamsTab] = useState<'routes' | 'drivers' | 'vehicles'>('routes');

  // Input states
  const [newRouteName, setNewRouteName] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newVehicleDesc, setNewVehicleDesc] = useState('');

  // Editing states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemValue, setEditingItemValue] = useState('');
  const [editingItemExtra, setEditingItemExtra] = useState('');

  if (!isOpen) return null;

  // Routes Handlers
  const handleAddRoute = async () => {
    if (!newRouteName.trim() || loading) return;
    try {
      setLoading(true);
      await addDoc(routesCol, {
        name: newRouteName.trim(),
        createdAt: serverTimestamp()
      });
      setNewRouteName('');
    } catch (error: any) {
      console.error("Error añadiendo ruta:", error);
      alert(`Error al añadir ruta: ${error.message || 'Sin permisos'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRouteName = async (id: string) => {
    const trimmedName = editingItemValue.trim();
    if (!trimmedName || trimmedName === routes.find(r => r.id === id)?.name) {
      setEditingItemId(null);
      return;
    }
    try {
      await setDoc(doc(routesCol, id), { name: trimmedName }, { merge: true });
      setEditingItemId(null);
    } catch (error: any) {
      console.error("Error al actualizar la ruta:", error);
      alert(`Error al actualizar nombre: ${error.message || 'Verifique sus permisos'}`);
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (loading) return;
    try {
      setLoading(true);
      const routeObj = routes.find(r => r.id === id);
      
      const assignedDocsCount = Object.values(assignments).filter(a => a.route === id).length;
      
      if (assignedDocsCount > 0) {
        alert(`No se puede eliminar la ruta "${routeObj?.name || id}": Existen ${assignedDocsCount} documentos asignados a esta ruta. Cambie la ruta de esos documentos antes de eliminarla.`);
        return;
      }

      if (!window.confirm(`¿Seguro que desea eliminar la ruta "${routeObj?.name || id}" permanentemente?`)) {
        return;
      }
      
      await deleteDoc(doc(routesCol, id));
      
      setSelectedRoutes(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error: any) {
      console.error("Error al eliminar ruta:", error);
      alert(`Error al eliminar la ruta: ${error.message || 'Error de permisos o conexión'}`);
    } finally {
      setLoading(false);
    }
  };

  // Drivers Handlers
  const handleAddDriver = async () => {
    if (!newDriverName.trim() || loading) return;
    try {
      setLoading(true);
      await addDoc(driversCol, { name: newDriverName.trim(), createdAt: serverTimestamp() });
      setNewDriverName('');
    } catch (error: any) { 
      alert(`Error: ${error.message}`); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleUpdateDriver = async (id: string, name: string) => {
    if (!name.trim()) return;
    try { 
      await setDoc(doc(driversCol, id), { name: name.trim() }, { merge: true }); 
      setEditingItemId(null); 
    } catch (e: any) { 
      alert(e.message); 
    }
  };

  const handleDeleteDriver = async (id: string) => {
    if (!window.confirm("¿Seguro que desea eliminar este conductor?")) return;
    try { 
      await deleteDoc(doc(driversCol, id)); 
    } catch (e: any) { 
      alert(e.message); 
    }
  };

  // Vehicles Handlers
  const handleAddVehicle = async () => {
    if (!newVehiclePlate.trim() || loading) return;
    try {
      setLoading(true);
      await addDoc(vehiclesCol, { plate: newVehiclePlate.trim(), description: newVehicleDesc, createdAt: serverTimestamp() });
      setNewVehiclePlate('');
      setNewVehicleDesc('');
    } catch (error: any) { 
      alert(`Error: ${error.message}`); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleUpdateVehicle = async (id: string, plate: string, desc: string) => {
    if (!plate.trim()) return;
    try { 
      await setDoc(doc(vehiclesCol, id), { plate: plate.trim(), description: desc }, { merge: true }); 
      setEditingItemId(null); 
    } catch (e: any) { 
      alert(e.message); 
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!window.confirm("¿Seguro que desea eliminar este vehículo?")) return;
    try { 
      await deleteDoc(doc(vehiclesCol, id)); 
    } catch (e: any) { 
      alert(e.message); 
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        id="parameters-backdrop"
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 z-10"
        id="parameters-modal-content"
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Configuración de Parámetros</h2>
            <p className="text-[10px] text-slate-500 font-medium tracking-tight">Gestiona tus rutas, conductores y vehículos</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 bg-white" id="parameters-tabs">
          <button 
            type="button"
            onClick={() => setParamsTab('routes')}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${paramsTab === 'routes' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
          >
            Rutas
          </button>
          <button 
            type="button"
            onClick={() => setParamsTab('drivers')}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${paramsTab === 'drivers' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
          >
            Conductores
          </button>
          <button 
            type="button"
            onClick={() => setParamsTab('vehicles')}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${paramsTab === 'vehicles' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
          >
            Vehículos
          </button>
        </div>

        <div className="p-6 max-h-[450px] overflow-y-auto">
          {paramsTab === 'routes' && (
            <div>
              <div className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                  placeholder="Nombre de la nueva ruta..."
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRoute()}
                />
                <button 
                  onClick={handleAddRoute}
                  disabled={loading}
                  className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-500 font-bold text-xs shadow-lg shadow-indigo-200/50 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir</span>
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {[...routes].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(r => (
                  <div key={r.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group">
                    {editingItemId === r.id ? (
                      <input 
                        autoFocus
                        className="flex-1 text-xs font-bold px-2 py-1 border border-indigo-300 rounded-lg focus:outline-none bg-indigo-50/30 font-sans"
                        value={editingItemValue}
                        onChange={(e) => setEditingItemValue(e.target.value)}
                        onBlur={() => handleUpdateRouteName(r.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateRouteName(r.id)}
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500"><MapPin className="w-4 h-4" /></div>
                        <span className="font-bold text-slate-700 text-xs">{r.name || 'Sin nombre'}</span>
                      </div>
                    )}
                    <div className="flex gap-1 ml-4 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingItemId(r.id); setEditingItemValue(r.name || ''); }} 
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar"
                      ><Edit2 className="w-3.5 h-3.5" /></button>
                      <button 
                        onClick={() => handleDeleteRoute(r.id)} 
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar"
                      ><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {paramsTab === 'drivers' && (
            <div>
              <div className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                  placeholder="Nombre del conductor..."
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDriver()}
                />
                <button 
                  onClick={handleAddDriver}
                  className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-500 font-bold text-xs shadow-lg shadow-indigo-200/50 flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir</span>
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {[...drivers].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(d => (
                  <div key={d.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group">
                    {editingItemId === d.id ? (
                      <input 
                        autoFocus
                        className="flex-1 text-xs font-bold px-2 py-1 border border-indigo-300 rounded-lg focus:outline-none bg-indigo-50/30-sans"
                        value={editingItemValue}
                        onChange={(e) => setEditingItemValue(e.target.value)}
                        onBlur={() => handleUpdateDriver(d.id, editingItemValue)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateDriver(d.id, editingItemValue)}
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500"><User className="w-4 h-4" /></div>
                        <span className="font-bold text-slate-700 text-xs">{d.name || 'Sin nombre'}</span>
                      </div>
                    )}
                    <div className="flex gap-1 ml-4 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingItemId(d.id); setEditingItemValue(d.name || ''); }} 
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar"
                      ><Edit2 className="w-3.5 h-3.5" /></button>
                      <button 
                        onClick={() => handleDeleteDriver(d.id)} 
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar"
                      ><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {paramsTab === 'vehicles' && (
            <div>
              <div className="grid grid-cols-2 gap-2 mb-6">
                <input 
                  type="text" 
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                  placeholder="Patente..."
                  value={newVehiclePlate}
                  onChange={(e) => setNewVehiclePlate(e.target.value)}
                />
                <input 
                  type="text" 
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                  placeholder="Descripción (opcional)..."
                  value={newVehicleDesc}
                  onChange={(e) => setNewVehicleDesc(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddVehicle()}
                />
                <button 
                  onClick={handleAddVehicle}
                  className="col-span-2 bg-indigo-600 text-white px-4 py-3 rounded-xl hover:bg-indigo-500 font-bold text-xs shadow-lg shadow-indigo-200/50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir Vehículo</span>
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {[...vehicles].sort((a,b) => (a.plate || '').localeCompare(b.plate || '')).map(v => (
                  <div key={v.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group">
                    {editingItemId === v.id ? (
                      <div className="flex-1 flex gap-2">
                        <input 
                          autoFocus
                          className="flex-1 text-xs font-bold px-2 py-1 border border-indigo-300 rounded-lg focus:outline-none bg-indigo-50/30"
                          value={editingItemValue}
                          onChange={(e) => setEditingItemValue(e.target.value)}
                        />
                        <input 
                          className="flex-1 text-xs font-medium px-2 py-1 border border-indigo-300 rounded-lg focus:outline-none bg-indigo-50/30"
                          value={editingItemExtra}
                          onChange={(e) => setEditingItemExtra(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleUpdateVehicle(v.id, editingItemValue, editingItemExtra)}
                        />
                        <button onClick={() => handleUpdateVehicle(v.id, editingItemValue, editingItemExtra)} className="p-1 text-emerald-600 cursor-pointer"><Save className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500"><Truck className="w-4 h-4" /></div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 text-xs">{v.plate}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{v.description || 'Sin descripción'}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-1 ml-4 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingItemId(v.id); setEditingItemValue(v.plate || ''); setEditingItemExtra(v.description || ''); }} 
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar"
                      ><Edit2 className="w-3.5 h-3.5" /></button>
                      <button 
                        onClick={() => handleDeleteVehicle(v.id)} 
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar"
                      ><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
