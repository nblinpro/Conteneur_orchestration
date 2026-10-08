# ---- Étape 1 : build de l'application React avec Node.js ----
FROM node:22-alpine AS build

WORKDIR /app

# Dépendances d'abord, pour profiter du cache Docker.
COPY package.json package-lock.json ./
RUN npm ci

# Puis le code source, et génération des fichiers statiques dans dist/.
COPY . .
RUN npm run build

# ---- Étape 2 : serveur web léger, sans Node.js ni node_modules ----
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
