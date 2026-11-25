import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import AdminPage from './pages/Admin';
import MarcasPage from './pages/Marcas';
import ClientesPage from './pages/Clientes';
import InventarioPage from './pages/Inventario';
import RecepcionPage from './pages/Recepcion';
import BajasRetirosPage from './pages/BajasRetiros';
import POSPage from './pages/POS';
import DevolucionesPage from './pages/Devoluciones';
import CierreCajaPage from './pages/CierreCaja';
import LiquidacionesPage from './pages/Liquidaciones';
import RentaPage from './pages/Renta';
import api from './services/api';
import { FeedbackProvider } from './components/ui/FeedbackProvider';

const canManageUsers = (user) => /admin|administrador/i.test(user?.role || '');
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'moon-last-activity';

const clearStoredSession = () => {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem('moon-session');
    storage.removeItem('moon-token');
    storage.removeItem(LAST_ACTIVITY_KEY);
  }
};

const authStorage = () => localStorage.getItem('moon-token') ? localStorage : sessionStorage;

const getInitialUser = () => {
  try {
    const storage = authStorage();
    const stored = storage.getItem('moon-session');
    if (!stored || !storage.getItem('moon-token')) return null;
    const lastActivity = Number(storage.getItem(LAST_ACTIVITY_KEY));
    if (lastActivity && Date.now() - lastActivity >= SESSION_TIMEOUT_MS) {
      clearStoredSession();
      return null;
    }
    if (!lastActivity) storage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    return JSON.parse(stored);
  } catch { return null; }
};

export default function App() {
  const [user, setUser] = useState(getInitialUser);

  const handleLogin = async (email, password, remember) => {
    const { data } = await api.post('/auth/login', { email, password });
    const signedInUser = { id: data.user.id, name: data.user.nombre, email: data.user.email, role: data.user.rol };
    localStorage.removeItem('moon-session');
    localStorage.removeItem('moon-token');
    sessionStorage.removeItem('moon-session');
    sessionStorage.removeItem('moon-token');
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('moon-session', JSON.stringify(signedInUser));
    storage.setItem('moon-token', data.access_token);
    storage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    setUser(signedInUser);
  };

  const handleLogout = useCallback(() => {
    clearStoredSession();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    let lastWrite = 0;
    const checkTimeout = () => {
      const storage = authStorage();
      const lastActivity = Number(storage.getItem(LAST_ACTIVITY_KEY)) || Date.now();
      if (Date.now() - lastActivity >= SESSION_TIMEOUT_MS) handleLogout();
    };
    const recordActivity = () => {
      const now = Date.now();
      if (now - lastWrite < 10_000) return;
      const storage = authStorage();
      const lastActivity = Number(storage.getItem(LAST_ACTIVITY_KEY)) || now;
      if (now - lastActivity >= SESSION_TIMEOUT_MS) {
        handleLogout();
        return;
      }
      storage.setItem(LAST_ACTIVITY_KEY, String(now));
      lastWrite = now;
    };
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    const interval = window.setInterval(checkTimeout, 10_000);
    document.addEventListener('visibilitychange', checkTimeout);
    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', checkTimeout);
    };
  }, [user, handleLogout]);

  return (
    <FeedbackProvider><BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />} />
        <Route path="/*" element={user ? (
          <Layout user={user} onLogout={handleLogout}>
            <Routes>
              <Route path="/" element={<DashboardPage user={user} />} />
              <Route path="/admin" element={canManageUsers(user) ? <AdminPage /> : <Navigate to="/" replace />} />
              <Route path="/marcas" element={<MarcasPage />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/inventario" element={<InventarioPage />} />
              <Route path="/catalogo-qr" element={<Navigate to="/inventario" replace />} />
              <Route path="/recepcion" element={<RecepcionPage />} />
              <Route path="/bajas-retiros" element={<BajasRetirosPage />} />
              <Route path="/pos" element={<POSPage />} />
              <Route path="/devoluciones" element={<DevolucionesPage />} />
              <Route path="/cierre-caja" element={<CierreCajaPage />} />
              <Route path="/liquidaciones" element={<LiquidacionesPage />} />
              <Route path="/renta" element={<RentaPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        ) : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter></FeedbackProvider>
  );
}
