# Adela Valverde — V2

Hub de herramientas, tienda y asesorías de Adela Valverde. Misma arquitectura
que MCnails: React (PWA) + Django REST sobre evz-backbone. Plan de trabajo en
[ROADMAP.md](ROADMAP.md).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router |
| Backend | Django 5.2, Django REST Framework, SimpleJWT |
| Backbone | evz-backbone v1.3.0: `evz_core`, `evz_store`, `evz_treasury`, `evz_crm`, `evz_calendars` |
| Base de datos | SQLite en desarrollo, PostgreSQL en producción |
| Pagos | PayPal |

## Estructura

```
adevalverdeV2/
├── backend/
│   ├── accounts/   # propia: usuario por email, registro, login, perfil
│   ├── content/    # propia: CMS de textos e imágenes editables (con revisiones)
│   ├── catalog/    # propia: detalle de producto (digital, enlace externo) y descargas
│   ├── payments/   # propia: PayPal (checkout, suscripciones, webhook) y acceso a apps
│   ├── bookings/   # propia: reserva y pago de asesorías, eventos en Google Calendar
│   ├── legacy/     # importación única desde el sitio anterior (import_legacy)
│   ├── core/       # settings y urls
│   └── templates/  # correos (recuperación de contraseña)
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

## Producción (notas)

- El servidor web debe devolver `index.html` para cualquier ruta del frontend
  (`try_files $uri /index.html`) y servir `sw.js` con `Cache-Control: no-cache`.
- `/api/`, `/admin/`, `/static/` y `/media/` van a Django.
