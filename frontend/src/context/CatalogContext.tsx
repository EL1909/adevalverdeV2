import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCategories, fetchPublishedProducts, fetchStoreProducts, type Category, type StoreProduct } from '../api/store';

interface CatalogContextValue {
  categories: Category[];
  /** Lo que se ve en la tienda: lo que va al carrito y las asesorías (con duración, se reservan). Sin planes. */
  products: StoreProduct[] | null;
  /** «El Umbral»: categorías marcadas por Adela que tienen algo a la venta. */
  menu: Category[];
  error: string | null;
  /** El panel lo llama tras editar categorías o productos. */
  reload: () => void;
  /** Tras editar un producto en el sitio: lo reemplaza sin recargar todo. */
  replaceProduct: (p: StoreProduct) => void;
}

const CatalogContext = createContext<CatalogContextValue>({
  categories: [], products: null, menu: [], error: null, reload: () => undefined, replaceProduct: () => undefined,
});

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<StoreProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    fetchCategories().then(setCategories).catch(e => setError(e.message));
    // ?sellable=1 deja fuera planes y asesorías; las asesorías se suman desde
    // el listado completo (el público no ve a qué plan pertenece un producto).
    Promise.all([fetchStoreProducts(), fetchPublishedProducts()])
      .then(([sellable, all]) => {
        const ids = new Set(sellable.map(p => p.id));
        setProducts(all.filter(p => ids.has(p.id) || !!p.duration));
      })
      .catch(e => setError(e.message));
  }, []);
  useEffect(reload, [reload]);

  const replaceProduct = useCallback((p: StoreProduct) => {
    setProducts(prev => prev && prev.map(x => (x.id === p.id ? p : x)));
  }, []);

  const menu = useMemo(() => {
    const withProducts = new Set((products ?? []).map(p => p.category));
    return categories.filter(c => c.show_in_menu && withProducts.has(c.id));
  }, [categories, products]);

  return (
    <CatalogContext.Provider value={{ categories, products, menu, error, reload, replaceProduct }}>
      {children}
    </CatalogContext.Provider>
  );
};

export const useCatalog = () => useContext(CatalogContext);
