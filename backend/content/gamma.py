"""
Convierte una página publicada en Gamma (gamma.site) en secciones del CMS.

Gamma incrusta el documento entero en el HTML (`__NEXT_DATA__`): cada «card»
es un árbol de nodos (heading, paragraph, bullet, smartLayout…). Aquí cada
card pasa a ser una sección de uno de los cinco tipos que dibuja el frontend
(components/ProductSections.tsx):

    portada   título, texto, nota, botón, imagen
    texto     título, texto, imagen (lado izquierda/derecha)
    recuadros título, texto, cierre, imagen, items (título + texto); estilo
    listas    título, texto, cierre, imagen, items (título + lista)
    oferta    título, texto, destacado, nota, botón, imagen (de fondo)

El texto sale en el formato del sitio: párrafos separados por línea en blanco,
`- ` para listas, `**negrita**` y `~~tachado~~`. Solo se lee: las imágenes se
descargan aparte (management command `import_gamma`).
"""

import json
import re

NEXT_DATA = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)

TEXT_MARKS = {'bold': '**', 'strike': '~~'}
ENDS_SENTENCE = re.compile(r'\S$')


def next_data(html):
    """El JSON que Gamma incrusta en la página; ValueError si no está."""
    m = NEXT_DATA.search(html)
    if not m:
        raise ValueError('La página no trae __NEXT_DATA__: ¿es una página de Gamma?')
    return json.loads(m.group(1))


def cards_of(data):
    """Las cards visibles del documento, en orden."""
    found = []

    def walk(o):
        if isinstance(o, dict):
            if o.get('type') == 'card':
                found.append(o)
                return
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(data)
    return [c for c in found if not (c.get('attrs') or {}).get('hidden')]


def _inline(node):
    """Texto de un nodo con negrita/tachado; los saltos (hardBreak) como '\\n'."""
    out = []
    for c in node.get('content', []):
        t = c.get('type')
        if t == 'text':
            s = c.get('text', '')
            marks = [TEXT_MARKS[m['type']] for m in c.get('marks', []) if m.get('type') in TEXT_MARKS]
            if s.strip():
                for mk in marks:
                    lead, core, trail = re.match(r'^(\s*)(.*?)(\s*)$', s, re.S).groups()
                    s = f'{lead}{mk}{core}{mk}{trail}'
            out.append(s)
        elif t == 'hardBreak':
            out.append('\n')
        elif t == 'emoji':
            out.append('\x00')  # marca de emoji: decide si la línea es un punto de lista
        else:
            out.append(_inline(c))
    # Marcas contiguas del mismo tipo: '**a** **b**' se lee bien, '**a****b**' no.
    return re.sub(r'(\*\*|~~)\1', '', ''.join(out))


def _paragraph(node):
    """Un párrafo; si todas sus líneas empiezan con emoji (✔️, ✨…) es una lista."""
    lines = [ln.strip() for ln in _inline(node).split('\n')]
    lines = [ln for ln in lines if ln]
    if lines and all(ln.startswith('\x00') for ln in lines):
        return 'list', '\n'.join('- ' + ln.lstrip('\x00 ').strip() for ln in lines)
    return 'para', '\n'.join(ln.replace('\x00', '').strip() for ln in lines)


def _image_src(node):
    attrs = node.get('attrs') or {}
    return attrs.get('src') or ''


def _accent(card):
    """Imagen lateral o de fondo de la card (con su punto focal)."""
    for ch in card.get('content', []):
        if ch.get('type') != 'cardAccentLayoutItem':
            continue
        bg = (ch.get('attrs') or {}).get('background') or {}
        img = bg.get('image') or {}
        if bg.get('type') == 'image' and img.get('src'):
            pos = img.get('backgroundPos')
            framing = {'x': round(pos['x'], 2), 'y': round(pos['y'], 2), 'zoom': 1} if pos else {}
            return {'src': img['src'], 'framing': framing}
    return None


def _cell(cell):
    """Un recuadro de un smartLayout: su primer título y el resto como texto."""
    title, parts = '', []
    for node in _flatten(cell):
        kind, value = node
        if kind == 'heading' and not title:
            title = value
        elif kind == 'heading':
            parts.append(f'**{value}**')
        elif kind in ('para', 'list'):
            parts.append(value)
    return {'titulo': _plain(title), 'texto': '\n\n'.join(p for p in parts if p)}


def _plain(s):
    """Títulos sin marcas: el estilo del título ya lo pone el sitio."""
    return re.sub(r'\*\*|~~', '', s).strip()


def _flatten(node):
    """
    Recorre la card en orden y devuelve bloques (tipo, valor):
    heading, para, list, image, button, callout y smart (lista de recuadros).
    """
    out = []

    def walk(n):
        t = n.get('type')
        if t == 'heading':
            out.append(('heading', _inline(n).replace('\x00', '')))
        elif t == 'paragraph':
            kind, value = _paragraph(n)
            if value:
                out.append((kind, value))
        elif t == 'bullet':
            out.append(('list', '- ' + _plain(_inline(n).replace('\x00', '')).replace('\n', ' ')))
        elif t == 'image':
            if _image_src(n):
                out.append(('image', _image_src(n)))
        elif t == 'button':
            out.append(('button', _plain(_inline(n))))
        elif t == 'calloutBox':
            out.append(('callout', '\n\n'.join(_paragraph(p)[1] for p in n.get('content', []))))
        elif t == 'smartLayout':
            cells = [_cell(c) for c in n.get('content', []) if c.get('type') == 'smartLayoutCell']
            out.append(('smart', {'variant': (n.get('attrs') or {}).get('variantKey') or '', 'cells': cells}))
        else:
            for c in n.get('content', []):
                walk(c)

    walk(node)
    # Bullets seguidos forman una sola lista.
    merged = []
    for kind, value in out:
        if kind == 'list' and merged and merged[-1][0] == 'list':
            merged[-1] = ('list', merged[-1][1] + '\n' + value)
        else:
            merged.append((kind, value))
    return merged


def _style(variant, cells):
    texts = [c['texto'].lstrip('*') for c in cells if c['texto']]
    if texts and all(t[:1] in '"“«' for t in texts):
        return 'testimonios'
    if variant in ('outlineBoxesWithTopCircle', 'solidBoxesWithTopCircle', 'steps'):
        return 'pasos'
    return 'tarjetas'


def section_of(card, first=False):
    """Una card de Gamma como sección del sitio (dict sin IDs ni imágenes descargadas)."""
    attrs = card.get('attrs') or {}
    blocks = _flatten(card)
    accent = _accent(card)

    # Título: el primer heading, unido al siguiente si la frase sigue
    # (ej. «Sobre Adela Valverde, Autora de » + «"El Librito del Oro"»).
    title, used = '', set()
    for i, (kind, value) in enumerate(blocks):
        if kind != 'heading':
            continue
        title, used = value, {i}
        j = i + 1
        while value.endswith((' ', '\n')) and j < len(blocks) and blocks[j][0] == 'heading':
            value = blocks[j][1]
            title += value
            used.add(j)
            j += 1
        break

    smart = next((v for k, v in blocks if k == 'smart'), None)
    has_button = any(k == 'button' for k, _ in blocks)
    content_images = [(i, v) for i, (k, v) in enumerate(blocks) if k == 'image']

    if has_button:
        tipo = 'portada' if first else 'oferta'
    elif smart:
        tipo = 'listas' if any(re.search(r'^- ', c['texto'], re.M) for c in smart['cells']) else 'recuadros'
    elif any(k == 'list' for k, _ in blocks):
        tipo = 'listas'
    else:
        tipo = 'texto'

    texto, cierre, nota, destacado, boton = [], [], [], [], ''
    items = smart['cells'] if smart else []
    after_smart = after_button = False
    for i, (kind, value) in enumerate(blocks):
        if i in used or kind == 'image':
            continue
        if kind == 'smart':
            after_smart = True
            if tipo in ('portada', 'oferta'):
                # Ej. «EXPERIENCIA COMPLETA…» con su lista: va dentro del texto de la oferta.
                for c in value['cells']:
                    if c['titulo']:
                        texto.append(f"**{c['titulo']}**")
                    if c['texto']:
                        texto.append(c['texto'])
            continue
        if kind == 'button':
            boton = boton or value
            after_button = True
            continue
        if kind == 'callout':
            destacado.append(value)
            continue
        if kind == 'list' and tipo == 'listas' and not smart:
            items.append({'titulo': '', 'texto': value})
            after_smart = True
            continue
        piece = f'**{_plain(value)}**' if kind == 'heading' else value
        if after_button and tipo in ('portada', 'oferta'):
            nota.append(piece)
        elif after_smart and tipo in ('recuadros', 'listas'):
            cierre.append(piece)
        else:
            texto.append(piece)

    if tipo in ('portada', 'oferta', 'texto'):
        items = []

    image = accent
    if not image and content_images:
        image = {'src': content_images[0][1], 'framing': {}}
    if attrs.get('layout') == 'left':
        lado = 'izquierda'
    elif attrs.get('layout') in ('right', 'behind') or not content_images:
        lado = 'derecha'
    else:
        # Imagen dentro del contenido: a la izquierda si va antes que el texto.
        first_text = next((i for i, (k, _) in enumerate(blocks) if k in ('heading', 'para', 'list')), len(blocks))
        lado = 'izquierda' if content_images[0][0] < first_text else 'derecha'

    fields = {
        'titulo': _plain(title),
        'texto': '\n\n'.join(texto),
        'cierre': '\n\n'.join(cierre),
        'destacado': '\n\n'.join(destacado),
        'nota': '\n\n'.join(nota),
        'boton': boton,
    }
    section = {
        'tipo': tipo,
        'campos': {k: v.strip() for k, v in fields.items() if v and v.strip()},
        'imagen': image,
        'items': items,
    }
    if tipo in ('portada', 'texto'):
        section['lado'] = lado
    if tipo == 'recuadros':
        section['estilo'] = _style(smart['variant'] if smart else '', items)
    return section


def sections_of(html):
    """Todas las secciones de una página de Gamma, a partir de su HTML."""
    cards = cards_of(next_data(html))
    return [section_of(c, first=(i == 0)) for i, c in enumerate(cards)]
