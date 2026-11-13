# ITrack

**A modern and streamlined IT Support Ticket & Asset Management System.**

ITrack simplifies IT support operations by providing a centralized platform for reporting technical issues, managing support tickets, tracking IT assets, assigning support personnel, and monitoring ticket resolution.

## Overview

ITrack is designed to improve how organizations manage IT support requests and assets. It provides employees and IT support teams with an organized workflow for reporting issues, tracking progress, managing devices, and ensuring accountability throughout the support process.

## Core Features

- **Ticket Management:** Create, assign, track, and manage IT support tickets.
- **Asset Management:** Register, retrieve, and manage organizational IT assets.
- **Support Assignment:** Assign IT support personnel to tickets and assets where applicable.
- **Overdue Status:** The server computes ticket overdue status from the current priority rules.
- **Ticket History:** Maintain records of ticket activities, comments, and status changes.
- **Dashboard & Analytics:** Provide insights into support activities and operational performance.
- **Role-Based Access Control:** Ensure users access features according to their assigned roles.

## Tech Stack

- **Framework:** NestJS
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Package Manager:** pnpm

## Getting Started

### Prerequisites

Ensure you have the following installed:

- Node.js
- pnpm
- PostgreSQL

### Installation

Clone the repository:

```bash
git clone <repository-url>
```

Navigate into the project directory:

```bash
cd itrack-server
```

Install dependencies:

```bash
pnpm install
```

### Environment Configuration

Create your local environment file using the provided example:

```bash
cp .env.example .env
```

Configure the required environment variables before starting the application.

### Authentication API

The authentication routes are prefixed with `/api/v1/auth`:

| Method | Route | Access | Purpose |
|---|---|---|---|
| `POST` | `/login` | Public | Sign in and issue HTTP-only session cookies |
| `POST` | `/refresh` | Refresh cookie | Rotate the refresh session |
| `POST` | `/logout` | Signed-in | Revoke the refresh session and clear cookies |
| `GET` | `/me` | Signed-in | Return the current user |
| `GET` | `/departments` | IT Admin | List departments in the current organization |
| `GET` | `/users` | IT Admin | List users in the current organization |
| `POST` | `/users` | IT Admin | Create a user in the current organization |

Create-user requests require `fullName`, `email`, `password` (8–128 characters), `role`, and a `departmentId` returned by `/departments`. `staffId`, `phone`, and `address` are optional. The organization is taken from the authenticated administrator's session, not from the request body. Password-reset endpoints are not available until an email-delivery provider is configured.

Passwords are hashed with bcrypt and the hash is never returned. The first demo organization, IT department, and administrator, technician, and employee accounts are created with `pnpm db:seed`. The seed reads `DEMO_ADMIN_PASSWORD`, `DEMO_TECHNICIAN_PASSWORD`, and `DEMO_EMPLOYEE_PASSWORD` from the ignored local `.env`, hashes them with bcrypt, and skips existing accounts without changing their passwords. Never commit these values or use demo credentials in production. Additional accounts should be created through the IT-admin-only `POST /api/v1/auth/users` endpoint.

The server requires PostgreSQL and Prisma at startup; there is no memory fallback. The local NestJS server was verified against Neon with admin login and `GET /api/v1/auth/users`; a hosted server deployment has not yet been verified. This project intentionally does not use Prisma migration files; future schema changes require an explicitly reviewed, non-destructive schema sync. The configured Neon database has been additively synced with the `asset_assignments` table for persistent assignment history; other environments need the equivalent reviewed schema sync before deploying this code. For Render, set `NODE_ENV=production`, `DATABASE_URL` to the pooled production PostgreSQL connection string, and `JWT_SECRET` to a unique secret of at least 32 characters. Keep `PORT` on Render's assigned value (the service reads it automatically); optionally set `JWT_EXPIRES_IN`. `CORS_ORIGINS` is a comma-separated list of exact browser origins. `.env.example` includes `http://localhost:5173` for local development; replace/add the deployed frontend's exact HTTPS origin for production.

### Ticket API

Ticket routes are authenticated and tenant-scoped to the current user's organization. The server validates request bodies and query parameters with Zod.

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/tickets` | Employee/Security: own; Technician/Admin: organization | Search/filter/paginate tickets (`q`, `status`, `priority`, `category`, `assigneeId`, `page`, `pageSize`) |
| `POST` | `/api/v1/tickets` | Any signed-in role | Create ticket; category is currently created on first use |
| `GET` | `/api/v1/tickets/:id` | Reporter, Technician, Admin | Read ticket, comments, visible history; accepts UUID or `IT-####` number |
| `PATCH` | `/api/v1/tickets/:id` | Technician/Admin | Edit title, description, category, impact, urgency |
| `POST` | `/api/v1/tickets/:id/status` | Technician/Admin; reporter may close/reopen own resolved ticket | Transition status; resolving requires a note; reopening requires a comment |
| `POST` | `/api/v1/tickets/:id/assign` | Technician self-assign; Admin assigns user | Assign ticket and advance New to Assigned |
| `POST` | `/api/v1/tickets/:id/comments` | Reporter, Technician, Admin | Add public reply or staff-only internal note |
| `DELETE` | `/api/v1/tickets/:id` | Admin | Soft-delete ticket and append a delete event |

Ticket status and history changes are written transactionally. Priorities are computed from impact/urgency. Ticket and category records are tenant-scoped.

### Asset API

Asset routes are tenant-scoped under `/api/v1/assets`. `GET /assets` supports search, type/condition, assignee, warranty-expiry, retired-asset, and pagination filters. Retired assets are excluded by default; `condition=RETIRED` and `includeRetired=true` make them queryable. Asset detail responses include related tickets and assignment history. Asset create/update/retire actions are restricted to IT staff, with retirement limited to IT Admins.

Assignment changes are recorded in the additive `asset_assignments` table, including the previous/new assignee IDs and name snapshots, actor, and timestamp. Apply the reviewed, non-destructive schema sync before deploying code that uses this table.

### Dashboard API

`GET /api/v1/dashboard/summary` is available to IT Admins and Technicians. The response includes all-time ticket counts by status; average resolution time and category counts over the last 30 days; server-calculated overdue tickets and per-technician open/overdue workload; and asset counts by type/condition plus warranties expiring within 30 days. SLA policy editing, progress timers, escalation, gate, and stock metrics are not part of this API.

### Running the Application

Development mode:

```bash
pnpm run start:dev
```

Production build:

```bash
pnpm run build
```

The build command generates the Prisma client from `prisma/schema.prisma` before compiling the application.

## Code Quality & Git Hooks

FixFlow uses Husky and Commitlint to maintain code quality and enforce consistent commit messages.

### Pre-commit Checks

The following checks are executed before a commit is accepted:

- Linting
- Production build verification

### Commit Message Convention

All commits must follow the **Conventional Commits** format:

```text
<type>(<scope>): <description>
```

The following commit types are approved for this project:

| Type | Description | Example |
|---|---|---|
| `feat` | Introduces a new feature | `feat(auth): implement JWT authentication` |
| `fix` | Fixes a bug | `fix(tickets): correct status update logic` |
| `docs` | Documentation changes | `docs: update API documentation` |
| `refactor` | Code restructuring without changing functionality | `refactor(users): simplify user service` |
| `test` | Adds or modifies tests | `test(tickets): add assignment tests` |
| `chore` | General maintenance and tooling | `chore: configure husky` |
| `build` | Build system or dependency changes | `build: update NestJS dependencies` |
| `ci` | CI/CD configuration changes | `ci: configure GitHub Actions` |
| `perf` | Performance improvements | `perf(tickets): optimize ticket queries` |
| `style` | Formatting changes without affecting logic | `style: format source files` |
| `revert` | Reverts a previous commit | `revert: undo ticket assignment` |

### Commit Message Examples

```bash
git commit -m "feat(auth): implement JWT authentication"

git commit -m "feat(tickets): add ticket creation endpoint"

git commit -m "fix(assignments): prevent duplicate assignments"

git commit -m "test(sla): add deadline calculation tests"

git commit -m "chore: configure commitlint and husky"
```

**Important:** Commit messages that do not follow the agreed convention will be rejected by Commitlint.

## Contribution Guidelines

1. Create a feature branch before implementing changes.
2. Follow the established NestJS module architecture.
3. Write clean, maintainable, and reusable code.
4. Follow the project's naming and coding conventions.
5. Ensure linting and build checks pass before committing.
6. Use the approved Conventional Commit formats.
7. Submit changes through pull requests for review and integration.
