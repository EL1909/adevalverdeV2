import React from 'react';
import { Editable, EditableImage } from '../components/Editable';
import { Cta, Quote, SectionTitle } from '../components/PageBlocks';
import { useBusiness } from '../context/BusinessContext';

// Contenido inicial tomado de la página de Gamma que este sitio reemplaza
// (elsilencioestuguru.gamma.site). Adela lo edita desde el modo edición.

const SIGNS = [
  ['agotamiento', 'Agotamiento espiritual profundo', 'Has leído todos los libros y hecho todos los talleres, pero sigues sintiendo el mismo vacío. Tienes mucha información, pero poca transformación.'],
  ['trampa', 'La trampa del gurú externo', 'Caíste en la idolatría espiritual. Entregaste tu poder a líderes o métodos esperando que ellos hicieran el trabajo por ti.'],
  ['ruido', 'El infierno del ruido mental', '«Mi mente nunca para. Ni siquiera cuando medito. Los pensamientos me atacan como una tormenta que nunca cesa. Ya no recuerdo cómo se siente la paz real.»'],
  ['desconexion', 'Desconexión con lo sagrado', 'Dependencia espiritual de otros. Sientes que si no vas a la iglesia, al retiro o a la terapia, te caes. No sabes sostenerte solo.'],
];

const STAGES = [
  ['1', 'Día 1-3', 'Ya no eres esclavo de tus pensamientos. Aprendes a bajar el volumen del mundo y a habitar tu cuerpo sin ansiedad. La calma deja de ser algo que buscas y se convierte en algo que eres.'],
  ['2', 'Día 4-7', 'La intuición despierta. Empiezas a discernir entre la voz del miedo (ego) y la voz de la verdad. Se caen las máscaras y las necesidades de aprobación externa.'],
  ['3', 'Día 8-14', 'Sientes la Presencia tan real como si estuviera sentada junto a ti. Se rompe la orfandad espiritual. Entiendes que nunca estuviste solo.'],
  ['4', 'Día 15-21', 'Ya no necesitas correr a buscar respuestas afuera. Tienes la certeza absoluta de que cualquier respuesta que necesites brotará de tu silencio. Eres soberano.'],
];

const TESTIMONIALS = [
  ['maria', 'Adela, después de 12 años buscando maestros espirituales, finalmente encontré lo que tanto necesitaba. En solo 5 días empecé a sentir esa paz que creía perdida para siempre. Ahora sé que Dios siempre estuvo ahí, solo necesitaba aprender a escucharlo.', 'María Elena Rodríguez, médica, 42 años'],
  ['carlos', 'Había gastado más de $5,000 dólares en retiros y cursos espirituales. Nada me funcionaba. El método de Adela me conectó con lo sagrado desde el primer día. Es vergonzosamente simple pero increíblemente poderoso.', 'Carlos Mendoza, empresario, 38 años'],
  ['ana', 'Por primera vez en 15 años, mi mente está en silencio. Ya no necesito técnicas complicadas. Solo necesito escuchar. Gracias, Adela, por mostrarme lo obvio que tenía enfrente.', 'Ana Lucía Torres, psicóloga, 35 años'],
];

export const School: React.FC = () => {
  const { business } = useBusiness();
  // Sin sistema de lista de espera: la consulta llega por correo a Adela.
  const waitlist = business.email
    ? `mailto:${business.email}?subject=${encodeURIComponent('El Silencio es tu Gurú · próxima fecha')}`
    : '/asesorias';

  return (
    <div className="space-y-24 pb-24">
      {/* Portada */}
      <section className="max-w-6xl mx-auto px-4 pt-16 md:pt-24 grid md:grid-cols-2 gap-10 items-center">
        <div className="space-y-6">
          <Editable k="school.hero.eyebrow" className="text-xs uppercase tracking-[0.3em] text-gold">Escuela del Silencio</Editable>
          <Editable k="school.hero.title" as="h1" className="text-4xl md:text-6xl leading-tight">El maestro que buscas no tiene nombre humano…</Editable>
          <Editable k="school.hero.text" className="text-mist text-lg">
            Has probado libros, técnicas, retiros, gurús… pero algo sigue faltando. Lo sé, porque yo también lo viví. Por eso creé El Silencio es tu Gurú: el sistema de 21 días para desprogramar la dependencia espiritual, silenciar el ruido del mundo y escuchar la única voz que no se equivoca: la tuya en comunión con Dios.
          </Editable>
          <Editable k="school.hero.motto" className="font-title text-xl text-gold-light">Tu búsqueda termina donde empieza tu silencio.</Editable>
          <div className="flex flex-wrap gap-3">
            <Cta k="school.hero.cta_join" to={waitlist}>Quiero despertar mi maestro interno</Cta>
            <Cta k="school.hero.cta_book" to="/tienda" variant="outline">Comenzar los 21 días</Cta>
          </div>
        </div>
        <EditableImage k="school.hero.image" src="/images/bio/escuela.jpg" alt="Adela Valverde"
          className="rounded-[2rem] w-full max-h-[560px] object-cover object-right border border-gold/20" />
      </section>

      {/* Señales */}
      <section className="max-w-6xl mx-auto px-4 space-y-10">
        <SectionTitle k="school.signs" eyebrow="¿Te reconoces en estas señales de alarma espiritual?" center>
          Esto no es solo estrés. Es el agotamiento del buscador eterno.
        </SectionTitle>
        <div className="grid sm:grid-cols-2 gap-6">
          {SIGNS.map(([key, title, text]) => (
            <div key={key} className="glass rounded-3xl p-6 space-y-2">
              <Editable k={`school.signs.${key}.title`} as="h3" className="text-lg text-gold">{title}</Editable>
              <Editable k={`school.signs.${key}.text`} className="text-sm text-mist">{text}</Editable>
            </div>
          ))}
        </div>
        <Editable k="school.signs.closing" className="text-center text-bone/90 max-w-3xl mx-auto">
          Si respondiste sí a alguna de estas, el problema no es que te falte aprender más. El problema es que necesitas desaprender para volver a escuchar.
        </Editable>
      </section>

      {/* El sistema */}
      <section className="max-w-3xl mx-auto px-4 space-y-6">
        <SectionTitle k="school.system" eyebrow="Sistema matriz de autosanación y soberanía espiritual">El Silencio es tu Gurú</SectionTitle>
        <Editable k="school.system.text" className="text-mist leading-relaxed">
          {'Has pasado la vida buscando respuestas en labios ajenos. Entregando tu poder a gurús, sistemas y métodos. Esperando que alguien te salve.\n\nPero el maestro que buscas no tiene nombre humano. Vive en ti.\n\nEste no es un curso más. Es un entrenamiento intensivo de 21 días de desprogramación para silenciar el ruido del mundo y escuchar la única voz que no se equivoca: la tuya en comunión con Dios.\n\nSin rituales complejos ni dogmas. Sin dependencias externas. Solo tú, tu respiración y la Presencia.\n\nBienvenido a la última búsqueda que harás en tu vida: la del regreso a casa.'}
        </Editable>
      </section>

      {/* Etapas */}
      <section className="max-w-6xl mx-auto px-4 space-y-10">
        <SectionTitle k="school.stages" center>Esto es lo que va a pasar en tu vida</SectionTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STAGES.map(([n, title, text]) => (
            <div key={n} className="glass rounded-3xl p-6 space-y-3">
              <span className="font-title text-4xl text-gold">{n}</span>
              <Editable k={`school.stages.${n}.title`} as="h3" className="text-lg">{title}</Editable>
              <Editable k={`school.stages.${n}.text`} className="text-sm text-mist">{text}</Editable>
            </div>
          ))}
        </div>
      </section>

      <Editable k="school.stages.warning" className="max-w-3xl mx-auto px-4 text-center text-sm text-gold-light">
        Advertencia: esta experiencia es irreversible. Una vez que descubras el Silencio Sagrado que te entrega el programa de autosanación El Silencio es tu Gurú, nunca más volverás a sentirte perdido espiritualmente.
      </Editable>

      <Quote k="school.quote.1">La respuesta que le pides al mundo, solo te la puede dar tu alma.</Quote>

      {/* Taller introductorio */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="glass rounded-3xl p-8 md:p-12 space-y-5 border border-gold/30">
          <Editable k="school.workshop.eyebrow" className="text-xs uppercase tracking-[0.3em] text-gold">Programa de autosanación y maestría interior (online)</Editable>
          <Editable k="school.workshop.title" as="h2" className="text-3xl">Introductorio online al sistema de maestría interior</Editable>
          <Editable k="school.workshop.subtitle" className="text-gold-light">4 horas de revelación en vivo. Una experiencia sin teorías.</Editable>
          <Editable k="school.workshop.includes" className="text-sm text-bone/90 leading-7">
            {'Enseñanzas esenciales de El Silencio es tu Gurú, directamente de su autora.\nTu cuaderno de trabajo digital para registrar las revelaciones y patrones que vas rompiendo día a día.\nHerramientas simples para calmar el ruido mental.\nAcceso exclusivo al círculo de estudiantes donde compartimos avances y sostenemos la frecuencia del silencio.'}
          </Editable>
          <Editable k="school.workshop.note" className="text-xs text-mist">
            Este workshop es una experiencia completa por sí solo, pero su verdadero propósito es evaluar si tu alma está lista para el camino sagrado de 21 días.
          </Editable>
          <Cta k="school.workshop.cta" to={waitlist}>Consultar próxima fecha / lista de espera</Cta>
        </div>
      </section>

      {/* Dos caminos */}
      <section className="max-w-6xl mx-auto px-4 space-y-10">
        <div className="space-y-3 text-center">
          <SectionTitle k="school.paths" eyebrow="Elige tu nivel de compromiso" center>Dos caminos para vivir el sistema</SectionTitle>
          <Editable k="school.paths.text" className="text-mist max-w-3xl mx-auto">
            Un sistema vivo, no un curso grabado. La transformación ocurre en tiempo real: nos reunimos online para silenciar la mente juntos. No te doy una grabación; te doy mi presencia, dirección y contención en tiempo real.
          </Editable>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass rounded-3xl p-8 space-y-4">
            <Editable k="school.book.title" as="h3" className="text-2xl text-gold">El libro: tu mapa de autosanación</Editable>
            <Editable k="school.book.text" className="text-mist">
              {'El sistema completo en tus manos. Que no te confunda el formato: este libro es el programa. No me he guardado nada. Aquí tienes la ruta exacta de 21 días, las prácticas de respiración y los códigos de lucidez para que, en la privacidad de tu hogar, desactives el ruido mental y conectes con Dios.\n\nIdeal para almas autodidactas que buscan soberanía, privacidad y avanzar a su propio ritmo.'}
            </Editable>
            <Cta k="school.book.cta" to="/tienda" variant="outline">Adquirir el libro</Cta>
          </div>
          <div className="glass rounded-3xl p-8 space-y-4 border border-gold/30">
            <Editable k="school.mentoring.title" as="h3" className="text-2xl text-gold">La inmersión profunda: mentoría de 25 días</Editable>
            <Editable k="school.mentoring.subtitle" className="text-xs uppercase tracking-wide text-gold-light">Exclusivo · cupos limitados</Editable>
            <Editable k="school.mentoring.text" className="text-mist">
              Hay momentos donde el ego se resiste tanto que necesitamos una mano firme que nos sostenga. En esta experiencia (grupal o 1:1), yo camino a tu lado durante todo el proceso del libro. No es para enseñarte más teoría, sino para sostener tu práctica, disolver tus dudas en tiempo real y asegurar que la transformación se asiente.
            </Editable>
            <Editable k="school.mentoring.includes" className="text-sm text-bone/90 leading-7">
              {'Grupos íntimos de máximo 10 personas.\nEncuentros individuales para ajustar el proceso a tu alma.\nAcompañamiento diario durante los 21 días de silencio interior.\nSesión íntima de preguntas y respuestas con Adela.'}
            </Editable>
            <Cta k="school.mentoring.cta" to={waitlist}>Consultar próxima fecha / lista de espera</Cta>
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section className="max-w-6xl mx-auto px-4 space-y-10">
        <SectionTitle k="school.testimonials" center>Lo que dicen las personas que ya se transformaron</SectionTitle>
        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(([key, text, who]) => (
            <figure key={key} className="glass rounded-3xl p-6 space-y-4">
              <Editable k={`school.testimonials.${key}.text`} as="blockquote" className="text-bone/90 italic">{text}</Editable>
              <Editable k={`school.testimonials.${key}.who`} as="figcaption" className="text-sm text-gold">{who}</Editable>
            </figure>
          ))}
        </div>
      </section>

      {/* Autora */}
      <section className="max-w-3xl mx-auto px-4 space-y-6">
        <SectionTitle k="school.author" eyebrow="Maestría y soberanía">La búsqueda termina donde empieza tu silencio</SectionTitle>
        <Editable k="school.author.text" className="text-mist leading-relaxed">
          {'Vivimos en un mundo lleno de ruido, incluso ruido «espiritual». Pasé mucho tiempo creyendo que para conectar con Dios necesitaba hacer más, viajar más o aprender más.\n\nHasta que la vida me detuvo y me mostró la verdad desnuda: la divinidad no se conquista, se reconoce.\n\nCuando quitas los adornos, los rituales y la dependencia de lo externo, lo único que queda es tu respiración y la Presencia. Ese es el único Gurú que no falla. Este programa nace de esa certeza. Es una invitación a soltar el peso de «tener que ser espiritual» para simplemente ser. Aquí no vienes a buscar milagros; vienes a darte cuenta de que tú eres el lugar donde el milagro ocurre.\n\nNo escribí El Silencio es tu Gurú para enseñar algo… lo escribí para sobrevivir. Fue en el momento más vulnerable de mi vida cuando entendí que ya no había nada más que buscar.\n\nDesde entonces, he guiado a miles de personas hacia su despertar espiritual usando este programa simple pero revolucionario.'}
        </Editable>
        <Quote k="school.quote.2">No llegaste aquí por casualidad. El silencio te está llamando…</Quote>
      </section>
    </div>
  );
};
