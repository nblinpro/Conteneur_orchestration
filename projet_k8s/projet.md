# Projet Conteneurisation et Orchestration

Vous allez faire un projet conteneur et orchestration utilisant les technolgies de votre choix pour la partie conteneur et Kubernetes pour la partie orchestration.

# I- Sujet

## Applications 

L'objectif est le déploiement, la maintenance et la mise à jour de différents micro-services REST et applications web dans un environnement conteneurisé, avec un orchestrateur Kubernetes afin d'assurer la haute disponibilité des apps.

## Ce qui est fournis

Pour ce projet, je jouerais le rôle du développeur. Vous pourrez donc me poser des questions sur le fonctionnement des apps, ce qu'elles ont besoin en terme de ressources et de liaisons. Si il le faut, je pourrais modifier le code des applications afin de les adapter à votre système (tant que ça reste de la configuration). Les applications sont disponibles sur le [git](https://github.com/bart120/m2cloud26/tree/main/projet_k8s/appscore) du cours.
Description des apps:
- web => application web qui consomme les services applicants.api et jobs.api
- applicants.api => service API REST fournissant des données d'une base de données.
- identity.api => service API REST fournissant une authentification
- jobs.api => service API REST fournissant des données d'une base de données.
- sql.data => base données SqlServer et données
- rabbitmq => fournis une communication entre les services API REST

Les relations sont décrites dans le fichier docker-compose. C'est avec une bonne analyse de ce fichier que vous pourrez connaitre les liens entre chaques applications et les variables d'environement.

## Conteneur

Vous devrez créer les fichiers afin de générer des images de conteneur de chaque app. Les apps étant réalisées sur des technos différentes, il vous faudra bien préparer les images pour que les apps s'éxécutent sans problèmes (image de base, ouverture de port, mise en réseau..). Les Dockerfile de chaque éléments vous sont fournis.
Les images devront par la suite être envoyées vers un repo d'images privé (dockerhub ou azure).


## Hébergement

Les apps devront être déployées dans Kubernetes. C'est à vous qu'appartient le choix de tous les paramètres (taille du cluster, nombre de noeuds, nombre de replicat, réseau virtuel, volume physique, pods, services, ingress...) nécessaires pour chaque app.
La mise en réseau des conteneurs devra se faire dans le cluster, seule les apps ayant besoin d'être appelées de l'extérieur devront être ouverte à la communication extérieure.
N'oublier pas d'utiliser les étiquettes afin d'organiser vos éléments de manière plus simple.

Le cluster de production devra être un cluster manager sur Azure (AKS) ou en local.

## Performance

Afin de ne pas avoir de problèmes de surcharge, chaque pod devra avoir une limite de consommation CPU, mémoire et disque ainsi que des demandes de ressources définies.
Les pods devront également redémarrer automatiquement si ils tombent.
Il vous faudra définir des "règles d'affinité" entre vos éléments afin d'en améliorer les performances dans les échanges.
Ressources par app:
- web => CPU 4m, MEM 900Mi
- applicants.api => CPU 0.5, MEM 500Mi
- identity.api => CPU 0.5, MEM 500Mi
- jobs.api => CPU 0.5, MEM 500Mi
- user.data => CPU 4m, MEM 500Mi

Ressources limittes par app:
- web => CPU 1, MEM 2000Mi
- applicants.api => CPU 1, MEM 1500Mi
- identity.api => CPU 1, MEM 1500Mi
- jobs.api => CPU 1, MEM 1500Mi

Affinité:
- Web => jobs.api et applicants.api
- jobs.api et applicants.api => sql.data
- identity.api => user.data

Scalabilité

Mettre en place un Horizontal Pod Autoscaler (HPA) sur au moins un service (par ex. web ou applicants.api), basé sur l’utilisation CPU (ou autre métrique disponible).

Démontrer (même de manière simple avec un outil de charge) que les replicas augmentent lorsque la charge augmente.

## Bilan de santé

Votre cluster devra être sous surveillance!  Vous devrez réaliser "un bilan de santé" de votre cluster en métant en place les sondes de préparation et les sondes de vivacité.
De même vous devrez mettre en place les mesures par métrique, les métriques de l'état du cluster, les métriques de ressources des noeuds et des pods ainsi que [les métriques de travail du plan de contrôle](https://kubernetes.io/docs/concepts/cluster-administration/system-metrics) (Metrics server et kube-state-metrics).
Les données seront affichées dans un Prometheus, installé au préalable sur le cluster.

## Sécurité

Vos apps devront être accessible uniquement par le protocole https de l'exterieur. Il vous faudra donc générer un [certificat](https://kubernetes.io/docs/tasks/tls/managing-tls-in-a-cluster) (auto-signé) SSL, et l'associer à votre cluster.

Utiliser un ServiceAccount dédié pour au moins un des microservices, avec des droits restreints (RBAC).

Mettre en place au moins une NetworkPolicy pour limiter les communications :
Par exemple : seule web peut appeler identity.api, seules les API peuvent parler à sql.data, etc.

## Logs

Les apps font remonter des logs dans la sortie standard. Afin de pouvoir les exploiter correctement il vous faudra mettre en place une pile complète (EFK ou ELK) afin de fournir une gestion de logs avancée.
Exploitation des logs
Mettre en place une stack de logs centralisée (ELK ou EFK).
Créer au moins :
  - un dashboard (Kibana/Opensearch…) montrant les logs d’un service donné sur une période
  - un filtre/recherche permettant de retrouver les erreurs d’un service (level=ERROR, HTTP 5xx…)

## Déploiement automatisé

Afin d'automatiser le déploiement sur d'autres clusters, vous allez mettre en place un système de déploiement automatisé via [HELM](https://helm.sh/docs/helm/helm_create/).
Votre paquet HEML devra contenir la création des pods, déploiements, services, ingress mais pas de controleur d'ingress.


# Groupes et fonctionnement

Le projet est a faire en groupe de 3 ou 4 personnes (ou seul).
Tous les groupes seront définis en cours, sous la supervision de l'enseignant. Les groupes s'enregistrent avec un nom de groupe ainsi que les noms de leurs membres.

Toute inscription est définitive.  Les étudiants ne sont pas autorisés, par la suite, à changer de groupe.

Au sein d'un groupe, les étudiants se répartiront les tâches pour le projet, de façon équitable.  Il est explicitement exigé que chaque membre consacre au moins 50% de son travail à du technique.

Les étudiants sont encouragés (mais pas obligés) à mettre en place un système de contrôle des sources de type Git ou équivalent, afin d'affecter et partager efficacement les fichiers de codes et autres composants numériques du projet (fichiers sources, descripteurs de déploiement, documents de recherche, cas d'utilisation, etc.).

# Soutenance et rendu

La soutenance aura lieux le 11 janvier 2027.
Le rendu se fera le 11 janvier 2027 à 23h59 maxi.
Les horaires de passage sont définis pour chaque groupe.
Toute absence à la soutenance entrainera un 0 (ZERO) pour le membre du groupe.

Les rendus doivent figurer sur un seul compte par groupe.
Le rendu s'effectu via un repos GIT ou SVN. L'adresse du rendu est envoyé par mail.
Le mail de rendu est vincent.leclerc@ynov.com
Les fichiers rendus doivent contenir
  - Les fichiers et documents techniques du projet.
  - Un AUTHORS.TXT listant les membres du groupe (prénom, nom), à raison d'un par ligne.  Il liste ensuite les responsabilités effectives de chacun dans le groupe.
Le sujet du mail doit contenir votre section ainsi que le nom du projet.
Les fichiers rendus peuvent aussi comprendre: 
  - Des documents de recherche créés pour le projet et fournissant plus de détails pour l'enseignant.
Pour tout autre type de fichier, veuillez demander à l'enseignant si son inclusion est appropriée.
La soutenance dure 20 minutes durant lesquelles les membres présentent leur travail. Un échange de questions peut se faire entre le professeur et les membres du groupe.

Livrable :
  - Un référentiel Git contenant :
    - Les Dockerfile de chaque service
    - Les manifestes Kubernetes (ou les templates Helm)
    - Le chart Helm complet
    - Les fichiers de configuration Prometheus + stack de logs (EFK/ELK)

  - Un fichier README.md expliquant :
    - Comment builder les images
    - Comment déployer le projet sur un cluster vierge
    - Comment accéder aux différentes applications (URL, ports, ingress)
    - Comment vérifier l’état du cluster (commandes kubectl, dashboards…)

  - Un schéma d’architecture (image ou PDF) montrant :
    - Les microservices et leurs dépendances
    - Les services Kubernetes, ingress, base de données, bus MQ, etc.
    - Les flux réseau principaux (interne cluster / externe)

Les groupes sont les suivants:
- 
- 
- 
- 
- 
- 
- 
- 
- 

Les horaires de passage des groupes sont les suivants:
   


Pour ceux dont le groupe n'est pas dans la liste, contactez-moi très rapidement à vincent.leclerc@ynov.com