#!/usr/bin/env bash
# Publica o Tripsync no VPS da Hostinger (Ubuntu 24.04) com nginx.
# Rode como root no VPS:  bash instalar-no-vps.sh
# Opcional: DOMINIO=tripsync.seudominio.com bash instalar-no-vps.sh  (ativa HTTPS grátis com Let's Encrypt;
# o domínio precisa apontar para o IP do VPS antes)
set -euo pipefail

PASTA=/var/www/tripsync
REPO=https://github.com/pgsafadao05/tripsync.git

apt-get update -qq
apt-get install -y -qq nginx git

if [ -d "$PASTA/.git" ]; then git -C "$PASTA" pull -q; else git clone -q "$REPO" "$PASTA"; fi

NOME="${DOMINIO:-_}"
cat > /etc/nginx/sites-available/tripsync <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name $NOME;
  root $PASTA;
  index index.html;
  location / { try_files \$uri \$uri/ /index.html; }
  location ~ /\.git { deny all; }
  location = /sw.js { add_header Cache-Control "no-cache"; }
}
EOF
ln -sf /etc/nginx/sites-available/tripsync /etc/nginx/sites-enabled/tripsync
[ "$NOME" = "_" ] && rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Libera a porta 80/443 se o firewall do Ubuntu estiver ligado
if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 'Nginx Full'; fi

# Atualiza o site sozinho a cada 5 minutos com o que estiver no GitHub
( crontab -l 2>/dev/null | grep -v tripsync; echo "*/5 * * * * git -C $PASTA pull -q # tripsync" ) | crontab -

if [ -n "${DOMINIO:-}" ]; then
  apt-get install -y -qq certbot python3-certbot-nginx
  certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos --register-unsafely-without-email --redirect
  echo "Pronto: https://$DOMINIO"
else
  echo "Pronto: http://$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')"
fi
