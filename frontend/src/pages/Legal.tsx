import React from 'react';
import { Editable } from '../components/Editable';

/** "## " → título de sección, "- " → lista, resto → párrafo. */
const renderLegal = (text: string) => {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length} className="list-disc pl-6 space-y-1">{list.map((l, i) => <li key={i}>{l}</li>)}</ul>);
    list = [];
  };
  text.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    if (line.startsWith('- ')) { list.push(line.slice(2)); return; }
    flush();
    blocks.push(line.startsWith('## ')
      ? <h2 key={blocks.length} className="text-xl text-gold pt-4">{line.slice(3)}</h2>
      : <p key={blocks.length}>{line}</p>);
  });
  flush();
  return <span className="block space-y-3">{blocks}</span>;
};

export const Legal: React.FC<{ contentKey: string; title: string; text: string }> = ({ contentKey, title, text }) => (
  <section className="max-w-3xl mx-auto px-4 py-16 space-y-6">
    <Editable k={`${contentKey}.title`} as="h1" className="text-4xl">{title}</Editable>
    <Editable k={`${contentKey}.body`} as="div" className="text-mist leading-relaxed" render={renderLegal}>{text}</Editable>
  </section>
);
