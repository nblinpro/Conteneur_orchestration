# helm/ : tout ce qui est installé dans le cluster pour le projet

```
helm/
├── 00-namespace.yml       namespace dotnetgigs, créé AVANT le chart de l'application
├── secrets.enc.yaml       mot de passe SQL, chiffré avec SOPS (dans Git, mais illisible sans la clé age)
├── secrets.example.yaml   exemple du contenu de secrets.enc.yaml une fois déchiffré
├── dotnetgigs/            chart Helm de l'APPLICATION (web, 3 API, SQL Server, Redis, RabbitMQ)
└── observabilite/         chart Helm de la SURVEILLANCE et des LOGS (Prometheus, Elasticsearch, Kibana, Fluent Bit)
```

Deux charts séparés : l'application d'un côté, les outils du cluster de l'autre. Chacun a son propre `values.yaml`,
qui réunit tous ses réglages (dont les ressources CPU / mémoire de chaque composant).

| Fichier / dossier | Installé par (README principal, section 7) |
|---|---|
| `00-namespace.yml` | étape 2 : `kubectl apply -f helm/00-namespace.yml` |
| `dotnetgigs/` + `secrets.enc.yaml` | étape 4 : `sops exec-file helm/secrets.enc.yaml 'helm upgrade --install dotnetgigs helm/dotnetgigs -n dotnetgigs -f {}'` |
| `observabilite/` | étape 5 : `helm upgrade --install observabilite helm/observabilite -n observabilite` |

Pourquoi le namespace n'est pas dans le chart : les Secrets créés à la main (Docker Hub, certificat HTTPS) doivent
y être rangés avant `helm install`, et Helm refuse de créer un objet qui existe déjà sans lui appartenir.

Le contrôleur d'ingress Traefik n'est pas ici : le sujet interdit de le mettre dans le chart (voir [../traefik/](../traefik/)).
