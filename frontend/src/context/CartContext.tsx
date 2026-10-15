import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface CartItem {
  product_id: number;
  name: string;
  price: string;
  image: string | null;
  is_digital: boolean;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  add: (item: Omit<CartItem, 'quantity'>) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

const STORAGE_KEY = 'adela_cart';
const CartContext = createContext<CartContextValue | undefined>(undefined);

const load = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// El carrito vive en el navegador; los precios definitivos los pone el
// backend al crear el pedido.
export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* almacenamiento no disponible: el carrito vive solo en memoria */
    }
  }, [items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    total: items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0),
    add: (item) => setItems(prev => {
      const existing = prev.find(i => i.product_id === item.product_id);
      if (existing) {
        if (item.is_digital) return prev; // un PDF se compra una vez
        return prev.map(i => i.product_id === item.product_id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    }),
    setQuantity: (productId, quantity) => setItems(prev =>
      prev.map(i => i.product_id === productId ? { ...i, quantity: Math.max(1, Math.min(quantity, 20)) } : i)),
    remove: (productId) => setItems(prev => prev.filter(i => i.product_id !== productId)),
    clear: () => setItems([]),
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
