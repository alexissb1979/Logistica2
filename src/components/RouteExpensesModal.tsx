import React, { useState, useEffect } from 'react';
import { X, DollarSign, Save, ShieldAlert, Coins, Plus, Calculator } from 'lucide-react';
import { RouteExpenses, LogisticsManifest } from '../types';

interface RouteExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifest: LogisticsManifest;
  onSave: (expenses: RouteExpenses) => void;
  isAdmin: boolean;
}

const formatCLP = (num: number) => {
  return Math.round(num).toLocaleString('es-CL');
};

const parseCLP = (str: string) => {
  const clean = str.replace(/\D/g, '');
  return clean === '' ? 0 : Number(clean);
};

interface ExpenseFieldCalculatorProps {
  label: string;
  descLabel?: string;
  descValue?: string;
  onDescChange?: (val: string) => void;
  amount: string;
  onAmountChange: (val: string) => void;
  list: number[];
  onListChange: (newList: number[]) => void;
  disabled: boolean;
}

const ExpenseFieldCalculator: React.FC<ExpenseFieldCalculatorProps> = ({
  label,
  descLabel,
  descValue,
  onDescChange,
  amount,
  onAmountChange,
  list,
  onListChange,
  disabled,
}) => {
  const [newSubVal, setNewSubVal] = useState('');

  const handleAddSub = () => {
    const val = parseCLP(newSubVal);
    if (val <= 0) return;
    const newList = [...list, val];
    onListChange(newList);
    const sum = newList.reduce((a, b) => a + b, 0);
    onAmountChange(formatCLP(sum));
    setNewSubVal('');
  };

  const handleRemoveSub = (index: number) => {
    const newList = list.filter((_, i) => i !== index);
    onListChange(newList);
    const sum = newList.reduce((a, b) => a + b, 0);
    onAmountChange(formatCLP(sum));
  };

  return (
    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3 transition-all duration-150 hover:border-slate-300">
      <div className="flex items-center justify-between">
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
          {label}
        </label>
        {list.length > 0 && (
          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Calculator className="w-2.5 h-2.5" />
            {list.length} {list.length === 1 ? 'boleta' : 'boletas'}
          </span>
        )}
      </div>

      {descLabel && onDescChange && (
        <input
          disabled={disabled}
          type="text"
          placeholder={descLabel}
          value={descValue || ''}
          onChange={(e) => onDescChange(e.target.value)}
          className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      )}

      {/* Main Total Display/Input */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
        <input
          disabled={disabled}
          type="text"
          value={amount}
          onChange={(e) => {
            const rawVal = e.target.value;
            onAmountChange(formatCLP(parseCLP(rawVal)));
            if (list.length > 0) {
              onListChange([]);
            }
          }}
          className="w-full text-sm font-black pl-7 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed font-mono"
        />
      </div>

      {/* Adder Form */}
      {!disabled && (
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[11px]">$</span>
              <input
                type="text"
                placeholder="Sumar boleta/monto..."
                value={newSubVal}
                onChange={(e) => setNewSubVal(formatCLP(parseCLP(e.target.value)))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSub();
                  }
                }}
                className="w-full text-xs pl-5 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-slate-800"
              />
            </div>
            <button
              type="button"
              onClick={handleAddSub}
              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0"
              title="Sumar boleta"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sub-amounts pills list */}
      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1.5 max-h-24 overflow-y-auto">
          {list.map((val, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold font-mono rounded-lg transition-colors group"
            >
              <span>${formatCLP(val)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveSub(idx)}
                  className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const RouteExpensesModal: React.FC<RouteExpensesModalProps> = ({
  isOpen,
  onClose,
  manifest,
  onSave,
  isAdmin,
}) => {
  const [colacion, setColacion] = useState('0');
  const [colacionList, setColacionList] = useState<number[]>([]);

  const [peaje, setPeaje] = useState('0');
  const [peajeList, setPeajeList] = useState<number[]>([]);

  const [reparacion, setReparacion] = useState('0');
  const [reparacionList, setReparacionList] = useState<number[]>([]);

  const [combustible, setCombustible] = useState('0');
  const [combustibleList, setCombustibleList] = useState<number[]>([]);

  const [otrosDesc1, setOtrosDesc1] = useState('');
  const [otrosAmount1, setOtrosAmount1] = useState('0');
  const [otrosList1, setOtrosList1] = useState<number[]>([]);

  const [otrosDesc2, setOtrosDesc2] = useState('');
  const [otrosAmount2, setOtrosAmount2] = useState('0');
  const [otrosList2, setOtrosList2] = useState<number[]>([]);

  const [otrosDesc3, setOtrosDesc3] = useState('');
  const [otrosAmount3, setOtrosAmount3] = useState('0');
  const [otrosList3, setOtrosList3] = useState<number[]>([]);

  // Initialize values when manifest changes or modal opens
  useEffect(() => {
    if (isOpen && manifest) {
      const exp = manifest.expenses;
      setColacion(formatCLP(exp?.colacion || 0));
      setColacionList(exp?.colacionList || []);

      setPeaje(formatCLP(exp?.peaje || 0));
      setPeajeList(exp?.peajeList || []);

      setReparacion(formatCLP(exp?.reparacion || 0));
      setReparacionList(exp?.reparacionList || []);

      setCombustible(formatCLP(exp?.combustible || 0));
      setCombustibleList(exp?.combustibleList || []);

      setOtrosDesc1(exp?.otrosDesc1 || '');
      setOtrosAmount1(formatCLP(exp?.otrosAmount1 || 0));
      setOtrosList1(exp?.otrosList1 || []);

      setOtrosDesc2(exp?.otrosDesc2 || '');
      setOtrosAmount2(formatCLP(exp?.otrosAmount2 || 0));
      setOtrosList2(exp?.otrosList2 || []);

      setOtrosDesc3(exp?.otrosDesc3 || '');
      setOtrosAmount3(formatCLP(exp?.otrosAmount3 || 0));
      setOtrosList3(exp?.otrosList3 || []);
    }
  }, [isOpen, manifest]);

  if (!isOpen) return null;

  const isDisabled = !!manifest.logisticsDataSaved && !isAdmin;

  const valColacion = parseCLP(colacion);
  const valPeaje = parseCLP(peaje);
  const valReparacion = parseCLP(reparacion);
  const valCombustible = parseCLP(combustible);
  const valOtros1 = parseCLP(otrosAmount1);
  const valOtros2 = parseCLP(otrosAmount2);
  const valOtros3 = parseCLP(otrosAmount3);

  const totalExpenses =
    valColacion + valPeaje + valReparacion + valCombustible + valOtros1 + valOtros2 + valOtros3;

  const handleSave = () => {
    onSave({
      colacion: valColacion,
      colacionList,
      peaje: valPeaje,
      peajeList,
      reparacion: valReparacion,
      reparacionList,
      combustible: valCombustible,
      combustibleList,
      otrosAmount1: valOtros1,
      otrosList1,
      otrosDesc1,
      otrosAmount2: valOtros2,
      otrosList2,
      otrosDesc2,
      otrosAmount3: valOtros3,
      otrosList3,
      otrosDesc3,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-150 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Coins className="w-6 h-6 text-indigo-200" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider">Gastos de Ruta (Calculadora Integrada)</h2>
              <p className="text-xs text-indigo-200 font-medium">HR-{manifest.routeNumber || '1001'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {manifest.logisticsDataSaved && (
            <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <span className="font-bold block uppercase tracking-wider text-[10px] text-amber-700">Ruta Cerrada</span>
                {isAdmin ? (
                  <span>Tiene permisos de Administrador. Puede editar y re-guardar los gastos de todas formas.</span>
                ) : (
                  <span>Los datos de esta ruta están cerrados y guardados. No tiene permisos para modificarlos.</span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Standard Expenses */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                Conceptos Fijos
              </h3>

              {/* Colacion */}
              <ExpenseFieldCalculator
                label="Colación / Alimentación"
                amount={colacion}
                onAmountChange={setColacion}
                list={colacionList}
                onListChange={setColacionList}
                disabled={isDisabled}
              />

              {/* Peaje */}
              <ExpenseFieldCalculator
                label="Peajes / Pórticos"
                amount={peaje}
                onAmountChange={setPeaje}
                list={peajeList}
                onListChange={setPeajeList}
                disabled={isDisabled}
              />

              {/* Reparación */}
              <ExpenseFieldCalculator
                label="Reparación / Imprevisto"
                amount={reparacion}
                onAmountChange={setReparacion}
                list={reparacionList}
                onListChange={setReparacionList}
                disabled={isDisabled}
              />

              {/* Combustible */}
              <ExpenseFieldCalculator
                label="Combustible (Carga/Relleno)"
                amount={combustible}
                onAmountChange={setCombustible}
                list={combustibleList}
                onListChange={setCombustibleList}
                disabled={isDisabled}
              />
            </div>

            {/* Other Expenses */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                Otros Gastos (Opcionales)
              </h3>

              {/* Otro 1 */}
              <ExpenseFieldCalculator
                label="Gasto Adicional 1"
                descLabel="Descripción (ej. Estacionamiento)"
                descValue={otrosDesc1}
                onDescChange={setOtrosDesc1}
                amount={otrosAmount1}
                onAmountChange={setOtrosAmount1}
                list={otrosList1}
                onListChange={setOtrosList1}
                disabled={isDisabled}
              />

              {/* Otro 2 */}
              <ExpenseFieldCalculator
                label="Gasto Adicional 2"
                descLabel="Descripción (ej. Lavado)"
                descValue={otrosDesc2}
                onDescChange={setOtrosDesc2}
                amount={otrosAmount2}
                onAmountChange={setOtrosAmount2}
                list={otrosList2}
                onListChange={setOtrosList2}
                disabled={isDisabled}
              />

              {/* Otro 3 */}
              <ExpenseFieldCalculator
                label="Gasto Adicional 3"
                descLabel="Descripción (ej. Insumo de embalaje)"
                descValue={otrosDesc3}
                onDescChange={setOtrosDesc3}
                amount={otrosAmount3}
                onAmountChange={setOtrosAmount3}
                list={otrosList3}
                onListChange={setOtrosList3}
                disabled={isDisabled}
              />
            </div>
          </div>

          {/* Total Display */}
          <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-600" />
              <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">
                Total de Gastos de Ruta
              </span>
            </div>
            <span className="text-lg font-black text-indigo-700 font-mono">
              ${formatCLP(totalExpenses)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          {!isDisabled && (
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-indigo-600/10 active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" /> Guardar Gastos
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
