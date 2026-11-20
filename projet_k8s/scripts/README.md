# scripts/ : outils de test

```
scripts/
└── load-generator.yml   pod qui génère de la charge pour démontrer l'HPA
```

Le sujet demande de « démontrer (même de manière simple avec un outil de charge) que les replicas augmentent
lorsque la charge augmente ». Ce pod lance 20 boucles de requêtes HTTPS vers le site, en passant par Traefik
comme un vrai visiteur : le CPU des pods web monte, et l'HPA passe de 2 à 3 pods.

```bash
kubectl get hpa -n dotnetgigs -w                  # terminal 1 : on regarde les réplicas
kubectl apply -f scripts/load-generator.yml       # terminal 2 : on lance la charge
kubectl delete -f scripts/load-generator.yml      # on arrête la charge (web redescend à 2 pods ~5 min après)
```

Ce pod ne fait pas partie de l'application (il n'est pas dans le chart). Le supprimer après la démo :
tant qu'il tourne, web reste à 3 pods.
