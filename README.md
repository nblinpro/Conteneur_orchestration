# Conteneurs & Orchestration

Travaux pratiques du module **Conteneurs & Orchestration**.

**Nicolas Blin** — Mastère 1 Expert Cloud, Infrastructure & Sécurité — Ynov Campus Paris

---

## Sommaire des TP

| TP | Sujet | Dossier |
|---|---|---|
| 1 | Docker : Dockerfile, image et layers | [`docker-lab/`](docker-lab/) |

---

## TP 1 — Docker : Dockerfile, image et layers

Conteneurisation d'une petite application **Flask**, puis analyse du fonctionnement interne d'une image Docker : layers, cache de build, format OCI, et risques liés aux secrets.

### Objectifs

- Écrire un `Dockerfile` et construire une image
- Lancer un conteneur avec redirection de port
- Comprendre et optimiser le cache de build
- Identifier et inspecter les layers d'une image (`docker history`, `docker save`)
- Montrer qu'un secret supprimé avec `RUN rm` reste lisible dans un layer précédent
- Protéger le contexte de build avec `.dockerignore`

### Contenu

```
docker-lab/
├── app.py              # Application Flask (route / qui affiche message.txt)
├── requirements.txt    # flask==3.0.3
├── message.txt         # Message affiché par l'application
├── Dockerfile          # Image python:3.12-slim, dépendances avant le code
├── .dockerignore       # Exclusion des secrets et artefacts du contexte de build
└── REPONSES.md         # Réponses aux 27 questions, commandes et sorties
```

### Lancer l'application

```bash
cd docker-lab
docker build -t docker-lab:v1 .
docker run -d --name docker-lab -p 8080:5000 docker-lab:v1
curl http://localhost:8080
```

La page affiche le contenu de `message.txt` (« Docker est incroyable ! ») en titre `<h1>`. Elle est aussi accessible dans un navigateur sur http://localhost:8080.

Arrêt et suppression :

```bash
docker rm -f docker-lab
docker rmi docker-lab:v1
```

### Résultats clés

| Expérience | Résultat |
|---|---|
| Image `docker-lab:v1` | 198 Mo sur disque, 48,3 Mo compressés, 9 layers |
| Plus gros layer | Base Debian (87,7 Mo), puis Python (41,4 Mo) et Flask (15,3 Mo) |
| Cache après modification de `message.txt` | Seul `COPY message.txt` est reconstruit, Flask n'est pas réinstallé |
| `COPY . .` avant `pip install` | Rebuild 3,3× plus lent (1,1 s → 3,7 s), dépendances réinstallées |
| Secret copié puis supprimé (`RUN rm`) | Toujours lisible en clair dans le layer du `COPY` (fichier whiteout `.wh.password.txt` au-dessus) |
| Secret via BuildKit (`--mount=type=secret`) | Utilisé pendant le build, aucune trace dans l'image |
| `.dockerignore` | Contexte 193 Mo → 12,8 kB, image 583 Mo → 198 Mo, build 12,2 s → 5,7 s |

Le détail des commandes, des sorties et des explications est dans [`docker-lab/REPONSES.md`](docker-lab/REPONSES.md).

---

## Environnement

- VM Linux (Ubuntu)
- Docker Engine avec BuildKit et snapshotter containerd (export `docker save` au format OCI)
- Python 3.12 (image `python:3.12-slim`)

---

## Sécurité

Le fichier `password.txt` utilisé dans la partie 10 du TP 1 est un **faux secret de démonstration**. Il n'est pas versionné : il est exclu par le `.gitignore` et par le `.dockerignore`.
