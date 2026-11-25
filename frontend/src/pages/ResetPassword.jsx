import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import brandConfig from '../brandConfig';
import api from '../services/api';

export default function ResetPasswordPage({ onPasswordReset }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/password-reset/confirm', { token, password });
      setSuccess(data.message);
      onPasswordReset?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo restablecer la contraseña. Solicita un enlace nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-screen flex min-h-screen items-center justify-center p-4 sm:p-8">
      <section className="w-full max-w-md rounded-[28px] bg-white px-7 py-10 shadow-2xl sm:px-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="login-logo-frame login-logo-light"><img src={brandConfig.logo.main} alt="" /></div>
          <div><p className="font-semibold text-on-surface">{brandConfig.name}</p><p className="text-xs text-on-surface-variant">Restablecimiento de contraseña</p></div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Crea una contraseña nueva</h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">Usa al menos 8 caracteres. El enlace solo funciona una vez y vence en 30 minutos.</p>
        {token ? <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-on-surface">Nueva contraseña
            <input required minLength={8} maxLength={72} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 rounded-lg border border-stone-200 px-3 font-normal outline-none focus:border-primary" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-on-surface">Confirmar contraseña
            <input required minLength={8} maxLength={72} autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 rounded-lg border border-stone-200 px-3 font-normal outline-none focus:border-primary" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
          {success && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{success}</p>}
          {!success && <button type="submit" disabled={loading} className="login-submit mt-1 flex items-center justify-center rounded-xl px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-70">{loading ? 'Guardando…' : 'Restablecer contraseña'}</button>}
          {success && <Link to="/login" className="text-center text-sm font-semibold text-primary hover:underline">Ir a iniciar sesión</Link>}
        </form> : <div className="mt-6 space-y-4"><p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">El enlace no es válido o no incluye el token. Solicita uno nuevo.</p><Link to="/login" className="block text-center text-sm font-semibold text-primary hover:underline">Volver al inicio de sesión</Link></div>}
      </section>
    </main>
  );
}
