import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, MapPin, Plus, Edit2, Trash2, User, Truck, Save, Coins, Calendar as CalendarIcon, Search } from 'lucide-react';
import { LogisticsRoute, LogisticsDriver, LogisticsVehicle, LogisticsAssignment } from '../types';
import { OFFICIAL_VEHICLES_SEED } from '../data/officialVehicles';
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

  // Vehicle Input states
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newVehicleDesc, setNewVehicleDesc] = useState('');
  const [newVehicleNominalKm, setNewVehicleNominalKm] = useState('');
  const [newVehicleYear, setNewVehicleYear] = useState('');
  const [newVehicleFuelType, setNewVehicleFuelType] = useState('Diésel');
  const [newVehicleLoadCapacity, setNewVehicleLoadCapacity] = useState('');
  const [newVehicleEngineNumber, setNewVehicleEngineNumber] = useState('');
  const [newVehicleChassisNumber, setNewVehicleChassisNumber] = useState('');
  const [newVehicleLastMaintenanceDate, setNewVehicleLastMaintenanceDate] = useState('');
  const [newVehicleTechnicalInspectionDate, setNewVehicleTechnicalInspectionDate] = useState('');
  const [newVehicleEmissionsInspectionDate, setNewVehicleEmissionsInspectionDate] = useState('');
  const [newVehicleBillingRut, setNewVehicleBillingRut] = useState('');

  // Editing states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemValue, setEditingItemValue] = useState('');
  const [editingItemGroup, setEditingItemGroup] = useState('');
  const [editingItemExtra, setEditingItemExtra] = useState('');
  const [editingItemNominalKm, setEditingItemNominalKm] = useState('');
  const [editingVehicleYear, setEditingVehicleYear] = useState('');
  const [editingVehicleFuelType, setEditingVehicleFuelType] = useState('Diésel');
  const [editingVehicleLoadCapacity, setEditingVehicleLoadCapacity] = useState('');
  const [editingVehicleEngineNumber, setEditingVehicleEngineNumber] = useState('');
  const [editingVehicleChassisNumber, setEditingVehicleChassisNumber] = useState('');
  const [editingVehicleLastMaintenanceDate, setEditingVehicleLastMaintenanceDate] = useState('');
  const [editingVehicleTechnicalInspectionDate, setEditingVehicleTechnicalInspectionDate] = useState('');
  const [editingVehicleEmissionsInspectionDate, setEditingVehicleEmissionsInspectionDate] = useState('');
  const [editingVehicleBillingRut, setEditingVehicleBillingRut] = useState('');

  // Search filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddVehicleForm, setShowAddVehicleForm] = useState(false);

  // Filtered lists based on search
  const filteredVehicles = useMemo(() => {
    if (!searchTerm.trim()) return vehicles;
    const term = searchTerm.toLowerCase().trim();
    return vehicles.filter(v => 
      (v.plate || '').toLowerCase().includes(term) ||
      (v.description || '').toLowerCase().includes(term) ||
      (v.fuelType || '').toLowerCase().includes(term) ||
      (v.billingRut || '').toLowerCase().includes(term) ||
      (v.engineNumber || '').toLowerCase().includes(term) ||
      (v.chassisNumber || '').toLowerCase().includes(term) ||
      (v.loadCapacity || '').toLowerCase().includes(term) ||
      String(v.year || '').includes(term)
    );
  }, [vehicles, searchTerm]);

  const filteredRoutes = useMemo(() => {
    if (!searchTerm.trim()) return routes;
    const term = searchTerm.toLowerCase().trim();
    return routes.filter(r => 
      (r.name || '').toLowerCase().includes(term) ||
      (r.group || '').toLowerCase().includes(term)
    );
  }, [routes, searchTerm]);

  const filteredDrivers = useMemo(() => {
    if (!searchTerm.trim()) return drivers;
    const term = searchTerm.toLowerCase().trim();
    return drivers.filter(d => 
      (d.name || '').toLowerCase().includes(term)
    );
  }, [drivers, searchTerm]);

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
        plate: newVehiclePlate.trim().toUpperCase(), 
        description: newVehicleDesc.trim(), 
        nominalKmPerLiter: kmL,
        year: newVehicleYear.trim(),
        fuelType: newVehicleFuelType.trim(),
        loadCapacity: newVehicleLoadCapacity.trim(),
        engineNumber: newVehicleEngineNumber.trim(),
        chassisNumber: newVehicleChassisNumber.trim(),
        lastMaintenanceDate: newVehicleLastMaintenanceDate,
        technicalInspectionDate: newVehicleTechnicalInspectionDate,
        emissionsInspectionDate: newVehicleEmissionsInspectionDate,
        billingRut: newVehicleBillingRut.trim(),
        createdAt: serverTimestamp() 
      });
      setNewVehiclePlate('');
      setNewVehicleDesc('');
      setNewVehicleNominalKm('');
      setNewVehicleYear('');
      setNewVehicleFuelType('Diésel');
      setNewVehicleLoadCapacity('');
      setNewVehicleEngineNumber('');
      setNewVehicleChassisNumber('');
      setNewVehicleLastMaintenanceDate('');
      setNewVehicleTechnicalInspectionDate('');
      setNewVehicleEmissionsInspectionDate('');
      setNewVehicleBillingRut('');
      setShowAddVehicleForm(false);
    } catch (error: any) { 
      alert(`Error: ${error.message}`); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleUpdateVehicle = async (id: string) => {
    if (!editingItemValue.trim()) return;
    try { 
      const kmL = parseFloat(editingItemNominalKm) || 0;
      await setDoc(doc(vehiclesCol, id), { 
        plate: editingItemValue.trim().toUpperCase(), 
        description: editingItemExtra.trim(),
        nominalKmPerLiter: kmL,
        year: editingVehicleYear.trim(),
        fuelType: editingVehicleFuelType.trim(),
        loadCapacity: editingVehicleLoadCapacity.trim(),
        engineNumber: editingVehicleEngineNumber.trim(),
        chassisNumber: editingVehicleChassisNumber.trim(),
        lastMaintenanceDate: editingVehicleLastMaintenanceDate,
        technicalInspectionDate: editingVehicleTechnicalInspectionDate,
        emissionsInspectionDate: editingVehicleEmissionsInspectionDate,
        billingRut: editingVehicleBillingRut.trim(),
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

  const handleSyncOfficialVehicles = async () => {
    try {
      setLoading(true);
      let updatedCount = 0;
      let addedCount = 0;

      for (const item of OFFICIAL_VEHICLES_SEED) {
        const existingVeh = vehicles.find(v => v.plate.trim().toUpperCase() === item.plate.trim().toUpperCase());
        if (existingVeh) {
          await setDoc(doc(vehiclesCol, existingVeh.id), {
            year: item.year,
            fuelType: item.fuelType,
            loadCapacity: item.loadCapacity,
            engineNumber: item.engineNumber,
            chassisNumber: item.chassisNumber,
            billingRut: item.billingRut
          }, { merge: true });
          updatedCount++;
        } else {
          await addDoc(vehiclesCol, {
            plate: item.plate,
            description: "Vehículo de Flota",
            nominalKmPerLiter: 10,
            year: item.year,
            fuelType: item.fuelType,
            loadCapacity: item.loadCapacity,
            engineNumber: item.engineNumber,
            chassisNumber: item.chassisNumber,
            billingRut: item.billingRut,
            createdAt: serverTimestamp()
          });
          addedCount++;
        }
      }
      alert(`Sincronización completada exitosamente.\nVehículos actualizados: ${updatedCount}\nVehículos nuevos creados: ${addedCount}`);
    } catch (e: any) {
      console.error("Error al sincronizar vehículos:", e);
      alert(`Error al guardar los vehículos en Firestore: ${e.message}`);
    } finally {
      setLoading(false);
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
        className={`relative w-full ${paramsTab === 'vehicles' || paramsTab === 'fuelCosts' ? 'max-w-6xl w-[95vw]' : 'max-w-2xl'} bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 z-10 transition-all duration-300`}
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

        {/* Buscador Superior */}
        <div className="px-6 py-3 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                paramsTab === 'vehicles' ? "Buscar vehículo por patente, modelo, RUT, motor, chasis, combustible..." :
                paramsTab === 'routes' ? "Buscar ruta por nombre o agrupador..." :
                paramsTab === 'drivers' ? "Buscar conductor por nombre..." :
                "Buscar vehículo por patente o modelo..."
              }
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-9 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none shadow-2xs transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {searchTerm && (
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-lg shrink-0 shadow-2xs">
              {paramsTab === 'vehicles' ? `${filteredVehicles.length} de ${vehicles.length}` :
               paramsTab === 'routes' ? `${filteredRoutes.length} de ${routes.length}` :
               paramsTab === 'drivers' ? `${filteredDrivers.length} de ${drivers.length}` :
               `${filteredVehicles.length} de ${vehicles.length}`}
            </span>
          )}
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
                {filteredRoutes.length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-xs font-semibold bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    No se encontraron rutas que coincidan con "{searchTerm}".
                  </div>
                )}
                {[...filteredRoutes].sort((a,b) => {
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
                {filteredDrivers.length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-xs font-semibold bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    No se encontraron conductores que coincidan con "{searchTerm}".
                  </div>
                )}
                {[...filteredDrivers].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(d => (
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
            <div className="flex flex-col gap-6 text-left">
              {/* Sync Official Vehicles Action Card & Add Vehicle Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl p-4 shadow-md flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-indigo-800/40">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="w-4 h-4 text-amber-400" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-white">Catálogo Oficial de Flota (17 Vehículos)</h3>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Carga o actualiza masivamente el Año, Combustible, Capacidad de carga, N° Motor y N° Chasis para las patentes oficiales.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncOfficialVehicles}
                    disabled={loading}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black shadow-md transition-all shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Cargar / Sincronizar Catálogo</span>
                  </button>
                </div>

                {!showAddVehicleForm && (
                  <button
                    type="button"
                    onClick={() => setShowAddVehicleForm(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 sm:py-2.5 rounded-2xl font-bold text-xs shadow-md shadow-indigo-200/50 flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer active:scale-95 border border-indigo-500"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nuevo Vehículo</span>
                  </button>
                )}
              </div>

              {/* Formulario Nuevo Vehículo (Desplegable) */}
              {showAddVehicleForm && (
                <div className="bg-slate-50/90 border border-indigo-200/80 rounded-2xl p-4 shadow-inner">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block">
                      Añadir Nuevo Vehículo
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddVehicleForm(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                      title="Cerrar formulario"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        Patente <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase"
                        placeholder="Ej: TTZH-93"
                        value={newVehiclePlate}
                        onChange={(e) => setNewVehiclePlate(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        Modelo / Marca
                      </label>
                      <input 
                        type="text" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Ej: MAHINDRA HAWK 2.2"
                        value={newVehicleDesc}
                        onChange={(e) => setNewVehicleDesc(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        Rend. Nominal (km/L)
                      </label>
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Ej: 10.5"
                        value={newVehicleNominalKm}
                        onChange={(e) => setNewVehicleNominalKm(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        Año
                      </label>
                      <input 
                        type="number" 
                        placeholder="Ej: 2022"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={newVehicleYear}
                        onChange={(e) => setNewVehicleYear(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        Combustible
                      </label>
                      <select 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                        value={newVehicleFuelType}
                        onChange={(e) => setNewVehicleFuelType(e.target.value)}
                      >
                        <option value="Diésel">Diésel</option>
                        <option value="Bencina 93">Bencina 93</option>
                        <option value="Bencina 95">Bencina 95</option>
                        <option value="Bencina 97">Bencina 97</option>
                        <option value="Gas / GLP">Gas / GLP</option>
                        <option value="Eléctrico">Eléctrico</option>
                        <option value="Híbrido">Híbrido</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        Capacidad de Carga
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ej: 1.5 Ton / 1500 kg"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={newVehicleLoadCapacity}
                        onChange={(e) => setNewVehicleLoadCapacity(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        N° Motor
                      </label>
                      <input 
                        type="text" 
                        placeholder="N° de Motor"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={newVehicleEngineNumber}
                        onChange={(e) => setNewVehicleEngineNumber(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        N° Chasis
                      </label>
                      <input 
                        type="text" 
                        placeholder="N° de Chasis / VIN"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={newVehicleChassisNumber}
                        onChange={(e) => setNewVehicleChassisNumber(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        RUT Facturación
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ej: 76.123.456-7"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={newVehicleBillingRut}
                        onChange={(e) => setNewVehicleBillingRut(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        Próxima Mantención (KM)
                      </label>
                      <input 
                        type="number" 
                        placeholder="Ej: 150000"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={newVehicleLastMaintenanceDate}
                        onChange={(e) => setNewVehicleLastMaintenanceDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        Fecha Revisión Técnica
                      </label>
                      <input 
                        type="date" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={newVehicleTechnicalInspectionDate}
                        onChange={(e) => setNewVehicleTechnicalInspectionDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                        Fecha Gases
                      </label>
                      <input 
                        type="date" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={newVehicleEmissionsInspectionDate}
                        onChange={(e) => setNewVehicleEmissionsInspectionDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end items-center gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddVehicleForm(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleAddVehicle}
                      disabled={loading || !newVehiclePlate.trim()}
                      className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-500 font-bold text-xs shadow-md shadow-indigo-200 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Guardar Nuevo Vehículo</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de Vehículos Existentes en formato Tabular */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-sm bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-[9.5px] font-black uppercase text-slate-500 tracking-tight">
                      <th className="py-2.5 px-2">Patente</th>
                      <th className="py-2.5 px-2">Modelo / Marca</th>
                      <th className="py-2.5 px-1 text-center">Año</th>
                      <th className="py-2.5 px-2">Combustible</th>
                      <th className="py-2.5 px-2 text-right">Rend.</th>
                      <th className="py-2.5 px-2">Cap. Carga</th>
                      <th className="py-2.5 px-2">RUT Fact.</th>
                      <th className="py-2.5 px-2">N° Motor</th>
                      <th className="py-2.5 px-2">N° Chasis</th>
                      <th className="py-2.5 px-2">Próx. Mant.</th>
                      <th className="py-2.5 px-2">Rev. Téc. / Gases</th>
                      <th className="py-2.5 px-1.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {filteredVehicles.length === 0 && (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-slate-400 text-xs font-semibold bg-slate-50/50">
                          {searchTerm ? `No se encontraron vehículos que coincidan con "${searchTerm}".` : 'No hay vehículos registrados.'}
                        </td>
                      </tr>
                    )}
                    {[...filteredVehicles]
                      .sort((a,b) => (a.plate || '').localeCompare(b.plate || ''))
                      .map(v => {
                        if (editingItemId === v.id) {
                          return (
                            <tr key={v.id} className="bg-indigo-50/60 border-y-2 border-indigo-200">
                              <td colSpan={12} className="p-4">
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">
                                      Editando Vehículo: <span className="font-mono text-xs">{v.plate}</span>
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                    <div>
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-0.5">Patente</label>
                                      <input 
                                        type="text"
                                        className="w-full text-xs font-bold font-mono px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-white uppercase"
                                        value={editingItemValue}
                                        onChange={(e) => setEditingItemValue(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-0.5">Modelo / Marca</label>
                                      <input 
                                        type="text"
                                        className="w-full text-xs font-medium px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-white"
                                        value={editingItemExtra}
                                        onChange={(e) => setEditingItemExtra(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-0.5">Rend. (km/L)</label>
                                      <input 
                                        type="number"
                                        step="0.1"
                                        className="w-full text-xs font-mono font-bold px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-white"
                                        value={editingItemNominalKm}
                                        onChange={(e) => setEditingItemNominalKm(e.target.value)}
                                      />
                                    </div>

                                    <div>
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-0.5">Año</label>
                                      <input 
                                        type="number"
                                        className="w-full text-xs font-mono font-bold px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-white"
                                        value={editingVehicleYear}
                                        onChange={(e) => setEditingVehicleYear(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-0.5">Combustible</label>
                                      <select 
                                        className="w-full text-xs font-bold px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-white cursor-pointer"
                                        value={editingVehicleFuelType}
                                        onChange={(e) => setEditingVehicleFuelType(e.target.value)}
                                      >
                                        <option value="Diésel">Diésel</option>
                                        <option value="Bencina 93">Bencina 93</option>
                                        <option value="Bencina 95">Bencina 95</option>
                                        <option value="Bencina 97">Bencina 97</option>
                                        <option value="Gas / GLP">Gas / GLP</option>
                                        <option value="Eléctrico">Eléctrico</option>
                                        <option value="Híbrido">Híbrido</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-0.5">Capacidad Carga</label>
                                      <input 
                                        type="text"
                                        className="w-full text-xs font-bold px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-white"
                                        value={editingVehicleLoadCapacity}
                                        onChange={(e) => setEditingVehicleLoadCapacity(e.target.value)}
                                      />
                                    </div>

                                    <div>
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-0.5">N° Motor</label>
                                      <input 
                                        type="text"
                                        className="w-full text-xs font-mono font-bold px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-white"
                                        value={editingVehicleEngineNumber}
                                        onChange={(e) => setEditingVehicleEngineNumber(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-0.5">N° Chasis</label>
                                      <input 
                                        type="text"
                                        className="w-full text-xs font-mono font-bold px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-white"
                                        value={editingVehicleChassisNumber}
                                        onChange={(e) => setEditingVehicleChassisNumber(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-0.5">RUT Facturación</label>
                                      <input 
                                        type="text"
                                        className="w-full text-xs font-mono font-bold px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-white"
                                        value={editingVehicleBillingRut}
                                        onChange={(e) => setEditingVehicleBillingRut(e.target.value)}
                                      />
                                    </div>

                                    <div>
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-0.5">Próx. Mantención (KM)</label>
                                      <input 
                                        type="number"
                                        placeholder="Ej: 150000"
                                        className="w-full text-xs font-mono font-bold px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-white"
                                        value={editingVehicleLastMaintenanceDate}
                                        onChange={(e) => setEditingVehicleLastMaintenanceDate(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-0.5">Revisión Técnica</label>
                                      <input 
                                        type="date"
                                        className="w-full text-xs font-bold px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-white"
                                        value={editingVehicleTechnicalInspectionDate}
                                        onChange={(e) => setEditingVehicleTechnicalInspectionDate(e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase block mb-0.5">Fecha Gases</label>
                                      <input 
                                        type="date"
                                        className="w-full text-xs font-bold px-2.5 py-1.5 border border-indigo-300 rounded-lg focus:outline-none bg-white"
                                        value={editingVehicleEmissionsInspectionDate}
                                        onChange={(e) => setEditingVehicleEmissionsInspectionDate(e.target.value)}
                                      />
                                    </div>
                                  </div>

                                  <div className="flex justify-end gap-2 mt-2">
                                    <button 
                                      type="button"
                                      onClick={() => setEditingItemId(null)}
                                      className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleUpdateVehicle(v.id)}
                                      className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                                    >
                                      <Save className="w-4 h-4" />
                                      <span>Guardar Cambios</span>
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-2 whitespace-nowrap">
                              <span className="font-mono font-black text-slate-900 bg-amber-100/80 text-amber-950 px-1.5 py-0.5 rounded border border-amber-200/80 text-[11px]">
                                {v.plate}
                              </span>
                            </td>
                            <td className="py-2 px-2 font-semibold text-slate-800 whitespace-nowrap max-w-[120px] truncate" title={v.description}>
                              {v.description || <span className="text-slate-300 font-normal">-</span>}
                            </td>
                            <td className="py-2 px-1 text-center font-mono font-bold text-slate-600 whitespace-nowrap">
                              {v.year ? (
                                <span className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-[10px]">
                                  {v.year}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-normal">-</span>
                              )}
                            </td>
                            <td className="py-2 px-2 font-medium text-slate-700 whitespace-nowrap text-[11px]">
                              {v.fuelType || <span className="text-slate-300 font-normal">-</span>}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-black text-emerald-700 whitespace-nowrap text-[11px]">
                              {v.nominalKmPerLiter && v.nominalKmPerLiter > 0 ? (
                                <span>{v.nominalKmPerLiter} <span className="text-[9.5px] font-normal text-emerald-600">km/L</span></span>
                              ) : (
                                <span className="text-slate-300 font-normal">-</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-slate-700 whitespace-nowrap text-[11px]">
                              {v.loadCapacity || <span className="text-slate-300 font-normal">-</span>}
                            </td>
                            <td className="py-2 px-2 font-mono text-slate-700 text-[10.5px] whitespace-nowrap">
                              {v.billingRut || <span className="text-slate-300 font-normal">-</span>}
                            </td>
                            <td className="py-2 px-2 font-mono text-slate-600 text-[10.5px] whitespace-nowrap max-w-[90px] truncate" title={v.engineNumber}>
                              {v.engineNumber || <span className="text-slate-300 font-normal">-</span>}
                            </td>
                            <td className="py-2 px-2 font-mono text-slate-600 text-[10.5px] whitespace-nowrap max-w-[90px] truncate" title={v.chassisNumber}>
                              {v.chassisNumber || <span className="text-slate-300 font-normal">-</span>}
                            </td>
                            <td className="py-2 px-2 font-mono font-bold text-slate-700 whitespace-nowrap text-[10.5px]">
                              {v.lastMaintenanceDate ? (
                                !isNaN(Number(v.lastMaintenanceDate)) && v.lastMaintenanceDate !== '' ? (
                                  `${Number(v.lastMaintenanceDate).toLocaleString('es-CL')} KM`
                                ) : (
                                  v.lastMaintenanceDate
                                )
                              ) : (
                                <span className="text-slate-300 font-normal">-</span>
                              )}
                            </td>
                            <td className="py-2 px-2 font-mono text-[9.5px] text-slate-600 whitespace-nowrap leading-tight">
                              <div><span className="text-slate-400 font-semibold">RT:</span> {v.technicalInspectionDate ? new Date(v.technicalInspectionDate + 'T12:00:00').toLocaleDateString('es-CL') : '-'}</div>
                              <div><span className="text-slate-400 font-semibold">Gas:</span> {v.emissionsInspectionDate ? new Date(v.emissionsInspectionDate + 'T12:00:00').toLocaleDateString('es-CL') : '-'}</div>
                            </td>
                            <td className="py-2 px-1.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-0.5">
                                <button 
                                  onClick={() => { 
                                    setEditingItemId(v.id); 
                                    setEditingItemValue(v.plate || ''); 
                                    setEditingItemExtra(v.description || ''); 
                                    setEditingItemNominalKm(v.nominalKmPerLiter ? String(v.nominalKmPerLiter) : '');
                                    setEditingVehicleYear(v.year ? String(v.year) : '');
                                    setEditingVehicleFuelType(v.fuelType || 'Diésel');
                                    setEditingVehicleLoadCapacity(v.loadCapacity || '');
                                    setEditingVehicleEngineNumber(v.engineNumber || '');
                                    setEditingVehicleChassisNumber(v.chassisNumber || '');
                                    setEditingVehicleLastMaintenanceDate(v.lastMaintenanceDate || '');
                                    setEditingVehicleTechnicalInspectionDate(v.technicalInspectionDate || '');
                                    setEditingVehicleEmissionsInspectionDate(v.emissionsInspectionDate || '');
                                    setEditingVehicleBillingRut(v.billingRut || '');
                                  }} 
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  title="Editar Vehículo"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteVehicle(v.id)} 
                                  className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar Vehículo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
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
                    {[...filteredVehicles]
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
