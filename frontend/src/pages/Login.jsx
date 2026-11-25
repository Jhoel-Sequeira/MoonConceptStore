import React, { useState } from 'react';
import brandConfig from '../brandConfig';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Ingresa tu usuario o correo y contraseña para continuar.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onLogin(email.trim(), password, remember);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No se pudo conectar con el sistema. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-screen min-h-screen flex items-center justify-center p-4 sm:p-8">
      <div className="login-shell w-full max-w-[1080px] min-h-[650px] grid md:grid-cols-[1.05fr_0.95fr] overflow-hidden rounded-[28px] shadow-2xl">
        <section className="login-brand-panel relative hidden md:flex flex-col justify-between p-12 text-on-surface overflow-hidden">
          <div className="absolute inset-0 login-brand-glow" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="login-logo-frame"><img src={brandConfig.logo.main} alt="" /></div>
            <div>
              <p className="text-lg font-semibold tracking-tight">{brandConfig.name}</p>
              <p className="text-xs tracking-[0.2em] uppercase text-on-surface-variant">Sistema de gestión</p>
            </div>
          </div>
          <div className="relative z-10 max-w-md">
            <div className="login-kicker"><span className="w-1.5 h-1.5 rounded-full bg-primary-fixed" /> TU ESPACIO, EN ORDEN</div>
            <h1 className="mt-6 text-4xl lg:text-[44px] leading-[1.12] font-semibold tracking-tight">Todo tu negocio,<br />en un solo lugar.</h1>
            <p className="mt-5 text-base leading-7 text-on-surface-variant max-w-sm">Administra ventas, inventario y clientes con una experiencia simple y hecha para tu tienda.</p>
          </div>
          <div className="relative z-10 flex items-center justify-between text-xs text-on-surface-variant">
            <span>{brandConfig.branchName} · Nicaragua</span><span>© {new Date().getFullYear()} {brandConfig.name}</span>
          </div>
          <div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" />
        </section>

        <section className="bg-white flex flex-col justify-center px-7 py-10 sm:px-12 lg:px-[72px]">
          <div className="md:hidden flex items-center gap-3 mb-10">
            <div className="login-logo-frame login-logo-light"><img src={brandConfig.logo.main} alt="" /></div>
            <div><p className="font-semibold text-on-surface">{brandConfig.name}</p><p className="text-xs text-on-surface-variant">Sistema de gestión</p></div>
          </div>
          <div className="mb-8">
            <div className="login-welcome-icon"><span className="material-symbols-outlined">lock_open</span></div>
            <p className="mt-6 text-sm font-semibold tracking-[0.16em] uppercase text-primary">Bienvenido de nuevo</p>
            <h2 className="mt-2 text-[32px] leading-tight font-semibold tracking-tight text-on-surface">Inicia sesión</h2>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">Ingresa tus datos para acceder al sistema.</p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-5">
            <label className="flex flex-col gap-2 text-sm font-medium text-on-surface">
              Usuario o correo electrónico
              <div className="login-input-wrap"><span className="material-symbols-outlined">person</span><input autoComplete="username" type="text" placeholder="admin o nombre@tienda.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-on-surface">
              Contraseña
              <div className="login-input-wrap"><span className="material-symbols-outlined">key</span><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} placeholder="Ingresa tu contraseña" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(!showPassword)}><span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span></button></div>
            </label>
            <div className="flex items-center justify-between -mt-1">
              <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-primary w-4 h-4 rounded" /> Recordarme</label>
              <button type="button" onClick={() => setError('Contacta al administrador para restablecer tu contraseña.')} className="text-sm font-semibold text-primary hover:underline">¿Olvidaste tu contraseña?</button>
            </div>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={loading} className="login-submit mt-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-white transition-all disabled:cursor-wait disabled:opacity-70">
              {loading ? 'Verificando...' : 'Entrar al sistema'} {!loading && <span className="material-symbols-outlined text-[19px]">arrow_forward</span>}
            </button>
          </form>
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-on-surface-variant/75"><span className="material-symbols-outlined text-[16px]">storefront</span> Portal de acceso del equipo de {brandConfig.name}</div>
        </section>
      </div>
    </main>
  );
}
