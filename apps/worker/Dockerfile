FROM node:20-alpine AS base

# Install pnpm through corepack or npm
RUN corepack enable && corepack prepare pnpm@latest --activate

# The following is a workaround for some corepack issues in certain environments
# ensuring we have the correct pnpm version available
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

FROM base AS builder
# Set working directory
WORKDIR /app
# Install turbo globaly to use the prune command
# You can also use "npx turbo" but installing it is often faster/cleaner in docker
RUN npm install -g turbo
COPY . .
# Prune the workspace for the worker app
RUN turbo prune --scope=worker --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
WORKDIR /app

# First install dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the project
COPY --from=builder /app/out/full/ .

# Generate Prisma Client
RUN pnpm turbo db:generate --filter=worker...

# Check if there is a turbo.json in the pruned output, if not copy it from root
# usually prune handles this, but sometimes explicit copy is safer if prune misses config
# We rely on what prune gave us in /out/full
RUN pnpm turbo build --filter=worker...

FROM base AS runner
WORKDIR /app

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

COPY --from=installer /app/apps/worker/package.json .
COPY --from=installer --chown=nodejs:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=installer --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=nodejs:nodejs /app/packages ./packages
# We also need the workspace dependencies if they are not bundled.
# By default, pnpm installs dependencies in root node_modules.
# However, for production we might want to ensure we have everything accessable.
# If we used a bundler like esbuild/webpack, we'd just copy the bundle.
# Since `tsc` is used (based on package.json "build": "tsc"), we need node_modules at runtime.

# IMPORTANT: In a monorepo with pnpm, node_modules structure can be complex.
# Copying the root node_modules is the safest bet for a simple "tsc" build.
# For strictly isolated builds we might want to deploy differently, but this is robust.

CMD ["node", "apps/worker/dist/index.js"]
