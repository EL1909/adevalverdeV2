import React from 'react';
import { TOOL_APPS } from '../apps/registry';
import { AppCard } from '../components/AppCard';
import { Editable } from '../components/Editable';

export const AppsHub: React.FC = () => (
  <section className="max-w-6xl mx-auto px-4 py-16">
    <Editable k="apps.intro.title" as="h1" className="text-4xl mb-3">Herramientas</Editable>
    <Editable k="apps.intro.text" className="text-mist mb-10 max-w-2xl">
      Una sola cuenta para todas. Cada herramienta guarda tu historial y te recomienda el libro, programa o asesoría que mejor responde a lo que estás viviendo.
    </Editable>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {TOOL_APPS.map(app => <AppCard key={app.slug} app={app} />)}
    </div>
  </section>
);
