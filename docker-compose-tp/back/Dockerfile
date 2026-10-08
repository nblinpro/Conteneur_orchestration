FROM node:22-alpine

WORKDIR /app

# Dépendances d'abord : ce layer reste en cache tant que
# package.json / package-lock.json ne changent pas.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Puis le code source.
COPY server.js ./

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# Ne pas faire tourner l'application en root.
USER node

CMD ["node", "server.js"]
