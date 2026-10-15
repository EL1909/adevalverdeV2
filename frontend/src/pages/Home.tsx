import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { TOOL_APPS } from '../apps/registry';
import { AppCard } from '../components/AppCard';
import { Editable, EditableImage } from '../components/Editable';

// Textos por defecto provisionales: Adela los valida y edita desde el sitio
// (modo edición, ver components/Editable.tsx).
export const Home: React.FC = () => (
  <>
    <section className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
      <div className="space-y-6">
        <Editable k="home.hero.eyebrow" className="text-xs uppercase tracking-[0.3em] text-gold">
          Discernimiento · Silencio · Soberanía
        </Editable>
        <Editable k="home.hero.title" as="h1" className="text-4xl md:text-6xl leading-tight">
          Herramientas para decidir desde tu centro
        </Editable>
        <Editable k="home.hero.text" className="text-mist text-lg">
          Prácticas breves basadas en la obra de Adela Valverde: para interpretar lo que vives, recuperar tu centro y convertir la enseñanza en decisiones reales.
        </Editable>
        <div className="flex flex-wrap gap-3">
          <Link to="/apps" className="bg-gold text-ink px-6 py-3 rounded-full font-semibold hover:bg-gold-light transition-colors flex items-center gap-2">
            Ver herramientas <ArrowRight size={18} />
          </Link>
          <Link to="/asesorias" className="border border-gold/60 text-gold px-6 py-3 rounded-full hover:bg-gold/10 transition-colors">
            Reservar asesoría
          </Link>
        </div>
      </div>
      <EditableImage
        k="home.hero.image"
        src="/images/quiensoy.jpg"
        alt="Adela Valverde"
        className="rounded-[2rem] w-full max-h-[560px] object-cover border border-gold/20"
      />
    </section>

    <section className="max-w-6xl mx-auto px-4 pb-20">
      <div className="flex items-end justify-between mb-8">
        <Editable k="home.tools.title" as="h2" className="text-3xl">Herramientas</Editable>
        <Link to="/apps" className="text-sm text-gold hover:text-gold-light">Ver todas</Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {TOOL_APPS.slice(0, 3).map(app => <AppCard key={app.slug} app={app} />)}
      </div>
    </section>
  </>
);
