import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { beats, licenses, type Beat, type License } from "../data/site";

export type CartItem = { beatId: string; licenseId: string };
export type CartLine = CartItem & { beat: Beat; license: License };

type Cart = {
  lines: CartLine[];
  total: number;
  hasQuote: boolean;
  add: (item: CartItem) => void;
  remove: (beatId: string) => void;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  licenseFor: Beat | null;
  chooseLicense: (b: Beat | null) => void;
};

const Ctx = createContext<Cart | null>(null);
const KEY = "gs-cart-v1";

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load);
  const [open, setOpen] = useState(false);
  const [licenseFor, chooseLicense] = useState<Beat | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* private mode */
    }
  }, [items]);

  // ביט אחד = רישיון אחד. הוספה מחדש מחליפה את הרישיון.
  const add = useCallback((item: CartItem) => {
    setItems((prev) => [...prev.filter((p) => p.beatId !== item.beatId), item]);
  }, []);
  const remove = useCallback((beatId: string) => setItems((prev) => prev.filter((p) => p.beatId !== beatId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<Cart>(() => {
    const lines = items.flatMap((i) => {
      const beat = beats.find((b) => b.id === i.beatId);
      const license = licenses.find((l) => l.id === i.licenseId);
      return beat && license ? [{ ...i, beat, license }] : [];
    });
    return {
      lines,
      total: lines.reduce((s, l) => s + (l.license.price ?? 0), 0),
      hasQuote: lines.some((l) => l.license.price === null),
      add,
      remove,
      clear,
      open,
      setOpen,
      licenseFor,
      chooseLicense,
    };
  }, [items, open, licenseFor, add, remove, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
