import React, { useState, useEffect } from 'react';
import { 
  X, UserPlus, Shield, Trash2, Edit2, Check, AlertCircle, Loader, Lock, 
  MapPin, Calendar, ClipboardList, Settings, UploadCloud, Users, List, Truck
} from 'lucide-react';
import { 
  getDocs, doc, setDoc, updateDoc, deleteDoc, onSnapshot 
} from 'firebase/firestore';
import { userProfilesCol, createSecondaryAuthUser } from '../firebase';
import { UserProfile } from '../types';

interface UserManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfile | null;
}

export default function UserManagerModal({
  isOpen,
  onClose,
  currentUserProfile,
}: UserManagerModalProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State for creating/editing user
  const [isEditing, setIsEditing] = useState(false);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // Only used for creation
  const [role, setRole] = useState<'ADMIN' | 'OPERATOR' | 'VIEWER'>('OPERATOR');
  
  // Custom permissions state
  const [permissions, setPermissions] = useState({
    canEditPlanning: true,
    canViewPlanning: true,
    canUploadExcel: true,
    canViewRouteSheets: true,
    canViewResumenRutas: true,
    canViewKPIs: true,
    canEditManifests: true,
    canEditParameters: false,
    canManageUsers: false,
  });

  // Load all user profiles
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const unsub = onSnapshot(userProfilesCol, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as UserProfile;
        const isAtLeastOperator = data.role === 'ADMIN' || data.role === 'OPERATOR';
        
        list.push({ 
          uid: doc.id, 
          ...data,
          permissions: {
            canViewPlanning: data.permissions?.canViewPlanning ?? true,
            canViewRouteSheets: data.permissions?.canViewRouteSheets ?? true,
            canViewResumenRutas: data.permissions?.canViewResumenRutas ?? true,
            canViewKPIs: data.permissions?.canViewKPIs ?? true,
            canEditPlanning: data.permissions?.canEditPlanning ?? isAtLeastOperator,
            canUploadExcel: data.permissions?.canUploadExcel ?? isAtLeastOperator,
            canEditManifests: data.permissions?.canEditManifests ?? isAtLeastOperator,
            canEditParameters: data.permissions?.canEditParameters ?? (data.role === 'ADMIN'),
            canManageUsers: data.permissions?.canManageUsers ?? (data.role === 'ADMIN'),
            ...data.permissions
          }
        } as UserProfile);
      });
      // Sort by email
      list.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.error("Error loading user profiles:", err);
      setErrorMsg("Error al cargar los perfiles de usuario.");
      setLoading(false);
    });

    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Role preset changes to make user creation easy
  const handleRoleChange = (newRole: 'ADMIN' | 'OPERATOR' | 'VIEWER') => {
    setRole(newRole);
    if (newRole === 'ADMIN') {
      setPermissions({
        canEditPlanning: true,
        canViewPlanning: true,
        canUploadExcel: true,
        canViewRouteSheets: true,
        canViewResumenRutas: true,
        canViewKPIs: true,
        canEditManifests: true,
        canEditParameters: true,
        canManageUsers: true,
      });
    } else if (newRole === 'OPERATOR') {
      setPermissions({
        canEditPlanning: true,
        canViewPlanning: true,
        canUploadExcel: true,
        canViewRouteSheets: true,
        canViewResumenRutas: true,
        canViewKPIs: true,
        canEditManifests: true,
        canEditParameters: false,
        canManageUsers: false,
      });
    } else {
      // VIEWER preset
      setPermissions({
        canEditPlanning: false,
        canViewPlanning: true,
        canUploadExcel: false,
        canViewRouteSheets: true,
        canViewResumenRutas: true,
        canViewKPIs: true,
        canEditManifests: false,
        canEditParameters: false,
        canManageUsers: false,
      });
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingUid(null);
    setDisplayName('');
    setEmail('');
    setPassword('');
    setRole('OPERATOR');
    setPermissions({
      canEditPlanning: true,
      canViewPlanning: true,
      canUploadExcel: true,
      canViewRouteSheets: true,
      canViewResumenRutas: true,
      canViewKPIs: true,
      canEditManifests: true,
      canEditParameters: false,
      canManageUsers: false,
    });
    setErrorMsg(null);
  };

  const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!displayName.trim() || !email.trim()) {
      setErrorMsg("Nombre y correo electrónico son obligatorios.");
      return;
    }

    setActionLoading(true);
    try {
      if (isEditing && editingUid) {
        // Just update firestore profile
        const userRef = doc(userProfilesCol, editingUid);
        await updateDoc(userRef, {
          displayName,
          role,
          permissions,
        });
        setSuccessMsg(`Usuario "${displayName}" actualizado correctamente.`);
        resetForm();
      } else {
        // Creating a new user
        if (!password || password.length < 6) {
          setErrorMsg("La contraseña debe tener al menos 6 caracteres.");
          setActionLoading(false);
          return;
        }

        // Use our secondary auth registration helper
        const newUserUid = await createSecondaryAuthUser(email.trim(), password);

        // Save profile in Firestore
        const profileRef = doc(userProfilesCol, newUserUid);
        const newProfile: UserProfile = {
          uid: newUserUid,
          email: email.trim().toLowerCase(),
          displayName: displayName.trim(),
          role,
          permissions,
          createdAt: new Date().toISOString(),
        };

        await setDoc(profileRef, newProfile);
        setSuccessMsg(`Usuario "${displayName}" creado y registrado con éxito.`);
        resetForm();
      }
    } catch (err: any) {
      console.error("Error creating/updating user:", err);
      let errMsg = "Ocurrió un error al procesar el usuario.";
      if (err.code === 'auth/email-already-in-use') {
        errMsg = "Este correo electrónico ya está registrado en Firebase Auth.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setErrorMsg(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditClick = (u: UserProfile) => {
    setIsEditing(true);
    setEditingUid(u.uid);
    setDisplayName(u.displayName || '');
    setEmail(u.email || '');
    setRole(u.role || 'OPERATOR');
    setPermissions({ ...u.permissions });
    setPassword(''); // No password change here
  };

  const handleDeleteUser = async (uid: string, name: string) => {
    if (uid === currentUserProfile?.uid) {
      alert("No puedes eliminar tu propio usuario actual.");
      return;
    }
    if (!confirm(`¿Está seguro que desea eliminar el acceso de "${name}"? El perfil será borrado, bloqueando su acceso de inmediato.`)) {
      return;
    }

    setActionLoading(true);
    try {
      await deleteDoc(doc(userProfilesCol, uid));
      setSuccessMsg(`Perfil de "${name}" eliminado de la base de datos.`);
    } catch (err: any) {
      console.error("Error deleting user profile:", err);
      setErrorMsg("No se pudo eliminar el perfil de usuario: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/15">
              <Users className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest leading-none">Control de Accesos</h2>
              <p className="text-[10px] text-slate-400 font-medium">Gestión de usuarios específicos, roles y permisos de la plataforma</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 bg-emerald-100 rounded-full p-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Area split in two panels */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Panel 1: Creation / Editing Form */}
          <div className="w-96 border-r border-slate-150 p-6 overflow-y-auto bg-slate-50/50 flex flex-col">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-200 pb-2 shrink-0">
              {isEditing ? (
                <>
                  <Edit2 className="w-4 h-4 text-amber-500" />
                  <span>Editar Permisos</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 text-indigo-500" />
                  <span>Registrar Nuevo Usuario</span>
                </>
              )}
            </h3>

            <form onSubmit={handleCreateOrUpdateUser} className="flex-1 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nombre Completo</label>
                <input 
                  type="text"
                  required
                  placeholder="Ej: Alexis Sepúlveda"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-white border border-slate-250 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Correo Electrónico</label>
                <input 
                  type="email"
                  required
                  disabled={isEditing}
                  placeholder="usuario@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`bg-white border rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all shadow-inner ${isEditing ? 'opacity-50 bg-slate-100 cursor-not-allowed border-slate-200 text-slate-400' : 'border-slate-250'}`}
                />
              </div>

              {!isEditing && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contraseña de Acceso</label>
                    <span className="text-[8px] text-indigo-500 font-bold uppercase">Mín. 6 Caract.</span>
                  </div>
                  <input 
                    type="password"
                    required
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white border border-slate-250 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-4 focus:ring-indigo-500/10 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rol General (Pre-configuración)</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                  {(['ADMIN', 'OPERATOR', 'VIEWER'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleChange(r)}
                      className={`text-[9px] font-bold uppercase py-1 rounded transition-all cursor-pointer ${role === r ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {r === 'ADMIN' ? 'Admin' : r === 'OPERATOR' ? 'Operador' : 'Visor'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific permissions */}
              <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5 mt-1 shadow-inner flex-1 overflow-y-auto">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5 mb-1.5 block">Permisos Específicos</span>
                
                <label className="flex items-start gap-2.5 cursor-pointer py-1 select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canViewPlanning}
                    onChange={(e) => setPermissions({ ...permissions, canViewPlanning: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 leading-tight flex items-center gap-1"><List className="w-3 h-3 text-indigo-500" /> Ver Planificación</span>
                    <span className="text-[9px] text-slate-400 font-medium">Permite ver el panel principal de planificación</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer py-1 select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canEditPlanning}
                    onChange={(e) => setPermissions({ ...permissions, canEditPlanning: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 leading-tight flex items-center gap-1"><MapPin className="w-3 h-3 text-indigo-500" /> Editar Planificación</span>
                    <span className="text-[9px] text-slate-400 font-medium">Asignar rutas y fechas de entrega a documentos</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer py-1 select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canUploadExcel}
                    onChange={(e) => setPermissions({ ...permissions, canUploadExcel: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 leading-tight flex items-center gap-1"><UploadCloud className="w-3 h-3 text-indigo-500" /> Carga de Planillas</span>
                    <span className="text-[9px] text-slate-400 font-medium">Capacidad de subir archivos Excel (NV, OC)</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer py-1 select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canViewRouteSheets}
                    onChange={(e) => setPermissions({ ...permissions, canViewRouteSheets: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 leading-tight flex items-center gap-1"><ClipboardList className="w-3 h-3 text-indigo-500" /> Ver Hojas de Ruta</span>
                    <span className="text-[9px] text-slate-400 font-medium">Visualizar resúmenes de Hojas de Ruta</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer py-1 select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canViewResumenRutas}
                    onChange={(e) => setPermissions({ ...permissions, canViewResumenRutas: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 leading-tight flex items-center gap-1"><Truck className="w-3 h-3 text-indigo-500" /> Ver Resumen Rutas</span>
                    <span className="text-[9px] text-slate-400 font-medium">Visualizar panel de Resumen de Rutas ejecutadas</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer py-1 select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canViewKPIs}
                    onChange={(e) => setPermissions({ ...permissions, canViewKPIs: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 leading-tight flex items-center gap-1"><Shield className="w-3 h-3 text-indigo-500" /> Ver KPIs y Análisis</span>
                    <span className="text-[9px] text-slate-400 font-medium">Visualizar panel de estadísticas y gráficos Recharts</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer py-1 select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canEditManifests}
                    onChange={(e) => setPermissions({ ...permissions, canEditManifests: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 leading-tight flex items-center gap-1"><Lock className="w-3 h-3 text-indigo-500" /> Modificar Entregas</span>
                    <span className="text-[9px] text-slate-400 font-medium">Registrar horarios, KMS, puntos pendientes y bloquear</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer py-1 select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canEditParameters}
                    onChange={(e) => setPermissions({ ...permissions, canEditParameters: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 leading-tight flex items-center gap-1"><Settings className="w-3 h-3 text-indigo-500" /> Configurar Parámetros</span>
                    <span className="text-[9px] text-slate-400 font-medium">Añadir/quitar choferes, vehículos y rutas</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer py-1 select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canManageUsers}
                    onChange={(e) => setPermissions({ ...permissions, canManageUsers: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 leading-tight flex items-center gap-1"><Users className="w-3 h-3 text-indigo-500" /> Administrar Usuarios</span>
                    <span className="text-[9px] text-slate-400 font-medium">Acceso para gestionar y crear nuevos accesos</span>
                  </div>
                </label>
              </div>

              <div className="flex gap-2 mt-auto pt-2 shrink-0">
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white rounded-lg py-2 text-xs font-bold shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {actionLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : isEditing ? (
                    'Guardar Cambios'
                  ) : (
                    'Registrar Usuario'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Panel 2: Users Directory List */}
          <div className="flex-1 p-6 flex flex-col min-h-0 bg-white">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-1.5 border-b border-slate-150 pb-2 shrink-0">
              <span>Directorio de Usuarios Registrados</span>
              <span className="px-2 py-0.5 bg-slate-100 text-[10px] rounded-full text-slate-500 font-bold">{users.length}</span>
            </h3>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Loader className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                <p className="text-xs">Cargando directorio de usuarios...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl shadow-inner scrollbar-thin">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-250 sticky top-0 z-10">
                    <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-4 py-3 leading-tight">Nombre / Correo</th>
                      <th className="px-4 py-3 leading-tight">Rol</th>
                      <th className="px-4 py-3 leading-tight">Permisos Asignados</th>
                      <th className="px-4 py-3 leading-tight text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {users.map((u) => {
                      const isMe = u.uid === currentUserProfile?.uid;
                      const activePermsCount = Object.values(u.permissions).filter(Boolean).length;
                      
                      return (
                        <tr key={u.uid} className={`hover:bg-slate-55/40 transition-colors ${isMe ? 'bg-indigo-50/20' : ''}`}>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-700 flex items-center gap-1">
                                {u.displayName}
                                {isMe && <span className="px-1.5 py-0.1 bg-indigo-100 text-indigo-700 rounded text-[8px] font-bold">TÚ</span>}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono font-medium">{u.email}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                              u.role === 'ADMIN' 
                                ? 'bg-red-50 text-red-700 border border-red-200' 
                                : u.role === 'OPERATOR' 
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                                : 'bg-slate-50 text-slate-600 border border-slate-200'
                            }`}>
                              {u.role === 'ADMIN' ? 'ADMIN' : u.role === 'OPERATOR' ? 'OPERADOR' : 'VISOR'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1 max-w-sm">
                              {u.permissions.canViewPlanning && (
                                <span className="px-1 bg-slate-100 text-slate-600 text-[8px] font-bold rounded uppercase tracking-wider" title="Ver Planificación">Planif.</span>
                              )}
                              {u.permissions.canEditPlanning && (
                                <span className="px-1 bg-slate-100 text-slate-600 text-[8px] font-bold rounded uppercase tracking-wider" title="Asignar rutas/fechas">Rutas</span>
                              )}
                              {u.permissions.canUploadExcel && (
                                <span className="px-1 bg-slate-100 text-slate-600 text-[8px] font-bold rounded uppercase tracking-wider" title="Subir Excels">Excels</span>
                              )}
                              {u.permissions.canViewRouteSheets && (
                                <span className="px-1 bg-slate-100 text-slate-600 text-[8px] font-bold rounded uppercase tracking-wider" title="Ver resúmenes despachos">Reportes</span>
                              )}
                              {u.permissions.canViewResumenRutas && (
                                <span className="px-1 bg-slate-100 text-slate-600 text-[8px] font-bold rounded uppercase tracking-wider" title="Ver Resumen Rutas">Resumen</span>
                              )}
                              {u.permissions.canViewKPIs && (
                                <span className="px-1 bg-slate-100 text-slate-600 text-[8px] font-bold rounded uppercase tracking-wider" title="Ver KPIs y Análisis">KPIs</span>
                              )}
                              {u.permissions.canEditManifests && (
                                <span className="px-1 bg-slate-100 text-slate-600 text-[8px] font-bold rounded uppercase tracking-wider" title="Ingresar horarios, KMs, etc.">Entregas</span>
                              )}
                              {u.permissions.canEditParameters && (
                                <span className="px-1 bg-slate-100 text-slate-600 text-[8px] font-bold rounded uppercase tracking-wider" title="Choferes/Vehículos/Rutas">Parámetros</span>
                              )}
                              {u.permissions.canManageUsers && (
                                <span className="px-1 bg-indigo-50 text-indigo-600 text-[8px] font-bold rounded uppercase tracking-wider" title="Permisos">Usuarios</span>
                              )}
                              {activePermsCount === 0 && (
                                <span className="text-[9px] text-slate-400 italic">Ningún permiso asignado</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleEditClick(u)}
                                className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-all cursor-pointer"
                                title="Editar Permisos"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.uid, u.displayName)}
                                disabled={isMe}
                                className={`p-1 rounded transition-all ${isMe ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'}`}
                                title={isMe ? "No puedes eliminar tu cuenta" : "Eliminar el acceso del usuario"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400 italic">
                          No hay perfiles adicionales cargados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
