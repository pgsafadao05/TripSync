#!/usr/bin/env bash
# Publica o Tripsync num VPS onde o Caddy (Docker) já ocupa as portas 80/443.
# Sobe um container nginx com o site na mesma rede do Caddy e acrescenta
# um bloco no Caddyfile. Faz backup e desfaz sozinho se a configuração falhar.
# Uso (como root):  curl -sL https://raw.githubusercontent.com/pgsafadao05/tripsync/main/instalar-com-caddy.sh | sudo DOMINIO=tripsync.seudominio.com bash
set -euo pipefail

DOMINIO="${DOMINIO:?defina DOMINIO=seu.dominio}"
CADDY="${CADDY:-supabase-caddy}"
PASTA=/var/www/tripsync
REPO=https://github.com/pgsafadao05/tripsync.git

# 1. Desliga o nginx do sistema (instalado pela tentativa anterior; não consegue usar a porta 80)
if systemctl list-unit-files nginx.service >/dev/null 2>&1; then systemctl disable --now nginx 2>/dev/null || true; fi
rm -f /etc/nginx/sites-enabled/tripsync

# 2. Código do site
command -v git >/dev/null || { apt-get update -qq; apt-get install -y -qq git; }
if [ -d "$PASTA/.git" ]; then git -C "$PASTA" pull -q; else git clone -q "$REPO" "$PASTA"; fi

# 3. Descobre a rede e o Caddyfile do container do Caddy
REDE=$(docker inspect "$CADDY" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
LINHA=$(docker inspect "$CADDY" --format '{{range .Mounts}}{{.Source}}|{{.Destination}}{{"\n"}}{{end}}' | grep -E '\|/etc/caddy(/Caddyfile)?$' | head -1)
[ -n "$LINHA" ] || { echo "Não achei o Caddyfile montado no container $CADDY"; exit 1; }
ORIG="${LINHA%%|*}"; DEST="${LINHA##*|}"
if [ "$DEST" = "/etc/caddy" ]; then ARQ="$ORIG/Caddyfile"; CONF=/etc/caddy/Caddyfile; else ARQ="$ORIG"; CONF="$DEST"; fi
echo "Caddy: $CADDY | rede: $REDE | Caddyfile: $ARQ"

# 4. Container do site (nginx leve, só leitura)
cat > "$PASTA.nginx.conf" <<'EOF'
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
  location ~ /\.git { deny all; }
  location = /sw.js { add_header Cache-Control "no-cache"; }
}
EOF
docker rm -f tripsync >/dev/null 2>&1 || true
docker run -d --name tripsync --restart unless-stopped --network "$REDE" \
  -v "$PASTA":/usr/share/nginx/html:ro \
  -v "$PASTA.nginx.conf":/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine >/dev/null

# 5. Bloco no Caddyfile (com backup e rollback)
if ! grep -q "^$DOMINIO" "$ARQ"; then
  cp "$ARQ" "$ARQ.bak-tripsync"
  printf '\n%s {\n  reverse_proxy tripsync:80\n}\n' "$DOMINIO" >> "$ARQ"
  if ! docker exec "$CADDY" caddy validate --config "$CONF" --adapter caddyfile >/dev/null 2>&1; then
    cat "$ARQ.bak-tripsync" > "$ARQ"
    echo "A configuração do Caddy não validou; voltei o Caddyfile como estava."; exit 1
  fi
fi
docker exec "$CADDY" caddy reload --config "$CONF" --adapter caddyfile

# 6. Atualiza o site sozinho a cada 5 minutos com o que estiver no GitHub
( crontab -l 2>/dev/null | grep -v tripsync; echo "*/5 * * * * git -C $PASTA pull -q # tripsync" ) | crontab -

echo "Pronto: https://$DOMINIO  (o certificado HTTPS sai sozinho em até 1 minuto)"
