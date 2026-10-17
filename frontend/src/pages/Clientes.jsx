import React, { useState } from 'react';
import brandConfig from '../brandConfig';
import { formatCordobas } from '../utils/currency';

const INITIAL_CLIENTS = [
  {
    id: 1,
    documento: '17.842.119-3',
    nombre: 'Sofía Valenzuela',
    initials: 'SV',
    nivel: 'Cliente Frecuente · Nivel Oro',
    telefono: '+54 911 3211-9876',
    email: 'sofia.valenzuela@gmail.com',
    comprasTotales: 1420.00,
    cantidadCompras: 14,
    ultimaVisita: 'Hoy, 10:45 AM',
    marcasPreferidas: ['Nordic Home', 'Vera Studio'],
    vip: true
  },
  {
    id: 2,
    documento: '19.221.054-K',
    nombre: 'Mateo Benítez',
    initials: 'MB',
    nivel: 'Cliente Registrado',
    telefono: '+54 911 4455-8899',
    email: 'mateo.b@outlook.com',
    comprasTotales: 460.50,
    cantidadCompras: 5,
    ultimaVisita: 'Ayer, 4:20 PM',
    marcasPreferidas: ['Komorebi Crafts'],
    vip: false
  },
  {
    id: 3,
    documento: '15.632.880-1',
    nombre: 'Camila Rossi',
    initials: 'CR',
    nivel: 'Cliente VIP · Nivel Platino',
    telefono: '+54 911 7788-9900',
    email: 'camila.rossi@empresa.com',
    comprasTotales: 3210.00,
    cantidadCompras: 28,
    ultimaVisita: '12 Oct, 06:15 PM',
    marcasPreferidas: ['Vera Studio', 'Aura Botanics'],
    vip: true
  },
  {
    id: 4,
    documento: '21.004.912-7',
    nombre: 'Ignacio Morales',
    initials: 'IM',
    nivel: 'Nuevo Cliente',
    telefono: '+54 911 2233-1122',
    email: 'ignacio.morales@gmail.com',
    comprasTotales: 85.00,
    cantidadCompras: 1,
    ultimaVisita: '10 Oct, 11:30 AM',
    marcasPreferidas: ['Nordic Home'],
    vip: false
  }
];

export default function ClientesPage() {
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('Todos');
  const [selectedClient, setSelectedClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    nombre: '',
    documento: '',
    email: '',
    telefono: '',
  });

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.documento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.telefono.includes(searchTerm);

    if (!matchesSearch) return false;
    if (filterTab === 'Recurrentes') return c.cantidadCompras > 3;
    if (filterTab === 'VIP') return c.comprasTotales >= 1000;
    if (filterTab === 'Nuevos') return c.cantidadCompras <= 2;
    return true;
  });

  const handleCreateClient = (e) => {
    e.preventDefault();
    const initials = newClient.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'CL';
    const created = {
      id: Date.now(),
      documento: newClient.documento,
      nombre: newClient.nombre,
      initials,
      nivel: 'Nuevo Cliente',
      telefono: newClient.telefono,
      email: newClient.email,
      comprasTotales: 0,
      cantidadCompras: 0,
      ultimaVisita: 'Recién registrado',
      marcasPreferidas: ['General'],
      vip: false
    };
    setClients([created, ...clients]);
    setIsModalOpen(false);
    setNewClient({ nombre: '', documento: '', email: '', telefono: '' });
  };

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* 1. Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary-fixed text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">group</span>
            </span>
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">Gestión de Clientes y Fidelización</h1>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Base centralizada de compradores frecuentes y su historial de compras en {brandConfig.name} ({brandConfig.branchName})
          </p>
        </div>
        <div className="flex items-center gap-space-sm">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md text-label-md shadow-sm hover:opacity-95 transition-all"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Registrar Cliente</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
          <div>
            <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Total Clientes</span>
            <div className="font-headline-xl text-on-surface mt-1 tracking-tight font-bold">{clients.length + 1476}</div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-secondary font-label-sm">
            <span className="material-symbols-outlined text-[16px]">trending_up</span> +14% mes actual
          </div>
        </div>

        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
          <div>
            <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Clientes Recurrentes</span>
            <div className="font-headline-xl text-on-surface mt-1 tracking-tight font-bold">42%</div>
          </div>
          <div className="w-full bg-surface-container-low h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-secondary h-full rounded-full" style={{ width: '42%' }}></div>
          </div>
        </div>

        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
          <div>
            <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Ticket Promedio</span>
            <div className="font-headline-xl text-on-surface mt-1 tracking-tight font-bold">{formatCordobas(64.5)}</div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-secondary font-label-sm">
            <span className="material-symbols-outlined text-[16px]">payments</span> Promedio en POS
          </div>
        </div>

        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
          <div>
            <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Nuevos este Mes</span>
            <div className="font-headline-xl text-on-surface mt-1 tracking-tight font-bold">+128</div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-primary font-label-sm">
            <span className="material-symbols-outlined text-[16px]">how_to_reg</span> Meta mensual: 150
          </div>
        </div>
      </div>

      {/* 3. Search and Filter Bar */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-9 pr-4 bg-surface-container-low rounded-xl text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none"
            placeholder="Buscar por DNI/Cédula, nombre, email o teléfono..."
            type="text"
          />
        </div>
        <div className="flex items-center bg-surface-container-low rounded-xl p-1 gap-1">
          {['Todos', 'Recurrentes', 'VIP', 'Nuevos'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm transition-all ${filterTab === tab ? 'bg-surface-container-lowest text-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider h-10">
                <th className="px-5 py-2.5 font-semibold">Documento ID</th>
                <th className="px-5 py-2.5 font-semibold">Nombre Completo</th>
                <th className="px-5 py-2.5 font-semibold">Contacto</th>
                <th className="px-5 py-2.5 font-semibold text-right">Compras Totales</th>
                <th className="px-5 py-2.5 font-semibold">Última Visita</th>
                <th className="px-5 py-2.5 font-semibold">Marcas Preferidas</th>
                <th className="px-5 py-2.5 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm">
              {filteredClients.map((c) => (
                <tr key={c.id} className="hover:bg-surface-container-low/50 transition-colors group cursor-pointer" onClick={() => setSelectedClient(c)}>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-on-surface font-medium bg-surface-container px-2 py-0.5 rounded text-[13px]">{c.documento}</span>
                      {c.vip && <span className="w-2 h-2 rounded-full bg-secondary" title="Cliente VIP"></span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-fixed text-primary font-label-md flex items-center justify-center font-bold">{c.initials}</div>
                      <div>
                        <div className="font-label-md text-on-surface font-semibold">{c.nombre}</div>
                        <div className="font-label-sm text-secondary font-medium">{c.nivel}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-on-surface font-mono text-[12px]">{c.telefono}</span>
                      <span className="text-on-surface-variant text-[12px]">{c.email}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-right">
                    <span className="font-mono text-on-surface font-semibold text-[14px]">{formatCordobas(c.comprasTotales)}</span>
                    <div className="text-[11px] text-on-surface-variant">{c.cantidadCompras} compras</div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> {c.ultimaVisita}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                      {c.marcasPreferidas.map((m, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-surface-container font-label-sm text-on-surface">{m}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setSelectedClient(c)} className="px-2.5 py-1 rounded-lg text-primary hover:bg-primary-fixed/40 font-label-sm transition-colors" type="button">
                      Ver Ficha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer: Historial Cliente */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="bg-surface-container-lowest w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary font-bold flex items-center justify-center text-lg">{selectedClient.initials}</div>
                  <div>
                    <h3 className="font-bold text-on-surface">{selectedClient.nombre}</h3>
                    <span className="font-mono text-xs text-on-surface-variant">{selectedClient.documento}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedClient(null)} className="text-on-surface-variant hover:text-error">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-3 rounded-xl">
                <div>
                  <span className="text-xs text-on-surface-variant">Compras Totales</span>
                  <div className="font-bold text-lg text-on-surface">{formatCordobas(selectedClient.comprasTotales)}</div>
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant">Visitas</span>
                  <div className="font-bold text-lg text-on-surface">{selectedClient.cantidadCompras} tickets</div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h4 className="font-bold text-sm text-on-surface">Datos de Contacto</h4>
                <div className="text-sm text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">call</span> {selectedClient.telefono}
                </div>
                <div className="text-sm text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">email</span> {selectedClient.email}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h4 className="font-bold text-sm text-on-surface">Marcas Favoritas en Consignación</h4>
                <div className="flex gap-2 flex-wrap">
                  {selectedClient.marcasPreferidas.map((m, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-surface-container rounded-lg text-xs font-semibold text-primary">{m}</span>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => setSelectedClient(null)} className="w-full py-2.5 rounded-lg bg-surface-container-low text-on-surface font-label-md">
              Cerrar Ficha
            </button>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
              <h3 className="font-bold text-on-surface text-lg">Registrar Nuevo Cliente</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-on-surface-variant hover:text-error">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateClient} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-on-surface-variant font-semibold">Nombre Completo *</label>
                <input
                  required
                  placeholder="Ej: Lucía Méndez"
                  value={newClient.nombre}
                  onChange={(e) => setNewClient({ ...newClient, nombre: e.target.value })}
                  className="w-full p-2 rounded-lg bg-surface-container-low border border-outline-variant/30 text-on-surface mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant font-semibold">Cédula / DNI *</label>
                <input
                  required
                  placeholder="Ej: 001-120994-0021A"
                  value={newClient.documento}
                  onChange={(e) => setNewClient({ ...newClient, documento: e.target.value })}
                  className="w-full p-2 rounded-lg bg-surface-container-low border border-outline-variant/30 text-on-surface mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant font-semibold">Teléfono</label>
                <input
                  placeholder="+505 8888-9999"
                  value={newClient.telefono}
                  onChange={(e) => setNewClient({ ...newClient, telefono: e.target.value })}
                  className="w-full p-2 rounded-lg bg-surface-container-low border border-outline-variant/30 text-on-surface mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant font-semibold">Email</label>
                <input
                  type="email"
                  placeholder="cliente@ejemplo.com"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  className="w-full p-2 rounded-lg bg-surface-container-low border border-outline-variant/30 text-on-surface mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-surface-container-low">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg bg-surface-container-low text-on-surface text-sm">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold">
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
