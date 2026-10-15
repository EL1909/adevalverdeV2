import React from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import type { ToolApp } from '../apps/registry';

export const AppCard: React.FC<{ app: ToolApp }> = ({ app }) => {
  const body = (
    <article className="group glass rounded-3xl overflow-hidden h-full flex flex-col">
      <div className="aspect-[4/3] overflow-hidden">
        <img src={app.image} alt="" className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="p-6 flex-1 flex flex-col gap-3">
        <h3 className="text-xl text-gold">{app.name}</h3>
        <p className="text-sm text-mist flex-1">{app.tagline}</p>
        <div className="flex items-center justify-between text-xs text-mist">
          <span className="flex items-center gap-1"><Clock size={14} /> {app.minutes}</span>
          <span>{app.status === 'soon' ? 'Próximamente' : app.price}</span>
        </div>
      </div>
    </article>
  );
  return app.status === 'available' ? <Link to={`/apps/${app.slug}`}>{body}</Link> : body;
};
