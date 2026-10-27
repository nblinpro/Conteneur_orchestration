# WordPress / MySQL / phpMyAdmin sous Kubernetes (minikube)

Passage sous minikube de la stack Docker Compose WordPress + MySQL + phpMyAdmin.
Tout est déployé dans le namespace `wordpress`. Chaque fichier est commenté ligne par ligne.

## Fichiers

```
k8s/docker-compose_kube/
├── namespace.yml                namespace wordpress
├── secret.example.yml           modèle des mots de passe (commité)
├── secret.yml                   mots de passe réels (à créer, ignoré par git)
├── database-deployment.yml      MySQL : PVC + Deployment + Service interne
├── phpmyadmin-deployment.yml    phpMyAdmin : Deployment + Service LoadBalancer (8080)
├── wordpress-deployment.yml     WordPress : PVC + Deployment + HPA + Service LoadBalancer (80)
└── load-generator.yml           pod qui charge WordPress pour tester l'HPA
```

| Fichier | Objets Kubernetes | Rôle |
|---|---|---|
| `namespace.yml` | Namespace | isole toute la stack, permet de tout supprimer d'un coup |
| `secret.yml` | Secret `wordpress-secret` | mots de passe, lus par les pods avec `secretKeyRef` |
| `database-deployment.yml` | PVC `mysql-pvc`, Deployment, Service `database-service` (ClusterIP) | base MySQL, données persistantes, jamais exposée hors du cluster |
| `phpmyadmin-deployment.yml` | Deployment, Service `phpmyadmin-service` (LoadBalancer) | interface d'administration de MySQL |
| `wordpress-deployment.yml` | PVC `wordpress-pvc`, Deployment, HPA, Service `wordpress-service` (LoadBalancer) | le site, mis à l'échelle de 1 à 3 pods selon le CPU |
| `load-generator.yml` | Pod | génère du trafic pour déclencher l'HPA |

## Équivalences Docker Compose → Kubernetes

| Docker Compose | Kubernetes |
|---|---|
| un service | un Deployment (les pods) + un Service (nom DNS stable) |
| `.env` (`ROOT_PWD`, `WP_DB`, `WP_USER`, `WP_PASSWORD`) | Secret `wordpress-secret`, mêmes clés |
| `environment:` | `env:` (valeurs directes ou lues dans le Secret) |
| volume `mysql_data` (bind) | PersistentVolumeClaim `mysql-pvc` |
| bind `wordpress_volume:/var/www/html` | PersistentVolumeClaim `wordpress-pvc` |
| `PMA_HOST=database`, `WORDPRESS_DB_HOST=database` | `database-service` |
| `ports: 8080:80` / `80:80` | Services `LoadBalancer` + `port-forward` |
| réseau `backend` (base non publiée) | Service `database-service` en `ClusterIP` |
| `depends_on` | n'existe pas : WordPress et phpMyAdmin réessaient seuls |
| `container_name` | inutile : les pods sont nommés par le Deployment |

Les bind mounts sur `/home/nicolas/docker/data/...` sont remplacés par des PVC : avec minikube, un dossier de la VM n'est pas visible depuis le cluster.

## Prérequis

```bash
minikube start
minikube addons enable metrics-server   # nécessaire pour l'HPA
```

## Lancer

Depuis `k8s/docker-compose_kube`, dans cet ordre :

```bash
# 1. Mots de passe : créer secret.yml à partir du modèle (une seule fois)
cp secret.example.yml secret.yml        # puis remplacer les valeurs "changeme"

# 2. Le namespace d'abord : les autres ressources sont créées dedans
minikube kubectl -- apply -f namespace.yml

# 3. Le Secret avant les Deployments qui le lisent
minikube kubectl -- apply -f secret.yml

# 4. La base, puis les applications
minikube kubectl -- apply -f database-deployment.yml
minikube kubectl -- apply -f phpmyadmin-deployment.yml
minikube kubectl -- apply -f wordpress-deployment.yml
```

Au premier lancement, le téléchargement des images (`mysql`, `wordpress`, `phpmyadmin`) prend quelques minutes.

## Vérifier

```bash
minikube kubectl -- get all,pvc,hpa -n wordpress                # pods Running, PVC Bound
minikube kubectl -- get pods -n wordpress -w                    # suivre les pods en direct
minikube kubectl -- logs -n wordpress -l app=database           # MySQL : "ready for connections"
minikube kubectl -- logs -n wordpress -l app=wordpress          # logs Apache de WordPress
minikube kubectl -- describe pod -n wordpress -l app=wordpress  # section Events si un pod bloque
minikube kubectl -- top pods -n wordpress                       # CPU / RAM
minikube kubectl -- get secret wordpress-secret -n wordpress -o jsonpath='{.data.ROOT_PWD}' | base64 -d
                                                                # lire une valeur du Secret
```

## Accéder depuis l'hôte (minikube dans une VM)

Les Services `LoadBalancer` restent en `EXTERNAL-IP <pending>` sur minikube, et l'IP de minikube n'est visible que depuis la VM.
On ouvre donc un port de la VM vers chaque Service, un terminal par commande, à laisser ouverts :

```bash
minikube kubectl -- port-forward --address 0.0.0.0 -n wordpress svc/wordpress-service 8000:80
minikube kubectl -- port-forward --address 0.0.0.0 -n wordpress svc/phpmyadmin-service 8080:8080
```

- WordPress : `http://<IP de la VM>:8000` (le port 80 demanderait `sudo`)
- phpMyAdmin : `http://<IP de la VM>:8080`, avec l'utilisateur `WP_USER` ou `root` et les mots de passe du Secret

WordPress enregistre l'URL utilisée lors de l'installation : toujours y accéder par la même adresse ensuite.

## Tester l'autoscaling

```bash
minikube kubectl -- apply -f load-generator.yml    # lancer la charge
minikube kubectl -- get hpa -n wordpress -w        # le nombre de réplicas monte (max 3)
minikube kubectl -- delete -f load-generator.yml   # arrêter la charge
```

Après l'arrêt de la charge, l'HPA attend environ 5 minutes avant de retirer des pods.

## Modifier un mot de passe

Modifier `secret.yml`, puis :

```bash
minikube kubectl -- apply -f secret.yml
minikube kubectl -- rollout restart deployment -n wordpress   # les pods relisent le Secret
```

MySQL ne lit `MYSQL_*` qu'au premier démarrage, quand son volume est vide : pour une base déjà créée, changer le mot de passe dans MySQL lui-même (phpMyAdmin).

## Tout supprimer

```bash
minikube kubectl -- delete namespace wordpress   # supprime aussi les volumes et les données
```
