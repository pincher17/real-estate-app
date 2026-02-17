# Batumi Real Estate Aggregator

A production MVP platform that aggregates apartment listings from Telegram channels in Batumi, Georgia.

## Architecture

- **Backend**: Node.js services for Telegram ingestion, AI extraction, and API
- **Frontend**: Next.js web application with filtering and listing display
- **Database**: Supabase (PostgreSQL) for structured data storage
- **Storage**: Supabase Storage for listing images

## Setup

### 1. Database Setup

Run the SQL schema in Supabase SQL Editor:

```bash
# Copy supabase/schema.sql content and execute in Supabase dashboard
```

For existing data classification by property type, run one-time backfill:

```bash
# Copy supabase/property_type_backfill.sql and execute in Supabase SQL Editor
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in your credentials
```

If you want to run parser from Vercel UI (not locally), deploy backend on VPS and start sync server:

```bash
cd backend
npm run sync-server
```

Recommended for production: run it via `pm2` or `systemd` so it stays alive.

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Fill in your Supabase credentials
```

For Vercel-triggered parser, set these frontend env vars in Vercel:

- `TELEGRAM_SYNC_SERVER_URL` (example: `https://your-vps-domain:8787`)
- `TELEGRAM_SYNC_SERVER_TOKEN` (must match `SYNC_API_TOKEN` on VPS)

## Project Structure

```
.
├── backend/
│   ├── telegram/      # Telegram ingestion service
│   ├── extraction/    # OpenAI extraction service
│   └── api/           # REST API (optional)
├── frontend/          # Next.js application
└── supabase/
    └── schema.sql     # Database schema
```

## Environment Variables

See `.env.example` files in each directory for required variables.
