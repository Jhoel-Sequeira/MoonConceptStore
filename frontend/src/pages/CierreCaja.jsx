import React, { useEffect, useMemo, useState } from 'react';
import { formatCordobas, formatCordobaDifference } from '../utils/currency';
import finanzasService from '../services/finanzasService';
import { SplashScreen, useFeedback } from '../components/ui/FeedbackProvider';

const fields = [
  { key: 'efectivo', label: 'Efectivo', icon: 'payments' },
  { key: 'tarjeta', label: 'Tarjeta', icon: 'credit_card' },
  { key: 'transferencia', label: 'Transferencias', icon: 'account_balance' },
];

export default function CierreCajaPage() {
  const { confirm, notify } = useFeedback();
  const [cierre, setCierre] = useState(null);
  const [fondo, setFondo] = useState('');
  const [contado, setContado] = useState({ efectivo: '', tarjeta: '', transferencia: '' });
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await finanzasService.obtenerCierre();
      setCierre(data);
      if (data.cerrado) {
        setFondo(String(data.fondo_inicial));
        setContado(Object.fromEntries(fields.map(({ key }) => [key, String(data.contado[key])])));
        setObservaciones(data.observaciones || '');
      }
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cargar el cierre de caja.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const expected = useMemo(() => ({
    efectivo: Number(fondo || 0) + Number(cierre?.ventas?.efectivo || 0),
    tarjeta: Number(cierre?.ventas?.tarjeta || 0),
    transferencia: Number(cierre?.ventas?.transferencia || 0),
  }), [fondo, cierre]);

  const submit = async (event) => {
    event.preventDefault();
    if (!(await confirm('¿Confirmas el cierre de caja? No se podrán registrar más ventas hoy.', { title: 'Cerrar caja', confirmLabel: 'Confirmar cierre' }))) return;
    setSaving(true);
    setError('');
    try {
      const result = await finanzasService.cerrarCaja({
        fondo_inicial: Number(fondo),
        contado_efectivo: Number(contado.efectivo),
        contado_tarjeta: Number(contado.tarjeta),
        contado_transferencia: Number(contado.transferencia),
        observaciones: observaciones.trim() || null,
      });
      setCierre(result);
      notify('La caja quedó cerrada por hoy.', 'success');
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cerrar la caja.');
    } finally {
      setSaving(false);
    }
  };

  const isClosed = cierre?.cerrado;
  return (
    <div className="flex flex-col w-full gap-space-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Cierre diario de caja</h1>
          <p className="text-sm text-on-surface-variant">Fecha operativa: {cierre?.fecha || '—'}. Un cierre por día.</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${isClosed ? 'bg-secondary-fixed/60 text-on-secondary-fixed-variant' : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'}`}>
          {isClosed ? 'Caja cerrada' : 'Caja abierta'}
        </span>
      </div>

      {error && <div role="alert" className="p-3 rounded-lg bg-error-container text-error text-sm">{error}</div>}
      {loading ? <SplashScreen compact message="Cargando movimientos de caja..." /> : cierre && (
        <form onSubmit={submit} className="flex flex-col gap-5">
          <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-surface-container-low">
              <h2 className="font-bold text-on-surface">Arqueo por método de pago</h2>
              <p className="text-sm text-on-surface-variant">El efectivo esperado suma el fondo inicial y las ventas en efectivo. La tarjeta incluye el cargo POS cobrado al cliente.</p>
              {!isClosed && <div className="mt-4 max-w-xs"><label htmlFor="fondo" className="block text-sm font-semibold mb-1">Fondo inicial de caja (C$)</label><input id="fondo" required min="0" type="number" step="0.01" value={fondo} onChange={(e) => setFondo(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-outline-variant" /></div>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="bg-surface-container-low text-xs uppercase text-on-surface-variant">
                  <th className="py-3 px-4">Método</th><th className="py-3 px-4 text-right">Ventas</th><th className="py-3 px-4 text-right">Esperado</th><th className="py-3 px-4 text-right">Contado</th><th className="py-3 px-4 text-right">Diferencia</th>
                </tr></thead>
                <tbody className="divide-y divide-surface-container-low text-sm">
                  {fields.map(({ key, label, icon }) => {
                    const actual = isClosed ? Number(cierre.contado[key]) : Number(contado[key] || 0);
                    const diff = actual - Number(expected[key] || 0);
                    return <tr key={key}>
                      <td className="py-4 px-4"><span className="material-symbols-outlined align-middle mr-2 text-primary">{icon}</span>{label}</td>
                      <td className="py-4 px-4 text-right">{formatCordobas(cierre.ventas[key] || 0)}</td>
                      <td className="py-4 px-4 text-right font-semibold">{formatCordobas(expected[key] || 0)}</td>
                      <td className="py-4 px-4 text-right">
                        {isClosed ? formatCordobas(cierre.contado[key]) : <input aria-label={`Contado ${label}`} required min="0" type="number" step="0.01" value={contado[key]} onChange={(e) => setContado({ ...contado, [key]: e.target.value })} className="w-32 px-2 py-1 rounded border border-outline-variant text-right" />}
                      </td>
                      <td className={`py-4 px-4 text-right font-semibold ${Math.abs(diff) < 0.01 ? 'text-secondary' : 'text-error'}`}>{formatCordobaDifference(diff)}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
            <label htmlFor="observaciones" className="block font-semibold text-sm text-on-surface mb-2">Observaciones</label>
            <textarea id="observaciones" rows={3} maxLength={2000} disabled={isClosed} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="w-full p-3 bg-surface-container-low rounded-lg text-sm disabled:opacity-70" placeholder="Notas de diferencias o entrega de efectivo" />
          </section>
          {isClosed ? <button type="button" onClick={() => window.print()} className="self-end px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold">Imprimir cierre</button> : (
            <button disabled={saving || !fondo} type="submit" className="self-end px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold disabled:opacity-50">
              {saving ? 'Cerrando…' : 'Confirmar cierre de caja'}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
