# Supabase Setup (PostgreSQL, no Docker)

This app now uses Supabase-hosted Postgres instead of local MySQL. Follow these steps to connect and run migrations.

## Prerequisites
- Supabase project (free tier is fine)
- Database password (Project Settings ? Database ? Connection string)
- Pooled connection string (port 6543) with SSL enabled
- psql installed locally (optional, for connectivity check)

## 1) Grab the pooled connection string
1. In Supabase dashboard: **Project Settings ? Database ? Connection string ? Pooled connection**.
2. Copy the URI that looks like:
   `
   postgresql://postgres:<PASSWORD>@db.<project>.supabase.co:6543/postgres?sslmode=require&pgbouncer=true
   `
3. Keep this safe; it will be your DATABASE_URL.

## 2) Update backend/.env
`
DATABASE_URL="postgresql://postgres:<PASSWORD>@db.<project>.supabase.co:6543/postgres?sslmode=require&pgbouncer=true"
JWT_SECRET=...            # keep existing values
PORT=5000
`
- Use the pooled (pgbouncer) URL, not the direct port 5432, to stay within Supabase connection limits.

## 3) Run migrations & generate client
From ackend/:
`powershell
npm install
npx prisma generate
npx prisma migrate deploy
`
- deploy applies the new Postgres migrations created for Supabase.
- If you want seed data, run: 
pm run prisma:seed after migrations.

## 4) Verify connectivity
`
curl http://localhost:5000/api/health/db
`
You should receive { "status": "ok", "db": "connected" }.

## 5) Common issues
- **FATAL: no pg_hba.conf entry** ? Make sure you copied the pooled URL (port 6543) and have SSL parameters.
- **password authentication failed** ? Reset database password in Supabase settings and update DATABASE_URL.
- **Prisma SSL errors** ? Ensure sslmode=require is present in the URL.

## 6) Deployments
- For Docker Compose, set DATABASE_URL in the root .env that Compose reads.
- No local Postgres container is needed; the compose file now only starts Redis + app.
