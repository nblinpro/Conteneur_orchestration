# Relancer minikube après un redémarrage de la VM

minikube ne redémarre pas tout seul quand la VM redémarre ou se met en veille.
Symptôme : toute commande `kubectl` renvoie

```
Unable to connect to the server: dial tcp 192.168.49.2:8443: connect: no route to host
```

`kubectl` essaie de joindre l'API du cluster (`192.168.49.2:8443`), mais le cluster est arrêté.

## 1. Vérifier l'état de minikube

```bash
minikube status
```

Si tout est en `Stopped`, le cluster est arrêté :

```
host: Stopped
kubelet: Stopped
apiserver: Stopped
kubeconfig: Stopped
```

minikube tourne avec le driver docker : le cluster est en fait un conteneur Docker nommé `minikube`.

```bash
docker ps -a --filter name=minikube   # STATUS "Exited" = arrêté
```

## 2. Redémarrer le cluster

```bash
minikube start
```

Rien n'est perdu : les déploiements, les Secrets et les volumes (PVC) sont conservés.
Les addons (metrics-server, dashboard...) redémarrent aussi.

## 3. Attendre que les pods repartent

Juste après le démarrage, les pods peuvent afficher `Unknown` ou `0/1` : c'est normal, ils redémarrent.

```bash
kubectl get pods -A                                             # tous les namespaces
kubectl wait --for=condition=Ready pod --all -n wordpress --timeout=180s
kubectl get pods -n wordpress                                   # tout doit être 1/1 Running
```

`-A` = tous les namespaces. `-n A` chercherait un namespace nommé « A ».

## 4. Relancer l'accès web depuis l'hôte

Les `port-forward` sont coupés quand le cluster s'arrête. Les relancer, un terminal chacun :

```bash
kubectl port-forward --address 0.0.0.0 -n wordpress svc/wordpress-service 8000:80
kubectl port-forward --address 0.0.0.0 -n wordpress svc/phpmyadmin-service 8080:8080
```

Puis depuis l'hôte :
- WordPress : `http://192.168.80.136:8000`
- phpMyAdmin : `http://192.168.80.136:8080`

## Résumé

```bash
minikube status
minikube start
kubectl get pods -A
kubectl port-forward --address 0.0.0.0 -n wordpress svc/wordpress-service 8000:80
```

## Notes

- `kubectl` est un alias de `minikube kubectl --` (ligne dans `~/.bashrc`) :
  `alias kubectl="minikube kubectl --"`
- Pour arrêter proprement minikube avant d'éteindre la VM : `minikube stop`
