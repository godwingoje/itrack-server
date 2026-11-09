import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
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
}
