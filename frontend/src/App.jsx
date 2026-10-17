import React, { useState } from 'react';
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
import CierreCajaPage from './pages/CierreCaja';
import LiquidacionesPage from './pages/Liquidaciones';
import RentaPage from './pages/Renta';
import api from './services/api';

const canManageUsers = (user) => /admin|administrador/i.test(user?.role || '');

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('moon-session') || sessionStorage.getItem('moon-session');
      const token = localStorage.getItem('moon-token') || sessionStorage.getItem('moon-token');
      return stored && token ? JSON.parse(stored) : null;
    } catch { return null; }
  });

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
    setUser(signedInUser);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('moon-session');
    localStorage.removeItem('moon-session');
    sessionStorage.removeItem('moon-token');
    localStorage.removeItem('moon-token');
    setUser(null);
  };

  return (
    <BrowserRouter>
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
              <Route path="/cierre-caja" element={<CierreCajaPage />} />
              <Route path="/liquidaciones" element={<LiquidacionesPage />} />
              <Route path="/renta" element={<RentaPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        ) : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
