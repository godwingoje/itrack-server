import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateUserRecordInput,
  DepartmentRecord,
  UserRecord,
  UsersRepository,
} from '../interfaces/users.repository.interface';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        organization: true,
      },
    });
    if (!user) return null;

    return {
      id: user.id,
      staffId: user.staffId,
      fullName: user.fullName,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      organizationId: user.organizationId,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        code: user.organization.code,
      },
      departmentId: user.departmentId,
      department: {
        id: user.department.id,
        name: user.department.name,
        code: user.department.code,
      },
      phone: user.phone,
      address: user.address,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      include: {
        department: true,
        organization: true,
      },
    });
    if (!user) return null;

    return this.toRecord(user);
  }

  async findByStaffId(staffId: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { staffId: staffId.trim() },
      include: { department: true, organization: true },
    });
    return user ? this.toRecord(user) : null;
  }

  async findAllByOrganizationId(
    organizationId: string,
  ): Promise<UserRecord[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
      include: { department: true, organization: true },
      orderBy: { fullName: 'asc' },
    });
    return users.map((user) => this.toRecord(user));
  }

  async findDepartmentsByOrganizationId(
    organizationId: string,
  ): Promise<DepartmentRecord[]> {
    return this.prisma.department.findMany({
      where: { organizationId },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(
    input: CreateUserRecordInput,
  ): Promise<UserRecord | null> {
    const department = await this.prisma.department.findFirst({
      where: {
        id: input.departmentId,
        organizationId: input.organizationId,
      },
      select: { id: true },
    });
    if (!department) return null;

    const user = await this.prisma.user.create({
      data: {
        staffId: input.staffId,
        fullName: input.fullName,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
        organizationId: input.organizationId,
        departmentId: department.id,
        phone: input.phone,
        address: input.address,
      },
      include: { department: true, organization: true },
    });
    return this.toRecord(user);
  }

  private toRecord(user: {
    id: string;
    staffId: string;
    fullName: string;
    email: string;
    passwordHash: string;
    role: UserRecord['role'];
    organizationId: string;
    organization: UserRecord['organization'];
    departmentId: string;
    department: UserRecord['department'];
    phone: string | null;
    address: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): UserRecord {
    return {
      id: user.id,
      staffId: user.staffId,
      fullName: user.fullName,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      organizationId: user.organizationId,
      organization: user.organization,
      departmentId: user.departmentId,
      department: user.department,
      phone: user.phone,
      address: user.address,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
