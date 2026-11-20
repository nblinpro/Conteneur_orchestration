# Sources et documentation du projet

Liste des sources utilisées pour construire ce projet, classées par thème, avec ce qu'il faut y lire.
Tous les liens ont été vérifiés le 20/11/2026.

## Ce qu'il faut savoir sur ces sources

Deux types de sources ont servi :

1. **Les sources lues directement pendant le projet** (section 1) : le sujet, le code fourni, nos TP précédents,
   les réglages par défaut des charts Helm et les pages de téléchargement des outils.
2. **Les documentations officielles de référence** (sections 2 à 10) : les objets et options utilisés dans le projet
   viennent de ces documentations. Elles n'ont pas toutes été ouvertes page par page pendant le travail, mais
   c'est là que chaque notion est expliquée officiellement : ce sont les pages à lire pour comprendre ou vérifier un choix.

## 1. Sources lues directement pendant le projet

| Source | Ce qu'on en a tiré |
|---|---|
| [`projet.md`](../projet.md) (sujet de l'enseignant) | toutes les exigences : ressources, affinités, HPA, sondes, HTTPS, RBAC, NetworkPolicy, EFK, Helm, livrables |
| `appscore/docker-compose.yml` | la liste des services, leurs ports, leurs variables d'environnement (`ConnectionString`, `HostRabbitmq`, `RedisHost`) et leurs dépendances |
| `appscore/*/Dockerfile` | comment builder chaque image (contexte `appscore/`, sauf SQL Server) |
| `appscore/Database/Dockerfile`, `SqlCmdStartup.sh`, `SqlCmdScript.sql` | le mot de passe imposé `Pass@word` et le nom des bases `dotnetgigs.jobs` / `dotnetgigs.applicants` |
| `appscore/Web/appsettings.json` | les adresses des API (`ApiSettings`) à remplacer par variables d'environnement |
| `appscore/Services/*/Startup.cs`, `JobsController.cs` | les échanges RabbitMQ (jobs-api publie `ApplicantAppliedEvent`, applicants-api et identity-api le reçoivent) |
| `k8s/wordpress/` (notre TP précédent) | le découpage en fichiers numérotés, le modèle d'Ingress Traefik et de NetworkPolicy |
| `helm show values traefik/traefik --version 42.4.1` | les options du chart Traefik (entrées `web` / `websecure`, redirection HTTP vers HTTPS) |
| [Releases sops v3.13.3](https://github.com/getsops/sops) et [age v1.3.2](https://github.com/FiloSottile/age) | les binaires installés (somme de contrôle de sops vérifiée) |

## 2. Kubernetes (documentation officielle)

| Notion | Lien | Utilisé dans |
|---|---|---|
| Namespaces | <https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/> | `helm/00-namespace.yml` |
| Labels et sélecteurs | <https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/> | labels `app` / `tier` partout |
| Deployment | <https://kubernetes.io/docs/concepts/workloads/controllers/deployment/> | `templates/03` à `09` |
| Service (ClusterIP) | <https://kubernetes.io/docs/concepts/services-networking/service/> | `templates/03` à `09` |
| Ingress | <https://kubernetes.io/docs/concepts/services-networking/ingress/> | `templates/12-ingress.yml` |
| NetworkPolicy | <https://kubernetes.io/docs/concepts/services-networking/network-policies/> | `templates/11-networkpolicies.yml` |
| Secret | <https://kubernetes.io/docs/concepts/configuration/secret/> | `templates/01-secret.yml`, `dotnetgigs-tls` |
| Image d'un registre privé (`imagePullSecrets`) | <https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/> | `dockerhub-secret` (README, étape 2) |
| PersistentVolume / PVC | <https://kubernetes.io/docs/concepts/storage/persistent-volumes/> | `templates/02-storage.yml` |
| Requests / limits (CPU, mémoire, `ephemeral-storage`) | <https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/> | `values.yaml` (section `resources`) |
| Sondes readiness / liveness | <https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/> | chaque Deployment, Elasticsearch et Kibana |
| Affinité entre pods (`podAffinity`) | <https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/> | `templates/06` à `09` |
| HorizontalPodAutoscaler | <https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/> | `templates/10-hpa.yml` |
| Démo de l'HPA avec un générateur de charge | <https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/> | `scripts/load-generator.yml` |
| RBAC (Role, RoleBinding) | <https://kubernetes.io/docs/reference/access-authn-authz/rbac/> | `templates/13-rbac.yml` |
| ServiceAccount | <https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/> | `templates/13-rbac.yml` |
| Métriques du plan de contrôle (lien du sujet) | <https://kubernetes.io/docs/concepts/cluster-administration/system-metrics/> | Prometheus |
| Certificats TLS dans un cluster (lien du sujet) | <https://kubernetes.io/docs/tasks/tls/managing-tls-in-a-cluster/> | certificat HTTPS |
| `kubectl port-forward` | <https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/> | accès depuis le PC |
| Aide-mémoire kubectl | <https://kubernetes.io/docs/reference/kubectl/quick-reference/> | toutes les commandes de vérification |

## 3. minikube

| Notion | Lien |
|---|---|
| Installation et démarrage | <https://minikube.sigs.k8s.io/docs/start/> |
| Driver docker (minikube dans un conteneur) | <https://minikube.sigs.k8s.io/docs/drivers/docker/> |
| Addons (metrics-server) | <https://minikube.sigs.k8s.io/docs/handbook/addons/> |

## 4. Helm

| Notion | Lien | Utilisé dans |
|---|---|---|
| Utiliser Helm (install, upgrade, repos) | <https://helm.sh/docs/intro/using_helm/> | README, section 7 |
| Créer un chart (premiers modèles) | <https://helm.sh/docs/chart_template_guide/getting_started/> | `helm/dotnetgigs/` |
| Fichier `values.yaml` | <https://helm.sh/docs/chart_template_guide/values_files/> | `values.yaml` |
| Fonctions des modèles (`required`, `quote`...) | <https://helm.sh/docs/chart_template_guide/function_list/> | `templates/01-secret.yml` |
| Astuces (`toYaml`, `nindent`, `include`) | <https://helm.sh/docs/howto/charts_tips_and_tricks/> | `templates/03` à `09` (ressources) |
| Dépendances d'un chart (chart parapluie) | <https://helm.sh/docs/helm/helm_dependency/> | `helm/observabilite/Chart.yaml` |
| `helm upgrade --install` | <https://helm.sh/docs/helm/helm_upgrade/> | README |
| `helm create` (lien du sujet) | <https://helm.sh/docs/helm/helm_create/> | structure du chart |
| `helm rollback` | <https://helm.sh/docs/helm/helm_rollback/> | démonstration Helm |

## 5. Traefik (contrôleur d'ingress)

| Notion | Lien | Utilisé dans |
|---|---|---|
| Ingress Kubernetes avec Traefik (annotations comme `router.entrypoints`) | <https://doc.traefik.io/traefik/routing/providers/kubernetes-ingress/> | `templates/12-ingress.yml` |
| Entrypoints et redirection HTTP → HTTPS | <https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/> | `traefik/traefik-values.yaml` |
| Chart Helm officiel de Traefik | <https://github.com/traefik/traefik-helm-chart> | README, étape 1 |

## 6. Monitoring (Prometheus)

| Notion | Lien | Utilisé dans |
|---|---|---|
| Chart Helm `prometheus-community/prometheus` | <https://github.com/prometheus-community/helm-charts/tree/main/charts/prometheus> | `helm/observabilite/values.yaml` (section `prometheus`) |
| Requêtes PromQL | <https://prometheus.io/docs/prometheus/latest/querying/basics/> | README, section 9 |
| kube-state-metrics (état du cluster) | <https://github.com/kubernetes/kube-state-metrics> | Prometheus |
| node-exporter (ressources du nœud) | <https://github.com/prometheus/node_exporter> | Prometheus |
| metrics-server (CPU pour l'HPA, `kubectl top`) | <https://github.com/kubernetes-sigs/metrics-server> | addon minikube |

## 7. Logs (EFK : Elasticsearch, Fluent Bit, Kibana)

| Notion | Lien | Utilisé dans |
|---|---|---|
| Elasticsearch en conteneur (single-node, mémoire Java) | <https://www.elastic.co/guide/en/elasticsearch/reference/8.15/docker.html> | `helm/observabilite/templates/01-elasticsearch.yml` |
| Kibana en conteneur | <https://www.elastic.co/guide/en/kibana/8.15/docker.html> | `helm/observabilite/templates/02-kibana.yml` |
| API d'import des objets Kibana | <https://www.elastic.co/guide/en/kibana/8.15/saved-objects-api-import.html> | import de `helm/observabilite/kibana-objects.ndjson` |
| Syntaxe des recherches Kibana (KQL) | <https://www.elastic.co/guide/en/kibana/8.15/kuery-query.html> | recherche « Erreurs des services » |
| Fluent Bit : lecture des fichiers (`tail`) | <https://docs.fluentbit.io/manual/pipeline/inputs/tail> | `helm/observabilite/values.yaml` (section `fluent-bit`) |
| Fluent Bit : messages sur plusieurs lignes | <https://docs.fluentbit.io/manual/pipeline/filters/multiline-stacktrace> | idem |
| Fluent Bit : script Lua | <https://docs.fluentbit.io/manual/pipeline/filters/lua> | idem (champ `level`) |
| Fluent Bit : infos Kubernetes | <https://docs.fluentbit.io/manual/pipeline/filters/kubernetes> | idem |
| Fluent Bit : envoi à Elasticsearch (`Retry_Limit`...) | <https://docs.fluentbit.io/manual/pipeline/outputs/elasticsearch> | idem |
| Chart Helm officiel de Fluent Bit | <https://github.com/fluent/helm-charts> | dépendance de `helm/observabilite/` |

## 8. Secrets et sécurité

| Notion | Lien | Utilisé dans |
|---|---|---|
| SOPS (documentation) | <https://getsops.io/docs/> | `.sops.yaml`, `helm/secrets.enc.yaml` |
| SOPS (dépôt et releases) | <https://github.com/getsops/sops> | installation (README, section 4) |
| age (clés de chiffrement) | <https://github.com/FiloSottile/age> | `~/.config/sops/age/keys.txt` |
| `openssl req` (certificat auto-signé) | <https://docs.openssl.org/3.0/man1/openssl-req/> | README, étape 3 |
| Tokens d'accès GitHub (pour `git push`) | <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens> | push du dépôt |

## 9. Docker et images

| Notion | Lien | Utilisé dans |
|---|---|---|
| `docker build` | <https://docs.docker.com/reference/cli/docker/buildx/build/> | README, section 5 |
| `docker push` | <https://docs.docker.com/reference/cli/docker/image/push/> | README, section 5 |
| Repos Docker Hub (privé, collaborateurs) | <https://docs.docker.com/docker-hub/repos/> | repo `nicoter04/dotnetgigs_bd` |
| Tokens d'accès Docker Hub (lecture seule pour l'enseignant) | <https://docs.docker.com/security/access-tokens/> | accès du correcteur aux images |
| Image Redis officielle | <https://hub.docker.com/_/redis> | `templates/04-user-data.yml` |
| Image RabbitMQ officielle | <https://hub.docker.com/_/rabbitmq> | `templates/05-rabbitmq.yml` |
| SQL Server en conteneur (`ACCEPT_EULA`, `SA_PASSWORD`) | <https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-docker-container-deployment> | `templates/03-sql-data.yml` |

## 10. Application .NET

| Notion | Lien | Utilisé dans |
|---|---|---|
| Configuration ASP.NET Core par variables d'environnement (séparateur `__`) | <https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/> | `ApiSettings__JobsApiUrl`, `Logging__Console__LogLevel__Default` |

## 11. Outils

| Notion | Lien |
|---|---|
| Git dans VS Code (fenêtre de saisie des identifiants en haut de l'écran) | <https://code.visualstudio.com/docs/sourcecontrol/overview> |
