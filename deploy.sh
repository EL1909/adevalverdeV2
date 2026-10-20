#!/usr/bin/env bash
#
# Actualiza adevalverdeV2 en la VM de Adela: trae el código, instala
# dependencias (con la versión exacta de evz-backbone), migra, recolecta
# estáticos, construye el frontend y reinicia gunicorn.
#
# nginx (deploy/nginx.conf) sirve frontend/dist y static_root directamente y
# hace proxy de /api/ y /admin/ a gunicorn (deploy/gunicorn-adevalverdeV2.service);
# no necesita recargarse, solo lee los archivos que este script actualiza.
#
# Sin Node en la VM: FRONTEND=skip ./deploy.sh, y subir frontend/dist desde el Mac:
#   cd frontend && npm run build && rsync -av --delete dist/ vm:$APP_DIR/frontend/dist/

set -euo pipefail

APP_DIR="/home/efrain19091/projects/adevalverdeV2/adevalverdeV2"
VENV="/home/efrain19091/projects/adevalverdeV2/venv"
SERVICE="gunicorn-adevalverdeV2.service"
FRONTEND="${FRONTEND:-build}"

echo "==> Actualizando código"
cd "$APP_DIR"
git pull

echo "==> Backend: dependencias y migraciones"
cd "$APP_DIR/backend"
source "$VENV/bin/activate"
# --upgrade: sin esto pip puede dar por satisfecho evz-backbone y no instalar
# el tag nuevo de requirements.txt.
pip install --no-cache-dir --upgrade -r requirements.txt

# Aun con --upgrade, pip a veces no reemplaza una dependencia instalada desde
# git: se compara la versión instalada con el tag y se fuerza si no coinciden.
EVZ_REQ=$(grep -E '^evz-backbone(\[[^]]*\])? @' requirements.txt | tr -d '\r' | sed 's/[[:space:]]*$//')
EVZ_TAG=$(sed -E 's/.*@v?([0-9][0-9.]*)$/\1/' <<<"$EVZ_REQ")
evz_instalada() { python -c 'from importlib.metadata import version; print(version("evz-backbone"))'; }
if [ "$(evz_instalada)" != "$EVZ_TAG" ]; then
  echo "==> evz-backbone instalado $(evz_instalada), se esperaba $EVZ_TAG: reinstalando"
  pip install --no-cache-dir --force-reinstall --no-deps "$EVZ_REQ"
fi
if [ "$(evz_instalada)" != "$EVZ_TAG" ]; then
  echo "ERROR: evz-backbone quedó en $(evz_instalada), se esperaba $EVZ_TAG." >&2
  exit 1
fi
echo "==> evz-backbone $EVZ_TAG"

python manage.py migrate --noinput

python manage.py collectstatic --noinput
python manage.py check --deploy

if [ "$FRONTEND" = "build" ]; then
  echo "==> Frontend: dependencias y build"
  cd "$APP_DIR/frontend"
  npm ci
  npm run build
else
  echo "==> Frontend: se omite el build (subir dist desde el Mac)"
fi

echo "==> Reiniciar gunicorn"
sudo systemctl restart "$SERVICE"

echo "==> Listo."
