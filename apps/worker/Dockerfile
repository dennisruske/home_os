FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

############################################
# BUILDER
############################################
FROM base AS builder
WORKDIR /app

RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=worker --docker

############################################
# INSTALLER
############################################
FROM base AS installer
WORKDIR /app

# Metadaten + Lockfile
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Enable hoisting to ensure all dependencies are in root node_modules
RUN echo "shamefully-hoist=true" > .npmrc

# Dependencies OHNE postinstall
RUN pnpm install --frozen-lockfile --ignore-scripts

# Vollständigen Code (inkl. prisma schema)
COPY --from=builder /app/out/full/ .

# Prisma Client für ALLE Workspaces generieren
RUN pnpm --filter @repo/database exec prisma generate

# Danach bauen
RUN pnpm turbo build --filter=worker...

############################################
# RUNNER
############################################
FROM node:20-alpine AS runner
WORKDIR /app

# non-root user
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nodejs
USER nodejs

# Runtime-Files
COPY --from=installer /app/apps/worker/dist ./apps/worker/dist
COPY --from=installer /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/packages ./packages

CMD ["node", "apps/worker/dist/index.js"]