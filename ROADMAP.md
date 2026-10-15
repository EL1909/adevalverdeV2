# Roadmap: adevalverdeV2

Sitio nuevo de Adela Valverde: **React (PWA) + Django/DRF sobre evz-backbone**,
con la misma arquitectura que MCnails. Reemplaza al sitio Django con plantillas
(`../adevalverde`) y a las páginas de Gamma.

Objetivo: una **mini app web con una sola cuenta de usuario, historial y pagos**,
que funcione como hub de herramientas (ver `AppsProposal.rtfd`) y dirija a cada
cliente al libro, programa o asesoría indicado. Las herramientas se incorporan
una a una.

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
| Backbone | `evz-backbone` v1.4.0 (`[google-calendar,digital,paypal]`) |
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

### Fase 3.5 — Asesorías y libros (siguiente)

- Mentoría 1:1: 90 min, $222 (duración desde el panel → pasa a Asesorías).
- Sesión de cortesía de 15 min, gratis, solo para quien compró un libro (una vez por email).
- Páginas propias de cada libro (sin Gamma).

### Fase 4 — Herramientas (una a una)

| # | App | Nota |
|---|---|---|
| 0 | Test de la Coherencia | Portar el prototipo (`static/coherencia_app/test/main.tsx`) sin IA; sus CTA apuntan a productos 19, 15, 6, 8, 5 |
| 1 | Escáner de la Coherencia | Modelo `Situation` (hechos, interpretaciones, emociones, suposiciones, faltantes, contradicciones, decisión, resultado), historial privado, límite gratis/Premium |
| 2 | La Llave del Día | Contenido + registro de aplicación |
| 3 | Centro Soberano | Registro de límites y compromisos, revisión semanal |
| 4 | Jericó | Ciclos de 7 días, pago único por ciclo |
| 5 | Bóveda de Luz | Requiere la biblioteca completa |

En paralelo: modelos de contenido (`Teaching`, `Distinction`, `Practice`,
etiquetados por necesidad) que reutilizan Llave, Jericó y Bóveda.

### Fase 5 — Despliegue

1. Postgres en la VM de Adela; `DATABASE_URL` en `.env`.
2. Gunicorn + nginx: `frontend/dist` como SPA, `/api` y `/admin` a Django.
   `location ~ ^/media/.*/private/ { deny all; }` (PDFs y comprobantes).
3. Importación final de datos y redirecciones de URLs antiguas (`/store/…`, `/test-coherencia/`, `/bio/`).
4. `evz_sync` hacia EsfuerzoVZ.
