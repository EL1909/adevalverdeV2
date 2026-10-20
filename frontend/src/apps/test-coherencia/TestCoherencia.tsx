import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, ChevronRight, RefreshCw } from 'lucide-react';
import { Editable, EditableImage } from '../../components/Editable';
import { ProductCta } from '../../components/ProductCta';
import { useContent } from '../../context/ContentContext';
import { cn } from '../../lib/utils';
import { QUESTIONS, QUESTION_IMAGES, RESULTS, RESULT_KEYS, resultFor, type Answer, type ResultKey } from './data';

/**
 * Test de la Coherencia (/apps/test-coherencia). Portado del prototipo del
 * sitio anterior, sin IA: portada → instrucciones → indagación → 12 preguntas
 * → intro de resultados → resultado → mentoría.
 *
 * Todo es editable en modo «Editar textos» (claves `test.*`); el destino de
 * cada botón de resultado lo elige Adela (ProductCta → página del libro o
 * asesoría). En modo edición, la barra de arriba salta a cualquier pantalla.
 */

type Step = 'portada' | 'instrucciones' | 'indagacion' | 'pregunta' | 'intro' | 'resultado' | 'mentoria';

const IMG = '/images/coherencia';
const goldButton = 'inline-flex items-center justify-center gap-3 bg-gold text-ink px-8 py-4 font-title font-bold uppercase tracking-[0.15em] text-xs hover:bg-gold-light transition-colors';
const ghostButton = 'inline-flex items-center justify-center gap-3 text-mist/70 font-title font-bold uppercase tracking-[0.3em] text-[10px] hover:text-gold transition-colors';

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

/** Pantalla a dos columnas: imagen editable y contenido. */
const Panel: React.FC<{
  imageKey: string; image: string; reverse?: boolean; imageWidth?: string; children: React.ReactNode; overlay?: React.ReactNode;
}> = ({ imageKey, image, reverse, imageWidth = 'md:w-1/2', children, overlay }) => (
  <div className={cn('max-w-6xl mx-auto w-full flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink/90',
    reverse ? 'md:flex-row-reverse' : 'md:flex-row')}>
    <div className={cn('relative h-[240px] md:h-auto md:min-h-[560px] overflow-hidden bg-black', imageWidth)}>
      <EditableImage k={imageKey} src={image} alt="" wrapperClassName="absolute inset-0" className="w-full h-full object-cover" />
      {overlay}
    </div>
    <div className="flex-1 p-8 md:p-12 lg:p-16 flex flex-col justify-center gap-8">{children}</div>
  </div>
);

export const TestCoherencia: React.FC = () => {
  const { editMode } = useContent();
  const [step, setStep] = useState<Step>('portada');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  // En modo edición se ve cualquier resultado sin hacer el test.
  const [preview, setPreview] = useState<ResultKey>('a');

  useEffect(() => { window.scrollTo(0, 0); }, [step, index]);

  const optionOrder = useMemo<Answer[]>(
    () => (editMode ? ['a', 'b', 'c', 'd'] : shuffle(['a', 'b', 'c', 'd'] as Answer[])),
    [index, editMode],
  );

  const answer = (a: Answer) => {
    const next = [...answers.slice(0, index), a];
    setAnswers(next);
    if (index < QUESTIONS.length - 1) setIndex(index + 1);
    else setStep('intro');
  };
  const back = () => {
    if (index === 0) setStep('indagacion');
    else setIndex(index - 1);
  };
  const restart = () => { setAnswers([]); setIndex(0); setStep('portada'); };

  const resultKey: ResultKey = editMode ? preview : resultFor(answers);
  const result = RESULTS[resultKey];
  const r = (field: string) => `test.resultado.${resultKey}.${field}`;
  const q = QUESTIONS[index];

  return (
    <section className="px-4 py-10 md:py-16 space-y-6">
      {editMode && (
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2 rounded-2xl border border-gold/50 bg-black/70 p-3 text-xs">
          <span className="text-gold">Editar pantalla:</span>
          <select
            value={step === 'pregunta' ? `p${index}` : step === 'resultado' ? `r-${preview}` : step}
            onChange={e => {
              const v = e.target.value;
              if (v.startsWith('p') && v !== 'portada') { setIndex(Number(v.slice(1))); setStep('pregunta'); }
              else if (v.startsWith('r-')) { setPreview(v.slice(2) as ResultKey); setStep('resultado'); }
              else setStep(v as Step);
            }}
            className="rounded-lg border border-white/15 bg-black/60 p-1.5 text-bone"
          >
            <option value="portada">Portada</option>
            <option value="instrucciones">Instrucciones</option>
            <option value="indagacion">Las preguntas de indagación</option>
            {QUESTIONS.map((_, i) => <option key={i} value={`p${i}`}>Pregunta {i + 1}</option>)}
            <option value="intro">Tus resultados (intro)</option>
            {RESULT_KEYS.map(k => <option key={k} value={`r-${k}`}>Resultado {k === 'empate' ? 'empate' : k.toUpperCase()}</option>)}
            <option value="mentoria">Mentoría</option>
          </select>
          <span className="text-mist">En edición las respuestas no avanzan: usa este selector.</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step === 'pregunta' ? `p${index}` : step === 'resultado' ? `r-${resultKey}` : step}
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {step === 'portada' && (
            <Panel imageKey="test.portada.imagen" image={`${IMG}/portada2.jpg`} imageWidth="md:w-[55%]">
              <div>
                <Editable k="test.portada.titulo" as="h1" className="text-5xl md:text-6xl font-bold uppercase tracking-tight leading-none">EL ESCÁNER</Editable>
                <Editable k="test.portada.subtitulo" className="mt-3 text-2xl md:text-3xl italic text-gold">de la Coherencia</Editable>
              </div>
              <div className="space-y-3">
                <Editable k="test.portada.lema" className="text-sm uppercase tracking-[0.2em] text-mist/70">NO ES UNA ENCUESTA...</Editable>
                <Editable k="test.portada.lema2" className="text-lg font-bold uppercase tracking-[0.1em] text-gold">"ES UNA INICIACIÓN"</Editable>
              </div>
              <button onClick={() => setStep('instrucciones')} className={cn(goldButton, 'justify-between w-full max-w-sm py-5')}>
                <Editable k="test.portada.boton" as="span">COMENZAR EL DIAGNÓSTICO</Editable> <ChevronRight size={18} />
              </button>
            </Panel>
          )}

          {step === 'instrucciones' && (
            <Panel imageKey="test.instrucciones.imagen" image={`${IMG}/proposito.jpg`} reverse>
              <Editable k="test.instrucciones.titulo" as="h2" className="text-2xl md:text-3xl font-bold uppercase tracking-[0.08em] text-gold">INSTRUCCIONES</Editable>
              <Editable k="test.instrucciones.texto" className="text-bone/90 leading-relaxed">
                {[
                  'Este test mide el nivel de sitio o soberanía del alma. No es una evaluación superficial de tu personalidad.',
                  'Es un espejo que refleja el estado real de tu coherencia interna: dónde habitas, quién gobierna tu voluntad, y qué tan cerca estás de tu Origen Divino.',
                  'Responde con honestidad brutal. Cada pregunta es una llave que abre una puerta hacia tu verdad más profunda. No hay respuestas correctas o incorrectas, solo grados de Conciencia.',
                ].join('\n\n')}
              </Editable>
              <button onClick={() => setStep('indagacion')} className={cn(goldButton, 'self-start')}>
                <Editable k="test.instrucciones.boton" as="span">Práctica de Autoconocimiento</Editable> <ArrowRight size={16} />
              </button>
            </Panel>
          )}

          {step === 'indagacion' && (
            <Panel imageKey="test.indagacion.imagen" image={`${IMG}/test12.jpg`}>
              <Editable k="test.indagacion.titulo" as="h2" className="text-2xl md:text-3xl font-bold uppercase">Las Preguntas de Indagación</Editable>
              <Editable k="test.indagacion.texto" className="text-mist leading-relaxed">
                {'Cada una de estas preguntas, confronta una dimensión de tu ser.\n\nLee con atención y elige la respuesta que más resuene con tu verdad actual, no con la que desearías que fuera cierta.'}
              </Editable>
              <Editable k="test.indagacion.cierre" className="font-bold italic text-gold">Sé brutalmente honesto contigo mismo.</Editable>
              <button onClick={() => { setIndex(0); setStep('pregunta'); }} className={cn(goldButton, 'self-start')}>
                <Editable k="test.indagacion.boton" as="span">SIGUIENTE</Editable>
              </button>
            </Panel>
          )}

          {step === 'pregunta' && (
            <Panel
              imageKey={`test.p${index + 1}.imagen`} image={QUESTION_IMAGES[index]} imageWidth="md:w-[35%]"
              overlay={
                <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-gold mb-2">Indagación {index + 1} / {QUESTIONS.length}</p>
                  <div className="h-[2px] bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-gold transition-all duration-500" style={{ width: `${((index + 1) / QUESTIONS.length) * 100}%` }} />
                  </div>
                </div>
              }
            >
              <Editable k={`test.p${index + 1}.pregunta`} as="h2" className="text-xl md:text-2xl font-medium leading-snug">{q.text}</Editable>
              <div className="grid gap-2">
                {optionOrder.map(a => (
                  <button key={a} onClick={editMode ? undefined : () => answer(a)}
                    className={cn('group flex items-center gap-5 p-4 md:p-5 text-left border-l border-white/10 bg-white/[0.02] transition-all',
                      !editMode && 'hover:bg-white/[0.05] hover:translate-x-1', answers[index] === a && 'border-gold')}>
                    <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-full border border-gold/50 group-hover:bg-gold transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold group-hover:bg-ink" />
                    </span>
                    <Editable k={`test.p${index + 1}.${a}`} as="span" className="text-sm md:text-base text-bone/80 group-hover:text-bone">{q.options[a]}</Editable>
                  </button>
                ))}
              </div>
              {!editMode && (
                <button onClick={back} className={cn(ghostButton, 'self-start tracking-[0.2em]')}><ArrowLeft size={14} /> Anterior</button>
              )}
            </Panel>
          )}

          {step === 'intro' && (
            <Panel imageKey="test.intro.imagen" image={`${IMG}/resultados.jpg`} reverse>
              <Editable k="test.intro.titulo" as="h2" className="text-2xl md:text-3xl font-bold uppercase tracking-[0.08em]">TUS RESULTADOS</Editable>
              <Editable k="test.intro.texto" className="text-mist leading-relaxed">
                {[
                  'Basado en tus respuestas, tu diagnóstico revelará en qué estado de coherencia habitas actualmente.',
                  'Cada estado representa un Nivel de Conciencia y Soberanía del Alma. Estos no son diagnósticos permanentes. Son fotografías de tu momento actual.',
                  'Puedes haber sido Soberano y caído en Prisionero tras una crisis. O estar en Purificación camino a Soberanía. Tu estado de HOY no define quién eres, sino dónde estás parado AHORA.',
                ].join('\n\n')}
              </Editable>
              <Editable k="test.intro.estados" className="font-bold uppercase tracking-[0.2em] text-gold text-lg">Los Cuatro Estados del Alma</Editable>
              <button onClick={() => setStep('resultado')} className={cn(goldButton, 'self-start')}>
                <Editable k="test.intro.boton" as="span">VER MI DIAGNÓSTICO</Editable> <ChevronRight size={16} />
              </button>
            </Panel>
          )}

          {step === 'resultado' && (
            <Panel
              imageKey={r('imagen')} image={result.image} imageWidth="md:w-[40%]"
              overlay={
                <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-ink to-transparent pointer-events-none">
                  <Editable k={r('estado')} as="h2" className="text-3xl md:text-4xl font-bold uppercase leading-none pointer-events-auto">{result.state}</Editable>
                </div>
              }
            >
              <div>
                <Editable k={r('subtitulo')} as="h3" className="text-2xl md:text-4xl font-bold uppercase mb-3">{result.subtitle}</Editable>
                <Editable k={r('mayoria')} className="text-xs md:text-sm font-bold uppercase tracking-[0.3em] text-gold border-b border-gold/20 pb-4">{result.majority}</Editable>
              </div>
              <div className="max-h-[320px] overflow-y-auto pr-4">
                <Editable k={r('texto')} className="text-bone/90 leading-relaxed">{result.text}</Editable>
              </div>
              <div className="flex flex-col gap-4">
                <ProductCta k={r('destino')} className={cn(goldButton, 'w-full text-center')}>
                  <Editable k={r('boton')} as="span">{result.cta}</Editable>
                </ProductCta>
                <button onClick={() => setStep('mentoria')} className={ghostButton}>
                  <Editable k="test.resultado.mentoria" as="span">CONOCE LA MENTORÍA 1:1</Editable> <ArrowRight size={14} />
                </button>
                {!editMode && (
                  <button onClick={restart} className={cn(ghostButton, 'text-mist/40 mt-2')}><RefreshCw size={14} /> REINICIAR DIAGNÓSTICO</button>
                )}
              </div>
            </Panel>
          )}

          {step === 'mentoria' && (
            <Panel imageKey="test.mentoria.imagen" image={`${IMG}/umbral222.jpg`} reverse>
              <div>
                <Editable k="test.mentoria.titulo" as="h2" className="text-2xl md:text-4xl font-bold uppercase leading-tight">EL UMBRAL DEL SILENCIO</Editable>
                <Editable k="test.mentoria.subtitulo" className="mt-3 text-xs font-bold uppercase tracking-[0.1em] text-gold border-b border-gold/20 pb-5">
                  LA INTERVENCIÓN DEFINITIVA EN MENTORÍA 1:1
                </Editable>
              </div>
              <Editable k="test.mentoria.texto" className="text-bone/80 leading-relaxed">
                {[
                  'Si este diagnóstico te confrontó, si reconociste tu estado con claridad brutal, entonces sabes que necesitas más que información. Necesitas una intervención.',
                  'Esta mentoría no es para todos. Es para quienes están listos para el quiebre total, para quienes ya no toleran vivir en la incoherencia, para quienes reclaman su soberanía sin negociación.',
                ].join('\n\n')}
              </Editable>
              <div className="p-5 border border-gold/20 bg-white/5 text-center">
                <Editable k="test.mentoria.precio" className="text-xs font-bold uppercase tracking-[0.1em] text-gold leading-relaxed">
                  Una sesión. Un mapa. Una llave. $222 dólares que sellan tu compromiso con tu propia transformación.
                </Editable>
              </div>
              <ProductCta k="test.mentoria.destino" className={cn(goldButton, 'w-full')}>
                <Editable k="test.mentoria.boton" as="span">SÍ, RECLAMO MI SESIÓN AHORA</Editable> <ChevronRight size={16} />
              </ProductCta>
              {!editMode && (
                <button onClick={() => setStep('resultado')} className={ghostButton}><ArrowLeft size={14} /> Volver a mi diagnóstico</button>
              )}
            </Panel>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
};
