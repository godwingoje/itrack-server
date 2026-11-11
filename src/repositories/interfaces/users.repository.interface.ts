import { Role } from '../../generated/prisma/enums';

export interface UserRecord {
  id: string;
  staffId: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: Role;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    code: string;
  };
  departmentId: string;
  department: {
    id: string;
    name: string;
    code: string;
  };
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentRecord {
  id: string;
  name: string;
  code: string;
}

export interface CreateUserRecordInput {
  staffId: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: Role;
  organizationId: string;
  departmentId: string;
  phone: string | null;
  address: string | null;
}

export interface UsersRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findByStaffId(staffId: string): Promise<UserRecord | null>;
  findAllByOrganizationId(organizationId: string): Promise<UserRecord[]>;
  findDepartmentsByOrganizationId(
    organizationId: string,
  ): Promise<DepartmentRecord[]>;
  create(
    input: CreateUserRecordInput,
  ): Promise<UserRecord | null>;
}
