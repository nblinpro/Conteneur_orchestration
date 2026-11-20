# helm/observabilite/ : chart Helm de la surveillance et des logs

Chart « parapluie » qui installe en une commande la surveillance (Prometheus) et la pile de logs EFK
(Elasticsearch, Fluent Bit, Kibana). Il est séparé du chart de l'application : ce sont des outils du cluster.

```
observabilite/
├── Chart.yaml              déclare 2 charts officiels comme dépendances : prometheus et fluent-bit
├── Chart.lock              versions exactes des dépendances (créé par helm dependency build)
├── values.yaml             TOUS les réglages et ressources : sections elasticsearch, kibana, prometheus, fluent-bit
├── templates/              nos propres modèles
│   ├── 01-elasticsearch.yml    Elasticsearch : disque (PVC) + Deployment + Service (port 9200)
│   └── 02-kibana.yml           Kibana : Deployment + Service (port 5601)
├── kibana-objects.ndjson   dashboard « Service jobs-api » + recherche « Erreurs des services », à importer dans Kibana
└── charts/                 charts officiels téléchargés (non versionné, recréé par helm dependency build)
```

| Composant | Rôle | Vient de |
|---|---|---|
| Prometheus | collecte et stocke les métriques | dépendance `prometheus` |
| kube-state-metrics | état du cluster (pods, HPA...) | dépendance `prometheus` |
| node-exporter | ressources du nœud | dépendance `prometheus` |
| Fluent Bit | lit les logs des conteneurs dotnetgigs et les envoie à Elasticsearch | dépendance `fluent-bit` |
| Elasticsearch | stocke les logs | `templates/01-elasticsearch.yml` |
| Kibana | recherche et dashboards sur les logs | `templates/02-kibana.yml` |

Installation (README principal, section 7, étape 5) :

```bash
helm dependency build helm/observabilite
kubectl create namespace observabilite
helm upgrade --install observabilite helm/observabilite -n observabilite
```

Dans `values.yaml`, ce qui est sous `prometheus:` et `fluent-bit:` est transmis tel quel aux charts officiels.
