# traefik/ : contrôleur d'ingress

```
traefik/
└── traefik-values.yaml   réglages du chart officiel traefik/traefik : redirection HTTP -> HTTPS, ressources
```

Traefik est le programme qui reçoit les requêtes du navigateur et applique l'Ingress de l'application
(`helm/dotnetgigs/templates/12-ingress.yml`) : `https://dotnetgigs.local` -> Service web.

Il est installé à part, avec son propre chart officiel (README principal, section 7, étape 1) :

```bash
helm upgrade --install traefik traefik/traefik --version 42.4.1 -n traefik --create-namespace -f traefik/traefik-values.yaml
```

Pourquoi pas dans le chart de l'application : le sujet l'interdit (« pas de contrôleur d'ingress »). Sur un vrai cluster,
le contrôleur est partagé par toutes les applications et installé une seule fois ; deux contrôleurs se disputeraient
les ports 80 et 443. Le chart de l'application peut ainsi s'installer sur n'importe quel cluster qui a déjà un contrôleur.
