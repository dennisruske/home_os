This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Database Setup

This project uses [Neon](https://neon.tech) PostgreSQL database. **You must set up the database connection before running any Prisma commands.**

Follow these steps:

1. Create a new database at [Neon Console](https://console.neon.tech/)
2. Copy your connection string from the Neon dashboard
3. Create environment files:
   - **`.env.local`** - for Next.js (used by the application)
   - **`.env`** - for Prisma CLI commands (required for `prisma migrate` and other Prisma commands)

   **Important:** Prisma CLI reads from `.env` (not `.env.local`), so you need both files with `DATABASE_URL`.

   Create both files with your connection string:

```bash
# Replace with your actual Neon connection string
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
MQTT_URL="mqtt://localhost:1883"
# Optional: Customize MQTT topics (defaults shown below)
MQTT_TOPIC_CCP="go-eController/916791/ccp"
MQTT_TOPIC_UTC="go-eController/916791/utc"
```

   Or create them manually:
   - Copy `.env.local` to `.env` (if you already have `.env.local`)
   - Or create both files with the same `DATABASE_URL` value

4. Reset the database (since we're starting fresh with PostgreSQL, this clears any failed migration state):

```bash
# This will drop all tables and reset migration state
pnpm prisma migrate reset
```

5. Apply the PostgreSQL migrations:

```bash
# For production/CI:
pnpm prisma migrate deploy

# Or for development (creates new migrations based on schema changes):
pnpm prisma migrate dev
```

6. Generate Prisma Client (if needed):

```bash
pnpm prisma generate
```

**Troubleshooting migration errors:**

If you encounter errors about failed migrations (especially when migrating from SQLite to PostgreSQL):

1. The old SQLite migrations have been moved to `prisma/migrations_backup_sqlite/` - only the PostgreSQL migration remains
2. If your database has a failed migration record, you can:
   - **Option A (Recommended for fresh start):** Reset the database completely:
     ```bash
     pnpm prisma migrate reset
     ```
   - **Option B:** Manually resolve the failed migration state by cleaning the `_prisma_migrations` table in your database, or mark it as rolled back:
     ```sql
     -- Connect to your database and run:
     DELETE FROM "_prisma_migrations" WHERE migration_name = '20251208180804_init';
     ```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
