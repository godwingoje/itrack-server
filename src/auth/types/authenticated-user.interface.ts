import { Role } from '../../generated/prisma/enums';

export interface AuthenticatedUser {
  id: string;
  staffId: string;
  fullName: string;
  email: string;
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
}
