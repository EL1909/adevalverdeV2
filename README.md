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

## Producción

Archivos en [deploy/](deploy/): `nginx.conf` (SPA, `/api` y `/admin` a
gunicorn, `/media/.../private/` bloqueado, `sw.js` sin caché) y
`gunicorn-adevalverdeV2.service` (puerto 8010). En la VM:

```
~/projects/adevalverdeV2/
├── adevalverdeV2/   # este repo (backend/.env, backend/media, service_account.json)
└── venv/
```

Cada actualización: `./deploy.sh` (o `FRONTEND=skip ./deploy.sh` si la VM no
tiene Node y `dist` se sube desde el Mac). Ver la fase 5 del ROADMAP para el
alta inicial y el corte.
