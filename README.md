# ITrack

**A modern and streamlined IT Support Ticket & Asset Management System.**

FixFlow simplifies IT support operations by providing a centralized platform for reporting technical issues, managing support tickets, tracking IT assets, assigning support personnel, and monitoring ticket resolution.

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

## Project Status

Currently under development.

---

**FixFlow**  
*Streamlining IT support, one ticket at a time.*