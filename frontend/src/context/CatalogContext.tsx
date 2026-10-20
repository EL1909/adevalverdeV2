import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCategories, fetchStoreProducts, type Category, type StoreProduct } from '../api/store';

interface CatalogContextValue {
  categories: Category[];
  /** Lo que se compra desde el carrito (sin planes ni asesorías). */
  products: StoreProduct[] | null;
  /** «El Umbral»: categorías marcadas por Adela que tienen algo a la venta. */
  menu: Category[];
  error: string | null;
  /** El panel lo llama tras editar categorías o productos. */
  reload: () => void;
}

const CatalogContext = createContext<CatalogContextValue>({
  categories: [], products: null, menu: [], error: null, reload: () => undefined,
});

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<StoreProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    fetchCategories().then(setCategories).catch(e => setError(e.message));
    fetchStoreProducts().then(setProducts).catch(e => setError(e.message));
  }, []);
  useEffect(reload, [reload]);

  const menu = useMemo(() => {
    const withProducts = new Set((products ?? []).map(p => p.category));
    return categories.filter(c => c.show_in_menu && withProducts.has(c.id));
  }, [categories, products]);

  return (
    <CatalogContext.Provider value={{ categories, products, menu, error, reload }}>
      {children}
    </CatalogContext.Provider>
  );
};

export const useCatalog = () => useContext(CatalogContext);
