# Pendientes para Efraín

Tareas acumuladas de las fases 0–3 que requieren acceso, credenciales o
decisiones. Orden sugerido.

## 1. Git

- [ ] **evz_backbone v1.4.0**: ya está en `main` con su tag (local). Esta sesión no tiene
  acceso SSH a GitHub; publicarlo desde tu terminal:
  ```bash
  cd ~/VS-Repository/evz_backbone
  git log --oneline origin/main..main      # 3 commits: Order.user, v1.4.0, cancelar pedido
  git push origin main v1.4.0
  ```
  Incluye `Order.user`, que no había llegado a la v1.3.0 publicada. Hasta el push,
  `pip install -r backend/requirements.txt` falla (fija `@v1.4.0`); en local V2 usa el
  backbone en modo editable. MCnails y FVJ cargan la v1.4.0 sin migraciones pendientes
  (solo añade tablas y campos) cuando suban su pin.
- [ ] **EsfuerzoVZ**: revisar y desplegar la rama `feature/relay-links-adjuntos` (relay
  con enlaces de descarga, `.ics` y Reply-To). Sin ella, los correos salen igual pero
  sin los botones de descarga ni el adjunto de la cita.
- [ ] **adevalverdeV2**: primer commit (todo está en el área de preparación) y crear el repo remoto.
  ```bash
  cd ~/VS-Repository/adevalverdeV2
  git commit -m "Sitio nuevo de Adela: esqueleto, CMS, importador y pagos"
  git remote add origin git@github.com:EL1909/adevalverdeV2.git && git push -u origin main
  ```
- [ ] **MCnails**: el registro da 500 (el `Profile` se crea dos veces: señal + serializer).
  Aplicar el mismo arreglo que en V2 (`accounts/serializers.py` → `RegisterSerializer.create`
  y `accounts/views.py` → `AdminCreateUserView`).

## 2. Seguridad del sitio actual (en producción hasta el corte)

- [ ] `store/payment_success?order_id=N` muestra los enlaces de descarga de **cualquier**
  pedido cambiando el número. Mitigación rápida: exigir que el pedido sea del usuario
  logueado o del `order_id` guardado en la sesión.
- [ ] `ManageOrder` con `execute_fulfillment` no exige permisos.
- [ ] El usuario `edgar` tenía la contraseña en texto plano en la base: revisar cómo se creó
  (¿alta desde un admin propio?) y pedirle que la cambie.

## 3. Decisiones

- [x] **Moneda**: USD (la cuenta PayPal de Adela es de EE. UU.), con aviso de conversión
  junto al botón de PayPal. El importador deja *Perfil del negocio* en USD.
- [x] Enlaces externos (Gamma y similares): se eliminan; cada libro tendrá su página en V2.
- [ ] Cuentas a excluir en la importación real (en la copia: `guest@example.com`, `test@example.com`).
- [ ] **Asesorías pagadas**: ¿se pueden cancelar o cambiar online y con qué devolución?
  Hoy solo las gratuitas se cancelan desde la cuenta (24 h antes); las pagadas, por correo.
- [ ] ¿"Primera Cita" gratuita una sola vez por email? (así está ahora).
- [ ] Precios en los textos de Sobre mí / Escuela (mentoría $222, taller $297): se quitaron
  hasta decidir la moneda; Adela los añade con el modo edición.

## 4. PayPal

- [x] Credenciales del sitio actual en `backend/.env` (son **live**: en local cobran de verdad).
- [ ] Crear el webhook de la app con URL `https://<dominio>/api/payments/paypal/webhook/`
  (en local, a través de un túnel tipo `cloudflared` o `ngrok`) y estos eventos:
  `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`,
  `PAYMENT.CAPTURE.REVERSED`, `PAYMENT.SALE.COMPLETED`, `BILLING.SUBSCRIPTION.*`.
  Copiar su ID a `PAYPAL_WEBHOOK_ID`.
- [ ] Crear planes: en el admin, un *Producto* (ej. categoría "Suscripciones", precio 7,99)
  y un *Plan* que lo use (*Servicios y Ventas → Planes*; intervalo, grants: `["escaner"]` o `["*"]`). Luego:
  ```bash
  ./venv/bin/python manage.py paypal_sync_plans
  ```
- [ ] Probar en sandbox: compra de un PDF (como invitado y con cuenta), descarga,
  suscripción, cancelación y llegada de webhooks (admin → *Pagos → Eventos de pasarela*).
- [ ] Producción: credenciales *live*, `PAYPAL_BASE_URL=https://api-m.paypal.com`, nuevo
  webhook live, y **borrar la clave `paypal` de `gateway_refs` de cada plan y volver a
  correr `paypal_sync_plans`** (los IDs de sandbox no existen en live).
- [ ] **Pagos manuales** (Adela, en el admin → *Pagos → Métodos de pago manual*): dar de
  alta Zelle, transferencia y/o USDT con sus datos. Aparecen solos en el carrito y en
  Asesorías; los pagos declarados llegan a *Mi cuenta → Tienda → Pagos por verificar*.

## 5. Correo

Sale por el relay de EsfuerzoVZ, como FVJ: sin credenciales SMTP en V2 y con
"Adela Valverde" en la cabecera (el nombre del proyecto en EsfuerzoVZ).

- [ ] En EsfuerzoVZ: crear el proyecto "Adela Valverde" y su *BusinessLink*; copiar el
  token a `backend/.env` → `EVZ_API_TOKEN`. Sin él los correos no salen (queda en el log).
- [ ] Opcional: `EVZ_MAIL_REPLY_TO` con el correo donde Adela quiere recibir las respuestas.

## 6. Datos reales (antes del corte)

El proyecto en la VM está en `~/projects/adevalverde/adevalverde` y su disco va al 96 %:
la copia se saca desde el Mac sin crear archivos en el servidor.

- [x] Disco de la VM depurado (25 % libre).
- [ ] Libros #11 (Jericó), #20 (El Librito del Oro) y #21 (El Silencio es tu Gurú): su
  archivo de descarga es una **imagen PNG**, no el PDF. Adela sube el PDF correcto desde
  *Mi cuenta → Tienda → Productos*.
- [ ] Base local: ahora se usa `adevalverde_v2_b` (reimportada con v1.4.0). La anterior,
  `adevalverde_v2`, quedó intacta; bórrala cuando quieras con `dropdb adevalverde_v2`.
- [ ] Copia fresca justo antes del corte (desde el Mac):
  ```bash
  cd ~/VS-Repository/vm-snapshot && ssh efrain19091@34.16.25.24 \
      "tar czf - -C ~/projects/adevalverde/adevalverde db.sqlite3 media" > snapshot.tgz && tar xzf snapshot.tgz
  ```
- [ ] Importar en la base PostgreSQL de producción (vacía y migrada); primero con `--dry-run`:
  ```bash
  ./venv/bin/python manage.py import_legacy --db ~/VS-Repository/vm-snapshot/db.sqlite3 \
      --media ~/VS-Repository/vm-snapshot/media \
      --exclude-email guest@example.com --exclude-email test@example.com \
      --rename-email efrain19091@gmail.com=el@esfuerzovz.com --dry-run
  ```
  Los pedidos fallidos no se importan y las portadas se comprimen al copiarse
  (`compress_images`). Adela entra como `eventos11@hotmail.com` (superusuaria).

## 7. Agenda y Google Calendar

- [x] `service_account.json` en `backend/` (ignorado por git) y en `.env`; lee el calendario
  de Adela. En el servidor: copiarlo igual y usar ruta absoluta en `GOOGLE_SERVICE_ACCOUNT_FILE`.
- [ ] En Google Calendar de Adela → *Configuración y uso compartido* → compartir con el
  email de la cuenta de servicio con **Hacer cambios en eventos** (V2 crea y borra eventos).
  El ID del calendario ya se importó en *Configuración de agenda*.
- [ ] Probar: reservar una "Primera Cita" en `/asesorias` → aparece el evento; cancelarla
  desde *Mi cuenta* → desaparece.
- [ ] Adela: revisar su horario (*Agenda → Horario semanal*, hoy L–V 9–19 hora de Madrid),
  bloquear vacaciones, y crear las asesorías de pago como productos con **duración**
  (ej. "Mentoría 1:1", `60 min`). Corregir la descripción de "Primera Cita" (texto de prueba).

## 8. Textos y legales

- [ ] nginx en el deploy: `location ~ ^/media/.*/private/ { deny all; }` — los PDFs que se
  venden y los comprobantes de pago solo se entregan por la API.
- [ ] Revisar `/privacidad` y `/terminos` (Adela o asesoría legal): son las plantillas del
  sitio actual con marcadores sin rellenar (`[Tu nombre o razón social]`, NIF, domicilio),
  leyes alemanas (BfDI, AO, BGB, UrhG) junto a jurisdicción española, precios en dólares,
  Stripe y envíos físicos. Faltan: reservas, Google Calendar, avisos push, y la excepción
  al desistimiento de contenido digital descargado.
- [ ] *Perfil del negocio* (admin): rellenar el email (lo usan los botones de lista de
  espera de la Escuela) y los datos fiscales.
- [ ] Adela revisa con su usuario los textos de Inicio, Sobre mí, Escuela y Asesorías.

## 9. Avisos push

- [ ] `./venv/bin/python manage.py vapid_keys` → copiar a `backend/.env`.
- [ ] Los avisos de nuevas reservas van a los **superusers**: si Adela debe recibirlos,
  su cuenta necesita `is_superuser`. Luego, en *Mi cuenta* → activar avisos (en iPhone,
  con el sitio añadido a la pantalla de inicio).
