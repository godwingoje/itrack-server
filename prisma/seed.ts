import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { Role } from '../src/generated/prisma/enums';

const organizationCode = 'ITRACK-DEMO';
const departmentCode = 'ITRACK-DEMO-IT';

const accountDefinitions = [
  {
    envKey: 'DEMO_ADMIN_PASSWORD',
    email: 'admin@itrack.example.com',
    staffId: 'DEMO-ADMIN-001',
    fullName: 'Demo IT Administrator',
    role: Role.IT_ADMIN,
  },
  {
    envKey: 'DEMO_TECHNICIAN_PASSWORD',
    email: 'technician@itrack.example.com',
    staffId: 'DEMO-TECH-001',
    fullName: 'Demo Technician',
    role: Role.TECHNICIAN,
  },
  {
    envKey: 'DEMO_EMPLOYEE_PASSWORD',
    email: 'employee@itrack.example.com',
    staffId: 'DEMO-EMP-001',
    fullName: 'Demo Employee',
    role: Role.EMPLOYEE,
  },
] as const;

function readPasswords(): Map<string, string> {
  const passwords = new Map<string, string>();
  const missing: string[] = [];

  for (const account of accountDefinitions) {
    const password = process.env[account.envKey];
    if (!password || password.length < 12) {
      missing.push(account.envKey);
      continue;
    }
    passwords.set(account.envKey, password);
  }

  if (missing.length) {
    throw new Error(
      `Set fresh passwords (at least 12 characters) for ${missing.join(', ')} in the ignored server .env before seeding.`,
    );
  }

  return passwords;
}

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL must be set in the server .env.');
  }

  const passwords = readPasswords();
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const organization = await prisma.organization.upsert({
      where: { code: organizationCode },
      update: {},
      create: { name: 'ITrack Demo Organization', code: organizationCode },
    });

    const existingDepartment = await prisma.department.findUnique({
      where: { code: departmentCode },
    });
    if (
      existingDepartment &&
      existingDepartment.organizationId !== organization.id
    ) {
      throw new Error('The demo department code belongs to a different organization.');
    }

    const department = existingDepartment ?? await prisma.department.create({
      data: {
        name: 'IT Support',
        code: departmentCode,
        organizationId: organization.id,
      },
    });

    const created: string[] = [];
    const skipped: string[] = [];

    for (const account of accountDefinitions) {
      const existing = await prisma.user.findUnique({
        where: { email: account.email },
        select: { id: true, organizationId: true, role: true, isActive: true },
      });

      if (existing) {
        if (
          existing.organizationId !== organization.id ||
          existing.role !== account.role ||
          !existing.isActive
        ) {
          throw new Error(`Existing demo account ${account.email} has an unexpected organization, role, or inactive state.`);
        }
        skipped.push(account.email);
        continue;
      }

      const password = passwords.get(account.envKey);
      if (!password) throw new Error(`Missing configured password for ${account.envKey}.`);

      await prisma.user.create({
        data: {
          email: account.email,
          staffId: account.staffId,
          fullName: account.fullName,
          role: account.role,
          organizationId: organization.id,
          departmentId: department.id,
          passwordHash: await bcrypt.hash(password, 12),
        },
      });
      created.push(account.email);
    }

    console.info(`Created demo accounts: ${created.length ? created.join(', ') : 'none'}`);
    console.info(`Already present (passwords unchanged): ${skipped.length ? skipped.join(', ') : 'none'}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Demo seed failed.');
  process.exitCode = 1;
});