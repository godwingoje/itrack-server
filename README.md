# ITrack

**A modern and streamlined IT Support Ticket & Asset Management System.**

ITrack simplifies IT support operations by providing a centralized platform for reporting technical issues, managing support tickets, tracking IT assets, assigning support personnel, and monitoring ticket resolution.

## Overview

ITrack is designed to improve how organizations manage IT support requests and assets. It provides employees and IT support teams with an organized workflow for reporting issues, tracking progress, managing devices, and ensuring accountability throughout the support process.

## Core Features

- **Ticket Management:** Create, assign, track, and manage IT support tickets.
- **Asset Management:** Register, retrieve, and manage organizational IT assets.
- **Support Assignment:** Assign IT support personnel to tickets and assets where applicable.
- **SLA Management:** Monitor service-level agreements and ticket resolution timelines.
- **Ticket History:** Maintain records of ticket activities, comments, and status changes.
- **Gate Pass Management:** Manage and verify asset movement.
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
cd fixflow-server
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

For Render, set `NODE_ENV=production`, `DATA_SOURCE=prisma`, `DATABASE_URL` to the production PostgreSQL connection string, and `JWT_SECRET` to a unique secret of at least 32 characters. Keep `PORT` on Render's assigned value (the service reads it automatically); optionally set `JWT_EXPIRES_IN`. `CORS_ORIGINS` is a comma-separated list of exact frontend origins and can remain unset while the frontend is local. Add the deployed frontend origin there when one exists. Do not set `SEED_PASSWORD` for production Prisma data.

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
