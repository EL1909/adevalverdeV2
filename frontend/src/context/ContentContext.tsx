import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ContentBlock, ContentMap, ContentUpdate, fetchContent, saveContent } from '../api/content';
import { useAuth } from './AuthContext';

interface ContentContextValue {
  blocks: ContentMap;
  /** Carga los bloques de una página una sola vez. */
  loadPage: (page: string) => void;
  canEdit: boolean;
  editMode: boolean;
  setEditMode: (on: boolean) => void;
  save: (key: string, data: ContentUpdate) => Promise<ContentBlock>;
}

const ContentContext = createContext<ContentContextValue | undefined>(undefined);

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [blocks, setBlocks] = useState<ContentMap>({});
  const [editMode, setEditMode] = useState(false);
  const requested = useRef(new Set<string>());

  const loadPage = useCallback((page: string) => {
    if (requested.current.has(page)) return;
    requested.current.add(page);
    fetchContent(page)
      .then(map => setBlocks(prev => ({ ...prev, ...map })))
      .catch(err => {
        // Sin backend se muestran los textos por defecto del frontend.
        console.error('[content]', err);
        requested.current.delete(page);
      });
  }, []);

  const save = useCallback(async (key: string, data: ContentUpdate) => {
    if (!token) throw new Error('Sesión expirada');
    const block = await saveContent(token, key, data);
    setBlocks(prev => ({ ...prev, [key]: block }));
    return block;
  }, [token]);

  const canEdit = !!user?.is_staff;

  return (
    <ContentContext.Provider value={{ blocks, loadPage, canEdit, editMode: canEdit && editMode, setEditMode, save }}>
      {children}
    </ContentContext.Provider>
  );
};

export const useContent = () => {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within ContentProvider');
  return ctx;
};
