import { useState, useEffect } from 'react';

const STORAGE_KEY = 'novita_doctor_online';

export function useDoctorStatus() {
  // Default to online when the doctor hasn't chosen yet — opening the medical
  // area means available; going offline is an explicit "Não disponível".
  const [online, setOnlineState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  });

  const toggle = () => {
    const next = !online;
    setOnlineState(next);
    localStorage.setItem(STORAGE_KEY, String(next));
    window.dispatchEvent(new CustomEvent('doctor-status-change', { detail: next }));
  };

  useEffect(() => {
    const handler = (e: Event) => {
      setOnlineState((e as CustomEvent<boolean>).detail);
    };
    window.addEventListener('doctor-status-change', handler);
    return () => window.removeEventListener('doctor-status-change', handler);
  }, []);

  return { online, toggle };
}

export default function DoctorStatusToggle() {
  const { online, toggle } = useDoctorStatus();

  return (
    <div className="mx-3 mb-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
        Status de Atendimento
      </p>

      <button
        onClick={toggle}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 text-left
          ${online
            ? 'bg-green-50 border-green-200 hover:bg-green-100'
            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
          }
        `}
      >
        {/* Indicator */}
        <div className="relative shrink-0">
          <div className={`w-3 h-3 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
          {online && (
            <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
          )}
        </div>

        {/* Label */}
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-bold leading-none ${online ? 'text-green-700' : 'text-gray-500'}`}>
            {online ? 'Online' : 'Offline'}
          </p>
          <p className={`text-[10px] mt-0.5 leading-none ${online ? 'text-green-600' : 'text-gray-400'}`}>
            {online ? 'Recebendo consultas' : 'Não disponível'}
          </p>
        </div>

        {/* Toggle pill */}
        <div className={`
          w-8 h-4 rounded-full transition-colors shrink-0 relative
          ${online ? 'bg-green-500' : 'bg-gray-300'}
        `}>
          <div className={`
            absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform
            ${online ? 'translate-x-4' : 'translate-x-0.5'}
          `} />
        </div>
      </button>
    </div>
  );
}
