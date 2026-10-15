// Catálogo de herramientas del hub. Cada app vive en su propia carpeta bajo
// src/apps/<slug>/ cuando se construya; mientras tanto el hub la muestra
// como "próximamente". El orden y los precios vienen de AppsProposal.

export type AppStatus = 'available' | 'soon';

export interface ToolApp {
  slug: string;
  name: string;
  tagline: string;
  minutes: string;
  price: string;
  image: string;
  status: AppStatus;
}

export const TOOL_APPS: ToolApp[] = [
  {
    slug: 'test-coherencia',
    name: 'Test de la Coherencia',
    tagline: 'Un diagnóstico breve que te muestra desde dónde estás decidiendo.',
    minutes: '5 min',
    price: 'Gratis',
    image: '/images/coherencia/portada2.jpg',
    status: 'soon',
  },
  {
    slug: 'escaner',
    name: 'El Escáner de la Coherencia',
    tagline: 'Separa hechos, interpretaciones y suposiciones antes de decidir.',
    minutes: '3 min',
    price: '$7,99/mes · $59/año',
    image: '/images/coherencia/umbral222.jpg',
    status: 'soon',
  },
  {
    slug: 'llave-del-dia',
    name: 'La Llave del Día',
    tagline: 'Una enseñanza breve que se convierte en una decisión.',
    minutes: '90 s',
    price: '$2,99/mes · $19,99/año',
    image: '/images/coherencia/proposito.jpg',
    status: 'soon',
  },
  {
    slug: 'centro-soberano',
    name: 'El Centro Soberano',
    tagline: 'Recupera tu centro antes de reaccionar.',
    minutes: '2 min',
    price: '$4,99/mes',
    image: '/images/coherencia/soberano.jpeg',
    status: 'soon',
  },
  {
    slug: 'jerico',
    name: 'Jericó: Derriba una Muralla',
    tagline: 'Transformación aplicada en ciclos de siete días.',
    minutes: '5 min/día',
    price: '$14,99 por ciclo',
    image: '/images/coherencia/sitiado.jpg',
    status: 'soon',
  },
  {
    slug: 'boveda',
    name: 'La Bóveda de Luz',
    tagline: 'Una biblioteca que responde a necesidades concretas.',
    minutes: '3–5 min',
    price: '$6,99/mes',
    image: '/images/coherencia/purificacion.jpeg',
    status: 'soon',
  },
];
