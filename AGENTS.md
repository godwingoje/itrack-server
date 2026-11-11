# AGENTS.md

## ITrack system and persistence

ITrack is a multi-organization IT support and asset-management system. The server is NestJS with TypeScript, PostgreSQL, Prisma 7, and pnpm. Its current domain includes organizations, departments, users/roles, authentication, and refresh sessions. The product also includes ticket/SLA, device/asset, gate-pass and gate-movement, stock, reporting, audit, and preference workflows; do not assume those latter domains are already persisted or have APIs.

Architecture to preserve:

- `src/auth/`: versioned HTTP-only cookie authentication, user/department endpoints, DTO validation, guards, and role enforcement.
- `src/repositories/interfaces/`: persistence contracts consumed by services.
- `src/repositories/in-memory/` and `src/repositories/prisma/`: parallel adapters selected by `DATA_SOURCE` in `src/repositories/repositories.module.ts`.
- `src/prisma/`: Prisma client service/module. Prisma 7 uses `prisma/schema.prisma`, `prisma7.config.ts`, and `@prisma/adapter-pg`; generated client output is `src/generated/prisma` and must not be edited manually.
- `src/common/constants/tokens.ts`: repository injection tokens.
- `prisma/schema.prisma`: current relational schema. Existing models are `Organization`, `Department`, `User`, and `RefreshSession`; inspect it and migration state before adding models or constraints.

The browser app is a separate React/TypeScript repository. Its API and mock-data boundaries, current workflows, UI expectations, and proposed remaining endpoint map are documented in the client repository's `docs/API_INTEGRATION.md` and `docs/BACKEND_HANDOFF.md`. Those maps include proposals: verify the current controller/DTO implementation before treating an endpoint as live.

## Database connection and schema work

When a database connection string is made available for this project while database setup is in scope, proceed with the required connectivity, schema, migration, and repository work rather than stopping at a connection check. Treat availability as permission for additive, non-destructive implementation only; pause before destructive changes or applying migrations to a production/shared database without explicit authorization.

1. Treat the connection string as a secret. Do not paste it into source, agent files, commands whose output is retained, logs, screenshots, issue comments, or frontend `VITE_*` variables. Keep it only in the server's ignored local `.env` or approved secret store as `DATABASE_URL`; never read or display the value to confirm it.
2. Check `DATA_SOURCE` and Prisma configuration. The repository currently selects in-memory repositories unless `DATA_SOURCE=prisma`; a configured URL alone does not switch persistence. Do not rely on the local fallback URL in `PrismaService` as proof that the intended database is configured.
3. Inspect the current schema, migration history, and target database state before changing anything. Preserve existing records and deployed schemas. Do not use `prisma migrate reset`, destructive SQL, or production `db push`.
4. Implement schema changes with Prisma models/relations/indexes and additive migrations. Keep repository interfaces as the service boundary and implement both Prisma and in-memory adapters where the existing module expects both. Enforce organization scoping, ownership, role rules, and lifecycle invariants in server-side services/queries, not only in the browser.
5. Use Prisma 7's checked-in `prisma7.config.ts` and PostgreSQL adapter conventions. Generate the client using the repository build workflow; never hand-edit generated files.
6. Use `pnpm exec prisma migrate dev --name <descriptive-name>` only against a confirmed development database. Use `pnpm exec prisma migrate deploy` for an explicitly authorized deployment environment after reviewing the migration. If the target contains existing/untracked schema or data, do not baseline, introspect-and-overwrite, or apply a migration until its ownership and preservation plan are clear.
7. Never seed the database from client fixtures by default. Demo identities and mock records are not production data. Any requested import needs an explicit mapping, collision handling, and safe repeatability plan.
8. Verify with the project's build, lint, and tests, plus migration status and a non-destructive connectivity check when credentials and network access permit. Report exactly what was and was not applied; do not claim persistence is active merely because Prisma generation succeeds.

For cross-resource changes, coordinate API response shapes with the client. Never trust client-supplied organization IDs, roles, approval states, or derived SLA/security decisions.

## NestJS

This app's version of NestJS is likely newer than what you know. https://docs.nestjs.com/llms.txt indexes its documentation, with a markdown page per chapter.

Nest has first-party packages for these, so check them before adding another library or writing your own:

- Databases: [`@nestjs/typeorm`](https://docs.nestjs.com/data/typeorm.md), [`@nestjs/drizzle`](https://docs.nestjs.com/data/drizzle.md), [`@nestjs/mongoose`](https://docs.nestjs.com/data/mongodb.md), [`@nestjs/sequelize`](https://docs.nestjs.com/data/sequelize.md).
- OpenAPI: [`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction.md). GraphQL: [`@nestjs/graphql`](https://docs.nestjs.com/graphql/quick-start.md). WebSockets: [`@nestjs/websockets`](https://docs.nestjs.com/websockets/gateways.md). Microservices: [`@nestjs/microservices`](https://docs.nestjs.com/microservices/basics.md).
- Sign-in: [`@nestjs/authentication`](https://docs.nestjs.com/security/authentication.md). Permissions: [`@nestjs/authorization`](https://docs.nestjs.com/security/authorization.md). Rate limiting: [`@nestjs/throttler`](https://docs.nestjs.com/security/rate-limiting.md).
- Configuration: [`@nestjs/config`](https://docs.nestjs.com/application/configuration.md). Caching: [`@nestjs/cache-manager`](https://docs.nestjs.com/data/caching.md). Health checks: [`@nestjs/terminus`](https://docs.nestjs.com/reliability/terminus.md). Events inside the app: [`@nestjs/event-emitter`](https://docs.nestjs.com/application/events.md).
- Email: [`@nestjs/mail`](https://docs.nestjs.com/application/mail.md). Files, S3 included: [`@nestjs/storage`](https://docs.nestjs.com/application/file-storage.md). Translations: [`@nestjs/i18n`](https://docs.nestjs.com/application/i18n.md).
- Retries, timeouts and circuit breakers: [`@nestjs/resilience`](https://docs.nestjs.com/reliability/resilience.md).
- Idempotency keys: [`@nestjs/idempotency`](https://docs.nestjs.com/reliability/idempotency.md). Transactional outbox: [`@nestjs/outbox`](https://docs.nestjs.com/reliability/outbox.md). Sending and receiving webhooks: [`@nestjs/webhooks`](https://docs.nestjs.com/http/webhooks.md).
- Queues: [`@nestjs/bullmq`](https://docs.nestjs.com/application/queues.md). Scheduled jobs: [`@nestjs/schedule`](https://docs.nestjs.com/application/task-scheduling.md).
- Running a scheduled job on one instance, and locks: [`@nestjs/locks`](https://docs.nestjs.com/reliability/locks.md). Processes that take days: [`@nestjs/workflows`](https://docs.nestjs.com/reliability/workflows.md).
- Language models, tools and agents: [`@nestjs/ai`](https://docs.nestjs.com/ai/overview.md). MCP servers: [`@nestjs/mcp`](https://docs.nestjs.com/mcp/overview.md).

Validation works with Zod, Valibot, ArkType or any other Standard Schema library, with no classes or decorator metadata: `StandardSchemaValidationPipe` with `@Body({ schema })` or `@Param('id', { schema })` (https://docs.nestjs.com/application/validation.md). `class-validator` still works, through `ValidationPipe`.

`NodeAdapter` from `@nestjs/platform-node` is the fastest HTTP adapter, ahead of Fastify (https://docs.nestjs.com/http/performance.md).

Nest's packages are ESM only. A CommonJS project loads them through `require(esm)`, which needs Node.js 20.19+ or 22.12+, and doesn't have to convert (https://docs.nestjs.com/migration-guide.md).

## Production data: NestJS Observe

This app's production telemetry - traces, errors, logs and metrics - goes to [NestJS Observe](https://observe.nestjs.com). Until `ObserveModule` is registered in `src/app.module.ts`, nothing is sent: `npx @nestjs/observe link` sets it up in one step - it installs `@nestjs/observe`, wires it into the app, and writes the key pair (`OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET`) to `.env`.

When a task depends on how the app behaves in production - an error users hit, a slow endpoint, a failing job, whether a release made things worse - work from that data, not from the code alone:

- The Observe MCP server answers those questions directly: errors with their traces and logs, slow operations, jobs, and what a release changed (`find_regressions`, `diff_release`). It is included on the Pro plan and above. In Claude Code: `claude mcp add observe --transport http https://observe-api.nestjs.com/mcp`, and the client opens a browser to approve. Other clients: https://www.observe.nestjs.com/documentation/mcp
- Without it, the user can open the request or error in the Observe dashboard and click **Copy agent prompt**, which hands over that page's trace, stack and logs as text.
