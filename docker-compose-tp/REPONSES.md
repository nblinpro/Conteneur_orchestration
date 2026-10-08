# Réponses aux questions du TP Docker Compose

**TP Avancé Docker Compose — Déploiement d'une application multi-services**
Nicolas Blin — M1 Expert Cloud, Infrastructure & Sécurité — Ynov Campus

Toutes les sorties ci-dessous viennent d'une exécution complète du TP, en partant d'un environnement Docker vide (aucune image, aucun conteneur, cache de build vidé).

---

## Architecture réalisée

```text
                     localhost:80
                          |
                          v
                     +---------+
                     |  nginx  |  (seul port publié)
                     +---------+
              front_net /     \ back_net
                       v       v
              +----------+   +----------+
              | frontend |   | backend  |
              |  React   |   | Express  |
              +----------+   +----------+
                                  | db_net (internal)
                                  v
                            +------------+
                            |     db     |  PostgreSQL 17
                            +------------+
                                  |
                                  v
                        volume postgres_data
```

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | Les 4 services, 3 réseaux, 1 volume, healthchecks |
| `.env` / `.env.example` | Nom de la base, utilisateur et mot de passe PostgreSQL |
| `front/Dockerfile` | Multi-stage : build avec Node.js, puis service des fichiers avec Nginx |
| `back/Dockerfile` | Image Node.js qui lance l'API Express sur le port 3000 |
| `nginx/Dockerfile` + `default.conf` | Reverse proxy : `/` → frontend, `/api1` et `/api2` → backend |
| `front/.dockerignore`, `back/.dockerignore` | Fichiers exclus du build (`node_modules`, `.env`…) |

Les dossiers `front` et `back` n'étant pas fournis, ils ont été écrits pour le TP : une page React qui appelle `/api1` et `/api2`, et une API Express qui enregistre des messages dans PostgreSQL.

---

## Étape 1 — Images des applications (§5)

### Construction

```bash
docker build -t tp-frontend ./front     # 12,0 s
docker build -t tp-backend  ./back      #  2,7 s
docker build -t tp-nginx    ./nginx     #  0,6 s
docker images
```

```text
IMAGE                ID             DISK USAGE   CONTENT SIZE   EXTRA
tp-backend:latest    9b2af73faa4b        251MB           63MB
tp-frontend:latest   27e43fd0d60b       73.8MB           21MB
tp-nginx:latest      3be9fca53c65       73.6MB           21MB
```

Étapes du premier build du frontend (sans cache) :

```text
#9  [build 3/6] COPY package.json package-lock.json ./   DONE 0.0s
#10 [build 4/6] RUN npm ci                               DONE 1.8s
#11 [build 5/6] COPY . .                                 DONE 0.0s
#12 [build 6/6] RUN npm run build                        DONE 5.2s
#13 [stage-1 2/2] COPY --from=build /app/dist /usr/share/nginx/html
```

**Q1. Pourquoi copier `package.json` avant le reste du code ?**
Pour profiter du cache. Tant que `package.json` ne change pas, Docker réutilise le layer où les dépendances sont installées. Si on modifie seulement le code, il ne réinstalle pas tout.

Test : on modifie uniquement `src/App.css`, puis on reconstruit.

```text
#9  [build 3/6] COPY package.json package-lock.json ./
#9  CACHED
#10 [build 4/6] RUN npm ci
#10 CACHED
#11 [build 5/6] COPY . .
#11 DONE 0.0s
#12 [build 6/6] RUN npm run build
```

**Q2. Quels est l'intérêt du cache lors d'un `npm install` ?**
Avec le cache, le téléchargement des dépendances est sautée (`CACHED`) et le build est beaucoup plus rapide.

**Q3. Quel avantage apporte un multi-stage build pour une application React?**
L'image finale ne garde que les fichiers compilés et un serveur web léger. Elle est plus petite et plus sûre, car elle ne contient ni Node.js ni les outils de build.

**Q4. Le frontend React a-t-il besoin de Node.js dans l'image finale après le build ?**
Non. Après `npm run build`, ce ne sont plus que des fichiers HTML, CSS et JS exécutés par le navigateur. Nginx suffit pour les servir.

```bash
docker run --rm tp-frontend sh -c 'which node || echo "pas de node"'
```

```text
pas de node
```

### Test du backend seul (§5.2)

```bash
docker run --rm -p 3000:3000 tp-backend
```

```text
Backend en écoute sur 0.0.0.0:3000
PostgreSQL indisponible (tentative 1) : ECONNREFUSED
PostgreSQL indisponible (tentative 2) : ECONNREFUSED
PostgreSQL indisponible (tentative 3) : ECONNREFUSED
^C
SIGINT reçu, arrêt propre
```

Dans un deuxième terminal :

```bash
curl http://localhost:3000/api1
```

```json
{"route":"/api1","message":"Bonjour depuis le backend Express !","conteneur":"edd0521e7da7","date":"2026-10-08T14:10:19.812Z"}
```

```bash
curl -i http://localhost:3000/api2
```

```text
HTTP/1.1 503 Service Unavailable
{"erreur":"Base de données pas encore disponible"}
```

Le backend démarre sans base : `/api1` répond, `/api2` renvoie 503 en attendant PostgreSQL. `Ctrl+C` l'arrête proprement (code de sortie 0).

**Q5. Pourquoi l'application doit-elle écouter sur 0.0.0.0 dans un conteneur?**
Dans un conteneur, `localhost` ne concerne que le conteneur lui-même. Avec `0.0.0.0`, l'application accepte aussi les connexions venant de l'extérieur du conteneur (Nginx par exemple).

**Q6. Quelle différence existe entre EXPOSE 3000 et -p 3000:3000 ?**
`EXPOSE` est une simple indication dans l'image et n'ouvre rien. `-p` ouvre réellement le port sur la machine hôte.

```bash
docker image inspect tp-backend --format '{{.Config.ExposedPorts}}'
```

```text
map[3000/tcp:{}]
```

**Q7. Pourquoi n'est-il pas nécessaire d'exposer le backend directement sur la machine hôte dans l'architecture finale ?**
Nginx le joint déjà par le réseau Docker. L'ouvrir créerait une deuxième porte d'entrée inutile (faille de sécurité) qui contourne Nginx.

---

## Étape 2 — Reverse proxy Nginx (§6)

`nginx/default.conf` :

```nginx
    location /api1 {
        proxy_pass http://backend:3000;
    }

    # /api2 -> backend
    location /api2 {
        proxy_pass http://backend:3000;
    }

    # Tout le reste -> frontend React
    location / {
        proxy_pass http://frontend:80;
    }
```

**Q8. Quel est le rôle d'un reverse proxy ?**
Il reçoit toutes les requêtes et les envoie au bon service selon l'URL. L'utilisateur ne voit qu'un seul serveur.

**Q9. Pourquoi le backend n'est-il pas appelé avec localhost depuis Nginx ?**
Dans le conteneur Nginx, `localhost` désigne Nginx lui-même. Le backend est dans un autre conteneur.

**Q10. Comment Docker Compose permet-il de résoudre le nom backend ?**
Docker a un DNS interne : chaque service est enregistré sous son nom. Quand Nginx demande `backend`, le DNS renvoie l'adresse IP du conteneur.

```bash
docker compose exec nginx getent hosts backend
```

```text
172.18.0.2        backend  backend
```

**Q11. Quel est l'intérêt d'avoir un point d'entrée unique pour l'application ?**
Un seul port à ouvrir et à protéger. Le frontend appelle simplement `/api1` sans connaître l'adresse du backend.

---

## Étape 4 — Démarrage de l'environnement (§14)

### Au premier plan

```bash
docker compose up
```

```text
 Image postgres:17-alpine Pulled
 Volume docker-compose-tp_postgres_data Created
 Network docker-compose-tp_db_net Created
 Network docker-compose-tp_front_net Created
 Network docker-compose-tp_back_net Created
 Container docker-compose-tp-frontend-1 Created
 Container docker-compose-tp-db-1 Created
 Container docker-compose-tp-backend-1 Created
 Container docker-compose-tp-nginx-1 Created
Attaching to backend-1, db-1, frontend-1, nginx-1
frontend-1  | /docker-entrypoint.sh: Configuration complete; ready for start up
db-1        | LOG:  database system is ready to accept connections
db-1        | LOG:  database system is ready to accept connections
 Container docker-compose-tp-backend-1 Started
backend-1   | Backend en écoute sur 0.0.0.0:3000
backend-1   | Connecté à PostgreSQL sur db:5432
 Container docker-compose-tp-backend-1 Healthy
nginx-1     | /docker-entrypoint.sh: Configuration complete; ready for start up
^C
 Gracefully Stopping... press Ctrl+C again to force
```

Les logs des 4 services s'affichent dans le terminal ; `Ctrl+C` arrête tout.

### En arrière-plan

```bash
docker compose up -d
```

```text
 Container docker-compose-tp-db-1 Started
 Container docker-compose-tp-db-1 Waiting
 Container docker-compose-tp-frontend-1 Started
 Container docker-compose-tp-db-1 Healthy
 Container docker-compose-tp-backend-1 Started
 Container docker-compose-tp-backend-1 Waiting
 Container docker-compose-tp-backend-1 Healthy
 Container docker-compose-tp-nginx-1 Started
```

```bash
docker compose ps
```

```text
NAME                           IMAGE                SERVICE    STATUS                    PORTS
docker-compose-tp-backend-1    tp-backend           backend    Up 6 seconds (healthy)    3000/tcp
docker-compose-tp-db-1         postgres:17-alpine   db         Up 11 seconds (healthy)   5432/tcp
docker-compose-tp-frontend-1   tp-frontend          frontend   Up 11 seconds             80/tcp
docker-compose-tp-nginx-1      tp-nginx             nginx      Up Less than a second     0.0.0.0:80->80/tcp, [::]:80->80/tcp
```

Les quatre services sont démarrés.

---

## Tests fonctionnels (§15)

```bash
curl http://localhost/
```

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>TP Docker Compose</title>
    <script type="module" crossorigin src="/assets/index-CgpCWFht.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-D-ivaJgL.css">
  </head>
```

```bash
curl http://localhost/api1
```

```json
{"route":"/api1","message":"Bonjour depuis le backend Express !","conteneur":"8b7463eae789","date":"2026-10-08T14:11:20.491Z"}
```

```bash
curl http://localhost/api2
```

```json
{"route":"/api2","base":"db:5432/tpdb","postgres":"PostgreSQL 17.11 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit","messages":[]}
```

Le frontend s'affiche, et `/api1` et `/api2` sont bien transmis par Nginx au backend. `/api2` lit dans PostgreSQL (la base est encore vide).

---

## Étape 3 — PostgreSQL et persistance (§8)

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
```

### Test de persistance

1. Ajout d'une donnée :

```bash
curl -X POST -H 'Content-Type: application/json' \
     -d '{"texte":"Message de test persistance"}' http://localhost/api2
```

```json
{"id":1,"texte":"Message de test persistance","cree_le":"2026-10-08T14:11:20.520Z"}
```

2. Suppression des conteneurs :

```bash
docker compose down
```

```text
 Container docker-compose-tp-nginx-1 Removed
 Container docker-compose-tp-frontend-1 Removed
 Container docker-compose-tp-backend-1 Removed
 Container docker-compose-tp-db-1 Removed
 Network docker-compose-tp_back_net Removed
 Network docker-compose-tp_front_net Removed
 Network docker-compose-tp_db_net Removed
```

```bash
docker volume ls
```

```text
DRIVER    VOLUME NAME
local     compose_mysql_data
local     docker-compose-tp_postgres_data
```

Le volume n'a pas été supprimé.

3. Recréation et vérification :

```bash
docker compose up -d
curl http://localhost/api2
```

```json
{"route":"/api2","base":"db:5432/tpdb","postgres":"PostgreSQL 17.11 ...","messages":[{"id":1,"texte":"Message de test persistance","cree_le":"2026-10-08T14:11:20.520Z"}]}
```

Le message est toujours là.

**Q12. Pourquoi un volume est-il nécessaire pour PostgreSQL ?**
Sans volume, les données sont dans le conteneur et disparaissent quand on le supprime. Le volume les garde en dehors du conteneur.

**Q13. Quelle différence existe entre supprimer un conteneur et supprimer un volume ?**
Supprimer un conteneur ne touche pas aux données du volume. Supprimer le volume efface définitivement les données.

**Q14. Que se passe-t-il avec les données si vous utilisez :`docker compose down` ?**
Il supprime les conteneurs et les réseaux, mais garde les volumes. Les données sont conservées (voir le test ci-dessus).

**Q15. Que se passe-t-il si vous utilisez : `docker compose down -v` ?**
Il supprime aussi les volumes. La base de données est perdue (voir la partie « Arrêt et nettoyage » : après `down -v`, `/api2` renvoie `"messages":[]`).

---

## Communication backend → PostgreSQL (§9)

```yaml
environment:
  DB_HOST: db
  DB_PORT: 5432
```

```bash
docker compose logs backend
```

```text
backend-1  | Backend en écoute sur 0.0.0.0:3000
backend-1  | Connecté à PostgreSQL sur db:5432
```

**Q16. Pourquoi localhost ne fonctionne-t-il pas pour joindre PostgreSQL depuis le backend ?**
Depuis le backend, `localhost` désigne le backend lui-même. PostgreSQL est dans un autre conteneur.

**Q17. Quel hostname doit être utilisé  ?**
Le nom du service : `db`.

**Q18. Quel est le rôle du réseau interne créé par Docker Compose ?**
Il permet aux conteneurs de se parler par leur nom, sans ouvrir de port sur la machine, et les isole du reste.

---

## Variables d'environnement (§10)

Les valeurs sont dans le fichier `.env`, lu automatiquement par Docker Compose :

```text
POSTGRES_DB=tpdb
POSTGRES_USER=tpuser
POSTGRES_PASSWORD=changeme
```

Le backend reçoit `DB_NAME=tpdb` : `/api2` affiche bien `"base":"db:5432/tpdb"`.

**Q19. Pourquoi utiliser des variables d'environnement ?**
Pour utiliser la même image partout (dev, recette, production) en changeant seulement la configuration, et sans mettre de mot de passe dans le code.

**Q20. Quelle est la différence entre la configuration d'une image et la configuration d'un conteneur ?**
La configuration de l'image est fixée au build, dans le Dockerfile. Celle du conteneur est donnée au lancement et peut changer à chaque fois.

```bash
docker image inspect tp-backend --format '{{.Config.Env}}'
```

```text
[PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin NODE_VERSION=22.23.3 YARN_VERSION=1.22.22 NODE_ENV=production PORT=3000]
```

**Q21. Pourquoi éviter de placer un mot de passe directement dans un Dockerfile ?**
Il resterait lisible dans l'image par toute personne qui la récupère (`docker image inspect`, comme ci-dessus), et dans l'historique Git.

---

## Dépendances entre services (§11)

```yaml
backend:
  depends_on:
    db:
      condition: service_healthy
```

L'ordre est visible au `docker compose up -d` : `db Healthy` → `backend Started` → `backend Healthy` → `nginx Started`.

**Q22. Quelle est la différence entre un conteneur démarré et un service réellement prêt ?**
Démarré veut dire que le processus est lancé. Prêt veut dire qu'il accepte vraiment les connexions. Au premier démarrage, PostgreSQL affiche deux fois `ready to accept connections` : il démarre une première fois pour créer la base, redémarre, puis il est vraiment prêt.

**Q23. Pourquoi un healthcheck peut-il être utile pour une base de données ?**
Docker vérifie que la base répond vraiment. Le backend n'est lancé qu'une fois la base prête (`db Healthy` avant `backend Started`).

---

## Réseaux (§12)

```bash
docker network ls
```

```text
NETWORK ID     NAME                          DRIVER    SCOPE
2d38ba59078d   bridge                        bridge    local
2fde5d911386   docker-compose-tp_back_net    bridge    local
ee6bb2085b80   docker-compose-tp_db_net      bridge    local
362ee23d6470   docker-compose-tp_front_net   bridge    local
522e39f8f676   host                          host      local
36bbb2d4ec4f   none                          null      local
```

```bash
docker network inspect docker-compose-tp_front_net
docker network inspect docker-compose-tp_back_net
docker network inspect docker-compose-tp_db_net
```

```text
front_net   Subnet=172.20.0.0/16  Internal=false
  docker-compose-tp-frontend-1 172.20.0.2/16
  docker-compose-tp-nginx-1    172.20.0.3/16
back_net    Subnet=172.18.0.0/16  Internal=false
  docker-compose-tp-backend-1  172.18.0.2/16
  docker-compose-tp-nginx-1    172.18.0.3/16
db_net      Subnet=172.19.0.0/16  Internal=true
  docker-compose-tp-backend-1  172.19.0.3/16
  docker-compose-tp-db-1       172.19.0.2/16
```

**Q24. Combien de réseaux votre fichier Compose crée-t-il  ?**
Trois : `front_net`, `back_net` et `db_net`. Sans section `networks`, Compose n'en aurait créé qu'un seul.

**Q25. Quels conteneurs sont connectés à ce réseau ?**

| Réseau | Conteneurs |
|---|---|
| `front_net` | nginx, frontend |
| `back_net` | nginx, backend |
| `db_net` | backend, db |

**Q26. Les conteneurs peuvent-ils communiquer par leur adresse IP ?**
Oui, s'ils sont sur le même réseau :

```bash
docker compose exec backend ping -c 2 db
```

```text
PING db (172.19.0.2): 56 data bytes
64 bytes from 172.19.0.2: seq=0 ttl=42 time=0.035 ms
64 bytes from 172.19.0.2: seq=1 ttl=42 time=0.060 ms
2 packets transmitted, 2 packets received, 0% packet loss
```

**Q27. Pourquoi vaut-il mieux utiliser le nom du service que son adresse IP ?**
L'adresse IP peut changer à chaque recréation. Ici, lors d'un premier essai, `db_net` avait le sous-réseau 172.20.0.0/16 ; après avoir tout supprimé et relancé, c'est 172.19.0.0/16. Le nom `db`, lui, ne change jamais.

---

## Publication des ports (§13)

```bash
docker compose ps --format 'table {{.Service}}\t{{.Ports}}'
```

```text
SERVICE    PORTS
backend    3000/tcp
db         5432/tcp
frontend   80/tcp
nginx      0.0.0.0:80->80/tcp, [::]:80->80/tcp
```

Seul Nginx est ouvert sur la machine (`0.0.0.0:80->80`).

```bash
curl -m2 http://localhost:3000/api1
```

```text
curl: (7) Failed to connect to localhost port 3000
```

Le port 5432 est également fermé sur la machine.

**Q28. Pourquoi ne pas exposer PostgreSQL sur le port 5432 de la machine hôte si ce n'est pas nécessaire ?**
Seul le backend en a besoin. L'ouvrir exposerait la base aux attaques.

**Q29. Quel avantage apporte cette approche en matière de sécurité ?**
Il n'y a qu'une seule porte d'entrée (Nginx). La base et l'API ne sont pas joignables directement.

**Q30. Quelle différence existe entre un port expose et un port publié avec ports ?**
`expose` rend le port accessible seulement aux autres conteneurs (`3000/tcp` ci-dessus). `ports` l'ouvre sur la machine hôte (`0.0.0.0:80->80/tcp`).

---

## Logs (§16)

```bash
docker compose logs
docker compose logs -f
docker compose logs backend
docker compose logs nginx
```

Test : on arrête le backend et on appelle l'API.

```bash
docker compose stop backend
curl -i http://localhost/api1
```

```text
HTTP/1.1 504 Gateway Time-out
```

```bash
docker compose logs nginx
```

```text
nginx-1  | [error] 32#32: *7 upstream timed out (110: Operation timed out) while connecting to upstream, client: 172.18.0.1, server: _, request: "GET /api1 HTTP/1.1", upstream: "http://172.18.0.2:3000/api1", host: "localhost"
nginx-1  | 172.18.0.1 - - [08/Oct/2026:14:14:04 +0000] "GET /api1 HTTP/1.1" 504 167 "-" "curl/7.81.0" "-"
```

```bash
docker compose logs backend
```

```text
backend-1  | Backend en écoute sur 0.0.0.0:3000
backend-1  | Connecté à PostgreSQL sur db:5432
```

```bash
docker compose start backend
```

**Q31. Dans quels logs recherchez-vous une erreur HTTP 502 retournée par Nginx ?**
Dans les logs de Nginx (`docker compose logs nginx`) : on y voit l'erreur et le service qui ne répond pas (`upstream`). Ensuite dans les logs de ce service (ici le backend) pour savoir pourquoi.

**Q32. Dans quels logs recherchez-vous une erreur de connexion PostgreSQL ?**
Dans les logs du backend (`docker compose logs backend`), puisque c'est lui qui se connecte (par exemple `PostgreSQL indisponible : ECONNREFUSED`). Ensuite dans ceux de `db` si besoin.

**Q33. Quelle commande permet de suivre les logs en temps réel ?**
`docker compose logs -f`

---

## Diagnostic depuis les conteneurs (§17)

```bash
docker compose exec backend sh
getent hosts db
```

```text
172.20.0.2        db  db
```

Depuis Nginx :

```bash
docker compose exec nginx getent hosts backend
docker compose exec nginx getent hosts frontend
```

```text
172.18.0.2        backend  backend
172.20.0.2        frontend  frontend
```

**Q34. Quelle adresse IP est associée au service db ?**
`172.19.0.2` lors du test.

**Q35. Cette adresse IP doit-elle être placée dans la configuration de l'application ?**
Non, on utilise le nom `db`.

**Q36. Que se passerait-il si le conteneur était recréé ?**
Il pourrait avoir une autre IP. Test : on supprime `db`, un autre conteneur prend sa place sur le réseau, puis on recrée `db`.

```bash
docker compose exec backend getent hosts db
# 172.19.0.2        db  db
docker compose rm -sf db
docker run -d --rm --network docker-compose-tp_db_net alpine sleep 60
docker compose up -d db
docker compose exec backend getent hosts db
# 172.19.0.4        db  db
curl http://localhost/api2
# "messages":[{"id":1,"texte":"Message de test persistance",...}]
```

L'IP est passée de `172.19.0.2` à `172.19.0.4`. Grâce au nom `db`, l'application continue de fonctionner sans rien changer. Avec l'IP écrite en dur, ça casserait.

---

## Arrêt et nettoyage (§18)

```bash
docker compose stop
```

```text
 Container docker-compose-tp-nginx-1 Stopped
 Container docker-compose-tp-frontend-1 Stopped
 Container docker-compose-tp-backend-1 Stopped
 Container docker-compose-tp-db-1 Stopped
```

```bash
docker compose ps -a
```

```text
SERVICE    STATUS
backend    Exited (0) Less than a second ago
db         Exited (0) Less than a second ago
frontend   Exited (0) Less than a second ago
nginx      Exited (0) Less than a second ago
```

```bash
docker compose start
docker compose ps
```

```text
SERVICE    STATUS
backend    Up 8 seconds (healthy)
db         Up 13 seconds (healthy)
frontend   Up 13 seconds
nginx      Up 2 seconds
```

```bash
docker compose down
```

```text
 Container docker-compose-tp-nginx-1 Removed
 Container docker-compose-tp-frontend-1 Removed
 Container docker-compose-tp-backend-1 Removed
 Container docker-compose-tp-db-1 Removed
 Network docker-compose-tp_back_net Removed
 Network docker-compose-tp_db_net Removed
 Network docker-compose-tp_front_net Removed
```

```bash
docker volume ls
```

```text
DRIVER    VOLUME NAME
local     compose_mysql_data
local     docker-compose-tp_postgres_data
```

```bash
docker compose down -v
```

```text
 Volume docker-compose-tp_postgres_data Removed
```

```bash
docker volume ls
```

```text
DRIVER    VOLUME NAME
local     compose_mysql_data
```

**Q37. Quelle différence existe entre stop et down ?**
`stop` arrête les conteneurs sans les supprimer (ils sont en `Exited`, `start` les relance). `down` les supprime, ainsi que les réseaux.

**Q38. Quelle différence existe entre down et down -v ?**
`down` garde le volume, donc les données. `down -v` le supprime : au redémarrage, `/api2` renvoie `"messages":[]`.

**Q39. Dans quel cas faut-il éviter down -v ?**
Dès que la base contient des données qu'on veut garder.

---

## Bonus — Healthcheck (§19)

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
  interval: 5s
  retries: 10
```

```bash
docker compose ps
```

```text
SERVICE    STATUS
backend    Up 8 seconds (healthy)
db         Up 13 seconds (healthy)
```

**Q40. Quel intérêt présente un healthcheck dans une architecture multi-services ?**
Savoir si un service est vraiment prêt, et pas seulement démarré. Les services qui en dépendent attendent qu'il le soit.

---

## Bonus — Limiter l'accès aux services (§20)

Un réseau pour chaque lien autorisé :

| Réseau | Qui peut se parler |
|---|---|
| `front_net` | nginx ↔ frontend |
| `back_net` | nginx ↔ backend |
| `db_net` (`internal: true`) | backend ↔ db |

Changements réalisés :
- seul Nginx a un port ouvert sur la machine (`ports: "80:80"`) ;
- le frontend n'est que sur `front_net` : il ne voit que Nginx ;
- le backend est sur `back_net` et `db_net` : il ne voit que Nginx et la base ;
- la base n'est que sur `db_net` : elle ne voit que le backend, et `internal: true` lui coupe l'accès à Internet.

Vérifications :

```bash
docker compose exec nginx getent hosts db           # rien;
docker compose exec frontend getent hosts backend   # rien;
docker compose exec db wget -T3 -qO- https://google.com   # échec : wget: bad address 'google.com'
```

---

## Bonus — .dockerignore (§21)

```text
node_modules
.git
.gitignore
npm-debug.log
.env
```

Taille du contexte envoyé à Docker lors du build :

```text
front : transferring context: 61.42kB
back  : transferring context: 39.30kB
```

**Q41. Quel est le rôle de .dockerignore?**
Il exclut des fichiers de ce qui est envoyé à Docker pour le build. Ils ne peuvent donc pas finir dans l'image.

**Q42. Quel impact peut-il avoir sur la vitesse d'un build ?**
Moins de fichiers à envoyer, donc un build plus rapide.

**Q43. Pourquoi faut-il éviter de copier un fichier .env contenant des secrets dans une image ?**
Les mots de passe seraient lisibles par toute personne qui récupère l'image.

---

## Livrable (§24)

```bash
docker compose up -d --build
```

```text
 Image tp-frontend Built
 Image tp-backend Built
 Image tp-nginx Built
 Volume docker-compose-tp_postgres_data Created
 Network docker-compose-tp_back_net Created
 Network docker-compose-tp_front_net Created
 Network docker-compose-tp_db_net Created
 Container docker-compose-tp-db-1 Started
 Container docker-compose-tp-frontend-1 Started
 Container docker-compose-tp-db-1 Healthy
 Container docker-compose-tp-backend-1 Started
 Container docker-compose-tp-backend-1 Healthy
 Container docker-compose-tp-nginx-1 Started
```

```text
SERVICE    STATUS                    PORTS
backend    Up 8 seconds (healthy)    3000/tcp
db         Up 14 seconds (healthy)   5432/tcp
frontend   Up 14 seconds             80/tcp
nginx      Up 2 seconds              0.0.0.0:80->80/tcp, [::]:80->80/tcp
```

```text
/     -> 200
/api1 -> 200
/api2 -> 200
```

Le projet démarre avec une seule commande, sans modifier le fichier Compose.

---

## Questions de synthèse

**1. Quelle est la différence entre une image et un conteneur ?**
L'image est le modèle, en lecture seule. Le conteneur est une instance de cette image en train de tourner.

**2. À quoi sert Docker Compose ?**
À décrire plusieurs conteneurs dans un seul fichier et à tous les lancer avec une seule commande.

**3. Comment deux conteneurs d'un même projet Compose communiquent-ils ?**
Par le réseau créé par Compose, en utilisant le nom du service.

**4. Pourquoi utilise-t-on le nom du service comme hostname ?**
Parce qu'il ne change pas, contrairement à l'adresse IP.

**5. À quoi sert un volume Docker ?**
À garder les données même quand le conteneur est supprimé.

**6. À quoi sert un reverse proxy ?**
À recevoir toutes les requêtes et à les envoyer au bon service.

**7. Pourquoi ne faut-il pas nécessairement publier tous les ports ?**
Moins de ports ouverts, moins de risques. Seul le point d'entrée doit être accessible.

**8. À quoi servent les variables d'environnement ?**
À configurer un conteneur sans modifier ni reconstruire l'image.

**9. `Quelle est la différence entre docker compose stop et docker compose down?**
`stop` arrête les conteneurs, `down` les supprime.

**10. Quel est l'intérêt d'un healthcheck dans une application multi-services ?**
Savoir quand un service est vraiment prêt, pour démarrer les autres au bon moment.
