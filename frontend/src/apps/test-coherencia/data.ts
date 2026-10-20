// Test de la Coherencia: contenido por defecto, portado del prototipo del
// sitio anterior (static/coherencia_app/test/main.tsx) sin la parte de IA.
// Todo texto e imagen es editable por Adela (CMS, claves `test.*`); esto es
// solo lo que se ve mientras no lo haya cambiado.

export type Answer = 'a' | 'b' | 'c' | 'd';
export type ResultKey = Answer | 'empate';

export interface Question {
  text: string;
  options: Record<Answer, string>;
}

export const QUESTIONS: Question[] = [
  {
    text: '1. ¿QUÉ TE DICE TU INSOMNIO A LAS 3:00 AM?',
    options: {
      a: 'Es pánico puro.',
      b: 'Es una carga de responsabilidad que no es mía.',
      c: 'Es un vacío que no sé llenar.',
      d: 'Es un llamado al silencio creativo.',
    },
  },
  {
    text: '2. CUANDO TOMAS UNA DECISIÓN, ¿DE QUIÉN ES LA VOZ QUE APRUEBA?',
    options: {
      a: 'El miedo al castigo.',
      b: 'Una figura externa que me controla.',
      c: 'La lealtad a mi pasado.',
      d: 'Mi propia soberanía en Dios.',
    },
  },
  {
    text: '3. ¿QUÉ HACES CUANDO SIENTES QUE TU VIDA NO TE PERTENECE?',
    options: {
      a: 'Me paralizo y espero que pase.',
      b: 'Busco culpables externos.',
      c: 'Intento recordar quién era antes.',
      d: 'Reclamo mi territorio con acción consciente.',
    },
  },
  {
    text: '4. ¿CÓMO REACCIONAS ANTE EL DOLOR EMOCIONAL PROFUNDO?',
    options: {
      a: 'Lo evito a toda costa, me aterra.',
      b: 'Lo proyectó en otros para no sentirlo.',
      c: 'Lo acepto pero no sé qué hacer con él.',
      d: 'Lo uso como combustible para mi transformación.',
    },
  },
  {
    text: '5. ¿QUÉ SIGNIFICA PARA TI EL CONCEPTO DE "MERICIMIENTO"?',
    options: {
      a: 'No me siento merecedor de nada bueno.',
      b: 'Debo ganarme todo con esfuerzo extremo.',
      c: 'Sé que merezco, pero no sé cómo recibirlo.',
      d: 'Habito mi merecimiento divino sin culpa.',
    },
  },
  {
    text: '6. ¿CUÁL ES TU RELACIÓN CON EL SILENCIO?',
    options: {
      a: 'Me aterra, lo lleno con ruido constante.',
      b: 'Lo evito porque me confronta.',
      c: 'Lo busco pero no sé habitarlo.',
      d: 'Es mi hogar, mi fuente de poder.',
    },
  },
  {
    text: '7. ¿CÓMO DESCRIBES TU RELACIÓN CON EL DINERO?',
    options: {
      a: 'Es una fuente constante de ansiedad.',
      b: 'Siento que nunca es suficiente, sin importar cuánto tenga.',
      c: 'Estoy aprendiendo a verlo como energía neutra.',
      d: 'Fluye hacia mí porque gobierno mi abundancia.',
    },
  },
  {
    text: '8. ¿QUÉ HACES CUANDO ALGUIEN INTENTA CONTROLAR TU VOLUNTAD?',
    options: {
      a: 'Me someto para evitar conflicto.',
      b: 'Reacciono con rabia pero no logro liberarme.',
      c: 'Identifico el patrón pero aún cedo terreno.',
      d: 'Establezco límites desde mi soberanía.',
    },
  },
  {
    text: '9. ¿CUÁL ES TU MAYOR MIEDO EXISTENCIAL?',
    options: {
      a: 'Que mi vida no tenga sentido.',
      b: 'Que nunca sea suficiente para los demás.',
      c: 'Que mi dolor haya sido en vano.',
      d: 'Ya no tengo miedo, tengo propósito.',
    },
  },
  {
    text: '10. ¿CÓMO TE RELACIONAS CON TU CUERPO?',
    options: {
      a: 'Lo veo como un enemigo que me traiciona.',
      b: 'Lo uso hasta agotarlo, es una herramienta.',
      c: 'Estoy aprendiendo a escucharlo.',
      d: 'Es mi templo, lo honro y lo cuido.',
    },
  },
  {
    text: '11. ¿QUÉ HACES CUANDO SIENTES QUE HAS PERDIDO TU IDENTIDAD?',
    options: {
      a: 'Entro en crisis total.',
      b: 'Busco desesperadamente respuestas en otros.',
      c: 'Acepto que estoy en proceso de redefinición.',
      d: 'Sé que mi identidad está sellada en lo divino.',
    },
  },
  {
    text: '12. ¿CUÁL ES TU RELACIÓN CON EL CONCEPTO DE "DIOS"?',
    options: {
      a: 'Es un juez que me castiga.',
      b: 'Es una idea abstracta sin conexión real.',
      c: 'Estoy reconstruyendo mi fe desde cero.',
      d: 'Es mi fuente, mi origen, mi gobierno interno.',
    },
  },
];

export const QUESTION_IMAGES = [
  'test1.jpeg', 'test2.jpeg', 'test3.jpeg', 'test4.jpeg', 'test5.jpg', 'test6.jpeg',
  'test7.jpg', 'test8.jpg', 'test9.jpeg', 'test10.jpg', 'test11.jpg', 'test12.jpg',
].map(f => `/images/coherencia/${f}`);

export interface Result {
  state: string;
  subtitle: string;
  majority: string;
  text: string;
  cta: string;
  image: string;
}

export const RESULTS: Record<ResultKey, Result> = {
  a: {
    state: 'ESTADO DE SUPERVIVENCIA',
    subtitle: 'EL PRISIONERO',
    majority: '(MAYORÍA DE A)',
    text: [
      'Tu sistema nervioso ha colapsado. Estás en modo supervivencia, intentando apagar incendios con las manos vacías. Tu agotamiento no es falta de energía, es una crisis de coherencia.',
      'Vives en el pánico constante, donde cada decisión se siente como una amenaza. Tu cuerpo grita, pero no sabes escucharlo. Has perdido el acceso a tu centro.',
      'No necesitas más información. Necesitas una Intervención Divina que restaure tu sistema desde la raíz.',
    ].join('\n\n'),
    cta: 'SÍ, RECLAMO MI DERECHO A LA PAZ',
    image: '/images/coherencia/prisionero.jpg',
  },
  b: {
    state: 'ESTADO DE INTERVENCIÓN',
    subtitle: 'EL SITIADO',
    majority: '(MAYORÍA DE B)',
    text: [
      'Estás viviendo la vida de alguien más. Tu voluntad está secuestrada por figuras externas.',
      'Identificar al invasor es tu primer acto de guerra.',
      'Sabes que algo no está bien, pero no logras nombrar qué. Hay voces externas que gobiernan tus decisiones. Tu territorio ha sido ocupado y necesitas recuperarlo.',
      'El mapa de tus muros es el primer paso hacia tu liberación. Sin él, seguirás peleando batallas equivocadas.',
    ].join('\n\n'),
    cta: 'SÍ, RECLAMO EL MAPA DE MIS MUROS',
    image: '/images/coherencia/sitiado.jpg',
  },
  c: {
    state: 'ESTADO DE TRANSICIÓN',
    subtitle: 'LA PURIFICACIÓN',
    majority: '(MAYORÍA DE C)',
    text: [
      'Tus muros han caído, pero el agua de tu fuente sigue turbia. Estás listo para dejar que el dolor te moldee. No busques parches, busca la purificación de la sal.',
      'Has hecho el trabajo de identificar y derribar lo que no era tuyo. Ahora viene la parte más profunda: limpiar lo que quedó dentro. El dolor ya no te paraliza, te transforma.',
      'Este es el estado de la alquimia sagrada que prepara Una Vasija Nueva. Aquí se forjan los soberanos.',
    ].join('\n\n'),
    cta: 'SÍ, RECLAMO EL MISTERIO DE LA SAL',
    image: '/images/coherencia/purificacion.jpeg',
  },
  d: {
    state: 'ESTADO DE GOBIERNO',
    subtitle: 'EL SOBERANO',
    majority: '(MAYORÍA DE D)',
    text: [
      'Habitas el Silencio, pero aún no sabes cómo administrar la abundancia que emana de él. Es momento de sellar tu identidad y gobernar tu territorio sin intermediarios.',
      'Has llegado a tu centro. Conoces tu origen. Tu voluntad es tuya. Pero ahora viene el desafío más grande: sostener tu soberanía en medio de la abundancia sin culpa, sin autosabotaje.',
      'Este es el nivel donde se sella el merecimiento divino. Aquí gobiernas desde tu esencia y eres pilar fundamental para otros.',
    ].join('\n\n'),
    cta: 'SÍ, RECLAMO MI MERECIMIENTO DIVINO',
    image: '/images/coherencia/soberano.jpeg',
  },
  empate: {
    state: 'LUCIDEZ RADICAL',
    subtitle: 'DESCIFRANDO TU DIAGNÓSTICO',
    majority: 'SI TIENES EMPATE',
    text: [
      'Si tu resultado es un empate entre dos letras, o si al leer tu diagnóstico sientes un quiebre total, no busques libros: reclama una Intervención Definitiva.',
      'Tu estado requiere un mapa personalizado que solo la Mentoría 1:1 puede entregarte. No intentes adivinar por cuál libro empezar. Tu estado de confusión es la señal clara de que necesitas:',
      'INTERVENCIÓN DIVINA',
      'Tu resultado no es lo que eres, es el lugar donde te has estacionado.',
    ].join('\n\n'),
    cta: 'SÍ, RECLAMO MI INTERVENCIÓN DIVINA',
    image: '/images/coherencia/proposito.jpg',
  },
};

export const RESULT_KEYS: ResultKey[] = ['a', 'b', 'c', 'd', 'empate'];

/** La letra más elegida; si las dos primeras empatan, «empate» (igual que el prototipo). */
export function resultFor(answers: Answer[]): ResultKey {
  if (answers.length === 0) return 'a';
  const counts = new Map<Answer, number>();
  answers.forEach(a => counts.set(a, (counts.get(a) ?? 0) + 1));
  const sorted = [...counts.entries()].sort((x, y) => y[1] - x[1]);
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return 'empate';
  return sorted[0][0];
}
