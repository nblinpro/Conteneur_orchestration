# Projet Kubernetes : dotnetgigs

Groupe : Nicolas Blin, Nolan DERUELLE (voir [AUTHORS.TXT](AUTHORS.TXT)). Sujet : [projet.md](projet.md).

Déploiement sur Kubernetes (minikube) de l'application **dotnetgigs** fournie par l'enseignant :
un site web, 3 API REST, une base SQL Server, un Redis et un RabbitMQ.
L'application est installée avec un chart Helm, exposée en HTTPS par un Ingress (contrôleur Traefik),
surveillée par Prometheus, et ses logs sont centralisés dans une pile EFK (Elasticsearch, Fluent Bit, Kibana).

![Architecture](docs/architecture.png)

## Sommaire

1. [Contenu du dossier](#1-contenu-du-dossier)
2. [Les applications](#2-les-applications)
3. [Où est traitée chaque partie du sujet](#3-où-est-traitée-chaque-partie-du-sujet)
4. [Prérequis](#4-prérequis)
5. [Builder et publier les images](#5-builder-et-publier-les-images)
6. [Déployer sur un cluster vierge](#6-déployer-sur-un-cluster-vierge)
7. [Accéder aux applications](#7-accéder-aux-applications)
8. [Vérifier l'état du cluster](#8-vérifier-létat-du-cluster)
9. [Supprimer et relancer la stack](#9-supprimer-et-relancer-la-stack)
10. [Démonstrations](#10-démonstrations)
11. [Choix techniques](#11-choix-techniques)
12. [Mots de passe et chiffrement (SOPS)](#12-mots-de-passe-et-chiffrement-sops)

## 1. Contenu du dossier

```
projet_k8s_bis/
├── appscore/                       code des applications + Dockerfile fournis par l'enseignant
├── helm/
│   ├── 00-namespace.yml            namespace dotnetgigs (créé avant le chart, étape 2)
│   ├── secrets.enc.yaml            mot de passe SQL, chiffré avec SOPS (section 12)
│   └── dotnetgigs/                 chart Helm de l'application
│       ├── Chart.yaml              nom et version du chart
│       ├── values.yaml             valeurs modifiables : image, domaine, réplicas, ressources
│       └── templates/              un fichier numéroté par élément (même découpage que k8s/wordpress)
│           ├── 01-secret.yml           mot de passe SQL et chaînes de connexion
│           ├── 02-storage.yml          disque persistant de SQL Server (PVC)
│           ├── 03-sql-data.yml         SQL Server        (Deployment + Service)
│           ├── 04-user-data.yml        Redis             (Deployment + Service)
│           ├── 05-rabbitmq.yml         RabbitMQ          (Deployment + Service)
│           ├── 06-jobs-api.yml         API offres        (Deployment + Service)
│           ├── 07-applicants-api.yml   API candidats     (Deployment + Service)
│           ├── 08-identity-api.yml     API identité      (Deployment + Service)
│           ├── 09-web.yml              site web          (Deployment + Service)
│           ├── 10-hpa.yml              autoscaling de web
│           ├── 11-networkpolicies.yml  pare-feu entre les pods
│           ├── 12-ingress.yml          entrée HTTPS du site
│           └── 13-rbac.yml             compte à droits limités pour jobs-api
├── traefik/traefik-values.yaml     réglages du contrôleur d'ingress Traefik (installé hors du chart)
├── monitoring/prometheus-values.yaml   réglages de Prometheus
├── logging/
│   ├── elasticsearch.yaml          stockage des logs
│   ├── kibana.yaml                 interface de recherche et dashboards
│   ├── fluent-bit-values.yaml      collecte des logs des conteneurs
│   └── kibana-objects.ndjson       dashboard + recherche d'erreurs à importer dans Kibana
├── scripts/load-generator.yml      pod qui génère de la charge (démo de l'HPA)
├── docs/architecture.png           schéma d'architecture (source : architecture.svg)
├── .sops.yaml                      configuration de SOPS (clé publique de chiffrement)
├── AUTHORS.TXT                     membres du groupe et responsabilités
└── projet.md                       sujet
```

## 2. Les applications

| Application | Rôle | Image | Adresse dans le cluster | Pods |
|---|---|---|---|---|
| web | le site | `nicoter04/dotnetgigs_bd:web` | `web:80` (et de l'extérieur via l'Ingress) | 2 → 3 (HPA) |
| jobs-api | API des offres d'emploi | `nicoter04/dotnetgigs_bd:jobs-api` | `jobs-api:80` | 2 |
| applicants-api | API des candidats | `nicoter04/dotnetgigs_bd:applicants-api` | `applicants-api:80` | 2 |
| identity-api | API d'authentification | `nicoter04/dotnetgigs_bd:identity-api` | `identity-api:80` | 2 |
| sql-data | base SQL Server | `nicoter04/dotnetgigs_bd:sql-data` | `sql-data:1433` | 1 (disque persistant) |
| user-data | Redis (utilisateurs) | `redis:7-alpine` | `user-data:6379` | 1 |
| rabbitmq | bus de messages entre les API | `rabbitmq:3-management` | `rabbitmq:5672` | 1 |

Les noms `jobs.api`, `user.data`... du docker-compose deviennent `jobs-api`, `user-data`... :
le point est interdit dans un nom de Service Kubernetes. Les adresses des API dans le code de web sont donc
remplacées par des variables d'environnement (`ApiSettings__JobsApiUrl=http://jobs-api`...).

Namespaces : `dotnetgigs` (application), `traefik` (contrôleur d'ingress), `monitoring` (Prometheus), `logging` (EFK).

## 3. Où est traitée chaque partie du sujet

| Partie du sujet | Fichier(s) | En bref |
|---|---|---|
| Conteneur | `appscore/*/Dockerfile` | images poussées dans le repo privé Docker Hub `nicoter04/dotnetgigs_bd` |
| Hébergement | `templates/03` à `09` | un Deployment + un Service par application, labels `app` et `tier` |
| Seul web ouvert à l'extérieur | `templates/12-ingress.yml` | tous les Services sont internes (ClusterIP), l'Ingress expose uniquement web |
| Ressources (requests / limits) | `values.yaml` (section `resources`) | valeurs du sujet réunies au même endroit ; CPU, mémoire et disque (`ephemeral-storage`) |
| Redémarrage automatique | `livenessProbe` + Deployment | un conteneur qui ne répond plus est redémarré |
| Affinités | `affinity:` dans `06` à `09` | web → API ; jobs-api / applicants-api → sql-data ; identity-api → user-data |
| Scalabilité | `templates/10-hpa.yml` | web passe de 2 à 3 pods quand le CPU monte |
| Sondes | `readinessProbe` / `livenessProbe` | dans chaque Deployment |
| Métriques | `monitoring/prometheus-values.yaml` | Prometheus + kube-state-metrics + node-exporter + metrics-server |
| HTTPS | `templates/12-ingress.yml` + `traefik/traefik-values.yaml` | contrôleur Traefik, certificat auto-signé, HTTP redirigé vers HTTPS |
| ServiceAccount + RBAC | `templates/13-rbac.yml` | jobs-api ne peut que lire les ConfigMaps |
| NetworkPolicy | `templates/11-networkpolicies.yml` | seules les API parlent à SQL ; seul web parle à identity-api |
| Logs (EFK) | `logging/` | Fluent Bit → Elasticsearch → Kibana (dashboard + recherche d'erreurs) |
| Déploiement automatisé | `helm/dotnetgigs/` | toute l'application en une commande, sans contrôleur d'ingress |
| Mots de passe | `helm/secrets.enc.yaml` | mot de passe SQL chiffré avec SOPS + age (section 12) |

## 4. Prérequis

- Une machine ou VM Linux : 6 CPU, 15 Go de RAM, 50 Go de disque conseillés.
- Docker, minikube, kubectl (ou `minikube kubectl --`), Helm 3 ou plus.
- Un compte Docker Hub avec le repo privé `dotnetgigs_bd`, et `docker login -u nicoter04` fait sur la machine.
- **sops** et **age**, pour déchiffrer le mot de passe SQL (binaires officiels, sans droits root) :

```bash
mkdir -p ~/.local/bin
curl -Lo ~/.local/bin/sops https://github.com/getsops/sops/releases/download/v3.13.3/sops-v3.13.3.linux.amd64
chmod +x ~/.local/bin/sops
curl -L https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz | tar xz -C /tmp
cp /tmp/age/age /tmp/age/age-keygen ~/.local/bin/
source ~/.profile
sops --version ; age --version
```

- **La clé privée age** dans `~/.config/sops/age/keys.txt` (transmise à part, jamais dans Git : voir section 12).

Toutes les commandes suivantes se lancent depuis le dossier `projet_k8s_bis`.

## 5. Builder et publier les images

Les Dockerfile fournis sont utilisés tels quels. Le contexte de build est `appscore/` (comme dans le docker-compose d'origine), sauf pour SQL Server.

```bash
cd appscore
docker build -f Web/Dockerfile                    -t nicoter04/dotnetgigs_bd:web .
docker build -f Services/Jobs.Api/Dockerfile       -t nicoter04/dotnetgigs_bd:jobs-api .
docker build -f Services/Applicants.Api/Dockerfile -t nicoter04/dotnetgigs_bd:applicants-api .
docker build -f Services/Identity.Api/Dockerfile   -t nicoter04/dotnetgigs_bd:identity-api .
docker build -t nicoter04/dotnetgigs_bd:sql-data ./Database

docker login -u nicoter04
docker push nicoter04/dotnetgigs_bd:web
docker push nicoter04/dotnetgigs_bd:jobs-api
docker push nicoter04/dotnetgigs_bd:applicants-api
docker push nicoter04/dotnetgigs_bd:identity-api
docker push nicoter04/dotnetgigs_bd:sql-data
cd ..
```

Docker Hub gratuit n'autorise qu'un seul repo privé : les 5 images sont dans le même repo, avec un tag différent.

## 6. Déployer sur un cluster vierge

### Étape 1 : cluster + contrôleur Traefik

```bash
minikube start --cpus=4 --memory=11g --disk-size=40g
minikube addons enable metrics-server
helm repo add traefik https://traefik.github.io/charts
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add fluent https://fluent.github.io/helm-charts
helm repo update
helm upgrade --install traefik traefik/traefik --version 42.4.1 -n traefik --create-namespace -f traefik/traefik-values.yaml
kubectl rollout status deploy/traefik -n traefik --timeout=180s
```

metrics-server mesure le CPU des pods (utilisé par l'HPA). Traefik est le contrôleur d'ingress : il est installé à part, hors du chart de l'application (exigence du sujet).

### Étape 2 : namespace + accès au repo privé

```bash
kubectl apply -f helm/00-namespace.yml
kubectl create secret generic dockerhub-secret -n dotnetgigs --from-file=.dockerconfigjson=$HOME/.docker/config.json --type=kubernetes.io/dockerconfigjson
```

Le namespace est créé avant le chart, car les 2 Secrets de cette étape et de la suivante doivent y être rangés avant l'installation.
Le Secret `dockerhub-secret` reprend les identifiants enregistrés par `docker login` : il n'est pas dans le chart pour ne pas mettre de mot de passe dans Git.

### Étape 3 : certificat HTTPS auto-signé

```bash
mkdir -p certs
openssl req -x509 -nodes -newkey rsa:2048 -days 365 -keyout certs/tls.key -out certs/tls.crt -subj "/CN=dotnetgigs.local" -addext "subjectAltName=DNS:dotnetgigs.local"
kubectl create secret tls dotnetgigs-tls -n dotnetgigs --cert=certs/tls.crt --key=certs/tls.key
```

La première commande crée la clé privée (`tls.key`) et le certificat (`tls.crt`) ; la seconde les range dans le Secret `dotnetgigs-tls` utilisé par l'Ingress.
Le dossier `certs/` n'est pas envoyé sur Git (il contient la clé privée).

### Étape 4 : l'application (chart Helm)

```bash
sops exec-file helm/secrets.enc.yaml 'helm upgrade --install dotnetgigs helm/dotnetgigs -n dotnetgigs -f {}'
kubectl get pods -n dotnetgigs -w
```

`sops exec-file` déchiffre `helm/secrets.enc.yaml` dans un fichier temporaire, remplace `{}` par son chemin, lance `helm`, puis efface le fichier.
Sans ce fichier, Helm s'arrête avec le message « sqlPassword manquant ».

Attendre que les 11 pods soient en `1/1 Running` (2 à 3 minutes), puis quitter avec `Ctrl+C`.
Quelques redémarrages des API au début sont normaux : elles plantent tant que SQL Server et RabbitMQ ne sont pas prêts, puis Kubernetes les relance automatiquement.

### Étape 5 : Prometheus

```bash
helm upgrade --install prometheus prometheus-community/prometheus --version 29.47.2 -n monitoring --create-namespace -f monitoring/prometheus-values.yaml
```

### Étape 6 : logs (EFK)

```bash
kubectl apply -f logging/elasticsearch.yaml
kubectl apply -f logging/kibana.yaml
kubectl wait --for=condition=Ready pod -l app=elasticsearch -n logging --timeout=300s
helm upgrade --install fluent-bit fluent/fluent-bit --version 0.58.3 -n logging -f logging/fluent-bit-values.yaml
kubectl wait --for=condition=Ready pod -l app=kibana -n logging --timeout=300s
```

Fluent Bit est installé seulement quand Elasticsearch est prêt : sinon les premiers logs sont perdus. Puis l'import du dashboard Kibana :

```bash
kubectl port-forward -n logging svc/kibana 5601:5601 &
sleep 3
curl -X POST "http://localhost:5601/api/saved_objects/_import?overwrite=true" -H "kbn-xsrf: true" --form file=@logging/kibana-objects.ndjson
kill %1
```

La réponse doit contenir `"successCount":5,"success":true`.

## 7. Accéder aux applications

minikube tourne dans une VM : on ouvre un port-forward par outil (un terminal chacun).

```bash
kubectl port-forward --address 0.0.0.0 -n traefik svc/traefik 8443:443
kubectl port-forward --address 0.0.0.0 -n monitoring svc/prometheus-server 9090:80
kubectl port-forward --address 0.0.0.0 -n logging svc/kibana 5601:5601
```

| Outil | Adresse depuis le PC |
|---|---|
| Site (HTTPS) | `https://dotnetgigs.local:8443` |
| Prometheus | `http://<IP de la VM>:9090` |
| Kibana | `http://<IP de la VM>:5601` |

Dans notre environnement, l'IP de la VM est `192.168.80.136`. Pour le site, ajouter dans le fichier hosts du PC
(`C:\Windows\System32\drivers\etc\hosts` sous Windows, `/etc/hosts` sous Linux) :

```
<IP de la VM>   dotnetgigs.local
```

Le certificat est auto-signé : le navigateur affiche une alerte, cliquer sur « Avancé » puis « Continuer ».

## 8. Vérifier l'état du cluster

```bash
kubectl get pods -A                                             # tous les pods (tout doit être Running)
kubectl get pods,svc,ingress,hpa,networkpolicy -n dotnetgigs    # l'application
kubectl top pods -n dotnetgigs                                  # CPU / mémoire de chaque pod
kubectl describe pod -n dotnetgigs -l app=web                   # détail d'un pod (sondes, événements)
kubectl logs -n dotnetgigs deploy/jobs-api --tail=20            # logs d'une application
helm list -A                                                    # ce qui est installé avec Helm

# RBAC : jobs-api-sa peut lire les ConfigMaps mais pas les Secrets
kubectl auth can-i get configmaps -n dotnetgigs --as=system:serviceaccount:dotnetgigs:jobs-api-sa   # yes
kubectl auth can-i list secrets   -n dotnetgigs --as=system:serviceaccount:dotnetgigs:jobs-api-sa   # no

# Logs bien arrivés dans Elasticsearch (visiter le site avant) : docs.count > 0
kubectl exec -n logging deploy/elasticsearch -c elasticsearch -- curl -s 'localhost:9200/_cat/indices/dotnetgigs-*?v'
```

**Prometheus** : menu Status → Target health (tout doit être `UP`), puis onglet Query :

| Ce qu'on regarde | Requête |
|---|---|
| Pods en marche (état du cluster, kube-state-metrics) | `sum by (namespace) (kube_pod_status_phase{phase="Running"})` |
| CPU de chaque pod (cAdvisor) | `sum by (pod) (rate(container_cpu_usage_seconds_total{namespace="dotnetgigs",container!=""}[2m]))` |
| Mémoire libre du nœud (node-exporter) | `node_memory_MemAvailable_bytes / 1e9` |
| Plan de contrôle (requêtes à l'API Kubernetes) | `sum(rate(apiserver_request_total[2m]))` |
| Réplicas de l'HPA | `kube_horizontalpodautoscaler_status_current_replicas{namespace="dotnetgigs"}` |

**Kibana** :
- Dashboards → « Service jobs-api » : les logs de jobs-api dans le temps, par niveau.
- Discover → Open → « Erreurs des services (level ERROR) » : les erreurs de toutes les applications.

## 9. Supprimer et relancer la stack

### Tout supprimer et repartir d'un cluster vierge

```bash
pkill -f port-forward          # arrête les port-forward encore ouverts
minikube delete                # supprime tout le cluster : application, Traefik, Prometheus, EFK, volumes
rm -rf certs                   # supprime l'ancien certificat
```

Restent en place : les images sur Docker Hub, le `docker login`, la clé age et les fichiers du projet.
Pour relancer : refaire la section 6 dans l'ordre (étapes 1 à 6), puis la section 7.

### Supprimer et relancer seulement l'application (sans recréer le cluster)

Traefik, Prometheus et EFK restent en place ; les données SQL sont effacées (le disque est supprimé avec le namespace).

```bash
helm uninstall dotnetgigs -n dotnetgigs
kubectl delete namespace dotnetgigs
```

Pour relancer : refaire les étapes 2, 3 et 4 de la section 6.

### Supprimer toute la stack sans supprimer le cluster

```bash
pkill -f port-forward
helm uninstall dotnetgigs -n dotnetgigs
helm uninstall fluent-bit -n logging
helm uninstall prometheus -n monitoring
helm uninstall traefik -n traefik
kubectl delete namespace dotnetgigs logging monitoring traefik
rm -rf certs
```

Pour relancer : refaire la section 6 à partir de l'étape 1 (le `minikube start` répond simplement que le cluster tourne déjà).

## 10. Démonstrations

**HPA** (2 terminaux) :

```bash
kubectl get hpa -n dotnetgigs -w                  # terminal 1 : on regarde
kubectl apply -f scripts/load-generator.yml       # terminal 2 : on lance la charge
kubectl delete -f scripts/load-generator.yml      # on arrête la charge
```

Après environ 1 minute, web passe de 2 à 3 pods. Il redescend à 2 environ 5 minutes après l'arrêt.

**Redémarrage automatique** : `kubectl delete pod -n dotnetgigs -l app=jobs-api` → les pods sont recréés tout de suite.

**HTTPS** : `http://dotnetgigs.local` est redirigé (301) vers `https://dotnetgigs.local`.

**NetworkPolicy** : un pod de test ne peut pas joindre SQL Server (seules les API le peuvent) :

```bash
kubectl run test --rm -it --image=busybox:1.36 -n dotnetgigs -- nc -zv -w 3 sql-data 1433
# => Connection timed out
```

**Erreurs dans Kibana** : arrêter SQL Server, recharger le site (erreur), puis ouvrir la recherche « Erreurs des services ».

```bash
kubectl scale deploy/sql-data -n dotnetgigs --replicas=0
kubectl scale deploy/sql-data -n dotnetgigs --replicas=1
```

**Helm** : changer une valeur puis revenir en arrière.

```bash
sops exec-file helm/secrets.enc.yaml 'helm upgrade dotnetgigs helm/dotnetgigs -n dotnetgigs -f {} --set apiReplicas=1'
helm history dotnetgigs -n dotnetgigs
helm rollback dotnetgigs 1 -n dotnetgigs
```

## 11. Choix techniques

### Ingress : Traefik + HTTPS

| Point | Choix | Raison |
|---|---|---|
| Exposition | tous les Services en `ClusterIP`, un seul Ingress vers `web` | un seul point d'entrée ; API, base, Redis et RabbitMQ restent invisibles de l'extérieur |
| Contrôleur | **Traefik** (chart officiel), `ingressClassName: traefik` | même contrôleur que notre TP WordPress ; installé hors du chart, comme demandé |
| HTTPS | bloc `tls:` + Secret `dotnetgigs-tls` (certificat auto-signé) | exigence du sujet ; le Secret est créé à la main car il contient la clé privée |
| HTTP | redirection sur l'entrée `web` de Traefik (`traefik-values.yaml`) | toute requête HTTP est redirigée (301) vers HTTPS |
| Entrée du site | annotation `router.entrypoints: websecure` | le site n'est servi que sur l'entrée HTTPS |
| Nom de domaine | `dotnetgigs.local` (valeur `host` de `values.yaml`) | modifiable à l'installation pour un autre cluster |

Écartés : un Service `NodePort`/`LoadBalancer` sur web (pas de HTTPS centralisé) ; les Middlewares Traefik du TP WordPress
(inutiles : un seul chemin `/`) ; le certificat dans le chart (la clé privée serait dans Git).

### NetworkPolicies : protéger les pods sensibles

Sans NetworkPolicy, tous les pods peuvent se parler. Dès qu'une NetworkPolicy sélectionne un pod, ce pod n'accepte plus
que le trafic entrant qu'elle autorise.

| Règle | Pods protégés | Seuls autorisés | Port |
|---|---|---|---|
| `sql-data-from-api` | `app: sql-data` | `app: jobs-api`, `app: applicants-api` | 1433 |
| `identity-api-from-web` | `app: identity-api` | `app: web` | 80 |

Ce sont les deux exemples du sujet, écrits avec le label `app` déjà présent sur chaque pod. Le modèle « tout bloquer
puis ouvrir » du TP WordPress demanderait au moins 6 règles ici (une par flux) : nous avons gardé 2 règles lisibles et suffisantes.
Le plugin réseau de minikube (kindnet) applique bien ces règles.

### Ressources centralisées dans values.yaml

Les requests / limits de toutes les applications sont dans la section `resources` de `values.yaml` :
les valeurs du sujet se vérifient au même endroit, et chaque Deployment les recopie avec `toYaml .Values.resources.<app>`.
Elles se modifient sans toucher aux modèles, par exemple `--set resources.web.limits.memory=3000Mi`.

### Stockage

Seul SQL Server a un disque persistant (`02-storage.yml`, 2Gi) : ses bases doivent survivre au redémarrage du pod.
web et les API sont sans état (leurs données sont dans SQL ou Redis), ce qui permet de les multiplier et de les scaler.
Elasticsearch et Prometheus ont chacun leur propre disque.

## 12. Mots de passe et chiffrement (SOPS)

| Secret | Où il est | Dans Git ? |
|---|---|---|
| Mot de passe SQL Server | `helm/secrets.enc.yaml`, **chiffré** avec SOPS + age | oui, chiffré |
| Identifiants Docker Hub | Secret `dockerhub-secret`, créé à la main depuis `~/.docker/config.json` (étape 2) | non |
| Clé privée du certificat HTTPS | dossier `certs/` + Secret `dotnetgigs-tls` (étape 3) | non (`.gitignore`) |
| Clé privée age (déchiffrement) | `~/.config/sops/age/keys.txt` | **non, jamais** |

Chemin du mot de passe SQL :
`secrets.enc.yaml` (chiffré) → déchiffré par `sops exec-file` → `values.yaml` (`sqlPassword`, vide par défaut) →
Secret `dotnetgigs-secrets` (`01-secret.yml`) → variables d'environnement des pods (`secretKeyRef`).

**La clé age** : `helm/secrets.enc.yaml` est chiffré pour la clé publique écrite dans `.sops.yaml`. Pour le déchiffrer, il faut la clé privée
correspondante dans `~/.config/sops/age/keys.txt`. Elle est transmise à part aux personnes autorisées (membres du groupe, enseignant).
Sans elle, on peut installer en donnant le mot de passe à la main : `helm upgrade --install dotnetgigs helm/dotnetgigs -n dotnetgigs --set sqlPassword=...`

```bash
sops decrypt helm/secrets.enc.yaml     # afficher le contenu déchiffré
sops edit helm/secrets.enc.yaml        # modifier (ouvre un éditeur, rechiffre à l'enregistrement)
```

**Limite connue** : le mot de passe est aussi écrit en dur dans le code fourni (`appscore/Database/Dockerfile` et `SqlCmdStartup.sh`,
qui crée les bases). Le changer côté Kubernetes casserait la création des bases : il faudrait d'abord que ce script lise la variable
`SA_PASSWORD`, puis reconstruire l'image sql-data.
