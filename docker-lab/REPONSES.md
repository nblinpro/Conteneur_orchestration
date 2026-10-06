# Réponses aux questions du TP Docker

**TP Docker — Dockerfile, image et layers**
Nicolas Blin — M1 Expert Cloud, Infrastructure & Sécurité — Ynov Campus

---

## Sommaire

1. [Partie 1 — Création de l'application](#partie-1--création-de-lapplication)
2. [Partie 2 — Création du Dockerfile](#partie-2--création-du-dockerfile) (Q1 à Q3)
3. [Partie 3 — Construction de l'image](#partie-3--construction-de-limage) (Q4 et Q5)
4. [Partie 4 — Lancement du conteneur](#partie-4--lancement-du-conteneur) (Q6 à Q8)
5. [Partie 5 — Analyse des layers](#partie-5--analyse-des-layers) (Q9 à Q11)
6. [Partie 6 — Comprendre le cache Docker](#partie-6--comprendre-le-cache-docker) (Q12 à Q14)
7. [Partie 7 — Mauvaise optimisation du Dockerfile](#partie-7--mauvaise-optimisation-du-dockerfile) (Q15 à Q17)
8. [Partie 8 — Inspection du contenu de l'image](#partie-8--inspection-du-contenu-de-limage) (Q18 et Q19)
9. [Partie 9 — Recherche d'un fichier dans les layers](#partie-9--recherche-dun-fichier-dans-les-layers) (Q20 et Q21)
10. [Partie 10 — Challenge sécurité](#partie-10--challenge-sécurité) (Q22 à Q25)
11. [Partie 11 — Bonus : .dockerignore](#partie-11--bonus--dockerignore) (Q26 et Q27)

---

## Partie 1 — Création de l'application

### Commandes

```bash
docker version
mkdir docker-lab && cd docker-lab
```

### Fichiers

`app.py` :

```python
from flask import Flask

app = Flask(__name__)

@app.route("/")
def home():
    with open("message.txt", "r") as f:
        message = f.read()
    return f"<h1>{message}</h1>"

app.run(host="0.0.0.0", port=5000)
```

`requirements.txt` :

```
flask==3.0.3
```

`message.txt` :

```
Bonjour depuis mon conteneur Docker !
```

---

## Partie 2 — Création du Dockerfile

### Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY message.txt .

EXPOSE 5000

CMD ["python", "app.py"]
```

### Question 1 — Différence entre `RUN` et `CMD`

`RUN` s'exécute pendant la phase de **construction** (build) de l'image pour installer des paquets ou exécuter des commandes, et crée un nouveau layer.

`CMD` définit la commande par défaut qui sera exécutée au **démarrage** du conteneur (runtime).

### Question 2 — Rôle de `WORKDIR /app`

`WORKDIR /app` définit le répertoire de travail courant pour toutes les instructions suivantes (`RUN`, `COPY`, `CMD`, etc.). S'il n'existe pas, il est créé automatiquement.

### Question 3 — Rôle de `EXPOSE 5000`

`EXPOSE 5000` sert de documentation pour indiquer sur quel port l'application écoute à l'intérieur du conteneur.

**Non**, cette instruction ne publie pas automatiquement le port sur la machine hôte : il faut explicitement utiliser l'option `-p` lors du `docker run`.

---

## Partie 3 — Construction de l'image

### Commandes

```bash
sudo docker build -t docker-lab:v1 .
sudo docker images docker-lab
```

Extrait du build :

```
 => [1/6] FROM docker.io/library/python:3.12-slim@sha256:05cda9777409a9c3ffddd94a4c476b79f0769a0b4857f0c7ed9226b6800  1.3s
 => [2/6] WORKDIR /app                                                                                                0.1s
 => [3/6] COPY requirements.txt .                                                                                     0.0s
 => [4/6] RUN pip install --no-cache-dir -r requirements.txt                                                          2.7s
 => [5/6] COPY app.py .                                                                                               0.1s
 => [6/6] COPY message.txt .                                                                                          0.0s
 => => naming to docker.io/library/docker-lab:v1                                                                      0.0s
```

### Question 4 — Afficher les images Docker

```bash
docker images
```

### Question 5 — Taille de l'image `docker-lab:v1`

```
nicolas@containerorchestration:~/docker-lab$ sudo docker images docker-lab
IMAGE           ID             DISK USAGE   CONTENT SIZE   EXTRA
docker-lab:v1   fae2a7f5d550        198MB         48.3MB    U
```

| Colonne | Valeur | Signification |
|---|---|---|
| DISK USAGE | **198 Mo** | Espace occupé sur le disque |
| CONTENT SIZE | **48,3 Mo** | Taille des layers compressés (transférés lors d'un pull/push) |

---

## Partie 4 — Lancement du conteneur

### Commandes

```bash
sudo docker run -d --name docker-lab -p 8080:5000 docker-lab:v1
curl http://localhost:8080
```

```
<h1>Bonjour depuis mon conteneur Docker !
</h1>
```

### Question 6 — Signification de `-p 8080:5000`

L'option `-p 8080:5000` redirige le port `8080` de la machine hôte vers le port `5000` du conteneur, permettant d'accéder à l'application web via `http://localhost:8080`.

### Question 7 — Afficher les conteneurs en cours d'exécution

```bash
docker ps
```

```
nicolas@containerorchestration:~/docker-lab$ sudo docker ps
CONTAINER ID   IMAGE           COMMAND           CREATED          STATUS          PORTS                                         NAMES
af6edcb48301   docker-lab:v1   "python app.py"   17 minutes ago   Up 17 minutes   0.0.0.0:8080->5000/tcp, [::]:8080->5000/tcp   docker-lab
```

### Question 8 — Afficher les logs du conteneur

```bash
docker logs docker-lab
```

```
nicolas@containerorchestration:~/docker-lab$ sudo docker logs docker-lab
 * Serving Flask app 'app'
 * Debug mode: off
WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
 * Running on http://172.17.0.2:5000
Press CTRL+C to quit
192.168.80.1 - - [06/Oct/2026 14:24:46] "GET / HTTP/1.1" 200 -
192.168.80.1 - - [06/Oct/2026 14:24:47] "GET / HTTP/1.1" 200 -
192.168.80.1 - - [06/Oct/2026 14:24:47] "GET / HTTP/1.1" 200 -
172.17.0.1 - - [06/Oct/2026 14:25:04] "GET / HTTP/1.1" 200 -
172.17.0.1 - - [06/Oct/2026 14:35:43] "GET / HTTP/1.1" 200 -
```

---

## Partie 5 — Analyse des layers

### Commandes

```bash
sudo docker history docker-lab:v1
sudo docker history --no-trunc docker-lab:v1
```

### Question 9 — Instructions du Dockerfile dans l'historique

On y retrouve l'historique des instructions présentes dans le Dockerfile (`FROM`, `WORKDIR`, `COPY`, `RUN`, etc.).

```
nicolas@containerorchestration:~/docker-lab$ sudo docker history docker-lab:v1
IMAGE          CREATED          CREATED BY                                      SIZE      COMMENT
fae2a7f5d550   20 minutes ago   CMD ["python" "app.py"]                         0B        buildkit.dockerfile.v0
<missing>      20 minutes ago   EXPOSE [5000/tcp]                               0B        buildkit.dockerfile.v0
<missing>      20 minutes ago   COPY message.txt . # buildkit                   12.3kB    buildkit.dockerfile.v0
<missing>      20 minutes ago   COPY app.py . # buildkit                        12.3kB    buildkit.dockerfile.v0
<missing>      20 minutes ago   RUN /bin/sh -c pip install --no-cache-dir -r…   15.3MB    buildkit.dockerfile.v0
<missing>      20 minutes ago   COPY requirements.txt . # buildkit              12.3kB    buildkit.dockerfile.v0
<missing>      20 minutes ago   WORKDIR /app                                    8.19kB    buildkit.dockerfile.v0
<missing>      13 hours ago     CMD ["python3"]                                 0B        buildkit.dockerfile.v0
<missing>      13 hours ago     RUN /bin/sh -c set -eux;  for src in idle3 p…   16.4kB    buildkit.dockerfile.v0
<missing>      13 hours ago     RUN /bin/sh -c set -eux;   savedAptMark="$(a…   41.4MB    buildkit.dockerfile.v0
<missing>      13 hours ago     ENV PYTHON_SHA256=c2c4321961fab0fb999d66e0ce…   0B        buildkit.dockerfile.v0
<missing>      13 hours ago     ENV PYTHON_VERSION=3.12.15                      0B        buildkit.dockerfile.v0
<missing>      13 hours ago     ENV GPG_KEY=7169605F62C751356D054A26A821E680…   0B        buildkit.dockerfile.v0
<missing>      13 hours ago     RUN /bin/sh -c set -eux;  apt-get update;  a…   4.94MB    buildkit.dockerfile.v0
<missing>      13 hours ago     ENV LANG=C.UTF-8                                0B        buildkit.dockerfile.v0
<missing>      13 hours ago     ENV PATH=/usr/local/bin:/usr/local/sbin:/usr…   0B        buildkit.dockerfile.v0
<missing>      39 hours ago     # debian.sh --arch 'amd64' out/ 'trixie' '@1…   87.7MB    debuerreotype 0.17
```

### Question 10 — Instructions créant des layers de fichiers

`FROM`, `COPY` et `RUN` participent directement à la modification du système de fichiers et à la création de layers de données (`WORKDIR`, `EXPOSE` et `CMD` gèrent les métadonnées).

### Question 11 — Layer le plus volumineux

Le layer le plus lourd est celui de l'image de base (`debian.sh`, **87,7 Mo**), suivi de l'installation de Python (**41,4 Mo**) et du `RUN pip install` (**15,3 Mo**).

---

## Partie 6 — Comprendre le cache Docker

### Commandes

```bash
echo "Docker est incroyable !" > message.txt
cat message.txt
sudo docker build --progress=plain -t docker-lab:v2 . 2>&1 | tee build-v2.log
grep -E "^#[0-9]+ \[|CACHED" build-v2.log
```

Sortie du build :

```
nicolas@containerorchestration:~/docker-lab$ cat message.txt
Docker est incroyable !

nicolas@containerorchestration:~/docker-lab$ sudo docker build --progress=plain -t docker-lab:v2 . 2>&1 | tee build-v2.log
#0 building with "default" instance using docker driver

#1 [internal] load build definition from Dockerfile
#1 transferring dockerfile: 224B done
#1 DONE 0.0s

#2 [internal] load metadata for docker.io/library/python:3.12-slim
#2 DONE 0.8s

#3 [internal] load .dockerignore
#3 transferring context: 175B done
#3 DONE 0.0s

#4 [internal] load build context
#4 transferring context: 127B done
#4 DONE 0.0s

#5 [1/6] FROM docker.io/library/python:3.12-slim@sha256:05cda9777409a9c3ffddd94a4c476b79f0769a0b4857f0c7ed9226b6800b0d6f
#5 resolve docker.io/library/python:3.12-slim@sha256:05cda9777409a9c3ffddd94a4c476b79f0769a0b4857f0c7ed9226b6800b0d6f 0.0s done
#5 DONE 0.0s

#6 [3/6] COPY requirements.txt .
#6 CACHED

#7 [2/6] WORKDIR /app
#7 CACHED

#8 [4/6] RUN pip install --no-cache-dir -r requirements.txt
#8 CACHED

#9 [5/6] COPY app.py .
#9 CACHED

#10 [6/6] COPY message.txt .
#10 DONE 0.0s

#11 exporting to image
#11 exporting layers 0.0s done
#11 exporting manifest sha256:5262853b3bd431c1daf36cc367df719682037ba95c22ba1a98ca6927ce33039d done
#11 exporting config sha256:3bfc28a1f0e5940a0db4f0b34e1102f9a7be80ebd71e3f7fe11e84ef29060d0e done
#11 exporting attestation manifest sha256:12c10533e1ae200f7fd63e4daec62361774f0e98e7e120eaf4030772f293208e done
#11 exporting manifest list sha256:73fd4fa36122a3d78aedab6466d032fd7da1c28ee9b9ec75096e070523c06f91 done
#11 naming to docker.io/library/docker-lab:v2 done
#11 unpacking to docker.io/library/docker-lab:v2 0.0s done
#11 DONE 0.1s
```

Filtrage des étapes :

```
nicolas@containerorchestration:~/docker-lab$ grep -E "^#[0-9]+ \[|CACHED" build-v2.log
#1 [internal] load build definition from Dockerfile
#2 [internal] load metadata for docker.io/library/python:3.12-slim
#3 [internal] load .dockerignore
#4 [internal] load build context
#5 [1/6] FROM docker.io/library/python:3.12-slim@sha256:05cda9777409a9c3ffddd94a4c476b79f0769a0b4857f0c7ed9226b6800b0d6f
#6 [3/6] COPY requirements.txt .
#6 CACHED
#7 [2/6] WORKDIR /app
#7 CACHED
#8 [4/6] RUN pip install --no-cache-dir -r requirements.txt
#8 CACHED
#9 [5/6] COPY app.py .
#9 CACHED
#10 [6/6] COPY message.txt .
```

Vérification complémentaire, en comparant les layers de v1 et v2 :

```bash
sudo docker image inspect docker-lab:v1 --format '{{range .RootFS.Layers}}{{println .}}{{end}}' > layers-v1.txt
sudo docker image inspect docker-lab:v2 --format '{{range .RootFS.Layers}}{{println .}}{{end}}' > layers-v2.txt
diff layers-v1.txt layers-v2.txt
```

### Question 12 — Étapes marquées `CACHED`

Toutes les étapes situées en amont du fichier modifié, c'est-à-dire l'image de base (`FROM`), le répertoire de travail (`WORKDIR`), la copie du fichier `requirements.txt` (`COPY`), l'installation des dépendances (`RUN pip install`) et la copie de `app.py` (`COPY`).

### Question 13 — Pourquoi Docker ne réinstalle-t-il pas Flask ?

Grâce au système de cache de Docker : le fichier `requirements.txt` n'ayant pas changé, Docker réutilise le layer mis en cache correspondant.

### Question 14 — Instruction à partir de laquelle le cache est invalidé

Le cache est invalidé à partir de l'étape `[6/6] COPY message.txt .` (ligne `#10`), qui est la première à ne plus porter la mention `CACHED` et à s'exécuter directement (`DONE 0.0s`), en raison de la modification du fichier `message.txt`.

---

## Partie 7 — Mauvaise optimisation du Dockerfile

### Dockerfile.v3

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 5000

CMD ["python", "app.py"]
```

### Commandes

```bash
# 1er build v3
sudo docker build --progress=plain -f Dockerfile.v3 -t docker-lab:v3 . 2>&1 | tee build-v3-a.log

# Modification de message.txt uniquement
echo "Message modifié pour tester le cache" > message.txt

# 2e build v3
sudo docker build --progress=plain -f Dockerfile.v3 -t docker-lab:v3 . 2>&1 | tee build-v3-b.log
grep -E "^#[0-9]+ \[|CACHED|Downloading|Successfully installed" build-v3-b.log
```

### Question 15 — `RUN pip install` est-il toujours récupéré depuis le cache ?

**Non**, elle n'est plus récupérée depuis le cache. Le filtrage des logs par `grep` sur le deuxième build (`build-v3-b.log`) le démontre explicitement : `pip` retélécharge et réinstalle Flask et toutes ses dépendances.

```
nicolas@containerorchestration:~/docker-lab$ grep -E "^#[0-9]+ \[|CACHED|Downloading|Successfully installed" build-v3-b.log
#1 [internal] load build definition from Dockerfile.v3
#2 [internal] load metadata for docker.io/library/python:3.12-slim
#3 [internal] load .dockerignore
#4 [1/4] FROM docker.io/library/python:3.12-slim@sha256:05cda9777409a9c3ffddd94a4c476b79f0769a0b4857f0c7ed9226b6800b0d6f
#5 [internal] load build context
#6 [2/4] WORKDIR /app
#6 CACHED
#7 [3/4] COPY . .
#8 [4/4] RUN pip install --no-cache-dir -r requirements.txt
#8 2.031   Downloading flask-3.0.3-py3-none-any.whl.metadata (3.2 kB)
#8 2.074   Downloading werkzeug-3.1.9-py3-none-any.whl.metadata (4.1 kB)
#8 2.107   Downloading jinja2-3.1.6-py3-none-any.whl.metadata (2.9 kB)
#8 2.134   Downloading itsdangerous-2.2.0-py3-none-any.whl.metadata (1.9 kB)
#8 2.167   Downloading click-8.5.0-py3-none-any.whl.metadata (2.6 kB)
#8 2.198   Downloading blinker-1.9.0-py3-none-any.whl.metadata (1.6 kB)
#8 2.279   Downloading markupsafe-3.0.4-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl.metadata (2.7 kB)
#8 2.300 Downloading flask-3.0.3-py3-none-any.whl (101 kB)
#8 2.344 Downloading blinker-1.9.0-py3-none-any.whl (8.5 kB)
#8 2.355 Downloading click-8.5.0-py3-none-any.whl (125 kB)
#8 2.385 Downloading itsdangerous-2.2.0-py3-none-any.whl (16 kB)
#8 2.396 Downloading jinja2-3.1.6-py3-none-any.whl (134 kB)
#8 2.425 Downloading werkzeug-3.1.9-py3-none-any.whl (228 kB)
#8 2.465 Downloading markupsafe-3.0.4-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl (22 kB)
#8 2.993 Successfully installed Jinja2-3.1.6 MarkupSafe-3.0.4 Werkzeug-3.1.9 blinker-1.9.0 click-8.5.0 flask-3.0.3 itsdangerous-2.2.0
```

### Question 16 — Pourquoi ce Dockerfile est-il moins performant ?

Ce Dockerfile est moins performant pour deux raisons.

**1. Invalidation du cache**

L'instruction globale `COPY . .` placée avant l'installation des dépendances invalide le cache au moindre changement (comme dans `message.txt`). Les tests de chronométrage montrent bien l'écart de performance :

```bash
echo "test chrono 1" > message.txt
time sudo docker build -q -t docker-lab:v2 .                     # bon Dockerfile (avec cache)

echo "test chrono 2" > message.txt
time sudo docker build -q -f Dockerfile.v3 -t docker-lab:v3 .    # mauvais Dockerfile (sans cache)
```

```
# Bon Dockerfile
sha256:eb9c072f3f34beb5a0e76600d3f10b0a1b96098205384d95dd9e7e1258e237f9

real    0m1,121s
user    0m0,001s
sys     0m0,007s

# Mauvais Dockerfile
sha256:65430086a2a3f464b41dc07cad7d4f47a82ddbf7a7a15048c734da0917552cc2

real    0m3,738s
user    0m0,003s
sys     0m0,005s
```

On remet ensuite le message attendu par le sujet :

```bash
echo "Docker est incroyable !" > message.txt
```

| Dockerfile | Temps de build après modification de `message.txt` |
|---|---|
| Bon (dépendances avant le code) | **1,1 s** |
| Mauvais (`COPY . .` avant `pip install`) | **3,7 s** (×3,3) |

**2. Pollution de l'image**

La commande `COPY . .` a embarqué l'intégralité du répertoire de travail, y compris les fichiers superflus (`build-v2.log`, `build-v3-a.log`, etc.), ce qui alourdit inutilement l'image. On peut le vérifier en inspectant le conteneur :

```bash
sudo docker run --rm docker-lab:v3 ls -la /app
```

```
total 52
drwxr-xr-x 1 root root 4096 Oct  6 15:14 .
drwxr-xr-x 1 root root 4096 Oct  6 15:14 ..
-rw-r--r-- 1 root root  133 Oct  6 14:16 .dockerignore
-rw-r--r-- 1 root root  185 Oct  6 14:16 Dockerfile
-rw-rw-r-- 1 root root  137 Oct  6 14:59 Dockerfile.v3
-rw-r--r-- 1 root root  212 Oct  6 14:19 app.py
-rw-rw-r-- 1 root root 1488 Oct  6 14:53 build-v2.log
-rw-rw-r-- 1 root root 3881 Oct  6 15:01 build-v3-a.log
-rw-rw-r-- 1 root root 3975 Oct  6 15:02 build-v3-b.log
-rw-rw-r-- 1 root root  649 Oct  6 14:58 layers-v1.txt
-rw-rw-r-- 1 root root  649 Oct  6 14:58 layers-v2.txt
-rw-r--r-- 1 root root   14 Oct  6 15:14 message.txt
-rw-r--r-- 1 root root   13 Oct  6 14:16 requirements.txt
```

### Question 17 — Version optimisée du Dockerfile

Pour optimiser le Dockerfile et maximiser l'utilisation du cache Docker, il faut dissocier la copie des fichiers. On copie d'abord uniquement le fichier des dépendances (`requirements.txt`) pour installer les paquets, et l'on copie le reste du code source (`COPY . .`) après :

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
```

---

## Partie 8 — Inspection du contenu de l'image

### Commandes

```bash
sudo docker save docker-lab:v1 -o docker-lab.tar
sudo chown $USER:$USER docker-lab.tar
ls -lh docker-lab.tar

mkdir -p docker-image
tar -xf docker-lab.tar -C docker-image
ls docker-image
```

```
blobs  index.json  manifest.json  oci-layout
```

### Question 18 — Contenu de `manifest.json`

`manifest.json` contient la liste des couches (layers) de l'image sous forme de fichiers `.tar` ou de blobs, ainsi que le chemin de leur fichier de configuration (`Config`) et les tags de l'image (`RepoTags`). En l'inspectant via Python, on obtient :

```bash
python3 -m json.tool docker-image/manifest.json
```

```json
[
    {
        "Config": "blobs/sha256/9b48b16c154d293169523f27bb36240f6c1e7219f01e96dd9fc26b7093a696ff",
        "RepoTags": [
            "docker-lab:v1"
        ],
        "Layers": [
            "blobs/sha256/ecc510c1e359bdc007b39802570bb7e4dec7d6ebccf357c3201a74299113e05e",
            "blobs/sha256/75b6a36c64a1cf3520fc4b4aae4739d5caa8a6a05c27835a920a61784c9c32f8",
            "blobs/sha256/6912e23eb44595b44dc6d9882b34f305ad6f6e9667cec70b13e5dbc4f8cd97f4",
            "blobs/sha256/bbc5a12237474ec0b23b5051260d56d6436a24d70d9cad961adebe7a037ed813",
            "blobs/sha256/305e62ba133fc11e8e50e1fec907345ba542f42b7ad9b64760570fb92262d399",
            "blobs/sha256/2e358bdf0971348585973bcbe7ce42490bc15cb06ea2d487fcc4cbbbd2d6a29c",
            "blobs/sha256/e67555b977b3d1be9756e0f4446398ae2debe5417fd5f385e53e9de62a1e547a",
            "blobs/sha256/c951fbf85514a7128a92bebcf6ccb8050394d6f50b1d8dba9bbdee838d3ed65e",
            "blobs/sha256/6efdab552f1447619c55eabfe0f3059e7254e21e9f6d814a4f872f132accb242"
        ]
    }
]
```

### Question 19 — Nombre de layers

L'image est composée de **9 layers** au total. Ce nombre se vérifie via le `manifest.json` ou l'inspection de l'image, qui retournent toutes deux le même résultat :

```bash
python3 -c "import json;print(len(json.load(open('docker-image/manifest.json'))[0]['Layers']))"
sudo docker image inspect docker-lab:v1 --format '{{len .RootFS.Layers}}'
```

```
9
```

---

## Partie 9 — Recherche d'un fichier dans les layers

### Commandes

Avec le format OCI utilisé par les versions récentes de Docker, les layers sont des blobs sans extension : `find docker-image -name "*.tar"` ne renvoie donc rien.

```bash
find docker-image -name "*.tar"
ls -lh docker-image/blobs/sha256/
```

On utilise alors un script d'analyse des couches (`find-in-layers.py`) qui interroge chaque blob listé dans le `manifest.json` (il gère aussi les blobs compressés) :

```bash
cat > find-in-layers.py <<'EOF'
import json, sys, tarfile, os
root, pattern = sys.argv[1], sys.argv[2]
m = json.load(open(os.path.join(root, "manifest.json")))[0]
for i, layer in enumerate(m["Layers"], 1):
    with tarfile.open(os.path.join(root, layer)) as t:
        names = t.getnames()
    hits = [n for n in names if pattern in n]
    print(f"Layer {i}/{len(m['Layers'])}  {layer[-20:]}  ({len(names)} entrées)" + (f"  <-- {hits}" if hits else ""))
EOF
```

```bash
python3 find-in-layers.py docker-image message.txt
```

```
Layer 1/9  57c3201a74299113e05e  (3271 entrées)
Layer 2/9  835a920a61784c9c32f8  (553 entrées)
Layer 3/9  c70b13e5dbc4f8cd97f4  (1828 entrées)
Layer 4/9  ad961adebe7a037ed813  (8 entrées)
Layer 5/9  b64760570fb92262d399  (1 entrées)
Layer 6/9  d487fcc4cbbbd2d6a29c  (2 entrées)
Layer 7/9  f385e53e9de62a1e547a  (961 entrées)
Layer 8/9  8dba9bbdee838d3ed65e  (2 entrées)
Layer 9/9  814a4f872f132accb242  (2 entrées)  <-- ['app/message.txt']
```

Affichage du contenu du layer concerné :

```bash
LAYER=$(python3 -c "import json;print(json.load(open('docker-image/manifest.json'))[0]['Layers'][8])")
tar -tvf docker-image/$LAYER
```

### Question 20 — Dans quel layer se trouve `message.txt` ?

On trouve le fichier `message.txt` dans le **Layer 9/9**, qui correspond à l'étape de copie du fichier dans l'image (`COPY message.txt .`).

### Question 21 — Le layer contient-il tout le système de fichiers de l'image ?

**Non**, ce layer ne contient pas l'intégralité du système de fichiers. Il ne renferme que les modifications de son étape, c'est-à-dire seulement **2 entrées** (`app/` et `app/message.txt`).

---

## Partie 10 — Challenge sécurité

### Dockerfile.secret

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY message.txt .

COPY password.txt .
RUN rm password.txt

EXPOSE 5000

CMD ["python", "app.py"]
```

### Commandes

```bash
# Le .dockerignore exclut password.txt : on le désactive pour cette partie
mv .dockerignore .dockerignore.off

echo "SuperSecretPassword123!" > password.txt
sudo docker build --progress=plain -f Dockerfile.secret -t docker-lab:secret .

# Vérification : le fichier n'est plus visible dans le conteneur
sudo docker run --rm docker-lab:secret ls -la /app
sudo docker run --rm docker-lab:secret find / -name "password.txt" 2>/dev/null

# Historique : le layer COPY password.txt a une taille non nulle
sudo docker history docker-lab:secret

# Sauvegarde et extraction de l'image
sudo docker save docker-lab:secret -o docker-secret.tar
sudo chown $USER:$USER docker-secret.tar
mkdir -p docker-image-secret
tar -xf docker-secret.tar -C docker-image-secret

# Recherche du fichier dans les layers
python3 find-in-layers.py docker-image-secret password.txt
```

### Question 22 — `password.txt` est-il réellement absent de l'image ?

**Non**. Même s'il a été supprimé par l'instruction `RUN rm password.txt` dans le Dockerfile et qu'on ne le voit pas à l'intérieur du conteneur, il n'a pas disparu de l'image.

### Question 23 — Dans quel layer est-il encore présent ?

Le fichier est toujours présent en clair dans le layer de copie (**Layer 10/11**). L'instruction `RUN rm` ne supprime pas physiquement le fichier des couches précédentes : elle ajoute simplement un nouveau layer par-dessus (**Layer 11/11**) contenant un fichier de masquage (« whiteout », `app/.wh.password.txt`).

En extrayant directement l'archive de l'image, on peut localiser le fichier et extraire le secret en clair :

```
nicolas@containerorchestration:~/docker-lab$ python3 find-in-layers.py docker-image-secret password.txt
Layer 1/11  57c3201a74299113e05e  (3271 entrées)
Layer 2/11  835a920a61784c9c32f8  (553 entrées)
Layer 3/11  c70b13e5dbc4f8cd97f4  (1828 entrées)
Layer 4/11  ad961adebe7a037ed813  (8 entrées)
Layer 5/11  b64760570fb92262d399  (1 entrées)
Layer 6/11  d487fcc4cbbbd2d6a29c  (2 entrées)
Layer 7/11  f385e53e9de62a1e547a  (961 entrées)
Layer 8/11  8dba9bbdee838d3ed65e  (2 entrées)
Layer 9/11  9705ddc0882878b44977  (2 entrées)
Layer 10/11  a8a3ecad680fce197790  (2 entrées)  <-- ['app/password.txt']
Layer 11/11  5fe69b409da39cafc315  (2 entrées)  <-- ['app/.wh.password.txt']
```

```bash
LAYER=$(python3 -c "import json;print(json.load(open('docker-image-secret/manifest.json'))[0]['Layers'][9])")
tar -xOf docker-image-secret/$LAYER app/password.txt
```

```
SuperSecretPassword123!
```

### Question 24 — Pourquoi cette pratique est-elle dangereuse ?

C'est dangereux car n'importe quel utilisateur ayant accès à l'image peut inspecter les layers et récupérer des informations sensibles ou des mots de passe en clair.

### Question 25 — L'approche `COPY` / `RUN utilisation` / `RUN rm` est-elle correcte ?

**Non**, cette approche est incorrecte en sécurité. La suppression d'un fichier dans un layer ultérieur (`RUN rm`) masque simplement le fichier dans le conteneur final, mais ne l'efface pas des couches précédentes de l'image.

La bonne approche consiste à utiliser les **BuildKit Secrets** (`--mount=type=secret`). Ils permettent de monter le fichier de manière temporaire et sécurisée uniquement pendant la phase de construction du build.

`Dockerfile.secure` :

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app
RUN --mount=type=secret,id=mypass \
    echo "Longueur du secret : $(wc -c < /run/secrets/mypass) octets"
```

```bash
sudo docker build --progress=plain --no-cache --secret id=mypass,src=password.txt -f Dockerfile.secure -t docker-lab:secure .
```

```
#0 building with "default" instance using docker driver

#1 [internal] load build definition from Dockerfile.secure
#1 transferring dockerfile: 216B done
#1 DONE 0.0s

#2 resolve image config for docker-image://docker.io/docker/dockerfile:1
#2 DONE 1.7s

#3 docker-image://docker.io/docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
#3 resolve docker.io/docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e 0.0s done
#3 sha256:9d2b4f57f9e20f33279375ce25c6ff14f30f64270ed5c7b613b2b30256754f62 14.28MB / 14.28MB 0.8s done
#3 extracting sha256:9d2b4f57f9e20f33279375ce25c6ff14f30f64270ed5c7b613b2b30256754f62 0.1s done
#3 DONE 1.0s

#4 [internal] load metadata for docker.io/library/python:3.12-slim
#4 DONE 0.5s

#5 [internal] load .dockerignore
#5 transferring context: 176B done
#5 DONE 0.0s

#6 [stage-0 1/3] FROM docker.io/library/python:3.12-slim@sha256:05cda9777409a9c3ffddd94a4c476b79f0769a0b4857f0c7ed9226b6800b0d6f
#6 resolve docker.io/library/python:3.12-slim@sha256:05cda9777409a9c3ffddd94a4c476b79f0769a0b4857f0c7ed9226b6800b0d6f done
#6 DONE 0.0s

#7 [stage-0 2/3] WORKDIR /app
#7 CACHED

#8 [stage-0 3/3] RUN --mount=type=secret,id=mypass     echo "Longueur du secret : $(wc -c < /run/secrets/mypass) octets"
#8 0.219 Longueur du secret : 24 octets
#8 DONE 0.2s

#9 exporting to image
#9 exporting layers 0.0s done
#9 exporting manifest sha256:0b845da9055410ed6e67547e910abbe7f0251dedffd7bbaf333ff80683e7480b done
#9 exporting config sha256:041a4055fe405c260de269bff2c3e038cc97c240e4c5236337e189b567ee3b48 done
#9 exporting attestation manifest sha256:a7772f82bfe6f74e36752acdfe780a772831fccada322cc7a8d5f95edf86054f done
#9 exporting manifest list sha256:0adfc84c06b26cf669f235ed8faa09d7539180483a772346e7b39d774c7d24cb done
#9 naming to docker.io/library/docker-lab:secure done
#9 unpacking to docker.io/library/docker-lab:secure 0.0s done
#9 DONE 0.1s
```

Le secret a bien été lu pendant le build (`24 octets`). On vérifie ensuite qu'il n'a laissé aucune trace dans l'image :

```bash
sudo docker save docker-lab:secure -o docker-secure.tar
sudo chown $USER:$USER docker-secure.tar
mkdir -p docker-image-secure && tar -xf docker-secure.tar -C docker-image-secure
python3 find-in-layers.py docker-image-secure mypass
python3 find-in-layers.py docker-image-secure password
sudo docker history --no-trunc docker-lab:secure | grep -i super
```

---

## Partie 11 — Bonus : `.dockerignore`

### Fichier `.dockerignore`

```
.git
.gitignore
docker-lab.tar
docker-secret.tar
docker-image/
docker-image-secret/
__pycache__/
*.pyc
.env
password.txt
REPONSES.md
```

> Pendant la partie 10, la ligne `password.txt` avait été remplacée par `!password.txt` pour pouvoir copier le fichier. Le préfixe `!` est une **exception** : il force l'inclusion du fichier au lieu de l'exclure. La ligne a été remise à `password.txt` avant les mesures ci-dessous.

### Commandes

```bash
# Correction du .dockerignore
sed -i 's/^!password.txt$/password.txt/' .dockerignore
cat .dockerignore

# 1. SANS .dockerignore
mv .dockerignore .dockerignore.off
sudo docker builder prune -af          # vide le cache de build pour une mesure équitable
time sudo docker build --progress=plain --no-cache -f Dockerfile.v3 -t docker-lab:noignore . 2>&1 | grep -E "load .dockerignore|transferring context|real"
sudo docker run --rm docker-lab:noignore ls -la /app
sudo docker run --rm docker-lab:noignore cat /app/password.txt

# 2. AVEC .dockerignore
mv .dockerignore.off .dockerignore
sudo docker builder prune -af
time sudo docker build --progress=plain --no-cache -f Dockerfile.v3 -t docker-lab:ignore . 2>&1 | grep -E "load .dockerignore|transferring context|real"
sudo docker run --rm docker-lab:ignore ls -la /app
sudo docker run --rm docker-lab:ignore cat /app/password.txt

# 3. Comparaison des tailles
sudo docker images | grep -E "noignore|ignore|v1"
```

Le Dockerfile utilisé est `Dockerfile.v3` (`COPY . .`), qui copie tout le contexte de build : c'est le cas où l'effet du `.dockerignore` est le plus visible.

### Résultats sans `.dockerignore`

```
#3 [internal] load .dockerignore
#3 transferring context: 2B done
#5 transferring context: 193.18MB 0.9s done

real    0m12,247s
```

```
nicolas@containerorchestration:~/docker-lab$ sudo docker run --rm docker-lab:noignore ls -la /app
total 94408
drwxr-xr-x 1 root root     4096 Oct  6 16:05 .
drwxr-xr-x 1 root root     4096 Oct  6 16:05 ..
-rw-r--r-- 1 root root      133 Oct  6 16:05 .dockerignore.off
-rw-r--r-- 1 root root      185 Oct  6 14:16 Dockerfile
-rw-rw-r-- 1 root root      220 Oct  6 15:43 Dockerfile.secret
-rw-rw-r-- 1 root root      170 Oct  6 15:46 Dockerfile.secure
-rw-rw-r-- 1 root root      137 Oct  6 14:59 Dockerfile.v3
-rw-r--r-- 1 root root    30683 Oct  6 16:03 REPONSES.md
-rw-r--r-- 1 root root      212 Oct  6 14:19 app.py
-rw-rw-r-- 1 root root     1488 Oct  6 14:53 build-v2.log
-rw-rw-r-- 1 root root     3881 Oct  6 15:01 build-v3-a.log
-rw-rw-r-- 1 root root     3975 Oct  6 15:02 build-v3-b.log
drwxrwxr-x 3 root root     4096 Oct  6 15:21 docker-image
drwxrwxr-x 3 root root     4096 Oct  6 15:45 docker-image-secret
-rw------- 1 root root 48279040 Oct  6 15:21 docker-lab.tar
-rw------- 1 root root 48282112 Oct  6 15:45 docker-secret.tar
-rw-rw-r-- 1 root root      423 Oct  6 15:34 find-in-layers.py
-rw-rw-r-- 1 root root      649 Oct  6 14:58 layers-v1.txt
-rw-rw-r-- 1 root root      649 Oct  6 14:58 layers-v2.txt
-rw-r--r-- 1 root root       24 Oct  6 15:15 message.txt
-rw-rw-r-- 1 root root       24 Oct  6 15:43 password.txt
-rw-r--r-- 1 root root       13 Oct  6 14:16 requirements.txt

nicolas@containerorchestration:~/docker-lab$ sudo docker run --rm docker-lab:noignore cat /app/password.txt
SuperSecretPassword123!
```

Sans `.dockerignore` (`transferring context: 2B` : aucun fichier d'exclusion), tout le dossier est envoyé au démon puis copié dans l'image : les deux archives `.tar`, les dossiers `docker-image*` extraits, les logs, `REPONSES.md` et surtout **`password.txt`**, lisible en clair.

### Résultats avec `.dockerignore`

```
#3 [internal] load .dockerignore
#3 transferring context: 175B done
#4 transferring context: 12.77kB done

real    0m5,730s
```

```
nicolas@containerorchestration:~/docker-lab$ sudo docker run --rm docker-lab:ignore ls -la /app
total 64
drwxr-xr-x 1 root root 4096 Oct  6 16:05 .
drwxr-xr-x 1 root root 4096 Oct  6 16:05 ..
-rw-r--r-- 1 root root  133 Oct  6 16:05 .dockerignore
-rw-r--r-- 1 root root  185 Oct  6 14:16 Dockerfile
-rw-rw-r-- 1 root root  220 Oct  6 15:43 Dockerfile.secret
-rw-rw-r-- 1 root root  170 Oct  6 15:46 Dockerfile.secure
-rw-rw-r-- 1 root root  137 Oct  6 14:59 Dockerfile.v3
-rw-r--r-- 1 root root  212 Oct  6 14:19 app.py
-rw-rw-r-- 1 root root 1488 Oct  6 14:53 build-v2.log
-rw-rw-r-- 1 root root 3881 Oct  6 15:01 build-v3-a.log
-rw-rw-r-- 1 root root 3975 Oct  6 15:02 build-v3-b.log
-rw-rw-r-- 1 root root  423 Oct  6 15:34 find-in-layers.py
-rw-rw-r-- 1 root root  649 Oct  6 14:58 layers-v1.txt
-rw-rw-r-- 1 root root  649 Oct  6 14:58 layers-v2.txt
-rw-r--r-- 1 root root   24 Oct  6 15:15 message.txt
-rw-r--r-- 1 root root   13 Oct  6 14:16 requirements.txt

nicolas@containerorchestration:~/docker-lab$ sudo docker run --rm docker-lab:ignore cat /app/password.txt
cat: /app/password.txt: No such file or directory
```

### Comparaison des images

```
nicolas@containerorchestration:~/docker-lab$ sudo docker images | grep -E "noignore|ignore|v1"
docker-lab:ignore     628f71eaa5d5        198MB         48.3MB
docker-lab:noignore   a8dfcc790b22        583MB          240MB
docker-lab:v1         fae2a7f5d550        198MB         48.3MB   U
```

| Critère | Sans `.dockerignore` | Avec `.dockerignore` | Gain |
|---|---|---|---|
| Contexte de build transféré | **193,18 Mo** | **12,77 kB** | ÷ 15 000 environ |
| Durée du build | **12,2 s** | **5,7 s** | ×2,1 plus rapide |
| Taille de l'image (DISK USAGE) | **583 Mo** | **198 Mo** | −385 Mo |
| Taille compressée (CONTENT SIZE) | **240 Mo** | **48,3 Mo** | ÷ 5 |
| `password.txt` dans l'image | **Oui, lisible en clair** | **Non** | Fuite évitée |

### Question 26 — Rôle du fichier `.dockerignore`

Il permet d'exclure certains fichiers et dossiers superflus ou sensibles du **contexte de build** envoyé au démon Docker.

### Question 27 — Impact du `.dockerignore`

- **Sécurité** : empêche d'inclure des fichiers sensibles (`.env`, secrets, clés privées). Sans `.dockerignore`, `password.txt` a été embarqué dans l'image et lu en clair avec un simple `cat` ; avec, le fichier est absent (`No such file or directory`).
- **Taille du contexte de build** : réduit la taille des données transmises au démon Docker, ici de **193,18 Mo à 12,77 kB**. Par effet de bord avec `COPY . .`, l'image passe de **583 Mo à 198 Mo**, soit la même taille que l'image v1.
- **Vitesse du build** : accélère la phase de construction (build), ici de **12,2 s à 5,7 s**, car il y a moins de données à envoyer au démon puis à écrire dans le layer `COPY`.

Le `.dockerignore` reste une protection complémentaire : il évite les erreurs de copie, mais ne remplace pas une vraie gestion des secrets (`--mount=type=secret`, injection au runtime).

---

## Nettoyage

```bash
sudo docker rm -f docker-lab
sudo docker rmi docker-lab:v3 docker-lab:secret docker-lab:secure docker-lab:noignore docker-lab:ignore
rm -rf docker-image docker-image-secret docker-image-secure *.tar *.log layers-v*.txt password.txt .dockerignore.off
rm Dockerfile.v3 Dockerfile.secret Dockerfile.secure find-in-layers.py
ls -la
```

Contenu final du livrable :

```
docker-lab/
├── app.py
├── requirements.txt
├── message.txt
├── Dockerfile
├── .dockerignore
└── REPONSES.md
```
