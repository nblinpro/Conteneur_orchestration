# Choix techniques : Ingress et NetworkPolicies

Fichiers concernés : [`helm/dotnetgigs/templates/ingress.yaml`](../helm/dotnetgigs/templates/ingress.yaml)
et [`helm/dotnetgigs/templates/networkpolicy.yaml`](../helm/dotnetgigs/templates/networkpolicy.yaml).

## 1. Ingress

### Besoin (sujet)

- Seules les applications appelées de l'extérieur doivent être exposées : ici, uniquement **web**.
- L'accès externe doit se faire **uniquement en HTTPS**, avec un certificat auto-signé.
- Le chart Helm contient l'Ingress, mais **pas le contrôleur d'ingress**.

### Choix

| Point | Choix | Raison |
|---|---|---|
| Exposition | Tous les Services en `ClusterIP`, un seul Ingress vers `web` | un seul point d'entrée ; API, base, Redis et RabbitMQ restent invisibles de l'extérieur |
| Contrôleur | **ingress-nginx** (addon minikube), `ingressClassName: nginx` | fourni par minikube en une commande, installé hors du chart comme demandé |
| Nom de domaine | `dotnetgigs.local` (valeur `host` de `values.yaml`) | modifiable à l'installation (`--set host=...`) pour un autre cluster |
| HTTPS | bloc `tls:` + Secret `dotnetgigs-tls` (certificat auto-signé openssl) | exigence du sujet ; le Secret est créé à la main car il contient la clé privée |
| HTTP | annotation `force-ssl-redirect: "true"` | toute requête HTTP est redirigée (code 308) vers HTTPS |
| Chemins | un seul : `/` → Service `web:80` | une seule application à exposer |

### Alternatives écartées

- **Service `NodePort` ou `LoadBalancer` sur web** : expose un port sans TLS géré, et un par application ; l'Ingress centralise le HTTPS.
- **Traefik** (utilisé dans notre TP WordPress) : non fourni par minikube, et ses Middlewares sont des objets propres à Traefik. Inutiles ici, car il n'y a qu'un chemin.
- **Certificat dans le chart** : la clé privée se retrouverait dans Git.

### Vérification

```bash
kubectl get ingress -n dotnetgigs
# depuis le cluster : HTTP => 308 (redirection), HTTPS => 200
```

## 2. NetworkPolicies

### Besoin (sujet)

« Mettre en place au moins une NetworkPolicy pour limiter les communications, par exemple :
seule web peut appeler identity.api, seules les API peuvent parler à sql.data. »

### Fonctionnement retenu

Sans NetworkPolicy, tous les pods peuvent se parler. Dès qu'une NetworkPolicy **sélectionne** un pod,
ce pod n'accepte plus que le trafic entrant qu'elle autorise. On protège donc les pods sensibles un par un.

| Règle | Pods protégés | Seuls autorisés | Port |
|---|---|---|---|
| `sql-data-from-api` | `app: sql-data` | `app: jobs-api`, `app: applicants-api` | 1433 |
| `identity-api-from-web` | `app: identity-api` | `app: web` | 80 |

Ce sont exactement les deux exemples du sujet. Les règles s'appuient sur le label `app`, déjà posé
sur chaque pod : pas de label supplémentaire à gérer.

### Pourquoi pas « tout bloquer par défaut » ?

Notre TP WordPress utilisait une règle `default-deny-ingress` (tout bloquer), puis des règles d'ouverture.
Appliqué à dotnetgigs, ce modèle demande au moins 6 règles : sans une règle pour chaque flux
(ingress → web, web → API, API → RabbitMQ, identity-api → Redis...), le site cesse de fonctionner.
Nous avons préféré **2 règles simples, lisibles et suffisantes pour le sujet**.
Le modèle complet est une amélioration possible (il est utilisé dans notre version détaillée `projet_k8s`).

### Prérequis

Les NetworkPolicies ne sont appliquées que si le plugin réseau du cluster les gère :
c'est le cas de kindnet, le plugin par défaut de minikube.

### Vérification

```bash
kubectl get networkpolicy -n dotnetgigs

# Un pod de test (sans label autorisé) ne peut pas joindre SQL Server :
kubectl run test --rm -it --image=busybox:1.36 -n dotnetgigs -- nc -zv -w 3 sql-data 1433
# => Connection timed out
```
