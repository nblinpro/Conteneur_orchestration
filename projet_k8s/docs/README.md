# docs/ : documentation du projet

```
docs/
├── architecture.png   schéma d'architecture (image affichée dans le README principal)
├── architecture.svg   source du schéma, modifiable dans un éditeur de texte ou Inkscape
└── SOURCES.md         sources et documentation officielle utilisées, par thème
```

Le schéma montre les microservices et leurs dépendances, les Services Kubernetes, l'Ingress, la base de données,
le bus de messages, les namespaces et les flux réseau (externe en HTTPS, interne autorisé), comme le demande le sujet.

Regénérer le PNG après une modification du SVG (avec Docker, sans rien installer) :

```bash
cd docs
docker run --rm -v "$PWD":/w -w /w alpine:3.20 sh -c "apk add -q --no-cache rsvg-convert font-dejavu && rsvg-convert -w 1800 architecture.svg -o architecture.png && chown $(id -u):$(id -g) architecture.png"
```
