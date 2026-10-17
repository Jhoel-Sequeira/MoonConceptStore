import React, { useState, useEffect } from 'react';

export default function BrandModal({ isOpen, onClose, onSave, brandToEdit }) {
    const [formData, setFormData] = useState({
        name: '',
        category: 'decoracion',
        taxId: '',
        repName: '',
        repPhonePrefix: '+56',
        repPhone: '',
        email: '',
        hasPortal: true,
        commission: 20.0,
        payoutCycle: 'quincenal',
        receptionMode: 'consignacion',
        bankEntity: 'santander',
        accountType: 'corriente',
        accountNumber: '',
        accountHolder: '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Si estamos editando, rellenar los campos con los datos de la marca
    useEffect(() => {
        if (brandToEdit) {
            setFormData({
                name: brandToEdit.name || '',
                category: brandToEdit.category || 'decoracion',
                taxId: brandToEdit.skuPrefix || '',
                repName: brandToEdit.contactName || '',
                repPhonePrefix: '+56',
                repPhone: '',
                email: brandToEdit.email || '',
                hasPortal: true,
                commission: brandToEdit.commission || 20.0,
                payoutCycle: 'quincenal',
                receptionMode: 'consignacion',
                bankEntity: 'santander',
                accountType: 'corriente',
                accountNumber: '',
                accountHolder: brandToEdit.contactName || '',
            });
        } else {
            // Si es nueva, limpiar campos
            setFormData({
                name: '',
                category: 'decoracion',
                taxId: '',
                repName: '',
                repPhonePrefix: '+56',
                repPhone: '',
                email: '',
                hasPortal: true,
                commission: 20.0,
                payoutCycle: 'quincenal',
                receptionMode: 'consignacion',
                bankEntity: 'santander',
                accountType: 'corriente',
                accountNumber: '',
                accountHolder: '',
            });
        }
    }, [brandToEdit, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        setTimeout(() => {
            onSave(formData);
            setIsSubmitting(false);
            onClose();
        }, 600);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
                {/* Modal Header */}
                <div className="flex items-start justify-between px-6 py-4 bg-white border-b border-slate-100 z-10">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0 mt-0.5">
                            <span className="material-symbols-outlined text-[24px]">store</span>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                                    {brandToEdit ? 'Editar Marca Aliada' : 'Registrar Nueva Marca Aliada'}
                                </h2>

                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Configura la identidad, representante legal, comisiones por consignación y datos bancarios.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Formulario con Scroll Interno */}
                <form onSubmit={handleSubmit} id="brandForm" className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
                    {/* SECCIÓN 1: Identidad de Marca */}
                    <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">1</span>
                                <h3 className="text-sm font-bold text-slate-800">Identidad de Marca</h3>
                            </div>
                            <span className="text-xs text-slate-400 uppercase tracking-wider">Obligatorio</span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start gap-4">
                            {/* Carga de Logo */}
                            <div className="flex flex-col gap-1 w-full sm:w-auto">
                                <label className="text-xs font-semibold text-slate-700">Logo Distintivo</label>
                                <div className="flex sm:flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer text-center w-full sm:w-[120px]">
                                    <div className="w-16 h-16 rounded-lg bg-white shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                                        <span className="material-symbols-outlined text-indigo-600 text-[24px]">cloud_upload</span>
                                        <span className="text-[10px] text-slate-400">PNG / SVG</span>
                                    </div>
                                    <span className="text-xs text-indigo-600 font-semibold hover:underline">Subir Logo</span>
                                </div>
                            </div>

                            {/* Campos de Identidad */}
                            <div className="flex-1 w-full flex flex-col gap-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-slate-700">
                                            Nombre Comercial <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">verified</span>
                                            <input
                                                required
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                placeholder="ej. Nordic Home"
                                                className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-slate-700">
                                            Categoría Principal <span className="text-rose-500">*</span>
                                        </label>
                                        <select
                                            name="category"
                                            value={formData.category}
                                            onChange={handleChange}
                                            className="w-full h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                                        >
                                            <option value="Hogar & Deco">Decoración y Hogar</option>
                                            <option value="Moda Sostenible">Indumentaria y Textil</option>
                                            <option value="Cosmética Orgánica">Cosmética Natural y Botánica</option>
                                            <option value="Joyería">Joyería y Orfebrería</option>
                                            <option value="Marroquinería">Accesorios y Marroquinería</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-slate-700">
                                        Razón Social / Identificador Fiscal (RUT / RFC) <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">badge</span>
                                        <input
                                            required
                                            type="text"
                                            name="taxId"
                                            value={formData.taxId}
                                            onChange={handleChange}
                                            placeholder="ej. 76.543.210-K"
                                            className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* SECCIÓN 2: Contacto Principal */}
                    <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">2</span>
                                <h3 className="text-sm font-bold text-slate-800">Contacto & Representante Legal</h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-700">
                                    Nombre del Representante <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">person</span>
                                    <input
                                        required
                                        type="text"
                                        name="repName"
                                        value={formData.repName}
                                        onChange={handleChange}
                                        placeholder="ej. Elena Müller"
                                        className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-700">
                                    WhatsApp Directo <span className="text-rose-500">*</span>
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <select
                                        name="repPhonePrefix"
                                        value={formData.repPhonePrefix}
                                        onChange={handleChange}
                                        className="w-24 h-9 px-2 rounded-lg bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200"
                                    >
                                        <option value="+56">🇨🇱 +56</option>
                                        <option value="+54">🇦🇷 +54</option>
                                        <option value="+34">🇪🇸 +34</option>
                                        <option value="+52">🇲🇽 +52</option>
                                        <option value="+57">🇨🇴 +57</option>
                                    </select>
                                    <input
                                        type="tel"
                                        name="repPhone"
                                        value={formData.repPhone}
                                        onChange={handleChange}
                                        placeholder="9 8765 4321"
                                        className="flex-1 h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-700">
                                Correo Electrónico para Liquidaciones <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">alternate_email</span>
                                <input
                                    required
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="ej. finanzas@nordichome.design"
                                    className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                                />
                            </div>
                        </div>
                    </section>

                    {/* SECCIÓN 3: Acuerdo Comercial */}
                    <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">3</span>
                                <h3 className="text-sm font-bold text-slate-800">Acuerdo Comercial & Comisiones</h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-700">
                                    % Comisión Tienda <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        name="commission"
                                        value={formData.commission}
                                        onChange={handleChange}
                                        className="w-full h-9 pl-3 pr-8 rounded-lg bg-slate-50 text-sm font-bold text-slate-900 border border-slate-200 focus:outline-none focus:border-indigo-600"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-700">Ciclo de Liquidación</label>
                                <select
                                    name="payoutCycle"
                                    value={formData.payoutCycle}
                                    onChange={handleChange}
                                    className="w-full h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                                >
                                    <option value="quincenal">Quincenal (Días 15 y 30)</option>
                                    <option value="mensual">Mensual (Fin de mes)</option>
                                    <option value="semanal">Semanal (Cada lunes)</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* SECCIÓN 4: Datos Bancarios */}
                    <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">4</span>
                                <h3 className="text-sm font-bold text-slate-800">Datos Bancarios para Transferencias</h3>
                            </div>
                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">lock</span>
                                Transferencia Segura
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-700">Banco</label>
                                <select
                                    name="bankEntity"
                                    value={formData.bankEntity}
                                    onChange={handleChange}
                                    className="w-full h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                                >
                                    <option value="santander">Banco Santander</option>
                                    <option value="bbva">BBVA</option>
                                    <option value="chile">Banco de Chile</option>
                                    <option value="bci">Banco BCI</option>
                                    <option value="mercadopago">Mercado Pago / CVU</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-700">Tipo de Cuenta</label>
                                <select
                                    name="accountType"
                                    value={formData.accountType}
                                    onChange={handleChange}
                                    className="w-full h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                                >
                                    <option value="corriente">Cuenta Corriente</option>
                                    <option value="ahorro">Caja de Ahorro</option>
                                    <option value="vista">Cuenta Vista / RUT</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-700">Número de Cuenta</label>
                                <input
                                    type="text"
                                    name="accountNumber"
                                    value={formData.accountNumber}
                                    onChange={handleChange}
                                    placeholder="000-12345678-9"
                                    className="w-full h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-700">Titular de la Cuenta</label>
                                <input
                                    type="text"
                                    name="accountHolder"
                                    value={formData.accountHolder}
                                    onChange={handleChange}
                                    placeholder="Nombre o Razón Social"
                                    className="w-full h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                                />
                            </div>
                        </div>
                    </section>
                </form>

                {/* Footer del Modal */}
                <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-200">
                    <span className="text-xs text-slate-500">
                        Los cambios se aplicarán inmediatamente al catálogo
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            form="brandForm"
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[18px]">
                                {isSubmitting ? 'progress_activity' : 'check'}
                            </span>
                            <span>{isSubmitting ? 'Guardando...' : brandToEdit ? 'Guardar Cambios' : 'Guardar y Dar de Alta'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}