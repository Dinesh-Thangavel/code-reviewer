import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Clear existing data
    await prisma.issue.deleteMany();
    await prisma.review.deleteMany();
    await prisma.pullRequest.deleteMany();
    await prisma.repository.deleteMany();

    // --- Repositories ---
    const repos = await Promise.all([
        prisma.repository.create({
            data: {
                name: 'frontend-app',
                fullName: 'acme-corp/frontend-app',
                isActive: true,
                autoReview: true,
                strictness: 'BALANCED',
                languages: JSON.stringify(['TypeScript', 'JavaScript', 'CSS']),
                ignorePaths: JSON.stringify(['node_modules', 'dist', '*.test.ts']),
            },
        }),
        prisma.repository.create({
            data: {
                name: 'backend-api',
                fullName: 'acme-corp/backend-api',
                isActive: true,
                autoReview: true,
                strictness: 'STRICT',
                languages: JSON.stringify(['TypeScript', 'JavaScript']),
                ignorePaths: JSON.stringify(['node_modules', 'dist']),
            },
        }),
        prisma.repository.create({
            data: {
                name: 'mobile-app',
                fullName: 'acme-corp/mobile-app',
                isActive: true,
                autoReview: false,
                strictness: 'RELAXED',
                languages: JSON.stringify(['Kotlin', 'Swift', 'Dart']),
                ignorePaths: JSON.stringify(['build', '.gradle']),
            },
        }),
        prisma.repository.create({
            data: {
                name: 'data-pipeline',
                fullName: 'acme-corp/data-pipeline',
                isActive: true,
                autoReview: true,
                strictness: 'BALANCED',
                languages: JSON.stringify(['Python', 'SQL']),
                ignorePaths: JSON.stringify(['__pycache__', '.venv']),
            },
        }),
        prisma.repository.create({
            data: {
                name: 'infra-config',
                fullName: 'acme-corp/infra-config',
                isActive: false,
                autoReview: false,
                strictness: 'RELAXED',
                languages: JSON.stringify(['YAML', 'HCL', 'Shell']),
                ignorePaths: JSON.stringify(['.terraform']),
            },
        }),
    ]);

    console.log(`✅ Created ${repos.length} repositories`);

    // --- Pull Requests ---
    const prData = [
        { repo: 0, number: 142, title: 'feat: Add user authentication flow', author: 'alice', status: 'MERGED' as const, risk: 'HIGH' as const, headSha: 'a1b2c3d', baseBranch: 'main' },
        { repo: 0, number: 143, title: 'fix: Resolve dashboard rendering bug', author: 'bob', status: 'OPEN' as const, risk: 'LOW' as const, headSha: 'e4f5g6h', baseBranch: 'main' },
        { repo: 0, number: 144, title: 'refactor: Migrate to React Query v5', author: 'charlie', status: 'OPEN' as const, risk: 'MEDIUM' as const, headSha: 'i7j8k9l', baseBranch: 'develop' },
        { repo: 1, number: 87, title: 'feat: Add rate limiting middleware', author: 'diana', status: 'MERGED' as const, risk: 'HIGH' as const, headSha: 'm0n1o2p', baseBranch: 'main' },
        { repo: 1, number: 88, title: 'fix: SQL injection in search endpoint', author: 'eve', status: 'OPEN' as const, risk: 'HIGH' as const, headSha: 'q3r4s5t', baseBranch: 'main' },
        { repo: 1, number: 89, title: 'chore: Update dependencies to latest', author: 'frank', status: 'CLOSED' as const, risk: 'LOW' as const, headSha: 'u6v7w8x', baseBranch: 'main' },
        { repo: 1, number: 90, title: 'feat: WebSocket real-time notifications', author: 'alice', status: 'OPEN' as const, risk: 'MEDIUM' as const, headSha: 'y9z0a1b', baseBranch: 'develop' },
        { repo: 2, number: 56, title: 'feat: Biometric login for Android', author: 'george', status: 'MERGED' as const, risk: 'MEDIUM' as const, headSha: 'c2d3e4f', baseBranch: 'main' },
        { repo: 2, number: 57, title: 'fix: Memory leak in image caching', author: 'hannah', status: 'OPEN' as const, risk: 'HIGH' as const, headSha: 'g5h6i7j', baseBranch: 'main' },
        { repo: 3, number: 34, title: 'feat: Add ETL pipeline for analytics', author: 'ivan', status: 'MERGED' as const, risk: 'MEDIUM' as const, headSha: 'k8l9m0n', baseBranch: 'main' },
        { repo: 3, number: 35, title: 'fix: Handle null values in data transform', author: 'julia', status: 'OPEN' as const, risk: 'LOW' as const, headSha: 'o1p2q3r', baseBranch: 'main' },
        { repo: 0, number: 145, title: 'feat: Dark mode theme implementation', author: 'bob', status: 'OPEN' as const, risk: 'LOW' as const, headSha: 's4t5u6v', baseBranch: 'develop' },
    ];

    const pullRequests = await Promise.all(
        prData.map((pr) =>
            prisma.pullRequest.create({
                data: {
                    repoId: repos[pr.repo].id,
                    number: pr.number,
                    title: pr.title,
                    author: pr.author,
                    status: pr.status,
                    riskLevel: pr.risk,
                    headSha: pr.headSha,
                    baseBranch: pr.baseBranch,
                },
            })
        )
    );

    console.log(`✅ Created ${pullRequests.length} pull requests`);

    // --- Reviews ---
    const reviewData = [
        { prIdx: 0, summary: 'This PR introduces authentication flow with JWT tokens. Found critical security issues with token storage and moderate concerns about password validation. The overall architecture follows good patterns but needs hardening before merge.', status: 'COMPLETED' as const, confidence: 87, risk: 'HIGH' as const, files: 14 },
        { prIdx: 1, summary: 'Minor rendering fix for the dashboard component. Low risk change with clean code. One style suggestion noted.', status: 'COMPLETED' as const, confidence: 95, risk: 'LOW' as const, files: 3 },
        { prIdx: 2, summary: 'React Query migration is mostly clean. A few performance concerns around query invalidation patterns and potential re-render loops. Recommend reviewing cache strategies.', status: 'COMPLETED' as const, confidence: 82, risk: 'MEDIUM' as const, files: 22 },
        { prIdx: 3, summary: 'Rate limiting implementation looks solid. Found a critical issue with distributed environments — the in-memory store won\'t work across multiple instances. Also flagged potential DDoS bypass via header spoofing.', status: 'COMPLETED' as const, confidence: 90, risk: 'HIGH' as const, files: 8 },
        { prIdx: 4, summary: 'Critical SQL injection vulnerability in the search endpoint. The user input is directly interpolated into SQL query. This must be fixed before merge. Additional concerns about error message information leakage.', status: 'COMPLETED' as const, confidence: 96, risk: 'HIGH' as const, files: 5 },
        { prIdx: 5, summary: 'Dependency update looks safe. All packages are minor/patch version bumps. No breaking changes detected.', status: 'COMPLETED' as const, confidence: 98, risk: 'LOW' as const, files: 2 },
        { prIdx: 6, summary: 'WebSocket implementation needs review. Memory leak potential with unclosed connections. Authentication for WS connections is missing. Good overall structure.', status: 'COMPLETED' as const, confidence: 78, risk: 'MEDIUM' as const, files: 11 },
        { prIdx: 7, summary: 'Biometric login integration follows Android best practices. Minor concerns about fallback handling when biometric hardware is unavailable.', status: 'COMPLETED' as const, confidence: 88, risk: 'MEDIUM' as const, files: 9 },
        { prIdx: 8, summary: 'Identified significant memory leak in image caching module. The cache eviction policy is not properly releasing bitmap references. Critical issue for production stability.', status: 'COMPLETED' as const, confidence: 92, risk: 'HIGH' as const, files: 6 },
        { prIdx: 9, summary: 'ETL pipeline implementation is well-structured. Minor improvements suggested for error handling in data transformation steps. Good test coverage.', status: 'COMPLETED' as const, confidence: 91, risk: 'MEDIUM' as const, files: 15 },
        { prIdx: 10, summary: 'Null handling fix is straightforward and correct. One additional edge case suggested.', status: 'COMPLETED' as const, confidence: 97, risk: 'LOW' as const, files: 4 },
        { prIdx: 11, summary: 'Dark mode theme implementation is clean. Minor style inconsistency with existing design tokens. Good use of CSS custom properties.', status: 'PENDING' as const, confidence: 0, risk: 'LOW' as const, files: 18 },
    ];

    const reviews = await Promise.all(
        reviewData.map((r) =>
            prisma.review.create({
                data: {
                    prId: pullRequests[r.prIdx].id,
                    summary: r.summary,
                    status: r.status,
                    confidenceScore: r.confidence,
                    riskLevel: r.risk,
                    filesChanged: r.files,
                },
            })
        )
    );

    console.log(`✅ Created ${reviews.length} reviews`);

    // --- Issues ---
    const issueData = [
        // Review 0 (Auth flow - HIGH risk) - 5 issues
        { reviewIdx: 0, severity: 'critical', file: 'src/auth/tokenStorage.ts', line: 42, title: 'JWT stored in localStorage', description: 'Storing JWT tokens in localStorage exposes them to XSS attacks. An attacker could steal the token via document.cookie or localStorage API.', fix: '// Use httpOnly cookies instead\nres.cookie("token", jwt, {\n  httpOnly: true,\n  secure: true,\n  sameSite: "strict",\n  maxAge: 3600000\n});', language: 'TypeScript', fixStatus: 'PENDING' as const },
        { reviewIdx: 0, severity: 'security', file: 'src/auth/password.ts', line: 18, title: 'Weak password hashing', description: 'Using MD5 for password hashing is cryptographically insecure. Collision attacks are practical and rainbow tables exist.', fix: 'import bcrypt from "bcrypt";\n\nconst SALT_ROUNDS = 12;\nconst hash = await bcrypt.hash(password, SALT_ROUNDS);', language: 'TypeScript', fixStatus: 'APPLIED' as const },
        { reviewIdx: 0, severity: 'performance', file: 'src/auth/middleware.ts', line: 15, title: 'Token validation on every request', description: 'The JWT verification is synchronous and happens on every request including static assets. Consider caching validated tokens briefly.', fix: 'const tokenCache = new Map<string, { valid: boolean; exp: number }>();\n\nfunction validateToken(token: string) {\n  const cached = tokenCache.get(token);\n  if (cached && cached.exp > Date.now()) return cached.valid;\n  // ... full validation\n}', language: 'TypeScript', fixStatus: 'PENDING' as const },
        { reviewIdx: 0, severity: 'quality', file: 'src/auth/login.tsx', line: 67, title: 'Missing error boundary', description: 'The login form does not have an error boundary. If any child component throws, the entire login page will crash.', fix: 'import { ErrorBoundary } from "react-error-boundary";\n\n<ErrorBoundary fallback={<LoginError />}>\n  <LoginForm />\n</ErrorBoundary>', language: 'TypeScript', fixStatus: 'REJECTED' as const },
        { reviewIdx: 0, severity: 'style', file: 'src/auth/types.ts', line: 5, title: 'Inconsistent naming convention', description: 'Using "IUser" interface prefix violates the project naming convention. Use "User" instead.', fix: 'export interface User {\n  id: string;\n  email: string;\n  role: UserRole;\n}', language: 'TypeScript', fixStatus: 'APPLIED' as const },

        // Review 1 (Dashboard fix - LOW risk) - 1 issue
        { reviewIdx: 1, severity: 'style', file: 'src/components/Dashboard.tsx', line: 23, title: 'Unused import', description: 'The useState import is not used in this component.', fix: 'import { useEffect } from "react";', language: 'TypeScript', fixStatus: 'APPLIED' as const },

        // Review 2 (React Query migration - MEDIUM risk) - 4 issues
        { reviewIdx: 2, severity: 'performance', file: 'src/hooks/useUsers.ts', line: 12, title: 'Missing staleTime configuration', description: 'Queries refetch on every window focus without staleTime. This causes excessive API calls.', fix: 'const { data } = useQuery({\n  queryKey: ["users"],\n  queryFn: fetchUsers,\n  staleTime: 5 * 60 * 1000, // 5 minutes\n});', language: 'TypeScript', fixStatus: 'PENDING' as const },
        { reviewIdx: 2, severity: 'quality', file: 'src/hooks/useMutations.ts', line: 34, title: 'Missing optimistic update rollback', description: 'The mutation uses optimistic updates but does not implement onError rollback, which could leave the UI in an inconsistent state.', fix: 'const mutation = useMutation({\n  mutationFn: updateUser,\n  onMutate: async (newUser) => {\n    const previous = queryClient.getQueryData(["users"]);\n    queryClient.setQueryData(["users"], (old) => [...old, newUser]);\n    return { previous };\n  },\n  onError: (err, newUser, context) => {\n    queryClient.setQueryData(["users"], context.previous);\n  },\n});', language: 'TypeScript', fixStatus: 'PENDING' as const },
        { reviewIdx: 2, severity: 'quality', file: 'src/providers/QueryProvider.tsx', line: 8, title: 'QueryClient created inside component', description: 'Creating QueryClient inside the component body means a new client is created on every render.', fix: 'const queryClient = new QueryClient({\n  defaultOptions: { queries: { retry: 2 } },\n});\n\nexport function QueryProvider({ children }) {\n  return (\n    <QueryClientProvider client={queryClient}>\n      {children}\n    </QueryClientProvider>\n  );\n}', language: 'TypeScript', fixStatus: 'APPLIED' as const },
        { reviewIdx: 2, severity: 'style', file: 'src/hooks/useUsers.ts', line: 1, title: 'Deprecated import path', description: 'Importing from "react-query" is deprecated. Use "@tanstack/react-query" instead.', fix: 'import { useQuery } from "@tanstack/react-query";', language: 'TypeScript', fixStatus: 'APPLIED' as const },

        // Review 3 (Rate limiting - HIGH risk) - 3 issues
        { reviewIdx: 3, severity: 'critical', file: 'src/middleware/rateLimiter.ts', line: 8, title: 'In-memory store in distributed env', description: 'Using an in-memory Map for rate limiting will not work in a multi-instance deployment. Each instance maintains its own counter.', fix: 'import { RateLimiterRedis } from "rate-limiter-flexible";\nimport Redis from "ioredis";\n\nconst redis = new Redis(process.env.REDIS_URL);\nconst limiter = new RateLimiterRedis({\n  storeClient: redis,\n  points: 100,\n  duration: 60,\n});', language: 'TypeScript', fixStatus: 'PENDING' as const },
        { reviewIdx: 3, severity: 'security', file: 'src/middleware/rateLimiter.ts', line: 22, title: 'IP spoofing via X-Forwarded-For', description: 'Rate limiting uses X-Forwarded-For header directly, which can be spoofed by attackers to bypass limits.', fix: 'const getClientIp = (req: Request) => {\n  // Only trust proxy headers if behind a known proxy\n  if (process.env.TRUST_PROXY) {\n    return req.ip; // Express handles proxy trust\n  }\n  return req.socket.remoteAddress;\n};', language: 'TypeScript', fixStatus: 'PENDING' as const },
        { reviewIdx: 3, severity: 'quality', file: 'src/middleware/rateLimiter.ts', line: 35, title: 'Missing rate limit headers', description: 'Response does not include standard rate limit headers (X-RateLimit-Remaining, X-RateLimit-Reset).', fix: 'res.set({\n  "X-RateLimit-Limit": String(limit),\n  "X-RateLimit-Remaining": String(remaining),\n  "X-RateLimit-Reset": String(resetTime),\n});', language: 'TypeScript', fixStatus: 'APPLIED' as const },

        // Review 4 (SQL injection - HIGH risk) - 3 issues
        { reviewIdx: 4, severity: 'critical', file: 'src/routes/search.ts', line: 15, title: 'SQL injection vulnerability', description: 'User input is directly concatenated into SQL query without parameterization. This allows arbitrary SQL execution.', fix: 'const results = await prisma.$queryRaw`\n  SELECT * FROM products\n  WHERE name LIKE ${`%${searchTerm}%`}\n  LIMIT ${limit}\n`;', language: 'TypeScript', fixStatus: 'PENDING' as const },
        { reviewIdx: 4, severity: 'security', file: 'src/routes/search.ts', line: 28, title: 'Error message leaks DB schema', description: 'SQL errors are returned directly to the client, exposing table names and column information.', fix: 'try {\n  const results = await search(query);\n  res.json(results);\n} catch (error) {\n  console.error("Search failed:", error);\n  res.status(500).json({ error: "Search failed" });\n}', language: 'TypeScript', fixStatus: 'PENDING' as const },
        { reviewIdx: 4, severity: 'quality', file: 'src/routes/search.ts', line: 5, title: 'Missing input validation', description: 'No validation on search query length or content. Could lead to ReDoS or resource exhaustion.', fix: 'import { z } from "zod";\n\nconst searchSchema = z.object({\n  q: z.string().min(1).max(200).trim(),\n  limit: z.number().int().min(1).max(100).default(20),\n});', language: 'TypeScript', fixStatus: 'APPLIED' as const },

        // Review 6 (WebSocket - MEDIUM risk) - 2 issues
        { reviewIdx: 6, severity: 'security', file: 'src/ws/server.ts', line: 12, title: 'Missing WebSocket authentication', description: 'WebSocket connections are not authenticated. Any client can connect and receive real-time events.', fix: 'wss.on("connection", (ws, req) => {\n  const token = new URL(req.url, "http://localhost").searchParams.get("token");\n  if (!verifyToken(token)) {\n    ws.close(4001, "Unauthorized");\n    return;\n  }\n  // ... handle authenticated connection\n});', language: 'TypeScript', fixStatus: 'PENDING' as const },
        { reviewIdx: 6, severity: 'performance', file: 'src/ws/server.ts', line: 45, title: 'Connection cleanup missing', description: 'Disconnected WebSocket clients are not properly cleaned up. This causes a memory leak over time.', fix: 'const clients = new Set<WebSocket>();\n\nwss.on("connection", (ws) => {\n  clients.add(ws);\n  ws.on("close", () => clients.delete(ws));\n  ws.on("error", () => {\n    clients.delete(ws);\n    ws.terminate();\n  });\n});', language: 'TypeScript', fixStatus: 'PENDING' as const },

        // Review 7 (Biometric - MEDIUM risk) - 2 issues
        { reviewIdx: 7, severity: 'quality', file: 'src/auth/BiometricPrompt.kt', line: 34, title: 'Missing fallback for older devices', description: 'No fallback authentication method when biometric hardware is not available or enrolled.', fix: 'val biometricManager = BiometricManager.from(context)\nwhen (biometricManager.canAuthenticate(BIOMETRIC_STRONG)) {\n    BiometricManager.BIOMETRIC_SUCCESS -> showBiometricPrompt()\n    else -> showPinFallback()\n}', language: 'Kotlin', fixStatus: 'PENDING' as const },
        { reviewIdx: 7, severity: 'style', file: 'src/auth/BiometricPrompt.kt', line: 10, title: 'Hardcoded string resources', description: 'Biometric prompt strings are hardcoded. Should use string resources for i18n support.', fix: 'val promptInfo = BiometricPrompt.PromptInfo.Builder()\n    .setTitle(getString(R.string.biometric_title))\n    .setSubtitle(getString(R.string.biometric_subtitle))\n    .build()', language: 'Kotlin', fixStatus: 'APPLIED' as const },

        // Review 8 (Memory leak - HIGH risk) - 2 issues
        { reviewIdx: 8, severity: 'critical', file: 'src/cache/ImageCache.swift', line: 67, title: 'Bitmap references not released', description: 'The NSCache eviction delegate is not implemented, leaving strong references to UIImage objects even after eviction.', fix: 'class ImageCache: NSObject, NSCacheDelegate {\n    private let cache = NSCache<NSString, UIImage>()\n    \n    override init() {\n        super.init()\n        cache.delegate = self\n        cache.countLimit = 100\n        cache.totalCostLimit = 50 * 1024 * 1024 // 50MB\n    }\n    \n    func cache(_ cache: NSCache<AnyObject, AnyObject>,\n               willEvictObject obj: Any) {\n        // Clean up reference\n    }\n}', language: 'Swift', fixStatus: 'PENDING' as const },
        { reviewIdx: 8, severity: 'performance', file: 'src/cache/ImageCache.swift', line: 23, title: 'No memory warning observer', description: 'Cache does not respond to memory warnings. Under memory pressure, the OS may kill the app.', fix: 'NotificationCenter.default.addObserver(\n    self,\n    selector: #selector(clearCache),\n    name: UIApplication.didReceiveMemoryWarningNotification,\n    object: nil\n)', language: 'Swift', fixStatus: 'PENDING' as const },

        // Review 9 (ETL pipeline - MEDIUM risk) - 2 issues
        { reviewIdx: 9, severity: 'quality', file: 'src/pipeline/transform.py', line: 89, title: 'Silent exception swallowing', description: 'Exceptions in data transformation are caught and silently ignored, leading to data loss.', fix: 'try:\n    result = transform(record)\n    yield result\nexcept TransformError as e:\n    logger.error(f"Transform failed for record {record.id}: {e}")\n    yield ErrorRecord(record.id, str(e))\nexcept Exception as e:\n    logger.critical(f"Unexpected error: {e}")\n    raise', language: 'Python', fixStatus: 'PENDING' as const },
        { reviewIdx: 9, severity: 'performance', file: 'src/pipeline/loader.py', line: 45, title: 'Row-by-row database inserts', description: 'Each record is inserted individually. Use batch inserts for 10-100x performance improvement.', fix: 'BATCH_SIZE = 1000\n\ndef load_batch(records: list[dict]):\n    for i in range(0, len(records), BATCH_SIZE):\n        batch = records[i:i + BATCH_SIZE]\n        db.execute_many(\n            "INSERT INTO analytics VALUES (:id, :value, :timestamp)",\n            batch\n        )', language: 'Python', fixStatus: 'APPLIED' as const },

        // Review 10 (Null handling - LOW risk) - 1 issue
        { reviewIdx: 10, severity: 'quality', file: 'src/pipeline/transform.py', line: 12, title: 'Edge case: empty string vs null', description: 'The null check does not distinguish between empty strings and actual null values, which may have different semantics.', fix: 'def clean_value(value):\n    if value is None:\n        return default_value\n    if isinstance(value, str) and value.strip() == "":\n        return default_value\n    return value', language: 'Python', fixStatus: 'PENDING' as const },
    ];

    let issueCount = 0;
    for (const issue of issueData) {
        await prisma.issue.create({
            data: {
                reviewId: reviews[issue.reviewIdx].id,
                severity: issue.severity,
                filePath: issue.file,
                lineNumber: issue.line,
                title: issue.title,
                description: issue.description,
                suggestedFix: issue.fix,
                language: issue.language,
                fixStatus: issue.fixStatus,
                appliedAt: issue.fixStatus === 'APPLIED' ? new Date() : null,
            },
        });
        issueCount++;
    }

    console.log(`✅ Created ${issueCount} issues`);
    console.log('🎉 Seed completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
