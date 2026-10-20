import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Descripciones de producto: respeta los saltos de línea; si es larga, scroll dentro de 320 px. */
export const descriptionBox = 'whitespace-pre-line max-h-[320px] overflow-y-auto pr-1';
