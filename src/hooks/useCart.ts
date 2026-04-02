import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CartItem, CatalogCartItem } from "@/types/prescription";

const LOCAL_KEY = "cart";
const CATALOG_KEY = "catalog_cart";

function readCatalogLocal(): CatalogCartItem[] {
  try {
    return JSON.parse(localStorage.getItem(CATALOG_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeCatalogLocal(items: CatalogCartItem[]) {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("storage"));
}

function readLocal(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocal(items: CartItem[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("storage"));
}

/**
 * Cart hook backed by Supabase `cart_items` when the user is authenticated.
 * Falls back to localStorage when no session is available.
 *
 * On first load with an active session, any items lingering in localStorage are
 * merged into the remote cart so nothing is lost across device switches.
 */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogCartItem[]>(readCatalogLocal());
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const synced = useRef(false);

  // ── Sync catalogItems from localStorage on storage events ─────────────────
  useEffect(() => {
    function onStorage() {
      setCatalogItems(readCatalogLocal());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Refresh catalog item prices from Supabase ─────────────────────────────
  useEffect(() => {
    const local = readCatalogLocal();
    if (local.length === 0) return;

    const ids = local.map((i) => i.cartItemId);
    supabase
      .from("medications")
      .select("id, price")
      .in("id", ids)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const priceMap = new Map(data.map((m: any) => [m.id, Number(m.price)]));
        const refreshed = local.map((i) =>
          priceMap.has(i.cartItemId) ? { ...i, price: priceMap.get(i.cartItemId)! } : i
        );
        writeCatalogLocal(refreshed);
        setCatalogItems(refreshed);
      });
  }, []);

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user?.id ?? null);
      }
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch remote cart ─────────────────────────────────────────────────────
  const fetchRemote = useCallback(async (uid: string): Promise<CartItem[]> => {
    const { data, error } = await supabase
      .from("cart_items")
      .select("id, medication_id, prescription_id, quantity, pharmacy_id, pharmacy_name, medications(name, dosage, frequency, duration, price, in_stock, image_url)")
      .eq("user_id", uid);

    if (error || !data) return [];

    return data.map((row: any) => {
      const med = row.medications ?? {};
      return {
        cartItemId: row.id,
        id: row.medication_id,
        prescriptionId: row.prescription_id,
        quantity: row.quantity,
        pharmacyId: row.pharmacy_id ?? undefined,
        pharmacyName: row.pharmacy_name ?? undefined,
        name: med.name ?? "",
        dosage: med.dosage ?? "",
        frequency: med.frequency ?? "",
        duration: med.duration ?? "",
        price: Number(med.price ?? 0),
        inStock: med.in_stock ?? true,
        imageUrl: med.image_url ?? undefined,
      } satisfies CartItem;
    });
  }, []);

  // ── Sync localStorage → Supabase (runs once per session) ──────────────────
  const syncLocalToRemote = useCallback(async (uid: string) => {
    const local = readLocal();
    if (local.length === 0) return;

    for (const item of local) {
      await supabase.from("cart_items").upsert(
        {
          user_id: uid,
          medication_id: item.id,
          prescription_id: item.prescriptionId,
          quantity: item.quantity,
          pharmacy_id: item.pharmacyId ?? null,
          pharmacy_name: item.pharmacyName ?? null,
        },
        { onConflict: "user_id,medication_id" }
      );
    }

    localStorage.removeItem(LOCAL_KEY);
  }, []);

  // ── Load cart on userId change ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      if (!userId) {
        setItems(readLocal());
        setLoading(false);
        synced.current = false;
        return;
      }

      // Merge localStorage into remote once
      if (!synced.current) {
        await syncLocalToRemote(userId);
        synced.current = true;
      }

      const remote = await fetchRemote(userId);
      if (!cancelled) {
        setItems(remote);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [userId, fetchRemote, syncLocalToRemote]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addItems = useCallback(
    async (newItems: CartItem[]) => {
      if (!userId) {
        const current = readLocal();
        const merged = [...current, ...newItems];
        writeLocal(merged);
        setItems(merged);
        return;
      }

      for (const item of newItems) {
        await supabase.from("cart_items").upsert(
          {
            user_id: userId,
            medication_id: item.id,
            prescription_id: item.prescriptionId,
            quantity: item.quantity,
            pharmacy_id: item.pharmacyId ?? null,
            pharmacy_name: item.pharmacyName ?? null,
          },
          { onConflict: "user_id,medication_id" }
        );
      }

      const remote = await fetchRemote(userId);
      setItems(remote);
    },
    [userId, fetchRemote]
  );

  const updateQuantity = useCallback(
    async (cartItemId: string, newQuantity: number) => {
      if (newQuantity < 1) return;

      if (!userId) {
        const updated = readLocal().map((i) =>
          i.cartItemId === cartItemId ? { ...i, quantity: newQuantity } : i
        );
        writeLocal(updated);
        setItems(updated);
        return;
      }

      await supabase
        .from("cart_items")
        .update({ quantity: newQuantity })
        .eq("id", cartItemId);

      setItems((prev) =>
        prev.map((i) =>
          i.cartItemId === cartItemId ? { ...i, quantity: newQuantity } : i
        )
      );
    },
    [userId]
  );

  const removeItem = useCallback(
    async (cartItemId: string) => {
      if (!userId) {
        const updated = readLocal().filter((i) => i.cartItemId !== cartItemId);
        writeLocal(updated);
        setItems(updated);
        return;
      }

      await supabase.from("cart_items").delete().eq("id", cartItemId);
      setItems((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
    },
    [userId]
  );

  const clearCart = useCallback(async () => {
    if (!userId) {
      localStorage.removeItem(LOCAL_KEY);
      window.dispatchEvent(new Event("storage"));
      setItems([]);
      return;
    }

    await supabase.from("cart_items").delete().eq("user_id", userId);
    setItems([]);
  }, [userId]);

  // ── Catalog cart mutations ─────────────────────────────────────────────────

  const addCatalogItem = useCallback((item: CatalogCartItem) => {
    const current = readCatalogLocal();
    const existing = current.find(i => i.cartItemId === item.cartItemId);
    let updated: CatalogCartItem[];
    if (existing) {
      updated = current.map(i =>
        i.cartItemId === item.cartItemId ? { ...i, quantity: item.quantity } : i
      );
    } else {
      updated = [...current, item];
    }
    writeCatalogLocal(updated);
    setCatalogItems(updated);
  }, []);

  const updateCatalogQuantity = useCallback((cartItemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    const updated = readCatalogLocal().map(i => {
      if (i.cartItemId !== cartItemId) return i;
      const capped = i.maxQuantity !== undefined ? Math.min(newQuantity, i.maxQuantity) : newQuantity;
      return { ...i, quantity: capped };
    });
    writeCatalogLocal(updated);
    setCatalogItems(updated);
  }, []);

  const removeCatalogItem = useCallback((cartItemId: string) => {
    const updated = readCatalogLocal().filter(i => i.cartItemId !== cartItemId);
    writeCatalogLocal(updated);
    setCatalogItems(updated);
  }, []);

  const clearCatalogItems = useCallback(() => {
    localStorage.removeItem(CATALOG_KEY);
    window.dispatchEvent(new Event("storage"));
    setCatalogItems([]);
  }, []);

  return {
    items,
    catalogItems,
    loading,
    count: items.length + catalogItems.length,
    addItems,
    updateQuantity,
    removeItem,
    clearCart,
    addCatalogItem,
    updateCatalogQuantity,
    removeCatalogItem,
    clearCatalogItems,
  };
}
