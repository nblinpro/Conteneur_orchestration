#!/bin/bash
# Génère un certificat SSL auto-signé pour dotnetgigs.local et le place
# dans le Secret TLS "dotnetgigs-tls" utilisé par l'Ingress (k8s/10-ingress.yml).
# Usage : ./scripts/gen-cert.sh   (le namespace dotnetgigs doit exister)
set -e

HOST=dotnetgigs.local

# kubectl installé, sinon celui de minikube (un alias du .bashrc n'est pas visible dans un script)
if command -v kubectl >/dev/null 2>&1; then KUBECTL="kubectl"; else KUBECTL="minikube kubectl --"; fi
DIR="$(dirname "$0")/../certs"      # dossier ignoré par git (contient la clé privée)
mkdir -p "$DIR"

# Clé privée + certificat valables 1 an, avec le nom d'hôte dans le SAN
# (les navigateurs ignorent le CN et exigent le SAN).
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$DIR/tls.key" -out "$DIR/tls.crt" \
  -subj "/CN=$HOST/O=dotnetgigs" \
  -addext "subjectAltName=DNS:$HOST"

# Création (ou mise à jour) du Secret TLS dans le cluster
$KUBECTL create secret tls dotnetgigs-tls -n dotnetgigs \
  --cert="$DIR/tls.crt" --key="$DIR/tls.key" \
  --dry-run=client -o yaml | $KUBECTL apply -f -

echo "Secret dotnetgigs-tls créé pour $HOST"
