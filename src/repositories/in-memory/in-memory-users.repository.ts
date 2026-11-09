import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Role } from '../../generated/prisma/enums';
import {
  UserRecord,
  UsersRepository,
} from '../interfaces/users.repository.interface';

@Injectable()
export class InMemoryUsersRepository implements UsersRepository, OnModuleInit {
  private users: UserRecord[] = [];

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const rawPassword =
      this.configService.get<string>('SEED_PASSWORD') || 'password123';
    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const now = new Date();

    const dummyOrg = {
      id: 'o1000000-0000-0000-0000-000000000001',
      name: 'FixFlow Technologies',
      code: 'FIXFLOW',
    };

    const itDept = {
      id: 'd1000000-0000-0000-0000-000000000001',
      name: 'Information Technology',
      code: 'IT',
    };
    const finDept = {
      id: 'd1000000-0000-0000-0000-000000000002',
      name: 'Finance',
      code: 'FIN',
    };
    const hrDept = {
      id: 'd1000000-0000-0000-0000-000000000003',
      name: 'Human Resources',
      code: 'HR',
    };
    const secDept = {
      id: 'd1000000-0000-0000-0000-000000000004',
      name: 'Security',
      code: 'SEC',
    };

    this.users = [
      {
        id: 'u1000000-0000-0000-0000-000000000001',
        staffId: 'EMP-001',
        fullName: 'Amaka Okeke',
        email: 'employee@fixflow.local',
        passwordHash,
        role: Role.EMPLOYEE,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: finDept.id,
        department: finDept,
        phone: '08011112222',
        address: 'Lagos, Nigeria',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u1000000-0000-0000-0000-000000000002',
        staffId: 'TECH-001',
        fullName: 'Tunde Adeleke',
        email: 'technician@fixflow.local',
        passwordHash,
        role: Role.TECHNICIAN,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: itDept.id,
        department: itDept,
        phone: '08022223333',
        address: 'Lagos, Nigeria',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u1000000-0000-0000-0000-000000000003',
        staffId: 'ADM-001',
        fullName: 'Ngozi Eze',
        email: 'admin@fixflow.local',
        passwordHash,
        role: Role.IT_ADMIN,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: itDept.id,
        department: itDept,
        phone: '08033334444',
        address: 'Lagos, Nigeria',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u1000000-0000-0000-0000-000000000004',
        staffId: 'SEC-001',
        fullName: 'Musa Ibrahim',
        email: 'security@fixflow.local',
        passwordHash,
        role: Role.SECURITY,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: secDept.id,
        department: secDept,
        phone: '08044445555',
        address: 'Lagos, Nigeria',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u1000000-0000-0000-0000-000000000005',
        staffId: 'INA-001',
        fullName: 'Inactive User',
        email: 'inactive@fixflow.local',
        passwordHash,
        role: Role.EMPLOYEE,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: hrDept.id,
        department: hrDept,
        phone: null,
        address: null,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.trim().toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === normalized) ?? null;
  }
}
