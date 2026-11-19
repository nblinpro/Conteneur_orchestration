#!/bin/bash
# Génère un certificat SSL auto-signé pour dotnetgigs.local et le place
# dans le Secret TLS "dotnetgigs-tls" utilisé par l'Ingress (k8s/10-ingress.yml).
# Usage : ./scripts/gen-cert.sh   (le namespace dotnetgigs doit exister)
set -e                              # arrête le script à la première erreur

HOST=dotnetgigs.local               # doit correspondre à ingress.host (values.yaml / 10-ingress.yml)

# kubectl installé, sinon celui de minikube (un alias du .bashrc n'est pas visible dans un script)
if command -v kubectl >/dev/null 2>&1; then KUBECTL="kubectl"; else KUBECTL="minikube kubectl --"; fi
DIR="$(dirname "$0")/../certs"      # dossier ignoré par git (contient la clé privée)
mkdir -p "$DIR"

# Clé privée + certificat valables 1 an, avec le nom d'hôte dans le SAN
# (les navigateurs ignorent le CN et exigent le SAN).
#   -x509     : certificat auto-signé (pas d'autorité de certification)
#   -nodes    : clé privée non chiffrée (sinon nginx demanderait un mot de passe)
#   -newkey   : génère une nouvelle clé RSA de 2048 bits
#   -subj     : CN = nom d'hôte, O = organisation
#   -addext   : ajoute le SAN (Subject Alternative Name)
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$DIR/tls.key" -out "$DIR/tls.crt" \
  -subj "/CN=$HOST/O=dotnetgigs" \
  -addext "subjectAltName=DNS:$HOST"

# Création (ou mise à jour) du Secret TLS dans le cluster.
# "create --dry-run=client -o yaml" génère le YAML sans rien créer, puis "apply" le crée
# ou le met à jour : le script peut être relancé sans erreur "already exists".
$KUBECTL create secret tls dotnetgigs-tls -n dotnetgigs \
  --cert="$DIR/tls.crt" --key="$DIR/tls.key" \
  --dry-run=client -o yaml | $KUBECTL apply -f -

echo "Secret dotnetgigs-tls créé pour $HOST"
