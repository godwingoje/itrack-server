import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Role } from '../../generated/prisma/enums';
import {
  CreateUserRecordInput,
  DepartmentRecord,
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
      name: 'IT',
      code: 'IT',
    };
    const financeDept = {
      id: 'd1000000-0000-0000-0000-000000000002',
      name: 'Finance',
      code: 'FIN',
    };
    const hrDept = {
      id: 'd1000000-0000-0000-0000-000000000003',
      name: 'HR',
      code: 'HR',
    };
    const secDept = {
      id: 'd1000000-0000-0000-0000-000000000004',
      name: 'Security',
      code: 'SEC',
    };
    const operationsDept = {
      id: 'd1000000-0000-0000-0000-000000000005',
      name: 'Operations',
      code: 'OPS',
    };

    this.users = [
      {
        id: 'u01',
        staffId: 'IT-A-001',
        fullName: 'Ngozi Eze',
        email: 'ngozi.eze@abuad.edu.ng',
        passwordHash,
        role: Role.IT_ADMIN,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: itDept.id,
        department: itDept,
        phone: null,
        address: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u02',
        staffId: 'IT-T-014',
        fullName: 'Tunde Adeyemi',
        email: 'tunde.adeyemi@abuad.edu.ng',
        passwordHash,
        role: Role.TECHNICIAN,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: itDept.id,
        department: itDept,
        phone: null,
        address: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u03',
        staffId: 'IT-T-021',
        fullName: 'Ifeanyi Okafor',
        email: 'ifeanyi.okafor@abuad.edu.ng',
        passwordHash,
        role: Role.TECHNICIAN,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: itDept.id,
        department: itDept,
        phone: null,
        address: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u04',
        staffId: 'IT-T-008',
        fullName: 'Kemi Sodipo',
        email: 'kemi.sodipo@abuad.edu.ng',
        passwordHash,
        role: Role.TECHNICIAN,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: itDept.id,
        department: itDept,
        phone: null,
        address: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u05',
        staffId: 'FIN-0112',
        fullName: 'Bola Kadri',
        email: 'bola.kadri@abuad.edu.ng',
        passwordHash,
        role: Role.EMPLOYEE,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: financeDept.id,
        department: financeDept,
        phone: null,
        address: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u06',
        staffId: 'OPS-0067',
        fullName: 'Yusuf Bello',
        email: 'yusuf.bello@abuad.edu.ng',
        passwordHash,
        role: Role.EMPLOYEE,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: operationsDept.id,
        department: operationsDept,
        phone: null,
        address: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u07',
        staffId: 'FIN-0098',
        fullName: 'Amaka Obi',
        email: 'amaka.obi@abuad.edu.ng',
        passwordHash,
        role: Role.EMPLOYEE,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: financeDept.id,
        department: financeDept,
        phone: null,
        address: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u08',
        staffId: 'HR-0033',
        fullName: 'Chidi Nwafor',
        email: 'chidi.nwafor@abuad.edu.ng',
        passwordHash,
        role: Role.EMPLOYEE,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: hrDept.id,
        department: hrDept,
        phone: null,
        address: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u09',
        staffId: 'SEC-0002',
        fullName: 'Sani Musa',
        email: 'sani.musa@abuad.edu.ng',
        passwordHash,
        role: Role.SECURITY,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: secDept.id,
        department: secDept,
        phone: null,
        address: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'u10',
        staffId: 'IT-T-031',
        fullName: 'Sade Bello',
        email: 'sade.bello@abuad.edu.ng',
        passwordHash,
        role: Role.TECHNICIAN,
        organizationId: dummyOrg.id,
        organization: dummyOrg,
        departmentId: itDept.id,
        department: itDept,
        phone: null,
        address: null,
        isActive: true,
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

  async findByStaffId(staffId: string): Promise<UserRecord | null> {
    const normalized = staffId.trim().toLowerCase();
    return this.users.find((u) => u.staffId.toLowerCase() === normalized) ?? null;
  }

  async findAllByOrganizationId(organizationId: string): Promise<UserRecord[]> {
    return this.users.filter((user) => user.organizationId === organizationId);
  }

  async findDepartmentsByOrganizationId(
    organizationId: string,
  ): Promise<DepartmentRecord[]> {
    const departments = new Map<string, DepartmentRecord>();
    for (const user of this.users) {
      if (user.organizationId === organizationId) {
        departments.set(user.department.id, user.department);
      }
    }
    return [...departments.values()];
  }

  async create(input: CreateUserRecordInput): Promise<UserRecord | null> {
    const organizationUser = this.users.find(
      (user) => user.organizationId === input.organizationId,
    );
    const departmentUser = this.users.find(
      (user) =>
        user.organizationId === input.organizationId &&
        user.departmentId === input.departmentId,
    );
    if (!organizationUser || !departmentUser) return null;

    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      ...input,
      email: input.email.trim().toLowerCase(),
      organization: organizationUser.organization,
      department: departmentUser.department,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(user);
    return user;
  }
}
