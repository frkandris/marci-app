# A sorrend kötött: előbb a frontend build, aztán a másolás. A szerver
# futásidőben függ a web/dist meglététől — ezért ellenőrzi a /api/health az
# index.html-t is. Lásd wiki/decisions/2026-07-27-egy-konteneres-deploy.md.

# --- 1. Frontend build ------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY server/package.json server/
RUN npm ci
COPY web/ web/
RUN npm run build --workspace=web

# --- 2. Futásidejű függőségek ----------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY server/package.json server/
RUN npm ci --omit=dev

# --- 3. Futtatás ------------------------------------------------------------
# Nincs natív modul: az SQLite a beépített node:sqlite, ezért az alpine
# elég, és nincs fordítási lépés.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/marci.db

COPY --from=deps /app/node_modules ./node_modules
COPY server/ ./server/
COPY --from=build /app/web/dist ./web/dist

RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000

# A healthcheck a frontend meglétét is nézi: a build fázis csendben
# elhasalhat úgy, hogy a szerver elindul, de csak 404-et ad.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/src/index.js"]
