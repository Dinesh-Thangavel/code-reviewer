# AI Code Review Dashboard - Deployment Guide

A full-stack application for automated code review using AI. This guide covers deployment options and requirements.

## Architecture

- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS
- **Backend**: Express.js + TypeScript + Prisma ORM
- **Database**: Supabase Postgres (via Prisma)
- **Background Jobs**: BullMQ with Redis
- **WebSockets**: Socket.io for real-time updates
- **AI Providers**: Claude, OpenAI, Gemini, or Ollama

## Prerequisites

- Node.js 18+ and npm
- Supabase Postgres database URL (pooled connection string)
- Redis (for background jobs - optional but recommended)
- GitHub App credentials (for GitHub integration)
- AI Provider API key (Claude, OpenAI, or Gemini)

## Environment Variables

### Backend Environment Variables

Create a `.env` file in the `backend/` directory:

#### Required Variables

```env
# Database
DATABASE_URL="postgresql://postgres:<pwd>@db.<project>.supabase.co:6543/postgres?sslmode=require&pgbouncer=true"

# Server
PORT=5000
NODE_ENV=production

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-here
```

#### AI Provider (Choose One)

```env
# Option 1: Anthropic Claude (Recommended)
AI_PROVIDER=claude
ANTHROPIC_API_KEY=your-anthropic-api-key
CLAUDE_MODEL=claude-3-5-sonnet-20241022

# Option 2: OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview

# Option 3: Google Gemini
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-pro

# Option 4: Ollama (Local)
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

#### GitHub Integration (Optional but Recommended)

```env
# GitHub App Configuration
GITHUB_APP_ID=your-github-app-id
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_CLIENT_ID=your-oauth-client-id
GITHUB_CLIENT_SECRET=your-oauth-client-secret
```

#### Bitbucket Integration (Optional)

```env
BITBUCKET_CLIENT_ID=your-bitbucket-client-id
BITBUCKET_CLIENT_SECRET=your-bitbucket-client-secret
```

#### Redis (Optional - for background jobs)

```env
# Option 1: Redis URL
REDIS_URL=redis://localhost:6379

# Option 2: Redis Host/Port
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

#### Email Notifications (Optional)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

### Frontend Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
# API Base URL (change for production)
VITE_API_URL=http://localhost:5000

# WebSocket URL (change for production)
VITE_WS_URL=ws://localhost:5000
```

For production, update these to your backend domain:
```env
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
```

## Local Development Setup

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup
See `backend/setup-supabase.md` for detailed Supabase connection steps.

```bash
cd backend

# 1) Set DATABASE_URL to your Supabase pooled URL (port 6543, sslmode=require)
# Example: postgresql://postgres:<pwd>@db.<project>.supabase.co:6543/postgres?sslmode=require&pgbouncer=true

# 2) Generate Prisma Client
npm run prisma:generate

# 3) Apply migrations to Supabase
npm run prisma:migrate

# (Optional) Seed database
npm run prisma:seed
```

### 3. Start Development Servers

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

- Backend: http://localhost:5000
- Frontend: http://localhost:5173

## Production Deployment

### Option 1: Docker Deployment (Recommended)

#### Create Dockerfile for Backend

Create `backend/Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Expose port
EXPOSE 5000

# Start server
CMD ["npm", "start"]
```

#### Create Dockerfile for Frontend

Create `frontend/Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Create nginx.conf for Frontend

Create `frontend/nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (if serving from same domain)
    location /api {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy
    location /socket.io {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

#### Create docker-compose.yml

Create `docker-compose.yml` in the root:

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      # Supabase pooled Postgres URL (required)
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      PORT: 5000
      NODE_ENV: production
      AI_PROVIDER: ${AI_PROVIDER}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      GITHUB_APP_ID: ${GITHUB_APP_ID}
      GITHUB_PRIVATE_KEY: ${GITHUB_PRIVATE_KEY}
      GITHUB_WEBHOOK_SECRET: ${GITHUB_WEBHOOK_SECRET}
      REDIS_URL: redis://redis:6379
    ports:
      - "5000:5000"
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./backend/.env:/app/.env:ro
    command: sh -c "npx prisma migrate deploy && npm start"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    environment:
      - VITE_API_URL=http://localhost:5000
      - VITE_WS_URL=ws://localhost:5000

volumes:
  redis_data:
```

#### Deploy with Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 2: Cloud Platform Deployment

#### Vercel/Netlify (Frontend) + Railway/Render (Backend)

**Frontend Deployment (Vercel/Netlify):**

1. Connect your repository
2. Set build command: `cd frontend && npm run build`
3. Set output directory: `frontend/dist`
4. Add environment variables:
   - `VITE_API_URL=https://your-backend-url.com`
   - `VITE_WS_URL=wss://your-backend-url.com`

**Backend Deployment (Railway/Render):**

1. Connect your repository
2. Set root directory: `backend`
3. Set build command: `npm install && npx prisma generate && npm run build`
4. Set start command: `npx prisma migrate deploy && npm start`
5. Add all environment variables from the backend `.env` file
6. Add managed Postgres (Supabase/Railway/Render) and set `DATABASE_URL`
7. Add Redis addon (optional)

#### AWS/GCP/Azure Deployment

**Backend (EC2/Compute Engine/Virtual Machine):**

```bash
# SSH into server
ssh user@your-server

# Install Node.js and dependencies
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Clone repository
git clone your-repo-url
cd Coder/backend

# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build
npm run build

# Start with PM2
pm2 start dist/server.js --name "code-review-api"
pm2 save
pm2 startup
```

**Frontend (S3 + CloudFront / Storage + CDN):**

```bash
cd frontend

# Build for production
npm run build

# Upload dist/ folder to S3/Storage bucket
# Configure CDN to serve index.html for all routes
```

### Option 3: Traditional VPS Deployment

1. **Setup Server:**
   ```bash
   # Install Node.js, Redis, Nginx
   sudo apt update
   sudo apt install nodejs npm redis-server nginx
   ```

2. **Configure Supabase connection:**
   - Create a `.env` in `backend/` with your Supabase pooled `DATABASE_URL` (port 6543, `sslmode=require`).
   - Ensure outbound traffic to `db.<project>.supabase.co:6543` is allowed.

3. **Deploy Backend:**
   ```bash
   cd /var/www/backend
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run build
   ```

4. **Setup PM2:**
   ```bash
   sudo npm install -g pm2
   pm2 start dist/server.js --name backend
   pm2 save
   pm2 startup
   ```

5. **Configure Nginx:**
   ```nginx
   # /etc/nginx/sites-available/code-review
   server {
       listen 80;
       server_name your-domain.com;

       # Frontend
       location / {
           root /var/www/frontend/dist;
           try_files $uri $uri/ /index.html;
       }

       # Backend API
       location /api {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       # WebSocket
       location /socket.io {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

6. **Enable SSL with Let's Encrypt:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## Database Migrations

### Development
```bash
cd backend
npm run prisma:migrate
```

### Production
```bash
cd backend
npx prisma migrate deploy
```

## Security Checklist

- [ ] Use strong `JWT_SECRET` (generate with `openssl rand -base64 32`)
- [ ] Use HTTPS in production
- [ ] Set `NODE_ENV=production`
- [ ] Configure CORS properly for your domain
- [ ] Use environment variables, never commit secrets
- [ ] Enable database SSL connections
- [ ] Use strong database passwords
- [ ] Configure firewall rules
- [ ] Set up rate limiting (consider adding express-rate-limit)
- [ ] Enable Helmet.js security headers (already configured)
- [ ] Regularly update dependencies

## Monitoring & Logging

### Recommended Tools

- **Application Monitoring**: PM2 Plus, New Relic, or Datadog
- **Error Tracking**: Sentry
- **Logging**: Winston or Pino
- **Uptime Monitoring**: UptimeRobot or Pingdom

### Health Check Endpoint

The app includes a health check endpoint:
- `GET /health` - Returns server status

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
cd backend
npx prisma db pull

# Reset database (WARNING: deletes all data)
npm run db:reset
```

### Prisma Issues

```bash
# Regenerate Prisma Client
npx prisma generate

# Check database status
npx prisma migrate status
```

### Build Issues

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Prisma cache
rm -rf node_modules/.prisma
npx prisma generate
```

## Support

For issues or questions:
1. Check the application logs
2. Verify all environment variables are set
3. Ensure database migrations are up to date
4. Check Redis connection (if using background jobs)

## License

[Your License Here]
