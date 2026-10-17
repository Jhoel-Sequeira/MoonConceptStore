import React, { useState } from 'react';
import brandConfig from '../brandConfig';
import { formatCordobas } from '../utils/currency';

const INITIAL_LIQUIDACIONES = [
  {
    id: 1,
    marca: 'Nordic Home',
    codigo: 'NDH',
    ventasBrutas: 12450.00,
    comisionPorc: 20,
    retencion: 2490.00,
    netoPagar: 9960.00,
    estado: 'Pendiente',
    banco: 'BAC Credomatic',
    cuenta: '362-819-283',
    periodo: '01 Oct - 15 Oct 2024'
  },
  {
    id: 2,
    marca: 'Vera Studio',
    codigo: 'VRA',
    ventasBrutas: 8600.00,
    comisionPorc: 22,
    retencion: 1892.00,
    netoPagar: 6708.00,
    estado: 'Pagado',
    banco: 'Banco Lafise',
    cuenta: '102-938-475',
    periodo: '01 Oct - 15 Oct 2024'
  },
  {
    id: 3,
    marca: 'Aura Botanics',
    codigo: 'AUR',
    ventasBrutas: 6920.00,
    comisionPorc: 18,
    retencion: 1245.60,
    netoPagar: 5674.40,
    estado: 'Pendiente',
    banco: 'Banpro',
    cuenta: '991-234-882',
    periodo: '01 Oct - 15 Oct 2024'
  },
  {
    id: 4,
    marca: 'Komorebi Crafts',
    codigo: 'KMB',
    ventasBrutas: 4320.00,
    comisionPorc: 20,
    retencion: 864.00,
    netoPagar: 3456.00,
    estado: 'En Revisión',
    banco: 'BAC Credomatic',
    cuenta: '123-456-789',
    periodo: '01 Oct - 15 Oct 2024'
  }
];

export default function LiquidacionesPage() {
  const [liquidaciones, setLiquidaciones] = useState(INITIAL_LIQUIDACIONES);
  const [selectedLiquidacion, setSelectedLiquidacion] = useState(null);
  const [filter, setFilter] = useState('Todos');

  const filteredList = liquidaciones.filter(l => {
    if (filter === 'Pendiente') return l.estado === 'Pendiente';
    if (filter === 'Pagado') return l.estado === 'Pagado';
    return true;
  });

  const totalBruto = liquidaciones.reduce((acc, l) => acc + l.ventasBrutas, 0);
  const totalRetencion = liquidaciones.reduce((acc, l) => acc + l.retencion, 0);
  const totalNeto = liquidaciones.reduce((acc, l) => acc + l.netoPagar, 0);

  const handleExportCSV = () => {
    const headers = "ID,Marca,Ventas Brutas (C$),Comision %,Retencion Tienda (C$),Neto Pagar (C$),Banco,Cuenta,Estado\n";
    const rows = liquidaciones.map(l =>
      `"${l.id}","${l.marca}","${l.ventasBrutas}","${l.comisionPorc}%","${l.retencion}","${l.netoPagar}","${l.banco}","${l.cuenta}","${l.estado}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `liquidaciones_marcas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMarkAsPaid = (id) => {
    setLiquidaciones(liquidaciones.map(l => l.id === id ? { ...l, estado: 'Pagado' } : l));
    if (selectedLiquidacion && selectedLiquidacion.id === id) {
      setSelectedLiquidacion({ ...selectedLiquidacion, estado: 'Pagado' });
    }
  };

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* 1. Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary-fixed text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            </span>
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">Liquidaciones a Marcas Aliadas</h1>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Rendición de cuentas de consignación, retención de comisiones y pagos en {brandConfig.name}
          </p>
        </div>
        <div className="flex items-center gap-space-sm">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-surface-container-low text-on-surface px-4 py-2 rounded-lg font-label-md text-label-md hover:bg-surface-container transition-all"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between">
          <span className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Ventas Brutas Período</span>
          <div className="font-headline-xl font-bold text-on-surface mt-1">{formatCordobas(totalBruto)}</div>
          <span className="text-xs text-secondary font-semibold mt-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">trending_up</span> +14.2% vs ciclo anterior
          </span>
        </div>

        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between">
          <span className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Comisión Tienda Retenida</span>
          <div className="font-headline-xl font-bold text-on-surface mt-1">{formatCordobas(totalRetencion)}</div>
          <span className="text-xs text-primary font-semibold mt-2">Margen promedio 20.8%</span>
        </div>

        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between">
          <span className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Neto por Liquidar a Marcas</span>
          <div className="font-headline-xl font-bold text-tertiary mt-1">{formatCordobas(totalNeto)}</div>
          <span className="text-xs text-on-surface-variant mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-tertiary-container animate-pulse"></span>
            {liquidaciones.filter(l => l.estado === 'Pendiente').length} marcas pendientes de pago
          </span>
        </div>

        <div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between">
          <span className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Próximo Corte</span>
          <div className="font-headline-xl font-bold text-on-surface mt-1">31 de Octubre</div>
          <span className="text-xs text-on-surface-variant mt-2">Cierre programado en 17 días</span>
        </div>
      </div>

      {/* 3. Table and Detail Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        <div className="xl:col-span-8 flex flex-col bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="px-space-lg py-space-md flex items-center justify-between bg-surface-container-low/40">
            <span className="font-semibold text-sm text-on-surface">Detalle de Rendición por Marca</span>
            <div className="flex items-center gap-1">
              {['Todos', 'Pendiente', 'Pagado'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${filter === f ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low font-label-sm text-xs uppercase text-on-surface-variant tracking-wider">
                  <th className="py-3 px-4">Marca Aliada</th>
                  <th className="py-3 px-4 text-right">Ventas Brutas</th>
                  <th className="py-3 px-4 text-center">Comisión %</th>
                  <th className="py-3 px-4 text-right">Retención Tienda</th>
                  <th className="py-3 px-4 text-right font-bold text-on-surface">Neto a Pagar</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low text-sm font-body-sm">
                {filteredList.map(l => (
                  <tr
                    key={l.id}
                    onClick={() => setSelectedLiquidacion(l)}
                    className="hover:bg-surface-container-low/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-on-surface">{l.marca}</span>
                        <span className="text-xs font-mono text-on-surface-variant">{l.codigo}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">{formatCordobas(l.ventasBrutas)}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-primary">{l.comisionPorc}%</td>
                    <td className="py-3.5 px-4 text-right font-mono text-secondary">−{formatCordobas(l.retencion)}</td>
                    <td className="py-3.5 px-4 text-right font-bold font-mono text-on-surface">{formatCordobas(l.netoPagar)}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${l.estado === 'Pagado' ? 'bg-secondary-fixed/50 text-on-secondary-fixed-variant' : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'}`}>
                        {l.estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {l.estado !== 'Pagado' ? (
                        <button
                          onClick={() => handleMarkAsPaid(l.id)}
                          className="px-2.5 py-1 rounded bg-primary text-on-primary text-xs font-semibold hover:opacity-90"
                        >
                          Pagar
                        </button>
                      ) : (
                        <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Detail Card */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col gap-3">
            <h3 className="font-bold text-sm text-on-surface">Datos Bancarios para Transferencia</h3>
            {selectedLiquidacion ? (
              <div className="flex flex-col gap-2.5">
                <div className="p-3 bg-surface-container-low rounded-lg flex flex-col gap-1">
                  <span className="text-xs font-semibold text-primary">{selectedLiquidacion.marca}</span>
                  <span className="text-sm font-bold text-on-surface">Neto: {formatCordobas(selectedLiquidacion.netoPagar)}</span>
                  <span className="text-xs text-on-surface-variant font-mono">Período: {selectedLiquidacion.periodo}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant">Banco:</span>
                  <span className="font-bold text-on-surface">{selectedLiquidacion.banco}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant">No. de Cuenta:</span>
                  <span className="font-mono font-bold text-on-surface">{selectedLiquidacion.cuenta}</span>
                </div>
                {selectedLiquidacion.estado !== 'Pagado' && (
                  <button
                    onClick={() => handleMarkAsPaid(selectedLiquidacion.id)}
                    className="w-full py-2.5 rounded-lg bg-primary text-on-primary font-bold text-xs shadow-sm hover:opacity-95 mt-2"
                  >
                    Marcar como Liquidado y Notificar Marca
                  </button>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-on-surface-variant">
                Selecciona una marca en la tabla para ver su cuenta bancaria y liquidar.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
