import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, MapPin, Plus, Edit2, Trash2, User, Truck, Save, Coins, Calendar as CalendarIcon } from 'lucide-react';
import { LogisticsRoute, LogisticsDriver, LogisticsVehicle, LogisticsAssignment } from '../types';
import { db } from '../firebase';
import { collection, addDoc, setDoc, doc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';

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
  fuelCosts?: Record<string, Record<string, Record<string, number>>>;
}

const MONTH_KEYS = [
  { key: '01', name: 'Ene' },
  { key: '02', name: 'Feb' },
  { key: '03', name: 'Mar' },
  { key: '04', name: 'Abr' },
  { key: '05', name: 'May' },
  { key: '06', name: 'Jun' },
  { key: '07', name: 'Jul' },
  { key: '08', name: 'Ago' },
  { key: '09', name: 'Sep' },
  { key: '10', name: 'Oct' },
  { key: '11', name: 'Nov' },
  { key: '12', name: 'Dic' },
];

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
  fuelCosts = {}
}: ParametersModalProps) {
  const [paramsTab, setParamsTab] = useState<'routes' | 'drivers' | 'vehicles' | 'fuelCosts'>('routes');

  // Fuel Cost States
  const [fuelYear, setFuelYear] = useState<string>(() => new Date().getFullYear().toString());
  const [fuelGrid, setFuelGrid] = useState<Record<string, Record<string, number>>>({});
  const [isSavingFuel, setIsSavingFuel] = useState(false);
  const [fuelSaveSuccess, setFuelSaveSuccess] = useState(false);

  // Sync fuelGrid from props or Firestore when year changes
  useEffect(() => {
    if (fuelCosts && fuelCosts[fuelYear]) {
      setFuelGrid(fuelCosts[fuelYear]);
    } else {
      setFuelGrid({});
    }
  }, [fuelYear, fuelCosts]);

  // Input states
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteGroup, setNewRouteGroup] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newVehicleDesc, setNewVehicleDesc] = useState('');
  const [newVehicleNominalKm, setNewVehicleNominalKm] = useState('');

  // Editing states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemValue, setEditingItemValue] = useState('');
  const [editingItemGroup, setEditingItemGroup] = useState('');
  const [editingItemExtra, setEditingItemExtra] = useState('');
  const [editingItemNominalKm, setEditingItemNominalKm] = useState('');

  // Unique list of existing route groups
  const existingRouteGroups = useMemo(() => {
    const groups = new Set<string>();
    routes.forEach(r => {
      if (r.group && r.group.trim()) {
        groups.add(r.group.trim());
      }
    });
    return Array.from(groups).sort();
  }, [routes]);

  if (!isOpen) return null;

  const handleFuelCellChange = (plate: string, monthKey: string, valStr: string) => {
    const val = Math.max(0, parseInt(valStr.replace(/\D/g, ''), 10) || 0);
    setFuelGrid(prev => ({
      ...prev,
      [plate]: {
        ...(prev[plate] || {}),
        [monthKey]: val
      }
    }));
  };

  const handleSaveFuelCosts = async () => {
    try {
      setIsSavingFuel(true);
      setFuelSaveSuccess(false);
      await setDoc(doc(db, "fuel_costs", fuelYear), {
        year: parseInt(fuelYear, 10),
        costs: fuelGrid,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setFuelSaveSuccess(true);
      setTimeout(() => setFuelSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error guardando costos de combustible:", err);
      alert(`Error al guardar costos de combustible: ${err.message || 'Sin permisos'}`);
    } finally {
      setIsSavingFuel(false);
    }
  };

  // Routes Handlers
  const handleAddRoute = async () => {
    if (!newRouteName.trim() || loading) return;
    try {
      setLoading(true);
      await addDoc(routesCol, {
        name: newRouteName.trim(),
        group: newRouteGroup.trim(),
        createdAt: serverTimestamp()
      });
      setNewRouteName('');
      setNewRouteGroup('');
    } catch (error: any) {
      console.error("Error añadiendo ruta:", error);
      alert(`Error al añadir ruta: ${error.message || 'Sin permisos'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRouteName = async (id: string) => {
    const trimmedName = editingItemValue.trim();
    const trimmedGroup = editingItemGroup.trim();
    if (!trimmedName) {
      setEditingItemId(null);
      return;
    }
    try {
      await setDoc(doc(routesCol, id), { 
        name: trimmedName,
        group: trimmedGroup
      }, { merge: true });
      setEditingItemId(null);
    } catch (error: any) {
      console.error("Error al actualizar la ruta:", error);
      alert(`Error al actualizar ruta: ${error.message || 'Verifique sus permisos'}`);
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
      const kmL = parseFloat(newVehicleNominalKm) || 0;
      await addDoc(vehiclesCol, { 
        plate: newVehiclePlate.trim(), 
        description: newVehicleDesc, 
        nominalKmPerLiter: kmL,
        createdAt: serverTimestamp() 
      });
      setNewVehiclePlate('');
      setNewVehicleDesc('');
      setNewVehicleNominalKm('');
    } catch (error: any) { 
      alert(`Error: ${error.message}`); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleUpdateVehicle = async (id: string, plate: string, desc: string, nominalKmStr: string) => {
    if (!plate.trim()) return;
    try { 
      const kmL = parseFloat(nominalKmStr) || 0;
      await setDoc(doc(vehiclesCol, id), { 
        plate: plate.trim(), 
        description: desc,
        nominalKmPerLiter: kmL 
      }, { merge: true }); 
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
        className={`relative w-full ${paramsTab === 'fuelCosts' ? 'max-w-5xl' : 'max-w-2xl'} bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 z-10 transition-all duration-300`}
        id="parameters-modal-content"
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Configuración de Parámetros</h2>
            <p className="text-[10px] text-slate-500 font-medium tracking-tight">Gestiona tus rutas, conductores, vehículos y costos de combustible</p>
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
          <button 
            type="button"
            onClick={() => setParamsTab('fuelCosts')}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${paramsTab === 'fuelCosts' ? 'border-amber-600 text-amber-600 bg-amber-50/30' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
          >
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span>Combustible</span>
          </button>
        </div>

        <div className="p-6 max-h-[450px] overflow-y-auto">
          {paramsTab === 'routes' && (
            <div>
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 mb-6 shadow-inner text-left">
                <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block mb-2">
                  Configuración de Rutas y Agrupador
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                      Nombre de la Ruta
                    </label>
                    <input 
                      type="text" 
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
                      placeholder="Ej: Retiro OC - 1, RM CENTRO SUR ( 1 )..."
                      value={newRouteName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewRouteName(val);
                        if (!newRouteGroup) {
                          let clean = val.replace(/\s*[\(-]?\s*\d+\s*[\)]?\s*$/g, '').trim();
                          const match = existingRouteGroups.find(g => g.toLowerCase() === clean.toLowerCase());
                          if (match) setNewRouteGroup(match);
                          else if (clean) setNewRouteGroup(clean);
                        }
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddRoute()}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                      Agrupador de Ruta
                    </label>
                    <input 
                      type="text" 
                      list="route-groups-list"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
                      placeholder="Ej: Retiros, RM Centro Sur..."
                      value={newRouteGroup}
                      onChange={(e) => setNewRouteGroup(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddRoute()}
                    />
                    <datalist id="route-groups-list">
                      {existingRouteGroups.map(grp => (
                        <option key={grp} value={grp} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {existingRouteGroups.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Seleccionar Agrupador Existente:</span>
                    {existingRouteGroups.map(grp => (
                      <button
                        key={grp}
                        type="button"
                        onClick={() => setNewRouteGroup(grp)}
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg border transition-all cursor-pointer ${
                          newRouteGroup === grp 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                            : 'bg-white text-indigo-700 border-indigo-200/80 hover:bg-indigo-50'
                        }`}
                      >
                        {grp}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex justify-end mt-3">
                  <button 
                    onClick={handleAddRoute}
                    disabled={loading || !newRouteName.trim()}
                    className="bg-indigo-600 text-white px-5 py-2 rounded-xl hover:bg-indigo-500 font-bold text-xs shadow-md shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Añadir Ruta</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {[...routes].sort((a,b) => {
                  const grpA = a.group || '';
                  const grpB = b.group || '';
                  if (grpA !== grpB) return grpA.localeCompare(grpB);
                  return (a.name || '').localeCompare(b.name || '');
                }).map(r => (
                  <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group">
                    {editingItemId === r.id ? (
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Nombre de la Ruta</label>
                          <input 
                            autoFocus
                            className="w-full text-xs font-bold px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-indigo-50/30"
                            value={editingItemValue}
                            onChange={(e) => setEditingItemValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateRouteName(r.id)}
                            placeholder="Nombre de la ruta..."
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Agrupador (Grupo)</label>
                          <input 
                            type="text"
                            list="route-groups-list"
                            className="w-full text-xs font-bold px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-indigo-50/30"
                            value={editingItemGroup}
                            onChange={(e) => setEditingItemGroup(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateRouteName(r.id)}
                            placeholder="Ej: Retiros, RM Centro Sur..."
                          />
                        </div>
                        <div className="sm:col-span-2 flex justify-end gap-2 mt-1">
                          <button 
                            onClick={() => setEditingItemId(null)}
                            className="px-3 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => handleUpdateRouteName(r.id)}
                            className="px-3.5 py-1 text-[11px] font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Guardar</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 min-w-0 text-left">
                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500 shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-800 text-xs truncate">{r.name || 'Sin nombre'}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {r.group ? (
                              <span className="inline-flex items-center text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                                Agrupador: {r.group}
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-400">
                                Sin Agrupador
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {editingItemId !== r.id && (
                      <div className="flex gap-1 ml-auto opacity-70 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { 
                            setEditingItemId(r.id); 
                            setEditingItemValue(r.name || ''); 
                            setEditingItemGroup(r.group || '');
                          }} 
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar Ruta y Agrupador"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteRoute(r.id)} 
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar Ruta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6">
                <input 
                  type="text" 
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                  placeholder="Patente (Ej: TTZH-93)..."
                  value={newVehiclePlate}
                  onChange={(e) => setNewVehiclePlate(e.target.value)}
                />
                <input 
                  type="text" 
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                  placeholder="Modelo / Marca (Ej: MAHINDRA)..."
                  value={newVehicleDesc}
                  onChange={(e) => setNewVehicleDesc(e.target.value)}
                />
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all shadow-inner font-mono"
                  placeholder="Rend. Nominal (km/L)..."
                  value={newVehicleNominalKm}
                  onChange={(e) => setNewVehicleNominalKm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddVehicle()}
                />
                <button 
                  onClick={handleAddVehicle}
                  className="sm:col-span-3 bg-indigo-600 text-white px-4 py-3 rounded-xl hover:bg-indigo-500 font-bold text-xs shadow-lg shadow-indigo-200/50 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir Vehículo con Rendimiento</span>
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {[...vehicles].sort((a,b) => (a.plate || '').localeCompare(b.plate || '')).map(v => (
                  <div key={v.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group">
                    {editingItemId === v.id ? (
                      <div className="flex-1 flex flex-col sm:flex-row gap-2">
                        <input 
                          autoFocus
                          placeholder="Patente"
                          className="w-full sm:w-28 text-xs font-bold px-2 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-indigo-50/30"
                          value={editingItemValue}
                          onChange={(e) => setEditingItemValue(e.target.value)}
                        />
                        <input 
                          placeholder="Modelo / Descripción"
                          className="flex-1 text-xs font-medium px-2 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-indigo-50/30"
                          value={editingItemExtra}
                          onChange={(e) => setEditingItemExtra(e.target.value)}
                        />
                        <input 
                          type="number"
                          step="0.1"
                          placeholder="Rend. km/L"
                          className="w-full sm:w-28 text-xs font-mono font-bold px-2 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-indigo-50/30"
                          value={editingItemNominalKm}
                          onChange={(e) => setEditingItemNominalKm(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleUpdateVehicle(v.id, editingItemValue, editingItemExtra, editingItemNominalKm)}
                        />
                        <button onClick={() => handleUpdateVehicle(v.id, editingItemValue, editingItemExtra, editingItemNominalKm)} className="p-2 bg-emerald-600 text-white rounded-lg cursor-pointer flex items-center justify-center gap-1 font-bold text-xs"><Save className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500 shrink-0"><Truck className="w-4 h-4" /></div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-xs font-mono">{v.plate}</span>
                            {v.nominalKmPerLiter !== undefined && v.nominalKmPerLiter > 0 ? (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">
                                {v.nominalKmPerLiter} km/L
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-mono">
                                Sin Rend.
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">{v.description || 'Sin modelo especificado'}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-1 ml-4 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { 
                          setEditingItemId(v.id); 
                          setEditingItemValue(v.plate || ''); 
                          setEditingItemExtra(v.description || ''); 
                          setEditingItemNominalKm(v.nominalKmPerLiter ? String(v.nominalKmPerLiter) : '');
                        }} 
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

          {paramsTab === 'fuelCosts' && (
            <div className="flex flex-col gap-4">
              {/* Year Selector & Save Control Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-700">Año de Registro:</span>
                  <select 
                    value={fuelYear} 
                    onChange={(e) => setFuelYear(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y.toString()}>{y}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  {fuelSaveSuccess && (
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 animate-fade-in">
                      ✓ Guardado exitoso
                    </span>
                  )}
                  <button
                    onClick={handleSaveFuelCosts}
                    disabled={isSavingFuel}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-amber-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingFuel ? 'Guardando...' : 'Guardar Costos ($)'}</span>
                  </button>
                </div>
              </div>

              {/* Tabular Fuel Costs Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200">
                    <tr className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                      <th className="p-2.5 min-w-[120px] bg-slate-100">Patente / Vehículo</th>
                      {MONTH_KEYS.map(m => (
                        <th key={m.key} className="p-2 text-center min-w-[65px]">{m.name}</th>
                      ))}
                      <th className="p-2.5 text-right min-w-[90px] bg-slate-100">Total ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...vehicles]
                      .sort((a,b) => (a.plate || '').localeCompare(b.plate || ''))
                      .map(v => {
                        const plate = v.plate;
                        const plateCosts = fuelGrid[plate] || {};
                        const rowTotal = MONTH_KEYS.reduce((sum, m) => sum + (plateCosts[m.key] || 0), 0);

                        return (
                          <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-2.5 font-bold text-slate-800 bg-slate-50/50">
                              <div className="flex flex-col">
                                <span className="font-mono text-xs">{v.plate}</span>
                                {v.description && <span className="text-[9px] text-slate-400 font-normal truncate max-w-[110px]">{v.description}</span>}
                              </div>
                            </td>

                            {MONTH_KEYS.map(m => {
                              const val = plateCosts[m.key] || 0;
                              return (
                                <td key={m.key} className="p-1 text-center">
                                  <input 
                                    type="text" 
                                    inputMode="numeric"
                                    value={val > 0 ? val.toLocaleString('es-CL') : ''}
                                    placeholder="0"
                                    onChange={(e) => handleFuelCellChange(plate, m.key, e.target.value)}
                                    className="w-full text-center text-[11px] font-mono font-bold py-1 px-1 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
                                  />
                                </td>
                              );
                            })}

                            <td className="p-2.5 text-right font-mono font-black text-amber-700 bg-slate-50/50">
                              ${rowTotal.toLocaleString('es-CL')}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
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
