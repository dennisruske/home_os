############################################
# Base
############################################
FROM node:20-alpine AS base

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

############################################
# Builder – prune Monorepo
############################################
FROM base AS builder
WORKDIR /app

# Turbo für prune
RUN npm install -g turbo

# Gesamtes Monorepo kopieren
COPY . .

# Workspace für worker isolieren
RUN turbo prune --scope=worker --docker

############################################
# Installer – deps + build
############################################
FROM base AS installer
WORKDIR /app

# Nur minimale Metadaten (cache-freundlich)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Dependencies installieren
RUN pnpm install --frozen-lockfile

# Vollständigen pruned Source kopieren
COPY --from=builder /app/out/full/ .

# Prisma Client (falls vorhanden)
RUN pnpm turbo db:generate --filter=worker...

# Worker bauen
RUN pnpm turbo build --filter=worker...

# 🔑 PRODUKTIONS-LAYOUT ERZEUGEN (wichtig!)
RUN pnpm deploy --filter=worker --prod /app/deploy

############################################
# Runner – minimal & clean
############################################
FROM node:20-alpine AS runner
WORKDIR /app

# Non-root User
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs

# Nur das, was zur Laufzeit nötig ist
COPY --from=installer /app/deploy/node_modules ./node_modules
COPY --from=installer /app/apps/worker/dist ./apps/worker/dist
COPY --from=installer /app/apps/worker/package.json ./apps/worker/package.json

CMD ["node", "apps/worker/dist/index.js"]