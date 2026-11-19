# Projet K8S : inventaire et plan (version la plus simple)

Rendu et soutenance : **11 janvier 2027** (rendu avant 23h59).

## 1. Ce qu'on déploie

7 composants, d'après `appscore/docker-compose.yml` :

| App | Image | Rôle | Dépend de | Port |
|---|---|---|---|---|
| web | à construire (`Web/Dockerfile`) | site ASP.NET MVC | identity.api, jobs.api | 80 |
| jobs.api | à construire | API offres d'emploi | sql.data, rabbitmq | 80 |
| applicants.api | à construire | API candidats | sql.data, rabbitmq | 80 |
| identity.api | à construire | API utilisateurs | user.data, rabbitmq | 80 |
| sql.data | à construire (`Database/Dockerfile`) | SQL Server 2017 + script de création des bases | — | 1433 |
| user.data | `redis` (officielle) | cache utilisateurs | — | 6379 |
| rabbitmq | `rabbitmq:3-management` (officielle) | bus de messages entre APIs | — | 5672 (+15672 admin) |

Seul **web** doit être accessible de l'extérieur (en HTTPS). Tout le reste reste interne au cluster.

## 2. Points techniques déjà vérifiés

- **Les Dockerfile fournis fonctionnent tels quels** : les images `mcr.microsoft.com/dotnet/core/*:2.1` et `mssql/server:2017-latest` sont toujours téléchargeables, ainsi que les paquets NuGet (MassTransit). Aucune modification de code nécessaire.
- **Les noms avec un point sont interdits en Kubernetes** : un Service ne peut pas s'appeler `jobs.api`. On nomme les Services `jobs-api`, `sql-data`, `user-data`, etc., et on surcharge la configuration par variables d'environnement (ASP.NET Core les lit automatiquement, `__` = niveau de section) :

  | App | Variable | Valeur |
  |---|---|---|
  | web | `ApiSettings__IdentityApiUrl` | `http://identity-api` |
  | web | `ApiSettings__JobsApiUrl` | `http://jobs-api` |
  | jobs-api | `ConnectionString` | `Server=sql-data;User=sa;Password=Pass@word;Database=dotnetgigs.jobs;` |
  | applicants-api | `ConnectionString` | `Server=sql-data;User=sa;Password=Pass@word;Database=dotnetgigs.applicants;` |
  | identity-api | `RedisHost` | `user-data:6379` |
  | les 3 API | `HostRabbitmq` | `rabbitmq` |
  | toutes les apps .NET | `Logging__LogLevel__Default` | `Information` (sinon presque aucun log pour la partie EFK) |

- **Pas d'endpoint `/health`** dans les apps : les sondes utiliseront le port TCP 80, ou une route existante (`/` pour web, `/api/jobs` pour jobs-api, `/api/applicants` pour applicants-api).
- **Ordre de démarrage** : pas de `depends_on` en Kubernetes. Si RabbitMQ ou SQL ne sont pas prêts, les APIs plantent puis redémarrent automatiquement jusqu'à ce que ça marche. C'est normal.
- **Question à poser au prof (rôle du développeur)** : le sujet dit que web consomme `applicants.api`, mais la config de web ne contient que `IdentityApiUrl` et `JobsApiUrl`.

## 3. Ressources : VM et cluster

### VM Ubuntu (réglée)

| | Valeur | État |
|---|---|---|
| CPU | 6 | ✅ |
| RAM | 15 Go (+ 4 Go de swap) | ✅ |
| Disque `/` | 48 Go (30 Go libres) | ✅ (volume LVM agrandi avec `lvextend`) |

### Cluster minikube

minikube tourne dans un conteneur Docker : Kubernetes ne dispose que de ce qu'on donne à ce conteneur, pas de toute la VM. Ces valeurs sont fixées à la création du cluster (changer = `minikube delete` puis recréer).

```bash
minikube delete
minikube start --cpus=4 --memory=11g --disk-size=40g
minikube addons enable metrics-server     # ✅ activé
minikube addons enable ingress            # ⬜ à activer (étape HTTPS)
```

| Option | Valeur | Pourquoi |
|---|---|---|
| `--cpus` | 4 sur 6 | il reste 2 CPU à la VM pour les `docker build` .NET |
| `--memory` | 11 Go sur 15 | ~8,5 Go de réservations pour le projet (tableau ci-dessous) + marge ; il reste ~4 Go pour Ubuntu, Docker, VS Code |
| `--disk-size` | 40 Go | images SQL Server, .NET, Elasticsearch, Kibana (~6 Go) + données + logs |

> Avec le driver docker, `kubectl describe node` affiche les ressources de **toute la VM** (6 CPU, 16 Go) dans `Allocatable`, pas les limites du conteneur. La vraie limite est celle du conteneur : `docker inspect minikube --format '{{.HostConfig.Memory}}'` (11 Go). Conséquence : Kubernetes ne bloquera pas les pods en `Pending` au-delà de 11 Go, mais le conteneur manquerait de mémoire. Garder la somme des requests sous ~10 Go.

### Budget mémoire du projet (requests)

| Bloc | Réplicas | Requests |
|---|---|---|
| web (imposé : 900Mi) | 2 | 1,8 Go |
| jobs-api, applicants-api, identity-api (imposé : 500Mi chacun) | 2 chacun | 3 Go |
| user.data (imposé : 500Mi) | 1 | 0,5 Go |
| sql.data (non imposé, minimum Microsoft) | 1 | 2 Go |
| rabbitmq | 1 | 0,25 Go |
| Elasticsearch (heap 512 Mo) + Kibana + Fluent Bit | 1 | ~1,3 Go |
| Prometheus + kube-state-metrics + node-exporter | 1 | ~0,4 Go |
| Kubernetes (kube-system) | — | ~0,4 Go |
| **Total** | | **~9,6 Go** |

Marge pour l'HPA : chaque pod web supplémentaire réserve 900Mi. Garder l'HPA de web à `maxReplicas: 3` (ou passer en `minReplicas: 1`) pour rester sous 11 Go.

Les requests sont des **réservations**, pas la consommation réelle : une API .NET consomme ~100 à 150 Mo. À montrer à la soutenance avec `kubectl top pods`.

## 4. Inventaire des exigences du sujet → solution la plus simple

| # | Exigence | Solution simple retenue |
|---|---|---|
| 1 | Images de conteneur | Dockerfile fournis **sans modification**, `docker build` sur la VM |
| 2 | Registry privé | Docker Hub. Le compte gratuit n'autorise **qu'un seul repo privé** : un repo `<user>/dotnetgigs` avec un **tag par app** (`:web`, `:jobs-api`, `:applicants-api`, `:identity-api`, `:sql-data`). Secret `imagePullSecret` dans le cluster |
| 3 | Cluster | **minikube local, 1 nœud** (autorisé : « AKS ou en local ») |
| 4 | Déploiements | 1 Deployment + 1 Service par app (Services en `ClusterIP`) |
| 5 | Réplicas / haute dispo | web et les 3 APIs : 2 réplicas. sql.data, user.data, rabbitmq : 1 |
| 6 | Étiquettes | `app: <nom>`, `tier: frontend / backend / data`, `project: dotnetgigs` sur tout |
| 7 | Volume physique | PVC pour sql.data (données SQL) |
| 8 | Requests / limits CPU, mémoire, **disque** | Valeurs du sujet + `ephemeral-storage` (ex. request 100Mi, limit 1Gi). sql.data : request 2Gi / limit 3Gi ; rabbitmq : 256Mi / 512Mi (non imposés) |
| 9 | Redémarrage automatique | Déjà le cas avec un Deployment (`restartPolicy: Always`) + livenessProbe |
| 10 | Affinités | `podAffinity` en **`preferredDuringScheduling`** (pas `required`, sinon pods bloqués) : web → jobs-api/applicants-api ; jobs-api/applicants-api → sql-data ; identity-api → user-data. Sur 1 nœud elles sont toujours satisfaites : l'expliquer à l'oral |
| 11 | HPA | Sur **web** (CPU 50 %, 2 → 3 réplicas, voir budget §3) |
| 12 | Démo de charge | Pod `busybox` qui fait des `wget` en boucle (comme `k8s/hello/load-generator.yml`) + `kubectl get hpa -w` |
| 13 | Sondes | readiness + liveness sur chaque Deployment (HTTP ou TCP, voir §2) |
| 14 | Métriques | addon `metrics-server` + chart Helm **`prometheus-community/prometheus`** (inclut Prometheus, kube-state-metrics, node-exporter, et scrape l'apiserver = métriques du plan de contrôle), sans alertmanager ni pushgateway. Accès Prometheus par port-forward |
| 15 | HTTPS uniquement | addon `ingress` (contrôleur nginx, **hors du chart**) + certificat **auto-signé** `openssl` → Secret TLS → Ingress avec `tls:` sur `dotnetgigs.local`. Redirection HTTP→HTTPS automatique avec nginx |
| 16 | ServiceAccount + RBAC | SA `jobs-api-sa` + Role minimal (lecture des ConfigMaps du namespace) + RoleBinding |
| 17 | NetworkPolicy | default-deny + autorisations : ingress-nginx → web ; web → identity-api/jobs-api(/applicants-api) ; jobs-api/applicants-api → sql-data ; identity-api → user-data ; les 3 APIs → rabbitmq. Le réseau de minikube (kindnet) les applique (testé sur `k8s/wordpress`) |
| 18 | Logs EFK | Elasticsearch **1 nœud sans sécurité** (heap 512 Mo) + Kibana (2 Deployments simples) + **Fluent Bit** (chart Helm `fluent/fluent-bit`, DaemonSet) qui envoie les logs des conteneurs vers Elasticsearch |
| 19 | Dashboard Kibana | Data view sur l'index de Fluent Bit, puis : 1 dashboard « logs de jobs-api dans le temps » (filtre `kubernetes.labels.app: jobs-api`) + 1 recherche sauvegardée « erreurs » (`log: *fail* or *error* or *exception*`) |
| 20 | Helm | `helm create dotnetgigs`, on vide les templates d'exemple et on y met nos manifestes. `values.yaml` = registry, tags, réplicas, ressources, host de l'Ingress. **Pas** de contrôleur ingress dedans |
| 21 | README | build des images, déploiement sur cluster vierge, URLs, commandes de vérification |
| 22 | Schéma d'architecture | draw.io (ou Mermaid exporté en PNG) : apps, Services, Ingress, flux internes/externes |
| 23 | AUTHORS.TXT | prénom nom par ligne + responsabilités |
| 24 | Rendu | dépôt Git, adresse envoyée à vincent.leclerc@ynov.com |

**Astuce la plus simple pour l'ensemble** : écrire directement le **chart Helm** (les templates = les manifestes), au lieu de faire des manifestes puis de les convertir. Le livrable accepte « manifestes **ou** templates Helm ». Prometheus et EFK sont installés à part (charts publics + quelques yml), avec leurs fichiers de config dans le dépôt.

## 5. Structure de dépôt proposée

```
projet_k8s/
├── appscore/                     code + Dockerfile fournis (inchangés)
├── helm/dotnetgigs/              le chart de l'application
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── web.yaml              Deployment + Service + HPA
│       ├── jobs-api.yaml         Deployment + Service (+ ServiceAccount/RBAC)
│       ├── applicants-api.yaml
│       ├── identity-api.yaml
│       ├── sql-data.yaml         Deployment + Service + PVC
│       ├── user-data.yaml
│       ├── rabbitmq.yaml
│       ├── ingress.yaml          Ingress HTTPS
│       └── networkpolicies.yaml
├── monitoring/
│   └── prometheus-values.yaml    config du chart prometheus-community/prometheus
├── logging/
│   ├── elasticsearch.yaml
│   ├── kibana.yaml
│   └── fluent-bit-values.yaml
├── scripts/
│   ├── build-push.sh             build + push des 5 images
│   ├── gen-cert.sh               certificat auto-signé + Secret TLS
│   └── load-generator.yaml       démo HPA
├── docs/architecture.png
├── README.md
└── AUTHORS.TXT
```

## 6. Plan de travail dans l'ordre

1. ✅ **Préparer la VM** : 6 CPU, 15 Go, disque agrandi, minikube recréé (4 CPU / 11 Go / 40 Go), metrics-server activé. Reste : `minikube addons enable ingress`.
2. ⬜ **Images** : `docker build` des 5 images depuis `appscore/` (contexte `./` comme dans le compose, `./Database` pour SQL), test rapide avec `docker compose up`, puis tag et push sur Docker Hub (repo privé unique).
3. ⬜ **App de base** : templates Helm de sql-data, user-data, rabbitmq, puis des 3 APIs, puis de web. `helm install` → tout en `Running`, le site s'affiche via port-forward.
4. ⬜ **Exigences « pod »** : ressources, sondes, labels, affinités, PVC.
5. ⬜ **HTTPS** : certificat, Secret TLS, Ingress, `dotnetgigs.local` dans le fichier hosts de l'hôte.
6. ⬜ **Sécurité** : ServiceAccount + RBAC, NetworkPolicies (tester que le site marche toujours).
7. ⬜ **HPA** + démo de charge (capture d'écran ou vidéo pour la soutenance).
8. ⬜ **Prometheus** : `helm install`, vérifier les cibles (Status → Targets) et quelques requêtes (CPU des pods, état des nœuds, `apiserver_request_total`).
9. ⬜ **EFK** : Elasticsearch + Kibana + Fluent Bit, dashboard et recherche d'erreurs.
10. ⬜ **Docs** : README, schéma, AUTHORS.TXT, répétition de la soutenance (20 min).

Les étapes 2 et 3 sont le cœur du projet : tant que l'appli ne tourne pas dans le cluster, le reste ne peut pas être démontré.
