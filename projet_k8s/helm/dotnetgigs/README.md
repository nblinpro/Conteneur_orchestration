# helm/dotnetgigs/ : chart Helm de l'application

Crée toute l'application dotnetgigs en une commande (pods, Deployments, Services, Ingress...),
sans le contrôleur d'ingress, comme l'exige le sujet.

```
dotnetgigs/
├── Chart.yaml        nom et version du chart
├── values.yaml       valeurs modifiables : image, domaine, nombre de pods des API,
│                     mot de passe SQL (vide : vient de ../secrets.enc.yaml), ressources de chaque application
└── templates/        un fichier numéroté par élément (même découpage que le TP k8s/wordpress)
    ├── 01-secret.yml             Secret : mot de passe SQL et chaînes de connexion des API
    ├── 02-storage.yml            PersistentVolumeClaim : disque persistant de SQL Server (2Gi)
    ├── 03-sql-data.yml           SQL Server        : Deployment + Service (port 1433)
    ├── 04-user-data.yml          Redis             : Deployment + Service (port 6379)
    ├── 05-rabbitmq.yml           RabbitMQ          : Deployment + Service (port 5672)
    ├── 06-jobs-api.yml           API offres        : Deployment + Service (port 80), ServiceAccount dédié
    ├── 07-applicants-api.yml     API candidats     : Deployment + Service (port 80)
    ├── 08-identity-api.yml       API identité      : Deployment + Service (port 80)
    ├── 09-web.yml                site web          : Deployment + Service (port 80)
    ├── 10-hpa.yml                HorizontalPodAutoscaler : web de 2 à 3 pods selon le CPU
    ├── 11-networkpolicies.yml    NetworkPolicies : seules les API joignent SQL, seul web joint identity-api
    ├── 12-ingress.yml            Ingress HTTPS : dotnetgigs.local -> Service web (contrôleur Traefik)
    └── 13-rbac.yml               ServiceAccount + Role + RoleBinding : jobs-api ne peut que lire les ConfigMaps
```

Les modèles lisent `values.yaml` avec `{{ .Values.xxx }}`. Exemples :

- `{{ .Values.image }}:web` donne l'image `nicoter04/dotnetgigs_bd:web` ;
- `{{- toYaml .Values.resources.web | nindent 10 }}` recopie le bloc de ressources de web.

Voir ce que Helm génère, sans rien installer :

```bash
helm template dotnetgigs helm/dotnetgigs -n dotnetgigs --set sqlPassword=test
```

Il n'y a pas de README dans `templates/` : Helm traite chaque fichier de ce dossier comme un manifeste Kubernetes.
