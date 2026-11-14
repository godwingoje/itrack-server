import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { Role } from '../src/generated/prisma/enums';

const organizationCode = 'ITRACK-DEMO';
const organizationName = 'Afe Babalola University';
const departmentCode = 'ITRACK-DEMO-IT';

const people = [
  { fullName: 'David Toluwanimi D.', emailName: 'david' },
  { fullName: 'Eseka John O.', emailName: 'john' },
  { fullName: 'Nwagbo Somadina C.', emailName: 'somadina' },
  { fullName: 'Goje Godwin M.', emailName: 'godwin' },
  { fullName: 'Okoronkwo Daniel', emailName: 'daniel.okoronkwo' },
  { fullName: 'Mosugu Aha', emailName: 'aha' },
  { fullName: 'Nzenwata Daniel', emailName: 'daniel.nzenwata' },
  { fullName: 'Adebayo Samuel', emailName: 'samuel' },
  { fullName: 'Ikhine Emmanuel', emailName: 'emmanuel' },
  { fullName: 'Ekoyo Daniel', emailName: 'daniel.ekoyo' },
  { fullName: 'Afolabi Solomon', emailName: 'solomon' },
  { fullName: 'Oyewumi Victor O.', emailName: 'victor' },
] as const;

const roleDefinitions = [
  {
    envKey: 'DEMO_ADMIN_PASSWORD',
    emailSuffix: 'it-admin',
    role: Role.IT_ADMIN,
  },
  {
    envKey: 'DEMO_TECHNICIAN_PASSWORD',
    emailSuffix: 'technician',
    role: Role.TECHNICIAN,
  },
  {
    envKey: 'DEMO_EMPLOYEE_PASSWORD',
    emailSuffix: 'employee',
    role: Role.EMPLOYEE,
  },
] as const;

const accountDefinitions = people.flatMap(({ fullName, emailName }) =>
  roleDefinitions.map(({ envKey, emailSuffix, role }) => ({
    envKey,
    email: `${emailName}-${emailSuffix}@abuad.edu.ng`,
    staffId: `ABUAD-${emailName.replace(/\./g, '-').toUpperCase()}-${emailSuffix.toUpperCase()}`,
    fullName,
    role,
  })),
);

function readPasswords(): Map<string, string> {
  const passwords = new Map<string, string>();
  const missing: string[] = [];

  for (const role of roleDefinitions) {
    const password = process.env[role.envKey];
    if (!password || password.length < 12) {
      missing.push(role.envKey);
      continue;
    }
    passwords.set(role.envKey, password);
  }

  if (missing.length) {
    throw new Error(
      `Set fresh passwords (at least 12 characters) for ${missing.join(', ')} in the ignored server .env before seeding.`,
    );
  }

  return passwords;
}

function assertUniqueAccountIdentifiers(): void {
  const emails = new Set(accountDefinitions.map(({ email }) => email));
  const staffIds = new Set(accountDefinitions.map(({ staffId }) => staffId));
  if (
    accountDefinitions.length !== 36 ||
    emails.size !== accountDefinitions.length ||
    staffIds.size !== accountDefinitions.length
  ) {
    throw new Error(
      'Demo accounts must contain 36 unique emails and staff IDs.',
    );
  }
}

function assertRemoteWriteConfirmed(connectionString: string): void {
  const hostname = new URL(connectionString).hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (
    !localHosts.has(hostname) &&
    process.env.CONFIRM_REMOTE_DEMO_SEED !== 'I_APPROVE_THIS_DATABASE_WRITE'
  ) {
    throw new Error(
      'Remote database seeding is blocked. Set CONFIRM_REMOTE_DEMO_SEED=I_APPROVE_THIS_DATABASE_WRITE for this command only after reviewing the target.',
    );
  }
}

async function printDryRun(prisma: PrismaClient): Promise<void> {
  const organization = await prisma.organization.findUnique({
    where: { code: organizationCode },
    select: { id: true, name: true },
  });
  if (!organization) {
    throw new Error(
      `The target organization ${organizationCode} does not exist.`,
    );
  }

  const [existingTargetUsers, currentUsers, ticketCount] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: accountDefinitions.map(({ email }) => email) } },
      select: { email: true, organizationId: true },
    }),
    prisma.user.findMany({
      where: { organizationId: organization.id },
      select: { email: true, isActive: true },
    }),
    prisma.ticket.count({ where: { organizationId: organization.id } }),
  ]);
  const foreignMatches = existingTargetUsers.filter(
    ({ organizationId }) => organizationId !== organization.id,
  );
  if (foreignMatches.length) {
    throw new Error(
      'One or more requested email addresses already belong to another organization.',
    );
  }

  const targetEmails = new Set(accountDefinitions.map(({ email }) => email));
  const legacyAccounts = currentUsers.filter(
    ({ email }) => !targetEmails.has(email),
  );
  const createdCount = accountDefinitions.length - existingTargetUsers.length;

  console.info(
    JSON.stringify(
      {
        dryRun: true,
        organization: {
          currentName: organization.name,
          newName: organizationName,
          code: organizationCode,
        },
        accounts: {
          total: accountDefinitions.length,
          byRole: Object.fromEntries(
            roleDefinitions.map(({ role }) => [
              role,
              accountDefinitions.filter((account) => account.role === role)
                .length,
            ]),
          ),
          created: createdCount,
          updated: existingTargetUsers.length,
          legacyAccountsToDeactivate: legacyAccounts.length,
          emailAddresses: accountDefinitions.map(({ email }) => email),
        },
        ticketsPreserved: ticketCount,
      },
      null,
      2,
    ),
  );
}

async function seed(prisma: PrismaClient, passwordHashes: Map<string, string>) {
  return prisma.$transaction(
    async (transaction) => {
      const organization = await transaction.organization.upsert({
        where: { code: organizationCode },
        update: { name: organizationName },
        create: { name: organizationName, code: organizationCode },
      });

      const existingDepartment = await transaction.department.findUnique({
        where: { code: departmentCode },
      });
      if (
        existingDepartment &&
        existingDepartment.organizationId !== organization.id
      ) {
        throw new Error(
          'The demo department code belongs to a different organization.',
        );
      }

      const department =
        existingDepartment ??
        (await transaction.department.create({
          data: {
            name: 'IT Support',
            code: departmentCode,
            organizationId: organization.id,
          },
        }));

      const emails = accountDefinitions.map(({ email }) => email);
      const staffIds = accountDefinitions.map(({ staffId }) => staffId);
      const [existingByEmail, existingByStaffId] = await Promise.all([
        transaction.user.findMany({
          where: { email: { in: emails } },
          select: {
            id: true,
            email: true,
            staffId: true,
            organizationId: true,
          },
        }),
        transaction.user.findMany({
          where: { staffId: { in: staffIds } },
          select: { email: true, staffId: true },
        }),
      ]);

      if (
        existingByEmail.some((user) => user.organizationId !== organization.id)
      ) {
        throw new Error(
          'One or more requested email addresses already belong to another organization.',
        );
      }
      if (
        existingByStaffId.some(
          (user) =>
            accountDefinitions.find(
              (account) => account.staffId === user.staffId,
            )?.email !== user.email,
        )
      ) {
        throw new Error('One or more requested staff IDs are already in use.');
      }

      const legacyUsers = await transaction.user.findMany({
        where: {
          organizationId: organization.id,
          email: { notIn: emails },
        },
        select: { id: true },
      });
      const legacyUserIds = legacyUsers.map(({ id }) => id);
      await transaction.user.updateMany({
        where: {
          organizationId: organization.id,
          email: { notIn: emails },
        },
        data: { isActive: false },
      });

      const existingIds = existingByEmail.map(({ id }) => id);
      const targetUserIds: string[] = [];
      let createdCount = 0;
      let updatedCount = 0;

      for (const account of accountDefinitions) {
        const passwordHash = passwordHashes.get(account.email);
        if (!passwordHash) {
          throw new Error(`Missing password hash for ${account.email}.`);
        }
        const user = await transaction.user.upsert({
          where: { email: account.email },
          update: {
            staffId: account.staffId,
            fullName: account.fullName,
            passwordHash,
            role: account.role,
            organizationId: organization.id,
            departmentId: department.id,
            isActive: true,
          },
          create: {
            email: account.email,
            staffId: account.staffId,
            fullName: account.fullName,
            passwordHash,
            role: account.role,
            organizationId: organization.id,
            departmentId: department.id,
          },
          select: { id: true },
        });

        targetUserIds.push(user.id);
        if (existingByEmail.some(({ email }) => email === account.email)) {
          updatedCount += 1;
        } else {
          createdCount += 1;
        }
      }

      const affectedUserIds = [
        ...new Set([...legacyUserIds, ...existingIds, ...targetUserIds]),
      ];
      if (affectedUserIds.length) {
        await transaction.refreshSession.updateMany({
          where: { userId: { in: affectedUserIds }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      const activeCount = await transaction.user.count({
        where: { organizationId: organization.id, isActive: true },
      });
      if (activeCount !== accountDefinitions.length) {
        throw new Error(
          `Expected 36 active demo accounts; found ${activeCount}.`,
        );
      }

      return {
        organizationName: organization.name,
        createdCount,
        updatedCount,
        deactivatedLegacyCount: legacyUsers.length,
        activeCount,
        emails: accountDefinitions.map(({ email }) => email),
      };
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

async function hashAccountPasswords(
  passwords: Map<string, string>,
): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  for (const account of accountDefinitions) {
    const password = passwords.get(account.envKey);
    if (!password) {
      throw new Error(`Missing configured password for ${account.envKey}.`);
    }
    hashes.set(account.email, await bcrypt.hash(password, 12));
  }
  return hashes;
}

async function main() {
  assertUniqueAccountIdentifiers();

  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL_UNPOOLED or DATABASE_URL must be set in the server .env.',
    );
  }
  assertRemoteWriteConfirmed(connectionString);

  const passwords = readPasswords();
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    if (process.argv.includes('--dry-run')) {
      await printDryRun(prisma);
      return;
    }

    const passwordHashes = await hashAccountPasswords(passwords);
    const result = await seed(prisma, passwordHashes);
    console.info(
      JSON.stringify(
        {
          organization: result.organizationName,
          created: result.createdCount,
          updated: result.updatedCount,
          legacyAccountsDeactivated: result.deactivatedLegacyCount,
          activeAccounts: result.activeCount,
          emails: result.emails,
          ticketRecordsDeleted: 0,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Demo seed failed.');
  process.exitCode = 1;
});
