import { UserRole } from '../../generated/prisma/enums.js';

export class CurrentUserDto {
  id!: string;
  role!: UserRole;
}
