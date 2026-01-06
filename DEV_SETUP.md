# Development Setup Guide

This guide describes how to set up the development environment for the `home_os` project.

## Prerequisites

- [Node.js](https://nodejs.org/) (v22 or later recommended)
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) and Docker Compose

## Getting Started

### 1. Start Infrastructure Services

The project uses Docker for development services like PostgreSQL, Redis, and MQTT.

```bash
pnpm docker:dev
```

This will start:
- **PostgreSQL**: `localhost:5432` (User: `devuser`, Password: `123456`, DB: `devdb`)
- **Redis**: `localhost:6379`
- **Mosquitto (MQTT)**: `localhost:1883`

### 2. Configure Environment Variables

The project uses several `.env` files. Ensure they point to your local development services.

**Database Package (`packages/database/.env`):**
Required for Prisma migrations and studio.
```env
DATABASE_URL=postgresql://devuser:123456@localhost:5432/devdb
```

**Worker Application (`apps/worker/.env`):**
```env
DATABASE_URL=postgresql://devuser:123456@localhost:5432/devdb
REDIS_URL=redis://localhost:6379
MQTT_URL=mqtt://localhost:1883
```

**Web Application (`apps/web/.env`):**
```env
DATABASE_URL=postgresql://devuser:123456@localhost:5432/devdb
```

### 3. Initialize Database

Apply the existing migrations and generate the Prisma client:

```bash
# Apply existing migrations
pnpm --filter @repo/database db:migrate:deploy

# Or, if you want to push the current schema directly (useful for rapid dev)
pnpm db:push
```

### 4. Run Applications

You can run the applications directly on your host machine:

```bash
pnpm dev
```

## Management Commands

- **Stop Services**: `pnpm docker:dev:down`
- **View DB (Studio)**: `pnpm db:studio`
- **Build All**: `pnpm build`
