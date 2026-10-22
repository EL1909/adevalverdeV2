# Adela Valverde — V2

Hub de herramientas, tienda y asesorías de Adela Valverde. Misma arquitectura
que MCnails: React (PWA) + Django REST sobre evz-backbone. Plan de trabajo en
[ROADMAP.md](ROADMAP.md).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router |
| Backend | Django 5.2, Django REST Framework, SimpleJWT |
| Backbone | evz-backbone v1.9.0: `evz_core`, `evz_store`, `evz_treasury`, `evz_crm`, `evz_calendars`, `evz_payments` |
| Base de datos | SQLite en desarrollo, PostgreSQL en producción |
| Pagos | PayPal |

## Estructura

```
adevalverdeV2/
├── backend/
│   ├── accounts/   # propia: usuario por email, registro, login, perfil
│   ├── content/    # propia: CMS de textos e imágenes editables (con revisiones) e import_gamma
│   ├── legacy/     # importación única desde el sitio anterior (import_legacy)
│   └── core/       # settings y urls
└── frontend/
    ├── public/     # imágenes, iconos, manifest y service worker (sw.js) de la PWA
    └── src/
        ├── api/        # clientes HTTP (/api/...)
        ├── apps/       # herramientas del hub (registry.ts)
        ├── components/
        ├── content/    # textos iniciales largos (legales)
        ├── context/    # sesión, identidad del negocio, CMS, carrito
        ├── lib/        # PayPal, fechas (hora de Madrid), push
        └── pages/
```

## Editar textos (CMS)

Cualquier usuario con `is_staff` ve el botón **Editar textos** abajo a la
derecha. En modo edición, cada texto marcado con línea punteada se edita con
un clic, y las imágenes muestran **Cambiar imagen**. Cada cambio guarda la
versión anterior, visible en `/admin/` → Bloques de contenido para copiarla
de vuelta si hace falta.

Para hacer editable un texto nuevo en el frontend:

```tsx
<Editable k="pagina.seccion.campo" as="h2" className="text-3xl">Texto por defecto</Editable>
<EditableImage k="pagina.seccion.imagen" src="/images/x.jpg" alt="…" />
```

Las imágenes editables guardan su encuadre (`framing`: punto a la vista y
zoom) sin recortar el archivo; las portadas de productos, en
`Product.image_framing` (backbone).

## Páginas de libros

Un producto con **Tiene página propia** (panel → Tienda) se ve en
`/libro/<slug>`: portada, precio y compra arriba, y debajo una página larga
por secciones (`components/ProductSections.tsx`): portada, texto, recuadros
(tarjetas, pasos o testimonios), listas y oferta. La estructura vive en el
bloque `libro.<slug>.secciones` (JSON) y cada texto o imagen en su propio
bloque; en modo edición se añaden, mueven y quitan secciones y recuadros.

Para crear la página desde una página publicada en Gamma (`content/gamma.py`):

```bash
python manage.py import_gamma libro.<slug> https://….gamma.site/ --dry-run   # solo muestra las secciones
python manage.py import_gamma libro.<slug> https://….gamma.site/             # guarda; --replace si ya tiene
```

Las imágenes se copian a `media/`: la página no depende de Gamma. El
contenido vive en la base de datos, así que se importa en cada entorno
(local y VM) por separado.

## Consultas

`components/ContactCta.tsx` es un botón con formulario (nombre, email o
teléfono, mensaje). Lo recibe `evz_crm` (`POST /api/crm/contact/`): la persona
queda en *Clientes* (lead si es nueva) con el mensaje como nota y la etiqueta
**Consulta pendiente**, y Adela recibe un push que abre la ficha
(`EVZ_CRM_CONTACT_LINK`). La pestaña *Consultas* del panel es la bandeja; el
botón **Consulta respondida** quita la etiqueta. Lo usan los botones de
lista de espera de `/escuela`.

## Correos

Los correos (recuperar contraseña, confirmación de citas, pedidos) salen por
EsfuerzoVZ (`evz_core.mail_relay`) con `EVZ_API_URL` y `EVZ_API_TOKEN` en
`.env`. El token se genera en EsfuerzoVZ con
`manage.py issue_business_token <slug-del-proyecto>`; generar uno nuevo
invalida el anterior. Sin token, los correos fallan en silencio (queda el
error en el log de gunicorn).

## Desarrollo

```bash
# Backend
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt   # requiere acceso SSH a EL1909/evz_backbone
cp .env.example .env                          # rellenar SECRET_KEY
./venv/bin/python manage.py migrate
./venv/bin/python manage.py createsuperuser
./venv/bin/python manage.py runserver         # :8000

# Frontend
cd frontend
npm install
npm run dev                                   # :3000, proxy de /api, /admin y /media al :8000
```

## Agenda

Horario, bloqueos (vacaciones) y holgura entre citas se editan en `/admin/` →
*Agenda*. El calendario de Google se configura en *Configuración de agenda*
(ID del calendario) y con `GOOGLE_SERVICE_ACCOUNT_FILE` en `.env`; la cuenta de
servicio necesita permiso **Hacer cambios en eventos** sobre ese calendario.
Las asesorías son los productos activos con **duración** (ej. `60 min`).
La reserva, el cobro y la cita manual son de `evz_calendars.booking` (backbone);
cada persona que reserva queda en *Clientes* como lead hasta su primer pago.
Las citas anteriores se enlazan con `manage.py link_appointment_clients`.

**Sesión de cortesía:** un servicio con precio y la casilla *Gratis para
quien compró un libro* (`Product.free_with_purchase`) sale gratis una vez por
email a quien tiene un producto digital pagado
(`EVZ_BOOKING_FREE_REQUIRES_PURCHASE = 'digital'`); los demás lo pagan. En
*Sesiones*, el paso 2 muestra los libros comprados (con sesión iniciada) o
comprueba el email (sin sesión, solo sí o no) con `GET /api/bookings/free-check/`.

## Producción

Archivos en [deploy/](deploy/): `nginx.conf` (SPA, `/api` y `/admin` a
gunicorn, `/media/.../private/` bloqueado, `sw.js` sin caché) y
`gunicorn-adevalverdeV2.service` (puerto 8010). En la VM:

```
~/projects/adevalverdeV2/
├── adevalverdeV2/   # este repo (backend/.env, backend/media, service_account.json)
└── venv/
```

Cada actualización: `FRONTEND=skip ./deploy.sh` en la VM y el frontend
construido en el Mac:

```bash
cd frontend && npm run build
rsync -av --delete dist/ esfuerzo:/home/efrain19091/projects/adevalverdeV2/adevalverdeV2/frontend/dist/
```

`./deploy.sh` a secas también construye el frontend en la VM, pero con 1,9 GB
de RAM compartidos con otros proyectos (y sin swap) `vite build` se queda sin
memoria. Ver la fase 5 del ROADMAP para el alta inicial y el corte.
