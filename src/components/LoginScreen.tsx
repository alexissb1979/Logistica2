import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, userProfilesCol } from '../firebase';
import { 
  Lock, Mail, User, ShieldAlert, Check, AlertCircle, Loader, ArrowRight 
} from 'lucide-react';

interface LoginScreenProps {
  onAuthSuccess: () => void;
}

export default function LoginScreen({ onAuthSuccess }: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  // Input fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  // Status hooks
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (isResetting) {
        await sendPasswordResetEmail(auth, cleanEmail);
        setSuccessMsg("Se ha enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.");
        setIsResetting(false);
      } else if (isRegistering) {
        if (!displayName.trim()) {
          setErrorMsg("Por favor, ingresa tu nombre completo.");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg("La contraseña debe tener al menos 6 caracteres.");
          setLoading(false);
          return;
        }

        // 1. Create auth user
        const credentials = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const uid = credentials.user.uid;

        // 2. Assign default roles/permissions
        // Check if user is the designated admin/developer email
        const isDeveloperAdmin = cleanEmail === 'sepulveda.alexis.a@gmail.com';
        
        const defaultProfile = {
          uid,
          email: cleanEmail,
          displayName: displayName.trim(),
          role: isDeveloperAdmin ? 'ADMIN' : 'VIEWER',
          permissions: {
            canEditPlanning: isDeveloperAdmin,
            canUploadExcel: isDeveloperAdmin,
            canViewRouteSheets: true, // Everyone gets viewing access to list sheets, but locked down modifications
            canEditManifests: isDeveloperAdmin,
            canEditParameters: isDeveloperAdmin,
            canManageUsers: isDeveloperAdmin,
          },
          createdAt: new Date().toISOString(),
        };

        // 3. Write profile doc to Firestore user_profiles
        await setDoc(doc(userProfilesCol, uid), defaultProfile);
        setSuccessMsg(`¡Registro completado! ${isDeveloperAdmin ? 'Has ingresado como Administrador General del sistema.' : 'Tu usuario ha sido registrado con privilegios de Visor (Lectura). Solicita permisos adicionales al Administrador si necesitas operar.'}`);
        onAuthSuccess();
      } else {
        // Standard Login
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        onAuthSuccess();
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let msg = "Error al intentar autenticar.";
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        msg = "Correo electrónico o contraseña incorrectos.";
      } else if (err.code === 'auth/email-already-in-use') {
        msg = "El correo electrónico ya se encuentra registrado.";
      } else if (err.code === 'auth/invalid-email') {
        msg = "Formato de correo electrónico inválido.";
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = "El inicio de sesión por Correo/Contraseña no está habilitado en Firebase. Por favor, actívelo en Firebase Console -> Authentication -> Sign-in method.";
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative Grid Lines / Accents */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35" />
      <div className="absolute w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -top-12 -left-12 pointer-events-none" />
      <div className="absolute w-[28rem] h-[28rem] bg-indigo-600/5 rounded-full blur-3xl -bottom-16 -right-16 pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-slate-850/80 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 backdrop-blur-md animate-in fade-in duration-200">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 mb-3.5">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white uppercase tracking-widest leading-none">Logistics Portal</h1>
          <p className="text-[11px] text-slate-400 mt-1.5 font-medium">Control de Flota y Planificación de Despachos</p>
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <div className="mb-6 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-3.5 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-xs text-emerald-400 flex items-start gap-2.5">
            <Check className="w-4 h-4 shrink-0 mt-0.5 bg-emerald-900/40 rounded-full p-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Email field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input 
                type="email"
                required
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-600/20 focus:border-indigo-500 transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Name field (Only in Register mode) */}
          {isRegistering && !isResetting && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre Completo</label>
              <div className="relative">
                <User className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  required
                  placeholder="Ej: Alexis Sepúlveda"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-600/20 focus:border-indigo-500 transition-all shadow-inner"
                />
              </div>
            </div>
          )}

          {/* Password field (Not in Reset mode) */}
          {!isResetting && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contraseña</label>
                {!isRegistering && (
                  <button 
                    type="button"
                    onClick={() => { setIsResetting(true); setErrorMsg(null); setSuccessMsg(null); }}
                    className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    ¿La olvidaste?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                <input 
                  type="password"
                  required
                  placeholder={isRegistering ? "Mínimo 6 caracteres" : "••••••••"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-600/20 focus:border-indigo-500 transition-all shadow-inner"
                />
              </div>
            </div>
          )}

          {/* Action button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white rounded-xl py-2.5 text-xs font-bold shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 cursor-pointer mt-2 transition-all group shrink-0"
          >
            {loading ? (
              <Loader className="w-4 h-4 animate-spin text-white" />
            ) : isResetting ? (
              'Enviar Correo de Recuperación'
            ) : isRegistering ? (
              <>
                <span>Registrar Cuenta</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </>
            ) : (
              <>
                <span>Ingresar al Sistema</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>


        {/* Bottom Toggle links */}
        <div className="mt-8 pt-6 border-t border-slate-800 text-center text-xs flex flex-col gap-2">
          {isResetting ? (
            <button
              onClick={() => { setIsResetting(false); setErrorMsg(null); setSuccessMsg(null); }}
              className="text-[10px] text-slate-400 hover:text-white font-bold uppercase transition-colors tracking-wide cursor-pointer"
            >
              Volver al inicio de sesión
            </button>
          ) : isRegistering ? (
            <p className="text-slate-400 shrink-0 font-medium text-[11px]">
              ¿Ya tienes una cuenta registrada?{' '}
              <button
                onClick={() => { setIsRegistering(false); setErrorMsg(null); setSuccessMsg(null); }}
                className="text-indigo-400 hover:text-indigo-300 font-bold ml-1 transition-colors hover:underline cursor-pointer"
              >
                Inicia Sesión
              </button>
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-slate-400 shrink-0 font-medium text-[11px]">
                ¿No tienes acceso?{' '}
                <button
                  onClick={() => { setIsRegistering(true); setErrorMsg(null); setSuccessMsg(null); }}
                  className="text-indigo-400 hover:text-indigo-300 font-bold ml-1 transition-colors hover:underline cursor-pointer"
                >
                  Regístrate aquí
                </button>
              </p>
              
              <div className="mt-2 text-[10px] text-slate-500 bg-slate-900/50 inline-block p-2 rounded-xl border border-slate-800/80">
                <span className="font-semibold text-slate-400 flex items-center justify-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  Nota sobre el primer inicio:
                </span>
                <p className="text-[9px] mt-1 leading-normal">
                  Inicia sesión o regístrate con tu correo habitual. Si tu correo es <code className="text-indigo-400 font-mono font-bold">sepulveda.alexis.a@gmail.com</code> obtendrás automáticamente permisos de <strong className="text-slate-300 font-bold">Administrador General</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
