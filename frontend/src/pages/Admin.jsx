import React, { useState, useRef, useEffect } from 'react';

export default function AdminPage() {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('usuarios');

  const users = [
    { initials: 'CR', name: 'Camila Rodríguez', id: 'USR-00109', detail: 'Caja #1', email: 'camila.rodriguez@brandhub.com', role: 'Cajero Principal', roleIcon: 'point_of_sale', roleBg: 'bg-primary-fixed/50 text-on-primary-fixed-variant', branch: 'Sucursal Principal', branchIcon: 'storefront', branchIconColor: 'text-primary', lastAccess: 'En línea ahora', lastAccessOnline: true, status: 'Activo', statusActive: true, avatarBg: 'bg-primary-fixed text-on-primary-fixed', online: true },
    { initials: 'MA', name: 'Martín Arismendi', id: 'USR-00001', detail: 'SuperAdmin', email: 'martin.a@brandhub.com', role: 'Administrador General', roleIcon: 'shield_person', roleBg: 'bg-surface-container-highest text-primary font-semibold', branch: 'Todas las Sucursales (3)', branchType: 'pill', lastAccess: 'Hace 2 horas', lastAccessOnline: false, status: 'Activo', statusActive: true, avatarBg: 'bg-surface-container-high text-primary' },
    { initials: 'EM', name: 'Elena Müller', id: 'USR-00442', detail: 'Nordic Home', email: 'elena@nordichome.design', role: 'Gestor de Marca (Nordic Home)', roleIcon: 'store', roleIconColor: 'text-tertiary', roleBg: 'bg-surface-container text-on-surface-variant', branch: 'Portal Proveedor', branchType: 'portal', lastAccess: 'Hace 1 día', lastAccessOnline: false, status: 'Activo', statusActive: true, avatarBg: 'bg-tertiary-fixed text-on-tertiary-fixed' },
    { initials: 'LV', name: 'Lucas Vera', id: 'USR-00448', detail: 'Vera Studio', email: 'lucas@verastudio.ar', role: 'Gestor de Marca (Vera Studio)', roleIcon: 'store', roleIconColor: 'text-tertiary', roleBg: 'bg-surface-container text-on-surface-variant', branch: 'Portal Proveedor', branchType: 'portal', lastAccess: 'Hace 3 días', lastAccessOnline: false, status: 'Activo', statusActive: true, avatarBg: 'bg-surface-container-high text-on-surface-variant' },
    { initials: 'DF', name: 'Diego Fernández', id: 'USR-00214', detail: 'Turno Tarde', email: 'd.fernandez@brandhub.com', role: 'Cajero Suplente', roleIcon: 'schedule', roleBg: 'bg-surface-container-low text-on-surface-variant', branch: 'Sucursal Principal', branchIcon: 'storefront', lastAccess: '08 Oct 2024', lastAccessOnline: false, status: 'En Pausa', statusActive: false, avatarBg: 'bg-surface-container-high/60 text-outline', opacity: true },
  ];

  const filteredUsers = users.filter(user => {
    const text = `${user.name} ${user.email} ${user.role}`.toLowerCase();
    const matchesQuery = text.includes(searchQuery.toLowerCase());
    let matchesRole = true;
    if (roleFilter === 'admin') matchesRole = text.includes('administrador');
    if (roleFilter === 'cashier') matchesRole = text.includes('cajero');
    if (roleFilter === 'brand') matchesRole = text.includes('gestor de marca');
    return matchesQuery && matchesRole;
  });

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col gap-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-primary font-label-sm text-label-sm uppercase tracking-wider">
              <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
              <span>Panel de Control & Seguridad</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Administración del Sistema</h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Configuración global de usuarios, roles de seguridad, datos de sucursal e impuestos para tiendas multimarca.
            </p>
          </div>
          {/* Quick Metrics Strip */}
          <div className="flex items-center gap-3 bg-surface-container-lowest px-4 py-2.5 rounded-xl shadow-sm">
            <div className="flex items-center gap-2.5 pr-4 border-r border-surface-container-high/60">
              <div className="w-8 h-8 rounded-lg bg-primary-fixed/40 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Usuarios Activos</span>
                <span className="font-headline-sm text-headline-sm text-on-surface leading-tight">18 / 20</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-1 text-secondary font-label-md text-label-md">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span>2FA Obligatorio</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-surface-container-high/80">
          <div className="flex items-center gap-2 -mb-px">
            <button onClick={() => setActiveTab('usuarios')} className={`group flex items-center gap-2 py-3 px-4 font-label-md text-label-md transition-all ${activeTab === 'usuarios' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:border-b-2 hover:border-outline-variant/60'}`} type="button">
              <span className="material-symbols-outlined text-[18px]" style={activeTab === 'usuarios' ? { fontVariationSettings: "'FILL' 1" } : {}}>manage_accounts</span>
              <span>Usuarios y Roles</span>
              <span className="px-1.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-sm text-label-sm ml-1">5</span>
            </button>
            <button onClick={() => setActiveTab('sucursal')} className={`group flex items-center gap-2 py-3 px-4 font-label-md text-label-md transition-all ${activeTab === 'sucursal' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:border-b-2 hover:border-outline-variant/60'}`} type="button">
              <span className="material-symbols-outlined text-[18px]">store</span>
              <span>Datos de Sucursal</span>
            </button>
            <button onClick={() => setActiveTab('config')} className={`group flex items-center gap-2 py-3 px-4 font-label-md text-label-md transition-all ${activeTab === 'config' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:border-b-2 hover:border-outline-variant/60'}`} type="button">
              <span className="material-symbols-outlined text-[18px]">tune</span>
              <span>Configuración General e Impuestos</span>
            </button>
          </div>
          <div className="hidden lg:flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>Sincronizado con BrandHub Cloud</span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-lowest p-3.5 rounded-xl shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-2xl">
            <div className="relative flex-1 min-w-[220px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">person_search</span>
              <input className="w-full h-9 pl-9 pr-3 bg-surface-container-low rounded-lg text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all" placeholder="Buscar por nombre, email o marca..." type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="relative min-w-[190px]">
              <select className="w-full h-9 appearance-none pl-3 pr-8 bg-surface-container-low rounded-lg text-on-surface font-label-md text-label-md focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="all">Todos los roles (5)</option>
                <option value="admin">Administrador General</option>
                <option value="cashier">Cajero / Operador</option>
                <option value="brand">Gestor de Marca</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">unfold_more</span>
            </div>
            <button className="h-9 px-3 bg-surface-container-low hover:bg-surface-container rounded-lg flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm transition-colors" type="button">
              <span className="material-symbols-outlined text-[16px]">filter_list</span>
              <span>Filtros avanzados</span>
            </button>
          </div>
          <button className="h-9 px-4 bg-primary text-on-primary rounded-lg font-label-md text-label-md flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 active:scale-[0.98] transition-all whitespace-nowrap" type="button" onClick={() => setShowModal(true)}>
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>+ Invitar Nuevo Usuario</span>
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-3 px-4" scope="col">Usuario</th>
                  <th className="py-3 px-4" scope="col">Email</th>
                  <th className="py-3 px-4" scope="col">Rol Asignado</th>
                  <th className="py-3 px-4" scope="col">Sucursal Asignada</th>
                  <th className="py-3 px-4" scope="col">Último Acceso</th>
                  <th className="py-3 px-4" scope="col">Estado</th>
                  <th className="py-3 px-4 text-right" scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60 font-body-md text-body-md text-on-surface">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className={`hover:bg-surface-container-low/60 transition-colors group ${user.opacity ? 'opacity-85' : ''}`}>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`relative w-9 h-9 rounded-full ${user.avatarBg} flex items-center justify-center font-label-md text-label-md`}>
                          {user.initials}
                          {user.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-secondary ring-2 ring-surface-container-lowest"></span>}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-label-md text-label-md text-on-surface group-hover:text-primary transition-colors">{user.name}</span>
                          <span className="font-body-sm text-body-sm text-on-surface-variant">ID: {user.id} · {user.detail}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">{user.email}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${user.roleBg} font-label-sm text-label-sm`}>
                        <span className={`material-symbols-outlined text-[14px] ${user.roleIconColor || ''}`}>{user.roleIcon}</span>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-body-sm text-body-sm whitespace-nowrap">
                      {user.branchType === 'pill' ? (
                        <span className="px-2 py-0.5 bg-surface-container-low rounded text-on-surface-variant font-label-sm text-label-sm">{user.branch}</span>
                      ) : user.branchType === 'portal' ? (
                        <span className="inline-flex items-center gap-1 text-tertiary font-label-sm text-label-sm">
                          <span className="material-symbols-outlined text-[14px]">captive_portal</span>
                          {user.branch}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 text-on-surface">
                          <span className={`material-symbols-outlined text-[16px] ${user.branchIconColor || ''}`}>{user.branchIcon}</span>
                          <span>{user.branch}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {user.lastAccessOnline ? (
                        <span className="inline-flex items-center gap-1.5 font-label-sm text-label-sm text-secondary font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span>
                          En línea ahora
                        </span>
                      ) : (
                        <span className="font-body-sm text-body-sm text-on-surface-variant">{user.lastAccess}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${user.statusActive ? 'bg-secondary-fixed/50 text-on-secondary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.statusActive ? 'bg-secondary' : 'bg-outline'}`}></span>
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {user.statusActive ? (
                          <button className="px-2.5 py-1 text-primary hover:bg-surface-container font-label-sm text-label-sm rounded transition-colors" type="button">Editar Permisos</button>
                        ) : (
                          <button className="px-2.5 py-1 text-secondary hover:bg-secondary-fixed/30 font-label-sm text-label-sm rounded transition-colors font-semibold" type="button">Reactivar</button>
                        )}
                        <button className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors" title="Más opciones" type="button">
                          <span className="material-symbols-outlined text-[18px]">more_vert</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant font-body-sm text-body-sm">
            <div className="flex items-center gap-2">
              <span>Mostrando {filteredUsers.length} de 18 usuarios registrados</span>
              <span className="text-outline-variant">•</span>
              <button className="text-primary hover:underline font-label-sm text-label-sm" type="button">Exportar listado (CSV)</button>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-label-sm text-label-sm transition-colors disabled:opacity-40" disabled type="button">Anterior</button>
              <span className="px-2 py-0.5 font-label-sm text-label-sm bg-primary text-on-primary rounded">1</span>
              <button className="px-2 py-0.5 font-label-sm text-label-sm hover:bg-surface-container rounded text-on-surface-variant" type="button">2</button>
              <button className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-sm text-label-sm transition-colors" type="button">Siguiente</button>
            </div>
          </div>
        </div>

        {/* Security & Brand Isolation Info Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-surface-container-lowest rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-gradient-to-br from-primary/5 via-secondary/10 to-transparent pointer-events-none"></div>
          <div className="lg:col-span-4 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">verified_user</span>
              </div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Resumen de Niveles de Permiso y Seguridad</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                BrandHub POS implementa una arquitectura estricta de <span className="font-semibold text-on-surface">Aislamiento Multitenant por Marca</span>. Cada proveedor opera en un contenedor virtual seguro.
              </p>
            </div>
            <div className="flex items-center gap-2 text-primary font-label-md text-label-md cursor-pointer hover:underline">
              <span>Ver matriz de permisos completa</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </div>
          </div>
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <RoleCard title="Super Admin" icon="security" iconColor="text-primary" desc="Acceso irrestricto a todas las marcas, cajas, recaudación global, configuraciones fiscales y conciliaciones bancarias." footerIcon="check_circle" footerText="Auditoría completa" footerColor="text-secondary" />
            <RoleCard title="Cajero / Operador" icon="point_of_sale" iconColor="text-primary" desc="Operación de terminal POS, escaneo de tickets y cobro múltiple. Sin visibilidad de costos de adquisición ni márgenes de marca." footerIcon="lock" footerText="Cierre por turno" footerColor="text-on-surface-variant" />
            <RoleCard title="Gestor de Marca" icon="loyalty" iconColor="text-tertiary" desc="Acceso aislado únicamente a su catálogo, stock y reportes de liquidación. Cero acceso a datos de otras marcas del local." footerIcon="verified" footerText="Aislamiento 100% estricto" footerColor="text-secondary" />
          </div>
        </div>
      </div>

      {/* Invite User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-xl p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Invitar Nuevo Usuario</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Configura las credenciales y el nivel de acceso</p>
                </div>
              </div>
              <button className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors" onClick={() => setShowModal(false)} type="button">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-on-surface font-medium">Nombre</label>
                  <input className="h-9 px-3 bg-surface-container-low rounded-lg text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Ej. Sofía" type="text" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-on-surface font-medium">Apellido</label>
                  <input className="h-9 px-3 bg-surface-container-low rounded-lg text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Ej. Valenzuela" type="text" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface font-medium">Correo Electrónico Corporativo</label>
                <input className="h-9 px-3 bg-surface-container-low rounded-lg text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="usuario@empresa.com" type="email" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-on-surface font-medium">Rol de Usuario</label>
                  <select className="h-9 px-3 bg-surface-container-low rounded-lg text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option>Cajero / Operador POS</option>
                    <option>Administrador General</option>
                    <option>Gestor de Marca</option>
                    <option>Auditor de Inventario</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-on-surface font-medium">Sucursal Asignada</label>
                  <select className="h-9 px-3 bg-surface-container-low rounded-lg text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option>Sucursal Principal (Palermo)</option>
                    <option>Sucursal Norte (Martínez)</option>
                    <option>Todas las sucursales</option>
                    <option>Portal Proveedor</option>
                  </select>
                </div>
              </div>
              <div className="p-3 bg-surface-container-low rounded-lg flex items-start gap-2.5">
                <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">info</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Se enviará una invitación por correo con enlace temporal seguro para la creación de contraseña y activación de doble factor (2FA).
                </p>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container-high/60">
                <button className="px-4 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container transition-colors" onClick={() => setShowModal(false)} type="button">Cancelar</button>
                <button className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-95 transition-all shadow-sm" type="button" onClick={() => setShowModal(false)}>Enviar Invitación</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleCard({ title, icon, iconColor, desc, footerIcon, footerText, footerColor }) {
  return (
    <div className="p-4 rounded-xl bg-surface-container-low/70 flex flex-col justify-between gap-3 hover:bg-surface-container-low transition-colors">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface">{title}</span>
          <span className={`material-symbols-outlined ${iconColor} text-[18px]`}>{icon}</span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{desc}</p>
      </div>
      <div className={`pt-2 border-t border-surface-container-high/60 flex items-center gap-1.5 font-label-sm text-label-sm ${footerColor}`}>
        <span className="material-symbols-outlined text-[14px]">{footerIcon}</span>
        <span>{footerText}</span>
      </div>
    </div>
  );
}
