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

## 3. ⚠️ Prérequis bloquant : ressources de la VM

Ta VM actuelle : **4 CPU, 7,7 Go de RAM, 8,8 Go de disque libre**. C'est insuffisant.

| Bloc | Mémoire réservée (requests) |
|---|---|
| web + 3 APIs + user.data (imposés par le sujet) | 900 + 3×500 + 500 = **2,9 Go** |
| SQL Server (minimum Microsoft) | **2 Go** |
| RabbitMQ | ~0,3 Go |
| Elasticsearch + Kibana + Fluent Bit | ~1,8 Go |
| Prometheus + kube-state-metrics + node-exporter | ~0,5 Go |
| Kubernetes lui-même | ~0,7 Go |
| **Total** | **~8,2 Go** pour minikube seul |

Côté disque : images .NET SDK (~1,7 Go pour le build), SQL Server (~1,5 Go), Elasticsearch (~1,2 Go), Kibana (~1 Go)…, soit ~10 Go.

**À faire avant tout** : passer la VM à **12 Go de RAM minimum** (16 recommandé) et **50 Go de disque** (dans l'hyperviseur, puis agrandir la partition LVM), puis :

```bash
minikube delete
minikube start --cpus=4 --memory=10g --disk-size=40g
minikube addons enable metrics-server
minikube addons enable ingress
```

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
| 8 | Requests / limits CPU, mémoire, **disque** | Valeurs du sujet + `ephemeral-storage` (ex. request 100Mi, limit 1Gi). Choisir des valeurs pour sql.data (2Gi) et rabbitmq (non imposées) |
| 9 | Redémarrage automatique | Déjà le cas avec un Deployment (`restartPolicy: Always`) + livenessProbe |
| 10 | Affinités | `podAffinity` en **`preferredDuringScheduling`** (pas `required`, sinon pods bloqués) : web → jobs-api/applicants-api ; jobs-api/applicants-api → sql-data ; identity-api → user-data. Sur 1 nœud elles sont toujours satisfaites : l'expliquer à l'oral |
| 11 | HPA | Sur **web** (CPU 50 %, 2 → 5 réplicas) |
| 12 | Démo de charge | Pod `busybox` qui fait des `wget` en boucle (comme `k8s/hello/load-generator.yml`) + `kubectl get hpa -w` |
| 13 | Sondes | readiness + liveness sur chaque Deployment (HTTP ou TCP, voir §2) |
| 14 | Métriques | addon `metrics-server` + chart Helm **`prometheus-community/prometheus`** (inclut Prometheus, kube-state-metrics, node-exporter, et scrape l'apiserver = métriques du plan de contrôle). Accès Prometheus par port-forward |
| 15 | HTTPS uniquement | addon `ingress` (contrôleur nginx, **hors du chart**) + certificat **auto-signé** `openssl` → Secret TLS → Ingress avec `tls:` sur `dotnetgigs.local`. Redirection HTTP→HTTPS automatique avec nginx |
| 16 | ServiceAccount + RBAC | SA `jobs-api-sa` + Role minimal (lecture des ConfigMaps du namespace) + RoleBinding |
| 17 | NetworkPolicy | default-deny + autorisations : ingress-nginx → web ; web → identity-api/jobs-api(/applicants-api) ; jobs-api/applicants-api → sql-data ; identity-api → user-data ; les 3 APIs → rabbitmq. Le réseau de minikube (kindnet) les applique (testé sur `k8s/wordpress`) |
| 18 | Logs EFK | Elasticsearch **1 nœud sans sécurité** + Kibana (2 Deployments simples) + **Fluent Bit** (chart Helm `fluent/fluent-bit`, DaemonSet) qui envoie les logs des conteneurs vers Elasticsearch |
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

1. **Préparer la VM** : RAM, disque, minikube recréé, addons (§3).
2. **Images** : `docker build` des 5 images depuis `appscore/` (contexte `./` comme dans le compose, `./Database` pour SQL), test rapide avec `docker compose up`, puis tag et push sur Docker Hub (repo privé unique).
3. **App de base** : templates Helm de sql-data, user-data, rabbitmq, puis des 3 APIs, puis de web. `helm install` → tout en `Running`, le site s'affiche via port-forward.
4. **Exigences « pod »** : ressources, sondes, labels, affinités, PVC.
5. **HTTPS** : certificat, Secret TLS, Ingress, `dotnetgigs.local` dans le fichier hosts de l'hôte.
6. **Sécurité** : ServiceAccount + RBAC, NetworkPolicies (tester que le site marche toujours).
7. **HPA** + démo de charge (capture d'écran ou vidéo pour la soutenance).
8. **Prometheus** : `helm install`, vérifier les cibles (Status → Targets) et quelques requêtes (CPU des pods, état des nœuds, `apiserver_request_total`).
9. **EFK** : Elasticsearch + Kibana + Fluent Bit, dashboard et recherche d'erreurs.
10. **Docs** : README, schéma, AUTHORS.TXT, répétition de la soutenance (20 min).

Les étapes 1 à 3 sont le cœur du projet : tant que l'appli ne tourne pas dans le cluster, le reste ne peut pas être démontré.
