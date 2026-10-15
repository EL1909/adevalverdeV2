import React from 'react';

/** Página de texto simple (ej. 404). */
export const Placeholder: React.FC<{ title: string; text?: string }> = ({ title, text }) => (
  <section className="max-w-3xl mx-auto px-4 py-16 space-y-4">
    <h1 className="text-4xl">{title}</h1>
    {text && <p className="text-mist">{text}</p>}
  </section>
);
