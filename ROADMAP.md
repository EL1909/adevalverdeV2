# Roadmap: adevalverdeV2

Sitio nuevo de Adela Valverde: **React (PWA) + Django/DRF sobre evz-backbone**,
con la misma arquitectura que MCnails. Reemplaza al sitio Django con plantillas
(`../adevalverde`) y a las páginas de Gamma.

Objetivo: una **mini app web con una sola cuenta de usuario, historial y pagos**,
que funcione como hub de herramientas (ver `AppsProposal.rtfd`) y dirija a cada
cliente al libro, programa o asesoría indicado. Las herramientas se incorporan
una a una.

## Estado y siguiente sesión (2026-10-20)

**Hecho:** fases 0–3.8 y la herramienta 0 de la fase 4 (Test de la Coherencia), en
`main` de los dos repos. V2 fija **evz_backbone v1.7.0** (tag `69c9faf`, publicado; incluye
evz_clerk beta, que V2 no instala). Staging en la VM desde el 2026-10-19 (ver fase 5).

**Siguiente:**
1. Desplegar en la VM (`./deploy.sh`: instala v1.7.0, migra `evz_store.0011–0012` y
   `content.0002`) y probar en staging: navegación (El Umbral), páginas `/libro/…`,
   sesión de cortesía, test y «Ajustar encuadre».
2. Fase 4, herramienta 1: **El Escáner de la Coherencia** (modelo `Situation`, límite
   gratis/Premium). Antes conviene probar suscripciones en sandbox de PayPal (fase 2).
3. Al terminar la fase 4: asignar el destino del botón **El Escáner** de la barra (hoy `#`).

**Adela, en la VM (datos, no código):**
- Categorías: nombre visible, descripción y «Mostrar en El Umbral» (hoy ninguna en el menú).
- Mentoría 1:1 con duración «90 min»; sesión de cortesía a $0 con «15 min».
- Marcar «Tiene página propia» en los libros y escribir su texto largo.
- Test: elegir el destino de los 5 resultados y de la mentoría (modo edición, selector bajo cada botón).
- «LA ANATOMÍA DEL MURO» está en Sesiones sin duración: se vende como producto; si es con cita, ponerle duración.

**Pendientes sueltos:** encuadre de portadas de productos (`Product.image_framing`, backbone);
el proxy de desarrollo usa el **8003** (`vite.config.ts` y `frontend/.env`, que lo pisa: mantenerlos iguales);
[PENDIENTES.md](PENDIENTES.md) está desactualizado en Git (push de v1.4.0 y primer commit ya hechos).

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Base | Esqueleto copiado de MCnails (`backend/core`, `backend/accounts`, infraestructura de `frontend/src`) |
| Identidad visual | La del sitio actual: negro `#0a0a0a`, dorado `#D4AF37`, Quicksand (títulos) + Montserrat (textos), imágenes de `media/site` y `static/coherencia_app/images` |
| Pagos | PayPal (como hoy) y pagos manuales verificados por Adela (Zelle, transferencia, USDT), en `evz_payments`. Moneda: USD |
| IA | No se usa. El prototipo del test tiene código de Gemini pero sin clave configurada (siempre muestra una frase fija); no se porta |
| Gamma | Se reemplaza con páginas propias |
| App | PWA instalable (sin tiendas de apps) |
| Keymoments | Se descarta |
| Agenda | **Sí aplica**: Adela da asesorías con cita (6 citas reales, Google Calendar). Se instalan `evz_calendars` + `evz_crm` (dependencia de `Appointment.client`) |
| Usuario | `accounts.User` por email (UUID), con email obligatorio al registrarse |
| Backbone | `evz-backbone` v1.7.0 (`[google-calendar,digital,paypal]`) |
| Correo | Relay de EsfuerzoVZ (`evz_core.mail_relay`): sin SMTP propio, "Adela Valverde" en la cabecera |
| Textos del sitio | CMS propio (app `content`): Adela edita textos e imágenes desde el propio sitio con su usuario staff; cada cambio guarda una revisión |

### Subscription: modelo propio, no extensión de Order

> Desde v1.4.0 `Plan`, `Subscription` y `SubscriptionPayment` viven en
> `evz_store` (sin campos de PayPal: `gateway`/`gateway_ref`), y la parte de
> PayPal en `evz_payments`. `Plan.apps` pasó a llamarse `Plan.grants`.

`Order` es un evento puntual (una compra con sus líneas congeladas);
una suscripción es un estado en el tiempo (activa → impagada → cancelada).

- `Plan`: extensión de `evz_store.Product` con intervalo (mensual/anual),
  `paypal_plan_id` y las apps que incluye.
- `Subscription`: usuario, plan, estado, `paypal_subscription_id`,
  `current_period_end`, `cancel_at`. Se actualiza con los webhooks de PayPal.
- **Cada cobro (alta y renovaciones) genera un `Order`** con FK a la
  `Subscription`. Así el historial de pagos es uno solo y `evz_treasury` sigue
  creando el `Transaction` al confirmar la orden.
- Acceso: función `has_access(user, app)` (suscripción activa o compra única).
  Pasa a modelo `Entitlement` solo si hace falta.

## Fases

### Fase 0 — Esqueleto ✅ (2026-10-12)

- [x] Estructura `backend/` + `frontend/` desde MCnails, sin prefijo `/mcnails`
- [x] Settings para Adela: dominio, `es`, zona horaria, variables de PayPal y Google Calendar, `.env.example`
- [x] Apps: `evz_core`, `evz_store`, `evz_treasury`, `evz_crm`, `evz_calendars`
- [x] `accounts.User`: `date_joined`/`last_login` sin `auto_now` (para conservar las fechas reales al migrar)
- [x] Fix del bug heredado: el registro daba 500 porque el `Profile` se creaba dos veces (señal + serializer). **MCnails tiene el mismo bug**
- [x] Frontend: tema, rutas (inicio, herramientas, tienda, asesorías, cuenta, reset), hub de apps, manifest PWA, imágenes locales
- [x] CMS en el sitio (app `content`): bloques editables por clave (`home.hero.title`), botón "Editar textos" para staff, revisión del valor anterior visible en el admin. Inicio, herramientas, asesorías, privacidad y términos ya son editables
- [x] Verificado: `manage.py check`, migraciones, registro/login/perfil por API, `tsc`, `vite build`, proxy de desarrollo

Zona horaria confirmada: `Europe/Madrid`.

### Fase 1 — Usuarios y datos del sitio anterior ✅ (2026-10-12, copia local)

- [x] evz-backbone **v1.3.0** (rama `feature/order-user`, commit `46768b7`; **falta tag y push**):
  `Order.user`, `Order.payment_reference`, `GET /api/store/orders/mine/`, `Method.PAYPAL`.
  Aditivo: MCnails (fijado en v1.1.0) no se ve afectado.
- [x] App `catalog`: `ProductDetail` (digital, archivo, enlace externo) y `Download` (token, QR).
- [x] App `legacy` con `manage.py import_legacy` (ver uso abajo). Conserva IDs de
  categorías, productos y pedidos, hashes de contraseña, fechas y tokens de descarga.
- [x] "Mi cuenta" muestra el historial de pedidos.
- [x] Probado sobre la copia local: 53 pedidos, 8 productos, 6 citas, 21 descargas;
  conteos y usuario de cada pedido verificados por el propio comando.

```bash
./venv/bin/python manage.py import_legacy --db <ruta>/db.sqlite3 --media <ruta>/media \
    --exclude-email guest@example.com --exclude-email test@example.com [--dry-run]
```

Reglas del importador:

| Caso | Qué hace |
|---|---|
| Varias cuentas con el mismo email | Se fusionan en la más antigua (conserva su contraseña y permisos) |
| Contraseña que no es hash (texto plano) | Queda inutilizable; la persona usa "olvidé mi contraseña" |
| Cuenta sin email o en `--exclude-email` | No se importa; sus pedidos quedan como invitado |
| Pedido sin líneas con importe | Se crea una línea "Pedido importado (sin detalle)" con el total |
| Pedido `failed` | Pasa a `cancelled` |
| Pedido pagado | Genera un ingreso en tesorería, salvo que el comprador sea del sandbox de PayPal (`*.example.com`) |
| `shipping_data` | Queda como nota del pedido |

Hallazgos en la copia local (revisar en la base real):
- La mayoría de pedidos son pruebas (sandbox, "John Doe", producto "Test Paypal").
- **No hay cuenta de Adela.** Crearla (o registrarla) y marcar `is_staff=True` para el CMS.
- El usuario `edgar` tenía la contraseña guardada en texto plano.
- Faltan 22 archivos de media en la copia local (QR y capturas); en la VM deberían estar.

Pendiente para el corte real: correr `--dry-run` contra una copia de la base de la VM.

### Fase 2 — Pagos (PayPal) ✅ (2026-10-12, sin probar contra PayPal real)

- [x] App `payments`: cliente de la API de PayPal (Orders v2, Billing v1, webhooks).
- [x] Checkout: precios del servidor, pedido con o sin cuenta, captura idempotente
  (navegador + webhook), comprobación de importe y moneda antes de dar un pedido por pagado,
  ingreso en tesorería, correo de confirmación. Pedidos de importe 0 se completan sin PayPal.
- [x] Recibo público con token firmado (`/pedido/<token>`): ya no se exponen IDs de pedido
  (el sitio anterior mostraba las descargas de cualquier pedido cambiando `?order_id=`).
- [x] Descargas (`catalog`): QR por compra, PDF con el QR estampado en la página 2,
  un solo uso (el staff lo rehabilita desde el admin), página de verificación `/verificar/<token>`.
- [x] Suscripciones: `Plan` (extensión de un `Product`), `Subscription`, `SubscriptionPayment`.
  Cada cobro → un `Order` pagado + ingreso. Cancelar mantiene el acceso hasta el fin del periodo.
  `manage.py paypal_sync_plans` crea en PayPal los planes pendientes.
- [x] Webhook `POST /api/payments/paypal/webhook/` con firma verificada por PayPal; sin
  `PAYPAL_WEBHOOK_ID` rechaza todo. Eventos guardados (auditoría e idempotencia).
- [x] `GET /api/payments/access/` → apps habilitadas por suscripción (staff: todas).
- [x] Frontend: carrito, checkout con botones de PayPal, recibo, verificación, planes,
  retorno de suscripción, "Mi cuenta" con suscripciones y descargas.
- [x] 18 tests con PayPal simulado.

Reglas de catálogo:
- Digital = `ProductDetail.is_digital` **con** archivo PDF. El importador corrige las
  sesiones que el sitio anterior marcaba como digitales.
- Productos con `duration` (asesorías) no se venden desde la tienda: se comprarán al reservar (fase 3).
- `requires_shipping` hace que PayPal pida la dirección.

Pendiente:
- Probar en sandbox con credenciales reales (compra, suscripción, webhook vía túnel).
- Devoluciones: el webhook marca el pedido como cancelado y deja nota; el gasto en
  tesorería se registra a mano.
- Acceso por compra única (Jericó) se resuelve en la fase 4.

### Fase 3 — Frontend completo (PWA) ✅ (2026-10-13, sin Google Calendar ni push reales)

- [x] App `bookings` (asesorías) sobre `evz_calendars`: una sola agenda (Adela, creada
  por migración con horario L–V 9–19, editable en el admin), días y horarios libres en
  hora de Madrid (con la hora local de quien reserva si difiere), antelación mínima 24 h,
  plazo 60 días.
- [x] Reserva = cita + pedido pendientes que retienen el horario 30 min mientras se paga
  (los botones de PayPal son los del carrito). Si el pago llega tarde: se cobra solo si el
  horario sigue libre. Gratuitas (ej. Primera Cita): una por email, sin PayPal.
- [x] Al cobrarse: cita confirmada, **evento en Google Calendar** (`bookings/gcal.py`,
  scope `calendar.events`), correo con `.ics` adjunto y aviso a la administración.
  Cancelar o borrar una cita (también desde el admin) borra su evento. Una devolución
  en PayPal cancela la cita.
- [x] El cliente cancela online solo sesiones gratuitas y con 24 h de antelación; las
  pagadas se cambian por correo (ver decisión en PENDIENTES).
- [x] Seguridad: del backbone ya no se montan las API de gestión (`/api/calendars/`,
  `/api/store/` salvo `orders/mine/`, CRM, tesorería): aceptaban crear pedidos y citas
  sin pagar. Adela gestiona desde el admin.
- [x] Páginas **Sobre mí** (`/sobre-mi`) y **Escuela** (`/escuela`) con el texto de las
  páginas de Gamma que reemplazan, todo editable (precios en $ quitados hasta decidir moneda).
- [x] Legales con el texto actual como contenido inicial editable (requiere revisión).
- [x] Cuenta: asesorías, pedidos, suscripciones, descargas; avisos push para superusers.
- [x] PWA: iconos (loto dorado del favicon), `sw.js` (app shell sin conexión, caché de
  assets e imágenes, nunca `/api` ni `/media`), recepción de push. `manage.py vapid_keys`.
- [x] 29 tests (11 de reservas).

Pendiente:
- Probar con la cuenta de servicio real contra el calendario de Adela.
- Enlace de la videollamada: hoy Adela lo envía a mano (una cuenta de servicio no crea
  enlaces de Meet sin Google Workspace).
- Recordatorio por correo el día anterior (necesita tarea programada: cron en el deploy).

### Fase 3.6 — Cobros al backbone y panel de Adela ✅ (2026-10-15, local)

- [x] **evz_backbone v1.4.0** (incluye `Order.user`, que no había llegado a v1.3.0):
  - `evz_store`: productos digitales (archivo en `store/private/`, descarga con QR),
    `Plan`/`Subscription`, `mark_paid()`, señales `order_paid` y `order_cancelled`,
    acción de staff para cancelar pedidos.
  - `evz_payments` (nueva, opcional): PayPal (pedidos, suscripciones, webhook) y pagos
    manuales (métodos en el admin; el cliente declara la referencia; el staff confirma).
  - `mail_relay`: enlaces, adjuntos `.ics` y Reply-To.
- [x] EsfuerzoVZ: relay ampliado (rama `feature/relay-links-adjuntos`).
- [x] V2 sin `catalog` ni `payments`: `bookings` se engancha por señales; recibo con
  la cita vía `EVZ_PAYMENTS_RECEIPT_EXTRA`; correos (pedido, cita, contraseña) por relay.
- [x] Importador: PDFs a la carpeta privada, pendientes sin pagar → cancelados,
  portadas comprimidas, moneda USD.
- [x] Checkout y asesorías con selector de método; recibo con datos para pagar y
  formulario de referencia.
- [x] `/cuenta` con pestañas **Perfil | Tienda | Calendario** (las dos últimas, staff):
  pagos por verificar, pedidos (notas, cancelar), productos (alta/edición con imagen y
  PDF), citas, horario semanal y bloqueos.
- [x] 39 tests.

### Fase 3.7 — Agenda en el backbone, cita manual y leads ✅ (2026-10-16, local)

- [x] **evz_backbone v1.5.0**: la app `bookings` pasa a `evz_calendars.booking` (reserva
  pagada, retención, eventos en Google Calendar con `EVZ_CALENDARS_GOOGLE_EVENTS`, `.ics`),
  configurable con `EVZ_BOOKING_*`. V2 ya no tiene app propia de reservas; la migración
  de datos de la agenda de Adela pasa a `accounts.0002`.
- [x] `evz_crm.services`: cada reserva crea o enlaza la ficha del cliente como lead
  (`Nuevo Lead`). Al primer pago pasa a `Cliente`; también se puede marcar a mano.
- [x] Cita manual desde el panel: cortesía, ya pagada (registra el ingreso) o pendiente
  (recibo con los datos de pago, no vence sola). Fuera de horario solo si se confirma;
  nunca encima de otra cita.
- [x] `/cuenta` → **Calendario**: FullCalendar con el panel Detalle | + Nueva cita (como
  MCnails). Nueva pestaña **Clientes**: directorio con filtro Leads/Clientes, ficha
  editable, etiquetas, notas e historial de citas y pedidos. Alta manual de fichas
  (lead o cliente, con nota inicial; avisa si el email o teléfono ya existe).
- [x] 56 tests (16 nuevos).
- Pendiente: `manage.py link_appointment_clients` sobre la base real tras importar.

### Fase 3.8 — Navegación por categorías ✅ (2026-10-20, en `main`)

- [x] **evz_backbone v1.6.0**: `Category.display_name`, `description`, `show_in_menu`, `position`.
  El importador trae `display_name` y `description` del sitio anterior.
- [x] Barra: logo → Sobre mí; **El Umbral ▾** (categorías que Adela marca y que tienen algo a
  la venta, con su nombre visible); **Escuela de Silencio ▾** (Escuela, Herramientas, Sesiones
  y mentorías); botón de inicio junto al carrito. Fuera: Inicio, Sobre mí, Tienda, Planes.
- [x] Botones dorados como en el sitio anterior: **El Escáner** (`#`; su destino se asigna al terminar la fase 4) y
  **Mentoría VIP** (`/asesorias?sesion=mentoria`: preselecciona la sesión cuyo nombre contiene «mentoria»).
- [x] `/tienda?categoria=<slug>`: título y descripción de la categoría; sin filtro, todo agrupado.
- [x] Panel → Tienda → Productos: nombre visible, descripción, «Mostrar en El Umbral» y orden ↑↓.
  En modo edición, El Umbral enlaza ahí («Elegir categorías»).
- Pendiente: en la VM, Adela marca y nombra sus categorías (hoy ninguna está en el menú).
- [x] CMS: **Ajustar encuadre** en las imágenes editables (arrastrar para mover, rueda o deslizador
  para el zoom). Se guarda `ContentBlock.framing` (punto a la vista y zoom), no un recorte; queda en
  las revisiones y una imagen nueva vuelve a centrarse. Portadas de productos: más adelante (backbone).

### Fase 3.5 — Asesorías y libros ✅ (2026-10-20, en `main`)

- [x] Mentoría 1:1: 90 min, $222 (duración desde el panel → pasa a Asesorías).
- [x] Sesión de cortesía, gratis, solo para quien compró un libro (una vez por email):
  **evz_backbone v1.7.0** `EVZ_BOOKING_FREE_REQUIRES_PURCHASE = 'digital'`. Cualquier asesoría
  gratuita exige un pedido pagado con un producto digital, del mismo email o de la cuenta
  (cuenta también quien compró como invitado). No depende del nombre del producto.
- [x] Páginas propias (`/libro/<slug>`): Adela marca «Tiene página propia» en el panel. El slug
  (v1.7.0, `Product.slug`) se crea una vez desde el nombre y no cambia al renombrar. Portada,
  precio, compra (o «Reservar» si es asesoría), descripción y texto largo editable
  (CMS `libro.<slug>.cuerpo`). La tienda enlaza a la página.
- [x] Descripciones con sus saltos de línea, máx. 320 px con scroll (tienda, asesorías, página).
- Pendiente en la VM: crear la sesión de cortesía (precio 0, «15 min») y marcar los libros con página.

### Fase 4 — Herramientas (una a una)

| # | App | Nota |
|---|---|---|
| 0 | Test de la Coherencia | ✅ 2026-10-20: `/apps/test-coherencia` (y `/test-coherencia` del sitio anterior). Sin IA; textos e imágenes editables (`test.*`); el destino de cada resultado y de la mentoría lo elige Adela en modo edición (`ProductCta`: página del libro o asesoría). Los IDs fijos del prototipo (19, 15, 6, 8, 5) no se usan: ya no correspondían (el CTA de La Sal apuntaba a Una Vasija Nueva) |
| 1 | Escáner de la Coherencia | **Siguiente.** Modelo `Situation` (hechos, interpretaciones, emociones, suposiciones, faltantes, contradicciones, decisión, resultado), historial privado, límite gratis/Premium |
| 2 | La Llave del Día | Contenido + registro de aplicación |
| 3 | Centro Soberano | Registro de límites y compromisos, revisión semanal |
| 4 | Jericó | Ciclos de 7 días, pago único por ciclo |
| 5 | Bóveda de Luz | Requiere la biblioteca completa |

En paralelo: modelos de contenido (`Teaching`, `Distinction`, `Practice`,
etiquetados por necesidad) que reutilizan Llave, Jericó y Bóveda.

### Fase 5 — Despliegue

Preparado (2026-10-19): settings de producción (`SECURE_PROXY_SSL_HEADER`,
`CSRF_TRUSTED_ORIGINS`, cookies seguras, HSTS por `.env`, `STATIC_ROOT`),
`gunicorn` en requirements, `deploy.sh` y `deploy/` (nginx, systemd).

**Datos:** `import_legacy` corre una sola vez y lo depurado a mano en local
(productos, CMS, agenda, clientes) no se reproduce reimportando. Por eso la
base de producción es un `pg_dump` de la local (`adevalverde_v2_b`) más
`backend/media`; lo que entre en el sitio viejo después del snapshot
(2026-10-13) se pasa a mano en el corte.

1. ✅ (2026-10-19) Staging en `v2.adelavalverde.info`, con el sitio viejo intacto. VM compartida
   (`esfuerzo1909-nginx-host-server`): gunicorn `gunicorn-adevalverdeV2.service` en el **8010**,
   Postgres 15 compartido con usuario `adevalverde_admin` y base `adevalverde`. **La base de la VM
   es ahora la buena** (no la local). Pasos que se siguieron:
   - `sudo apt install postgresql`; crear usuario y base `adevalverde`.
   - Clonar en `~/projects/adevalverdeV2/adevalverdeV2`, venv en `../venv`
     (la VM necesita deploy key para `EL1909/evz_backbone`).
   - `.env` de producción con `DATABASE_URL`, `DEBUG=False`, hosts de staging,
     **PayPal sandbox** y calendario de prueba (o sin `GOOGLE_SERVICE_ACCOUNT_FILE`).
   - Mac: `pg_dump -Fc --no-owner --no-acl adevalverde_v2_b > v2.dump` y
     `rsync backend/media/`; VM: `pg_restore --no-owner -d adevalverde …`, `migrate`
     (no debe haber migraciones pendientes).
   - systemd + nginx + `certbot --nginx -d v2.adelavalverde.info`, luego `./deploy.sh`.
   - Validar: compra, descarga, reserva, panel, correo por relay, push.
2. Corte:
   - Sitio viejo sin checkout; snapshot nuevo de `db.sqlite3` y pasar a V2 los
     usuarios, pedidos y citas posteriores al 2026-10-13.
   - nginx: `server_name adelavalverde.info www…` a V2, el viejo a `old.adelavalverde.info`;
     quitar `X-Robots-Tag`; `.env` con hosts finales y PayPal live; webhook live.
   - `./deploy.sh`. Su sección de un solo uso (leads para las cuentas importadas)
     se quitó el 2026-10-20: las cuentas del delta se dan de alta en Clientes a mano.
   - `link_appointment_clients`; redirecciones de URLs antiguas (`/store/…`, `/bio/`).
     `/test-coherencia` ya redirige desde el frontend a `/apps/test-coherencia`.
   - Tras unos días estable: `SECURE_HSTS_SECONDS`, apagar el sitio viejo
     (guardar su `db.sqlite3` y `media`).
3. `evz_sync` hacia EsfuerzoVZ.
