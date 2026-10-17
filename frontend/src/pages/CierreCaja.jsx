import React, { useState } from 'react';
import brandConfig from '../brandConfig';
import { formatCordobas, formatCordobaDifference } from '../utils/currency';

const INITIAL_METHODS = [
  {
    id: 'cash',
    name: 'Efectivo en Caja',
    desc: 'Incluye fondo inicial de C$ 150.00',
    icon: 'payments',
    esperado: 1240.00,
    contado: 1240.00,
    subdesc: '10 ventas físicas'
  },
  {
    id: 'cards',
    name: 'Tarjetas Débito / Crédito',
    desc: '24 transacciones POS terminal',
    icon: 'credit_card',
    esperado: 2860.00,
    contado: 2860.00,
    subdesc: 'Lote POS #0089'
  },
  {
    id: 'transfers',
    name: 'Transferencias Bancarias',
    desc: '4 comprobantes verificados',
    icon: 'account_balance',
    esperado: 750.00,
    contado: 750.00,
    subdesc: 'Bancos directos'
  }
];

const BRAND_BREAKDOWN = [
  { name: 'Nordic Home', percentage: 31.3, amount: 1520.00, items: 14, color: 'bg-primary' },
  { name: 'Vera Studio', percentage: 26.4, amount: 1280.00, items: 9, color: 'bg-secondary' },
  { name: 'Aura Botanics', percentage: 23.1, amount: 1120.00, items: 8, color: 'bg-tertiary-container' },
  { name: 'Komorebi Crafts', percentage: 19.2, amount: 930.00, items: 7, color: 'bg-surface-tint' }
];

export default function CierreCajaPage() {
  const [methods, setMethods] = useState(INITIAL_METHODS);
  const [notes, setNotes] = useState('');
  const [isClosed, setIsClosed] = useState(false);

  const handleContadoChange = (id, val) => {
    const num = parseFloat(val) || 0;
    setMethods(methods.map(m => m.id === id ? { ...m, contado: num } : m));
  };

  const handleQuickFill = () => {
    setMethods(methods.map(m => ({ ...m, contado: m.esperado })));
  };

  const totalEsperado = methods.reduce((acc, m) => acc + m.esperado, 0);
  const totalContado = methods.reduce((acc, m) => acc + m.contado, 0);
  const totalDiff = totalContado - totalEsperado;

  const handleConfirmClose = () => {
    if (window.confirm("¿Confirmar arqueo y cierre del turno actual? Se emitirá el reporte Z.")) {
      setIsClosed(true);
      window.print();
    }
  };

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* 1. Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary-fixed text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">lock_clock</span>
            </span>
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">Cierre de Caja y Arqueo de Turno</h1>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {brandConfig.name} · {brandConfig.branchName} — Turno Mañana (Cajera Principal)
          </p>
        </div>
        <div className="flex items-center gap-space-sm">
          <span className="px-3 py-1.5 rounded-full bg-secondary-fixed/60 text-on-secondary-fixed-variant font-label-sm font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary"></span> Caja Abierta
          </span>
          <button
            onClick={handleConfirmClose}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md shadow-sm hover:opacity-95"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>Finalizar y Cerrar Turno</span>
          </button>
        </div>
      </div>

      {/* 2. Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Left Column: Reconciliation (8 cols) */}
        <div className="xl:col-span-8 flex flex-col gap-5">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[20px]">account_balance_wallet</span>
                <div>
                  <h2 className="font-headline-sm text-on-surface font-bold">Conciliación de Balances de Caja</h2>
                  <p className="text-xs text-on-surface-variant">Ingrese los valores auditados para calcular discrepancias en tiempo real</p>
                </div>
              </div>
              <button onClick={handleQuickFill} className="text-primary hover:underline font-label-sm text-xs font-semibold" type="button">
                Autocompletar esperados
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-xs uppercase tracking-wider">
                    <th className="py-3 px-4">Método de Pago</th>
                    <th className="py-3 px-4 text-right">Esperado</th>
                    <th className="py-3 px-4 text-right min-w-[180px]">Contado Real (C$)</th>
                    <th className="py-3 px-4 text-right">Diferencia</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low text-on-surface font-body-md text-sm">
                  {methods.map((m) => {
                    const diff = m.contado - m.esperado;
                    const isExact = Math.abs(diff) < 0.01;
                    return (
                      <tr key={m.id} className="hover:bg-surface-container-low/50">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                              <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-on-surface">{m.name}</span>
                              <span className="text-xs text-on-surface-variant">{m.desc}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right font-semibold">
                          {formatCordobas(m.esperado)}
                          <div className="text-xs font-normal text-on-surface-variant">{m.subdesc}</div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={m.contado}
                            onChange={(e) => handleContadoChange(m.id, e.target.value)}
                            className="w-36 h-9 px-3 bg-surface-container-low rounded-lg text-right font-mono font-bold text-on-surface border border-outline-variant/30 focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-semibold">
                          <span className={isExact ? 'text-secondary' : diff > 0 ? 'text-primary' : 'text-error'}>
                            {formatCordobaDifference(diff)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isExact ? 'bg-secondary-fixed/60 text-on-secondary-fixed-variant' : diff > 0 ? 'bg-primary-fixed text-primary' : 'bg-error-container text-error'}`}>
                            {isExact ? 'Cuadrado' : diff > 0 ? 'Sobrante' : 'Faltante'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-container font-label-lg font-bold text-sm">
                    <td className="py-3.5 px-4 text-on-surface">TOTAL ARQUEO</td>
                    <td className="py-3.5 px-4 text-right font-mono">{formatCordobas(totalEsperado)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-primary">{formatCordobas(totalContado)}</td>
                    <td className={`py-3.5 px-4 text-right font-mono ${Math.abs(totalDiff) < 0.01 ? 'text-secondary' : 'text-error'}`}>
                      {formatCordobaDifference(totalDiff)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${Math.abs(totalDiff) < 0.01 ? 'bg-secondary text-on-secondary' : 'bg-error text-on-error'}`}>
                        {Math.abs(totalDiff) < 0.01 ? 'Balance Exacto' : 'Discrepancia'}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Observations */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col gap-2">
            <label className="font-semibold text-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">edit_note</span>
              Observaciones y Notas de Cierre
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Fondo de caja de C$ 150.00 entregado al supervisor. Vouchers POS grapados en sobre de auditoría..."
              className="w-full p-3 bg-surface-container-low rounded-lg text-sm text-on-surface focus:outline-none"
            />
          </div>
        </div>

        {/* Right Column: Breakdown (4 cols) */}
        <div className="xl:col-span-4 flex flex-col gap-5">
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Métricas de Turno</span>
              <div className="font-headline-xl font-bold text-on-surface mt-1">{formatCordobas(totalEsperado)}</div>
              <span className="text-xs text-on-surface-variant">38 tickets · Promedio: C$ 127.63</span>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-surface-container-low">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Ventas por Marca en Consignación</span>
              <div className="flex flex-col gap-2.5">
                {BRAND_BREAKDOWN.map((b, idx) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-on-surface">{b.name}</span>
                      <span className="font-mono text-on-surface">{formatCordobas(b.amount)} ({b.percentage}%)</span>
                    </div>
                    <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
                      <div className={`${b.color} h-full rounded-full`} style={{ width: `${b.percentage}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
