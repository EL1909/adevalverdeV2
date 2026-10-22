import React from 'react';
import { Check } from 'lucide-react';

/** `**negrita**` y `~~tachado~~` dentro de una línea. */
const inline = (line: string): React.ReactNode[] =>
  line.split(/(\*\*[^*]+\*\*|~~[^~]+~~)/).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="text-bone font-semibold">{part.slice(2, -2)}</strong>
    : part.startsWith('~~') && part.endsWith('~~') ? <s key={i} className="opacity-70">{part.slice(2, -2)}</s>
    : part);

/**
 * Texto de las secciones editables: párrafos separados por línea en blanco,
 * líneas que empiezan con "- " como lista (con ✓ dorado), **negrita** y ~~tachado~~.
 */
export const renderRich = (text: string) => {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(
      <p key={blocks.length}>{para.map((l, i) => <React.Fragment key={i}>{i > 0 && <br />}{inline(l)}</React.Fragment>)}</p>,
    );
    if (list.length) blocks.push(
      <ul key={blocks.length} className="space-y-2">
        {list.map((l, i) => (
          <li key={i} className="flex gap-2"><Check size={16} className="mt-1 shrink-0 text-gold" /><span>{inline(l)}</span></li>
        ))}
      </ul>,
    );
    para = []; list = [];
  };
  text.split('\n').map(l => l.trim()).forEach(line => {
    if (!line) { flush(); return; }
    if (line.startsWith('- ')) {
      if (para.length) flush();
      list.push(line.slice(2));
    } else {
      if (list.length) flush();
      para.push(line);
    }
  });
  flush();
  return <span className="block space-y-4">{blocks}</span>;
};
