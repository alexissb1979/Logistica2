import React, { useState } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Send, 
  AlertTriangle, 
  CheckCircle, 
  History, 
  MapPin, 
  User, 
  Clock, 
  FileText, 
  Search, 
  RefreshCw,
  Sparkles,
  HelpCircle,
  Volume2,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { LogisticsRequest, UserProfile } from '../types';

interface LogisticsRequestsManagerProps {
  requests: LogisticsRequest[];
  onCreateRequest: (data: Omit<LogisticsRequest, 'id' | 'createdAt' | 'status' | 'createdBy'>) => Promise<void>;
  onCompleteRequest: (id: string, observation: string) => Promise<void>;
  onUpdateRequest: (id: string, data: Partial<LogisticsRequest>) => Promise<void>;
  onDeleteRequest: (id: string) => Promise<void>;
  currentUserEmail: string;
  userProfile: UserProfile | null;
  onSimulateAlarm: () => void;
}

export const LogisticsRequestsManager: React.FC<LogisticsRequestsManagerProps> = ({
  requests,
  onCreateRequest,
  onCompleteRequest,
  onUpdateRequest,
  onDeleteRequest,
  currentUserEmail,
  userProfile,
  onSimulateAlarm
}) => {
  // Local Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [priority, setPriority] = useState<LogisticsRequest['priority']>('MEDIA');
  const [targetDate, setTargetDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [alarmOption, setAlarmOption] = useState<'SAME_DAY' | 'ANY_DAY' | 'SPECIFIC_DATE'>('SAME_DAY');
  const [alarmDate, setAlarmDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Interactive states
  const [editingRequest, setEditingRequest] = useState<LogisticsRequest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [observationText, setObservationText] = useState('');
  const [isHistoryTab, setIsHistoryTab] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !targetDate) return;

    try {
      setSubmitting(true);
      const dataPayload = {
        title: title.trim(),
        description: description.trim(),
        clientName: clientName.trim() || undefined,
        address: address.trim() || undefined,
        priority,
        targetDate,
        alarmOption,
        alarmDate: alarmOption === 'SPECIFIC_DATE' ? alarmDate : undefined
      };

      if (editingRequest) {
        await onUpdateRequest(editingRequest.id, dataPayload);
        setEditingRequest(null);
      } else {
        await onCreateRequest(dataPayload);
      }

      // Reset form
      setTitle('');
      setDescription('');
      setClientName('');
      setAddress('');
      setPriority('MEDIA');
      setAlarmOption('SAME_DAY');
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setTargetDate(`${yyyy}-${mm}-${dd}`);
      setAlarmDate(`${yyyy}-${mm}-${dd}`);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (req: LogisticsRequest) => {
    setEditingRequest(req);
    setTitle(req.title);
    setDescription(req.description || '');
    setClientName(req.clientName || '');
    setAddress(req.address || '');
    setPriority(req.priority);
    setTargetDate(req.targetDate || '');
    setAlarmOption(req.alarmOption || 'SAME_DAY');
    setAlarmDate(req.alarmDate || '');
  };

  const handleCancelEdit = () => {
    setEditingRequest(null);
    setTitle('');
    setDescription('');
    setClientName('');
    setAddress('');
    setPriority('MEDIA');
    setAlarmOption('SAME_DAY');
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setTargetDate(`${yyyy}-${mm}-${dd}`);
    setAlarmDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleDeleteSubmit = async (id: string) => {
    try {
      await onDeleteRequest(id);
      setDeletingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Complete handler submit
  const handleResolveSubmit = async (id: string) => {
    if (!observationText.trim()) return;
    try {
      await onCompleteRequest(id, observationText.trim());
      setCompletingId(null);
      setObservationText('');
    } catch (err) {
      console.error(err);
    }
  };

  // Filter requests
  const filteredRequests = requests.filter(req => {
    const isMatchedStatus = isHistoryTab ? req.status === 'COMPLETADO' : req.status === 'PENDIENTE';
    if (!isMatchedStatus) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = req.title.toLowerCase().includes(q);
      const matchDesc = req.description.toLowerCase().includes(q);
      const matchClient = (req.clientName || '').toLowerCase().includes(q);
      const matchAddress = (req.address || '').toLowerCase().includes(q);
      return matchTitle || matchDesc || matchClient || matchAddress;
    }
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'PENDIENTE').length;
  const completedCount = requests.filter(r => r.status === 'COMPLETADO').length;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50 animate-fade-in" id="requests-manager-panel">
      
      {/* LEFT SECTION: Submit request Form */}
      <div className="w-full md:w-[380px] bg-white border-r border-slate-200 p-6 flex flex-col overflow-y-auto shrink-0 text-left">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${editingRequest ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                <ClipboardList className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                {editingRequest ? 'Editar Solicitud' : 'Crear Nueva Solicitud'}
              </h3>
            </div>
            {editingRequest && (
              <button 
                onClick={handleCancelEdit}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                title="Cancelar Edición"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-500 font-medium">
            {editingRequest 
              ? 'Está modificando los contenidos de la solicitud. Al finalizar, haga clic en Guardar.'
              : 'Ingresa encargos especiales, despachos imprevistos o alertas urgentes para que el centro de despacho los acople en las próximas rutas.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Título o Concepto *</span>
            <input 
              type="text"
              required
              placeholder="Ej: Despacho Express Mall Plaza"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Prioridad</span>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 transition-all cursor-pointer"
              >
                <option value="BAJA">Baja</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta 🚨</option>
                <option value="CRITICA">Crítica ⚡</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Cliente (Opcional)</span>
              <input 
                type="text"
                placeholder="Ej: Sodimac SA"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Dirección / Comuna (Opcional)</span>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input 
                type="text"
                placeholder="Ej: Av. Vicuña Mackenna 4500"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl pl-9 pr-3.5 py-2 text-xs font-medium text-slate-800 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Fecha Requerida *</span>
              <input 
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 transition-all cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Activar Alarma</span>
              <select 
                value={alarmOption}
                onChange={(e) => setAlarmOption(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 transition-all cursor-pointer"
              >
                <option value="SAME_DAY">Mismo día de ruta</option>
                <option value="ANY_DAY">Cualquier día (Siempre)</option>
                <option value="SPECIFIC_DATE">Otra fecha específica...</option>
              </select>
            </div>
          </div>

          {alarmOption === 'SPECIFIC_DATE' && (
            <div className="flex flex-col gap-1 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 animate-fade-in text-left">
              <span className="text-[9px] font-extrabold uppercase text-indigo-700 tracking-wider">Fecha Específica para Alarma *</span>
              <input 
                type="date"
                required
                value={alarmDate}
                onChange={(e) => setAlarmDate(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 transition-all cursor-pointer"
              />
              <span className="text-[9px] text-slate-400 leading-normal mt-1">La alarma del panel sonará únicamente en los horarios agendados del día seleccionado.</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Descripción y Detalle de la Tarea *</span>
            <textarea 
              required
              rows={4}
              placeholder="Indica ítems, bultos, plazos u observaciones de entrega..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl p-3.5 text-xs font-medium text-slate-800 transition-all placeholder:text-slate-400 resize-none"
            />
          </div>

          <button 
            type="submit"
            disabled={submitting}
            className={`w-full text-white font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 uppercase tracking-wider transition-all shadow-lg cursor-pointer ${editingRequest ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/10'} ${submitting ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Registrando...
              </>
            ) : editingRequest ? (
              <>
                <Send className="w-3.5 h-3.5" /> Guardar Cambios
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Enviar Solicitud
              </>
            )}
          </button>
          {editingRequest && (
            <button 
              type="button"
              onClick={handleCancelEdit}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition-all cursor-pointer text-center uppercase tracking-wider font-extrabold"
            >
              Cancelar Edición
            </button>
          )}
        </form>

        {/* Informative Alert simulation triggers */}
        <div className="mt-auto pt-6 border-t border-slate-100 flex flex-col gap-3">
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-2.5">
            <span className="text-[9px] font-extrabold uppercase text-amber-600 tracking-widest flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-amber-500 animate-bounce" /> Sistema de Alarmas Activo
            </span>
            <p className="text-[10px] text-slate-400 leading-normal font-sans font-medium">
              El panel genera ventanas emergentes de atención prioritaria y alerta sonoras automáticas a las:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['08:15', '12:00', '15:30', '17:00'].map(t => (
                <span key={t} className="px-2.5 py-1 text-[10px] font-bold font-mono bg-white border border-slate-200 rounded-lg text-slate-700 shadow-sm">
                  📢 {t} hrs
                </span>
              ))}
            </div>

            <button 
              onClick={onSimulateAlarm}
              className="mt-1 text-[10px] font-black tracking-wider uppercase bg-amber-500 hover:bg-amber-600 active:scale-95 text-white py-2 px-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/15"
            >
              🔊 Forzar Alarma (Testeo)
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SECTION: Interactive list and history */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Subheader / Tabs */}
        <div className="p-6 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              📋 Control de Solicitudes Pendientes
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Gestiona, marca completadas y revisa las observaciones del equipo de reparto.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input 
                type="text"
                placeholder="Buscar solicitud..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl pl-9 pr-4 py-1.5 text-xs font-semibold text-slate-700 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center gap-2">
          <button 
            onClick={() => setIsHistoryTab(false)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${!isHistoryTab ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/10' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
          >
            🚨 Pendientes de Ruta
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${!isHistoryTab ? 'bg-white text-orange-600' : 'bg-slate-200 text-slate-700'}`}>
              {pendingCount}
            </span>
          </button>
          <button 
            onClick={() => setIsHistoryTab(true)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${isHistoryTab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
          >
            <History className="w-3.5 h-3.5" /> Historial / Resueltas
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isHistoryTab ? 'bg-white text-indigo-600' : 'bg-slate-200 text-slate-700'}`}>
              {completedCount}
            </span>
          </button>
        </div>

        {/* Request Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredRequests.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center max-w-xl mx-auto my-8 flex flex-col items-center gap-4">
              <div className="w-12 h-12 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-center text-slate-400">
                {isHistoryTab ? <History className="w-6 h-6 text-indigo-500" /> : <CheckCircle className="w-6 h-6 text-emerald-500" />}
              </div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                {isHistoryTab ? 'Sin Historial Registrado' : '¡Todo al día!'}
              </h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-sans">
                {isHistoryTab 
                  ? 'No se visualizan solicitudes completadas recientemente.' 
                  : 'No existen encargos imprevistos pendientes de asignarse.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredRequests.map((req) => {
                const priorityStyles = {
                  BAJA: { bg: 'bg-emerald-50 text-emerald-600 border-emerald-200/50', label: 'Baja' },
                  MEDIA: { bg: 'bg-indigo-50 text-indigo-600 border-indigo-200/50', label: 'Media' },
                  ALTA: { bg: 'bg-orange-50 text-orange-600 border-orange-200/50', label: 'Alta' },
                  CRITICA: { bg: 'bg-rose-50 text-rose-600 border-rose-300 animate-pulse', label: 'Crítica ⚡' }
                }[req.priority];

                const formattedDate = new Date(req.createdAt).toLocaleString('es-CL', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                });

                const isOwnerOrAdmin = userProfile?.role === 'ADMIN' || req.createdBy === currentUserEmail;

                return (
                  <div 
                    key={req.id} 
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between text-left relative overflow-hidden"
                  >
                    {/* Urgency Glowing top ribbon for pending requests */}
                    {req.status === 'PENDIENTE' && (
                      <div className={`absolute top-0 left-0 right-0 h-1.5 ${req.priority === 'CRITICA' ? 'bg-rose-500 animate-pulse' : req.priority === 'ALTA' ? 'bg-orange-500' : 'bg-slate-100'}`} />
                    )}

                    <div>
                      {/* Title & Priority Row */}
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex-1">
                          <h4 className="text-xs font-black text-slate-800 leading-tight tracking-tight uppercase">
                            {req.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isOwnerOrAdmin && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(req)}
                                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-md transition-all cursor-pointer"
                                title="Editar Solicitud"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingId(req.id)}
                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-all cursor-pointer"
                                title="Borrar Solicitud"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          <span className={`px-2 py-0.5 border text-[9px] font-extrabold uppercase tracking-widest rounded-lg shrink-0 ${priorityStyles.bg}`}>
                            {priorityStyles.label}
                          </span>
                        </div>
                      </div>

                      {/* Client / Address section */}
                      {(req.clientName || req.address) && (
                        <div className="mb-3 space-y-1 bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl text-[11px] text-slate-600 font-medium">
                          {req.clientName && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">Cliente: <strong className="text-slate-800 font-bold">{req.clientName}</strong></span>
                            </div>
                          )}
                          {req.address && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate text-slate-700 font-sans">{req.address}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Target date & Alarm option section */}
                      <div className="mb-3 flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 text-[11px] text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>Para el: <strong className="text-indigo-900 font-bold">{req.targetDate ? req.targetDate.split('-').reverse().join('/') : 'Sin fecha'}</strong></span>
                        </div>
                        <div className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-600 px-2 py-0.5 rounded-lg font-black uppercase tracking-wider shrink-0" title={req.alarmOption === 'SPECIFIC_DATE' ? `Alarma agendada para el ${req.alarmDate}` : ''}>
                          Alarma: {req.alarmOption === 'SAME_DAY' ? 'Ese día' : req.alarmOption === 'ANY_DAY' ? 'Siempre' : `El ${req.alarmDate ? req.alarmDate.split('-').reverse().join('/') : ''}`}
                        </div>
                      </div>

                      {/* Main Message content */}
                      <div className="text-xs text-slate-600 leading-relaxed font-normal whitespace-pre-wrap font-sans mb-4 bg-slate-50/20 p-3 rounded-xl border border-slate-100/40">
                        {req.description}
                      </div>
                    </div>

                    {/* Metadata & Actions row */}
                    <div className="mt-auto pt-3 border-t border-slate-100/80 flex flex-col gap-3">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" /> Detalle: {formattedDate}
                        </span>
                        <span>por: {req.createdBy.split('@')[0]}</span>
                      </div>

                      {/* Observations view for History/Completed Tab */}
                      {req.status === 'COMPLETADO' && req.observation && (
                        <div className="bg-emerald-50/30 border border-emerald-200/40 rounded-xl p-3 text-left">
                          <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest text-emerald-600 mb-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Resuelto y Anotación
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed font-sans italic">
                            "{req.observation}"
                          </p>
                          {req.completedAt && (
                            <div className="mt-1.5 text-[8px] font-bold font-mono text-slate-400 text-right">
                              Terminado el {new Date(req.completedAt).toLocaleString('es-CL')} {req.completedBy ? `por ${req.completedBy.split('@')[0]}` : ''}
                            </div>
                          )}
                        </div>
                      )}

                      {deletingId === req.id ? (
                        <div className="flex flex-col gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl animate-fade-in text-left">
                          <span className="text-[9px] font-extrabold uppercase text-rose-700 tracking-wider">¿Eliminar esta solicitud?</span>
                          <p className="text-[10px] text-slate-500 font-medium font-sans">Esta acción no se puede deshacer y removerá la solicitud permanentemente.</p>
                          <div className="flex justify-end gap-2 text-[10px] font-black mt-1">
                            <button 
                              onClick={() => setDeletingId(null)}
                              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                              No, cancelar
                            </button>
                            <button 
                              onClick={() => handleDeleteSubmit(req.id)}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer font-extrabold"
                            >
                              Sí, eliminar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Action trigger to complete task with observation inline */}
                          {req.status === 'PENDIENTE' && (
                            <div className="flex flex-col gap-2">
                              {completingId === req.id ? (
                                <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl animate-fade-in">
                                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Anotar Observación (Obligatorio)</span>
                                  <textarea 
                                    rows={2}
                                    autoFocus
                                    required
                                    placeholder="Escribe el estado del encargo, p.ej: 'Acoplado en ruta 3 de Orozco', o 'Entregado por fuera'..."
                                    value={observationText}
                                    onChange={(e) => setObservationText(e.target.value)}
                                    className="w-full bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-lg p-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400"
                                  />
                                  <div className="flex justify-end gap-2 text-[10px] font-black">
                                    <button 
                                      onClick={() => {
                                        setCompletingId(null);
                                        setObservationText('');
                                      }}
                                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                    <button 
                                      disabled={!observationText.trim()}
                                      onClick={() => handleResolveSubmit(req.id)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer disabled:opacity-40"
                                    >
                                      Grabar y Completar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setCompletingId(req.id);
                                    setObservationText('');
                                  }}
                                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 uppercase tracking-widest transition-all cursor-pointer shadow-md shadow-emerald-500/10"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" /> Completar Solicitud
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
