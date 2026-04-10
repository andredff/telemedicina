import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "paid_prescriptions";

function readPaid(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return new Set<string>(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function writePaid(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  window.dispatchEvent(new Event("storage"));
}

/**
 * Rastreia quais consultationIds (receitaIds) já foram pagas.
 * Persiste em localStorage — sem necessidade de migration no banco.
 */
export function usePaidPrescriptions() {
  const [paidIds, setPaidIds] = useState<Set<string>>(readPaid);

  useEffect(() => {
    function onStorage() {
      setPaidIds(readPaid());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const markAsPaid = useCallback((receitaIds: string[]) => {
    const current = readPaid();
    for (const id of receitaIds) current.add(id);
    writePaid(current);
    setPaidIds(new Set(current));
  }, []);

  const markAsUnpaid = useCallback((receitaIds: string[]) => {
    const current = readPaid();
    for (const id of receitaIds) current.delete(id);
    writePaid(current);
    setPaidIds(new Set(current));
  }, []);

  const isPaid = useCallback(
    (receitaId: string | number) => paidIds.has(String(receitaId)),
    [paidIds]
  );

  return { isPaid, markAsPaid, markAsUnpaid };
}
