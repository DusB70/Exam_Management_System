import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        student: {
          include: {
            department: true,
          },
        },
        lecturer: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async findById(userId: number) {
    return this.prisma.user.findUnique({
      where: { user_id: userId },
      include: {
        role: true,
        student: {
          include: {
            department: true,
          },
        },
        lecturer: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async update(userId: number, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { user_id: userId },
      data,
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }
}
