import React from 'react';
import { Editable, EditableImage } from '../components/Editable';
import { Cta, Quote, SectionTitle } from '../components/PageBlocks';

// Contenido inicial tomado de la página de Gamma que este sitio reemplaza
// (adelavalverdeinfo.gamma.site). Adela lo edita desde el modo edición.

const STATES = [
  {
    n: 1, title: 'Estado de alarma', subtitle: '(Alivio y emergencia)',
    text: 'Si el ruido mental no te deja descansar, no necesitas más información, necesitas soltar.',
    items: 'Intervención Divina\nEl Misterio del Síntoma\nEntrega Todo y Duerme en Paz\nEl Poder del Japamala\n7 Días de Silencio y Conquista',
  },
  {
    n: 2, title: 'Estado de bloqueo', subtitle: '(Despertar punta de lanza)',
    text: 'Si te sientes estancado o bajo muros invisibles, necesitas discernimiento.',
    items: 'Las 5 Murallas Invisibles\nEl Espejo de la Verdad Interior\nEl Radar de Jezabel\nEl Arsenal de Jericó\nEl Mapa de tus Muros',
  },
  {
    n: 3, title: 'Estado de retorno', subtitle: '(Identidad y abundancia)',
    text: 'Si estás listo para sanar la raíz y volver a tu diseño original.',
    items: 'Jericó (Derriba las Murallas)\nUna Vasija Nueva\nEl Misterio de la Sal\n21 Decretos de Identidad\nEl Librito del Oro',
  },
  {
    n: 4, title: 'Maestría final', subtitle: '(Conexión)',
    text: 'El Silencio es tu Gurú, 21 días de autosanación. El Programa Matriz: el espacio donde la mente se rinde para que el Espíritu Santo tome el control absoluto.',
    items: '',
  },
];

const TOOLS = [
  {
    key: 'intervencion', title: 'Intervención Divina®', cta: 'Solicitar intervención 1:1', to: '/asesorias',
    text: 'Detén el colapso mental y la ansiedad con este protocolo de rescate inmediato.\nRecupera el gobierno de tu mente y, si deseas ir a la raíz, profundiza conmigo en una mentoría 1:1.',
  },
  {
    key: 'sal', title: 'El Misterio de la Sal®', cta: 'Iniciar mi purificación', to: '/tienda',
    text: 'Limpia las impurezas que bloquean tu bendición y sana tus relaciones.\nEl paso indispensable para prepararte como una vasija nueva o derribar tus murallas en Jericó.',
  },
  {
    key: 'descanso', title: 'Entrega todo y duerme en paz', cta: 'Activar mi descanso', to: '/tienda',
    text: 'Silencia el ruido mental y vacía tus cargas diarias para un descanso reparador.\nLa llave para entrenar tu enfoque y acceder a niveles superiores de conciencia.',
  },
];

const MANIFESTO = [
  ['sintoma', 'Identifica el síntoma', 'Aprendemos a leer la emoción como un lenguaje técnico. Si hay caos, hay una creencia que aún sostiene un espíritu de esclavitud. Si hay paz, hay soberanía.'],
  ['silencio', 'Revelación y silencio', 'En esta frecuencia, el silencio no es ausencia de ruido, es presencia de Verdad. Es el espacio donde la conciencia sin intermediarios se activa.'],
  ['declaracion', 'Declaración de soberanía', 'Asumes la responsabilidad absoluta de tu estado interno. Dejas de pedir permiso al mundo para empezar a emitir tu propia luz.'],
  ['umbral', 'El umbral es el código sagrado', 'Es el punto de no retorno donde el silencio se convierte en la única guía para gobernar tu realidad.'],
];

const MENTORING_ITEMS = 'Sesión de diagnóstico y estrategia (60 min).\nGrabación del encuentro.\nEbook Jericó, Manual de Operaciones, incluido.\nKit de sustentación: acceso a mis tests exclusivos y guías de trabajo para que sostengas tu proceso con autonomía después de la sesión.';

const TESTIMONIALS = [
  ['maria', 'Después de años buscando, finalmente encontré lo que siempre había estado ahí. Fue un regreso a casa.', 'María C., Colombia'],
  ['carlos', 'El acompañamiento personalizado de Adela me permitió ir más profundo de lo que habría logrado sola.', 'Carlos R., España'],
  ['laura', 'Había perdido toda conexión espiritual tras decepciones religiosas. Aquí recuperé una fe auténtica, sin dogmas.', 'Laura M., España'],
];

export const Bio: React.FC = () => (
  <div className="space-y-24 pb-24">
    {/* Portada */}
    <section className="max-w-6xl mx-auto px-4 pt-16 md:pt-24 grid md:grid-cols-2 gap-10 items-center">
      <div className="space-y-6">
        <Editable k="bio.hero.eyebrow" className="text-xs uppercase tracking-[0.3em] text-gold">Sobre Adela Valverde</Editable>
        <Editable k="bio.hero.title" as="h1" className="text-4xl md:text-6xl leading-tight">Recupera el gobierno de tu espíritu</Editable>
        <Editable k="bio.hero.text" className="text-mist text-lg">
          La espiritualidad no es magia, es lucidez. Has llegado al lugar correcto para cuando el mundo pesa demasiado y el descanso parece imposible. Apela a la memoria de tu alma, identifica las voces que gobiernan tu voluntad y vuelve a ser el único dueño de tu propia existencia.
        </Editable>
        <Editable k="bio.hero.motto" className="font-title text-xl text-gold-light">No te enseño a seguirme, te enseño a escucharte.</Editable>
        <div className="flex flex-wrap gap-3">
          <Cta k="bio.hero.cta_scan" to="/apps">Inicia tu escáner de soberanía</Cta>
          <Cta k="bio.hero.cta_books" to="/tienda" variant="outline">Conoce mis libros</Cta>
        </div>
      </div>
      <EditableImage k="bio.hero.image" src="/images/bio/adela.jpg" alt="Adela Valverde"
        className="rounded-[2rem] w-full max-h-[560px] object-cover object-right border border-gold/20" />
    </section>

    {/* Historia */}
    <section className="max-w-6xl mx-auto px-4 grid md:grid-cols-[2fr_3fr] gap-10 items-start">
      <EditableImage k="bio.story.image" src="/images/bio/desierto.jpg" alt="Camino en el desierto"
        className="rounded-[2rem] w-full max-h-[640px] object-cover border border-gold/20" />
      <div className="space-y-6">
        <SectionTitle k="bio.story" eyebrow="No te escribo desde la cima de una montaña…">Te escribo desde el camino de regreso</SectionTitle>
        <Editable k="bio.story.text" className="text-mist leading-relaxed">
          {'Durante años fui una buscadora incansable. Toqué las puertas de muchas escuelas espirituales, aprendí muchas técnicas y recorrí muchos caminos esperando encontrar «la respuesta» que calmara la sed de mi espíritu. Creía que, si encontraba el método, escuela o técnica espiritual correcta, finalmente encontraría la paz.\n\nPero en esa búsqueda frenética por diferentes países, me perdí a mí misma. Descubrí que es posible estar lleno de información espiritual y, sin embargo, no darnos cuenta de que vivimos vacíos de Dios. Descubrí que buscamos afuera porque nos da miedo descubrir lo que encontraremos en el silencio.\n\nEn el año 2015 comenzó el colapso. Dios mismo me llevó a un desierto personal, donde me detuvo sin opción, quitándome el pasaporte del mundo para otorgarme el pasaporte del Espíritu, y así mostrarme una verdad contundente: la mente debe rendirse para que el Espíritu Santo de Dios tome el gobierno. He caminado el desierto y hoy volví con los mapas que Dios te otorga para sacarte de ahí.'}
        </Editable>
      </div>
    </section>

    <Quote k="bio.quote.1">«Nadie puede darte lo que ya vive en tu interior.»</Quote>

    {/* Obras por estado */}
    <section className="max-w-6xl mx-auto px-4 space-y-10">
      <div className="space-y-3 text-center">
        <SectionTitle k="bio.works" center>Obras que despiertan el alma</SectionTitle>
        <Editable k="bio.works.text" className="text-mist">No busques un libro, identifica tu estado. El diagnóstico es el primer paso de tu libertad.</Editable>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {STATES.map(s => (
          <div key={s.n} className="glass rounded-3xl p-6 space-y-3">
            <span className="font-title text-4xl text-gold">{s.n}</span>
            <Editable k={`bio.state${s.n}.title`} as="h3" className="text-lg uppercase tracking-wide">{s.title}</Editable>
            <Editable k={`bio.state${s.n}.subtitle`} className="text-xs text-gold">{s.subtitle}</Editable>
            <Editable k={`bio.state${s.n}.text`} className="text-sm text-mist">{s.text}</Editable>
            {s.items && <Editable k={`bio.state${s.n}.items`} className="text-sm text-bone/90 leading-7 border-t border-white/10 pt-3">{s.items}</Editable>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Cta k="bio.works.cta_scan" to="/apps">Realizar el escáner de soberanía</Cta>
        <Cta k="bio.works.cta_store" to="/tienda" variant="outline">Ver la tienda</Cta>
      </div>
    </section>

    {/* Bóveda de Luz */}
    <section className="max-w-6xl mx-auto px-4 space-y-10">
      <SectionTitle k="bio.vault" eyebrow="La Bóveda de Luz" center>Herramientas de rescate para recuperar tu eje</SectionTitle>
      <div className="grid md:grid-cols-3 gap-6">
        {TOOLS.map(t => (
          <div key={t.key} className="glass rounded-3xl p-6 flex flex-col gap-4">
            <Editable k={`bio.vault.${t.key}.title`} as="h3" className="text-xl text-gold">{t.title}</Editable>
            <Editable k={`bio.vault.${t.key}.text`} className="text-sm text-mist flex-1">{t.text}</Editable>
            <div><Cta k={`bio.vault.${t.key}.cta`} to={t.to} variant="outline">{t.cta}</Cta></div>
          </div>
        ))}
      </div>
    </section>

    {/* Manifiesto */}
    <section className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
      <div className="space-y-6">
        <SectionTitle k="bio.manifesto" eyebrow="Manifiesto de soberanía espiritual">De la idolatría a la soberanía espiritual</SectionTitle>
        <Editable k="bio.manifesto.text" className="text-mist">Bienvenida a la Escuela de Soberanía. No estás aquí para aprender más, estás aquí para desaprender quién te dijeron que eras.</Editable>
        <ul className="space-y-4">
          {MANIFESTO.map(([key, title, text]) => (
            <li key={key} className="border-l-2 border-gold/60 pl-4 space-y-1">
              <Editable k={`bio.manifesto.${key}.title`} as="h3" className="text-gold-light">{title}</Editable>
              <Editable k={`bio.manifesto.${key}.text`} className="text-sm text-mist">{text}</Editable>
            </li>
          ))}
        </ul>
        <Cta k="bio.manifesto.cta" to="/escuela">Cruzar el umbral</Cta>
      </div>
      <EditableImage k="bio.manifesto.image" src="/images/bio/portal.jpg" alt="Portal de luz"
        className="rounded-[2rem] w-full max-h-[640px] object-cover border border-gold/20" />
    </section>

    <Quote k="bio.quote.2">«El Silencio es tu Gurú.»</Quote>

    {/* Por qué puedo ayudarte */}
    <section className="max-w-3xl mx-auto px-4 space-y-6">
      <SectionTitle k="bio.why">¿Por qué puedo ayudarte?</SectionTitle>
      <Editable k="bio.why.text" className="text-mist leading-relaxed">
        {'Porque conozco el dolor de la decepción espiritual. Sé lo que es sentir que has hecho «todo lo correcto» y sigues chocando con los mismos muros. Sé lo que es vivir fingiendo que estás bien cuando por dentro te estás derrumbando.\n\nNo estoy aquí para ser tu maestra, ni para que me sigas. Ya hay demasiado ruido en el mundo. Estoy aquí para compartirte los mapas que tracé cuando logré salir de mi propio laberinto.\n\nMis libros y programas tienen un solo propósito: acompañarte a soltar todo lo que no eres, para que por fin puedas abrazar quien realmente eres en Dios.\n\nNo vengo a llenarte de más teorías. Vengo a ayudarte a vaciarte, para que Él te pueda llenar.'}
      </Editable>
    </section>

    {/* Mentoría y programa */}
    <section className="max-w-6xl mx-auto px-4 space-y-10">
      <SectionTitle k="bio.path" eyebrow="Sesión de soberanía espiritual" center>Inicia tu proceso de vaciado: el camino de ascensión</SectionTitle>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass rounded-3xl p-8 space-y-4 border border-gold/30">
          <Editable k="bio.mentoring.title" as="h3" className="text-2xl text-gold">Intervención de alto impacto (mentoría 1:1)</Editable>
          <Editable k="bio.mentoring.text" className="text-mist">
            Esto no es consejería. Es estrategia espiritual de alto nivel. Trabajaremos en privado para identificar la raíz exacta (Jericó/Jezabel) que te impide avanzar.
          </Editable>
          <Editable k="bio.mentoring.includes_title" className="text-sm uppercase tracking-wide text-gold-light">Lo que incluye</Editable>
          <Editable k="bio.mentoring.includes" className="text-sm text-bone/90 leading-7">{MENTORING_ITEMS}</Editable>
          <Editable k="bio.mentoring.note" className="text-xs text-mist">Cupos limitados por rigor técnico.</Editable>
          <Cta k="bio.mentoring.cta" to="/asesorias">Reclamar mi mentoría 1:1</Cta>
        </div>
        <div className="glass rounded-3xl p-8 space-y-4">
          <Editable k="bio.program.title" as="h3" className="text-2xl text-gold">Programa Matriz: El Silencio es tu Gurú</Editable>
          <Editable k="bio.program.subtitle" className="text-gold-light">21 días de autosanación</Editable>
          <Editable k="bio.program.text" className="text-mist">
            Este no es un curso más. Es un proceso de desprogramación. Durante 21 días, te acompaño a soltar la dependencia de maestros externos y a instalarte en tu propio corazón. Dejarás de buscar respuestas afuera para encontrar la voz de Dios adentro.
          </Editable>
          <Editable k="bio.program.phases" className="text-sm text-bone/90 leading-7">
            {'Despertar y conciencia: identificarás patrones inconscientes, desarrollarás autodisciplina y comenzarás a conectar con tu silencio interior.\nTransformación profunda: soltarás creencias limitantes y desarrollarás nuevos hábitos de poder personal.\nIntegración: consolidarás tu nueva forma de ser y establecerás bases sólidas para mantener tu transformación.'}
          </Editable>
          <Cta k="bio.program.cta" to="/escuela" variant="outline">Aplicar al programa</Cta>
        </div>
      </div>
    </section>

    {/* Testimonios */}
    <section className="max-w-6xl mx-auto px-4 space-y-10">
      <div className="space-y-3 text-center">
        <SectionTitle k="bio.testimonials" center>Historias de quienes dejaron de buscar afuera</SectionTitle>
        <Editable k="bio.testimonials.text" className="text-mist">Lo que sucede cuando apagas el ruido y sanas la fuente.</Editable>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {TESTIMONIALS.map(([key, text, who]) => (
          <figure key={key} className="glass rounded-3xl p-6 space-y-4">
            <Editable k={`bio.testimonials.${key}.text`} as="blockquote" className="text-bone/90 italic">{text}</Editable>
            <Editable k={`bio.testimonials.${key}.who`} as="figcaption" className="text-sm text-gold">{who}</Editable>
          </figure>
        ))}
      </div>
    </section>

    {/* Cierre */}
    <section className="max-w-3xl mx-auto px-4 text-center space-y-6">
      <Editable k="bio.closing.title" as="h2" className="text-3xl md:text-4xl">¿Sientes el llamado?</Editable>
      <Editable k="bio.closing.text" className="text-mist">
        {'Has llegado al final de este mapa, pero estás frente al inicio de tu verdadera libertad. La soberanía no se hereda, se reclama. No permitas que el ruido del mundo ahogue de nuevo la voz de tu Gurú interior.\n\nTu búsqueda termina cuando cierras los ojos y recuerdas: Él siempre estuvo ahí.'}
      </Editable>
      <Quote k="bio.quote.3">No necesitas más ruido… necesitas verdad.</Quote>
      <div className="flex flex-wrap justify-center gap-3">
        <Cta k="bio.closing.cta_mentoring" to="/asesorias">Reclamar mi mentoría 1:1</Cta>
        <Cta k="bio.closing.cta_store" to="/tienda" variant="outline">Adquirir mis mapas</Cta>
      </div>
    </section>
  </div>
);
