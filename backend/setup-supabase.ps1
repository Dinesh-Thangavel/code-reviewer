# Supabase Postgres bootstrap (non-Docker)
# - Validates DATABASE_URL in backend/.env
# - Tests connectivity with psql
# - Runs Prisma client generation and migrations

Write-Host "=== Supabase Postgres Setup ===" -ForegroundColor Cyan

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] backend/.env not found at $envFile" -ForegroundColor Red
    exit 1
}

# Extract DATABASE_URL
$envLines = Get-Content $envFile
$dbUrlLine = $envLines | Where-Object { $_ -match '^DATABASE_URL' }
if (-not $dbUrlLine) {
    Write-Host "[ERROR] DATABASE_URL not set in backend/.env" -ForegroundColor Red
    exit 1
}

$dbUrl = ($dbUrlLine -split '=',2)[1].Trim('"')
if ($dbUrl -notlike 'postgresql*') {
    Write-Host "[ERROR] DATABASE_URL must be a Supabase Postgres URL" -ForegroundColor Red
    Write-Host "Example: postgresql://postgres:<pwd>@db.<project>.supabase.co:6543/postgres?sslmode=require&pgbouncer=true" -ForegroundColor Yellow
    exit 1
}

Write-Host "Using DATABASE_URL:" -ForegroundColor Yellow
Write-Host "  $dbUrl" -ForegroundColor White

# Optional connectivity check (requires psql)
$psql = Get-Command psql -ErrorAction SilentlyContinue
if ($psql) {
    Write-Host "Testing connection with psql..." -ForegroundColor Yellow
    $test = & psql "$dbUrl" -c "select 1;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Unable to connect: $test" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Connection succeeded" -ForegroundColor Green
} else {
    Write-Host "[WARN] psql not found; skipping connectivity check" -ForegroundColor Yellow
}

# Ensure dependencies
if (-not (Test-Path "$PSScriptRoot/node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "Generating Prisma client..." -ForegroundColor Yellow
npm run prisma:generate
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Applying migrations to Supabase..." -ForegroundColor Yellow
npm run prisma:migrate
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "=== Supabase setup complete ===" -ForegroundColor Green
Write-Host "Start the backend with: npm run dev" -ForegroundColor Cyan
