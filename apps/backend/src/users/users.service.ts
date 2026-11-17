import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateUserDto, UpdateUserDto } from './dtos/users.dto';
import { UpdateProfileDto, ChangePasswordDto } from './dtos/profile.dto';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findByEmail(email: string) {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    return user;
  }

  async findById(id: number) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findAll(page: number, limit: number, search?: string, roleId?: number, isActive?: boolean) {
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nic_no: { contains: search, mode: 'insensitive' } },
        { student: { is: { registration_number: { contains: search, mode: 'insensitive' } } } },
        { student: { is: { index_number: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (roleId) {
      where.role_id = roleId;
    }

    if (isActive !== undefined) {
      where.is_active = isActive;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          role: true,
          student: {
            include: {
              degree: {
                include: {
                  department: true,
                },
              },
              specialization: {
                include: {
                  department: true,
                },
              },
            },
          },
          lecturer: {
            include: {
              department: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(createUserDto: CreateUserDto, executorId: number): Promise<User> {
    const {
      email,
      fullName,
      nameWithInitials,
      nicNo,
      dateOfBirth,
      phoneNumber,
      address,
      password,
      roleId,
      isActive,
      studentProfile,
      lecturerProfile,
    } = createUserDto;

    // 1. Verify email uniqueness
    const emailExists = await this.prisma.user.findUnique({ where: { email } });
    if (emailExists) {
      throw new BadRequestException('Email address already registered');
    }

    // 2. Verify NIC uniqueness
    const nicExists = await this.prisma.user.findUnique({ where: { nic_no: nicNo } });
    if (nicExists) {
      throw new BadRequestException('NIC number already registered');
    }

    // 3. Hash password (default to NIC number if not provided)
    const rawPassword = password || nicNo;
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // 4. Perform transactional creation
    const createdUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          full_name: fullName,
          name_with_initials: nameWithInitials,
          email,
          password_hash: hashedPassword,
          role_id: roleId,
          is_active: isActive !== undefined ? isActive : true,
          nic_no: nicNo,
          date_of_birth: new Date(dateOfBirth),
          phone_number: phoneNumber,
          address,
        },
      });

      if (roleId === 4) {
        // Student
        if (!studentProfile) {
          throw new BadRequestException('Student profile parameters are required for student role');
        }

        const regExists = await tx.student.findUnique({
          where: { registration_number: studentProfile.registrationNumber },
        });
        if (regExists) {
          throw new BadRequestException('Student registration number already exists');
        }

        const indexExists = await tx.student.findUnique({
          where: { index_number: studentProfile.indexNumber },
        });
        if (indexExists) {
          throw new BadRequestException('Student index number already exists');
        }

        const degreeExists = await tx.degree.findUnique({
          where: { degree_id: studentProfile.degreeId },
        });
        if (!degreeExists) {
          throw new BadRequestException('Selected degree does not exist');
        }

        if (studentProfile.specializationId) {
          const specExists = await tx.specialization.findUnique({
            where: { specialization_id: studentProfile.specializationId },
          });
          if (!specExists || specExists.degree_id !== studentProfile.degreeId) {
            throw new BadRequestException('Selected specialization is invalid for this degree');
          }
        }

        await tx.student.create({
          data: {
            user_id: user.user_id,
            registration_number: studentProfile.registrationNumber,
            index_number: studentProfile.indexNumber,
            degree_id: studentProfile.degreeId,
            specialization_id: studentProfile.specializationId || null,
            batch: studentProfile.batch || '21/22',
          },
        });
      } else if (roleId === 3) {
        // Lecturer
        if (!lecturerProfile) {
          throw new BadRequestException(
            'Lecturer profile parameters are required for lecturer role',
          );
        }

        const empExists = await tx.lecturer.findUnique({
          where: { employee_number: lecturerProfile.employeeNumber },
        });
        if (empExists) {
          throw new BadRequestException('Lecturer employee number already exists');
        }

        if (lecturerProfile.isHead) {
          const existingHeads = await tx.lecturer.findMany({
            where: {
              department_id: lecturerProfile.departmentId,
              is_head: true,
            },
            include: { user: true, department: true },
          });

          if (existingHeads.length > 0) {
            await tx.lecturer.updateMany({
              where: {
                department_id: lecturerProfile.departmentId,
                is_head: true,
              },
              data: { is_head: false },
            });

            for (const prevHead of existingHeads) {
              await this.auditService.logAction(
                executorId,
                'DEPARTMENT_HEAD_TRANSFER',
                'lecturers',
                prevHead.lecturer_id.toString(),
                {
                  department_id: lecturerProfile.departmentId,
                  department_name: prevHead.department?.department_name,
                  previous_head_id: prevHead.lecturer_id,
                  previous_head_user_id: prevHead.user_id,
                  previous_head_name: prevHead.user?.full_name,
                  is_head: true,
                },
                {
                  department_id: lecturerProfile.departmentId,
                  department_name: prevHead.department?.department_name,
                  new_head_user_id: user.user_id,
                  new_head_name: fullName,
                  is_head: false,
                  reason: 'Department head replaced by new lecturer creation',
                },
              );
            }
          }
        }

        await tx.lecturer.create({
          data: {
            user_id: user.user_id,
            employee_number: lecturerProfile.employeeNumber,
            department_id: lecturerProfile.departmentId,
            specialization: lecturerProfile.specialization || null,
            is_head: lecturerProfile.isHead || false,
            is_dean: lecturerProfile.isDean || false,
          },
        });
      }

      // Log action
      await this.auditService.logAction(
        executorId,
        'USER_CREATE',
        'users',
        user.user_id.toString(),
        null,
        { email, fullName, roleId, isActive, studentProfile, lecturerProfile },
      );

      return user;
    });

    // 5. Send welcome email (non-blocking — does not affect user creation outcome)
    this.notificationsService.sendWelcomeEmail(email, fullName, rawPassword).catch(() => {
      /* Errors are already logged inside NotificationsService */
    });

    return createdUser;
  }

  async update(userId: number, updateUserDto: UpdateUserDto, executorId: number): Promise<User> {
    const existingUser = await this.findById(userId);
    const {
      email,
      fullName,
      nameWithInitials,
      nicNo,
      dateOfBirth,
      phoneNumber,
      address,
      password,
      roleId,
      isActive,
      studentProfile,
      lecturerProfile,
    } = updateUserDto;

    // If changing email, verify uniqueness
    if (email && email !== existingUser.email) {
      const emailExists = await this.prisma.user.findUnique({ where: { email } });
      if (emailExists) {
        throw new BadRequestException('Email address already registered');
      }
    }

    // If changing NIC, verify uniqueness
    if (nicNo && nicNo !== existingUser.nic_no) {
      const nicExists = await this.prisma.user.findUnique({ where: { nic_no: nicNo } });
      if (nicExists) {
        throw new BadRequestException('NIC number already registered');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Prepare user updates
      const updateData: Prisma.UserUpdateInput = {};
      if (email) updateData.email = email;
      if (fullName) updateData.full_name = fullName;
      if (nameWithInitials) updateData.name_with_initials = nameWithInitials;
      if (nicNo) updateData.nic_no = nicNo;
      if (dateOfBirth) updateData.date_of_birth = new Date(dateOfBirth);
      if (phoneNumber) updateData.phone_number = phoneNumber;
      if (address) updateData.address = address;
      if (isActive !== undefined) updateData.is_active = isActive;
      if (roleId) updateData.role = { connect: { role_id: roleId } };
      if (password) updateData.password_hash = await bcrypt.hash(password, 10);

      const updatedUser = await tx.user.update({
        where: { user_id: userId },
        data: updateData,
      });

      const activeRole = roleId || existingUser.role_id;

      // 2. Manage and clean up profile records
      if (activeRole === 4) {
        // Student
        // Delete lecturer record if shifting roles
        await tx.lecturer.deleteMany({ where: { user_id: userId } });

        if (!studentProfile) {
          throw new BadRequestException('Student profile parameters are required for student role');
        }

        const regExists = await tx.student.findFirst({
          where: {
            registration_number: studentProfile.registrationNumber,
            NOT: { user_id: userId },
          },
        });
        if (regExists) {
          throw new BadRequestException('Student registration number already allocated');
        }

        const indexExists = await tx.student.findFirst({
          where: {
            index_number: studentProfile.indexNumber,
            NOT: { user_id: userId },
          },
        });
        if (indexExists) {
          throw new BadRequestException('Student index number already allocated');
        }

        const degreeExists = await tx.degree.findUnique({
          where: { degree_id: studentProfile.degreeId },
        });
        if (!degreeExists) {
          throw new BadRequestException('Selected degree does not exist');
        }

        if (studentProfile.specializationId) {
          const specExists = await tx.specialization.findUnique({
            where: { specialization_id: studentProfile.specializationId },
          });
          if (!specExists || specExists.degree_id !== studentProfile.degreeId) {
            throw new BadRequestException('Selected specialization is invalid for this degree');
          }
        }

        await tx.student.upsert({
          where: { user_id: userId },
          create: {
            user_id: userId,
            registration_number: studentProfile.registrationNumber,
            index_number: studentProfile.indexNumber,
            degree_id: studentProfile.degreeId,
            specialization_id: studentProfile.specializationId || null,
            batch: studentProfile.batch || '21/22',
          },
          update: {
            registration_number: studentProfile.registrationNumber,
            index_number: studentProfile.indexNumber,
            degree_id: studentProfile.degreeId,
            specialization_id: studentProfile.specializationId || null,
            batch: studentProfile.batch || '21/22',
          },
        });
      } else if (activeRole === 3) {
        // Lecturer
        // Delete student record if shifting roles
        await tx.student.deleteMany({ where: { user_id: userId } });

        if (!lecturerProfile) {
          throw new BadRequestException(
            'Lecturer profile parameters are required for lecturer role',
          );
        }

        const empExists = await tx.lecturer.findFirst({
          where: {
            employee_number: lecturerProfile.employeeNumber,
            NOT: { user_id: userId },
          },
        });
        if (empExists) {
          throw new BadRequestException('Lecturer employee number already allocated');
        }

        if (lecturerProfile.isHead) {
          const existingHeads = await tx.lecturer.findMany({
            where: {
              department_id: lecturerProfile.departmentId,
              is_head: true,
              user_id: { not: userId },
            },
            include: { user: true, department: true },
          });

          if (existingHeads.length > 0) {
            await tx.lecturer.updateMany({
              where: {
                department_id: lecturerProfile.departmentId,
                is_head: true,
                user_id: { not: userId },
              },
              data: { is_head: false },
            });

            for (const prevHead of existingHeads) {
              await this.auditService.logAction(
                executorId,
                'DEPARTMENT_HEAD_TRANSFER',
                'lecturers',
                prevHead.lecturer_id.toString(),
                {
                  department_id: lecturerProfile.departmentId,
                  department_name: prevHead.department?.department_name,
                  previous_head_id: prevHead.lecturer_id,
                  previous_head_user_id: prevHead.user_id,
                  previous_head_name: prevHead.user?.full_name,
                  is_head: true,
                },
                {
                  department_id: lecturerProfile.departmentId,
                  department_name: prevHead.department?.department_name,
                  new_head_user_id: userId,
                  new_head_name: fullName || existingUser.full_name,
                  is_head: false,
                  reason: 'Department head replaced by lecturer update',
                },
              );
            }
          }
        }

        await tx.lecturer.upsert({
          where: { user_id: userId },
          create: {
            user_id: userId,
            employee_number: lecturerProfile.employeeNumber,
            department_id: lecturerProfile.departmentId,
            specialization: lecturerProfile.specialization || null,
            is_head: lecturerProfile.isHead || false,
            is_dean: lecturerProfile.isDean || false,
          },
          update: {
            employee_number: lecturerProfile.employeeNumber,
            department_id: lecturerProfile.departmentId,
            specialization: lecturerProfile.specialization || null,
            is_head: lecturerProfile.isHead || false,
            is_dean: lecturerProfile.isDean || false,
          },
        });
      } else {
        // If Admin or Staff, remove any sub-profiles
        await tx.student.deleteMany({ where: { user_id: userId } });
        await tx.lecturer.deleteMany({ where: { user_id: userId } });
      }

      // Log action
      await this.auditService.logAction(
        executorId,
        'USER_UPDATE',
        'users',
        userId.toString(),
        existingUser,
        { email, fullName, roleId, isActive, studentProfile, lecturerProfile },
      );

      return updatedUser;
    });
  }

  async updateStatus(userId: number, isActive: boolean, executorId: number): Promise<User> {
    const existingUser = await this.findById(userId);

    const updatedUser = await this.usersRepository.update(userId, {
      is_active: isActive,
    });

    await this.auditService.logAction(
      executorId,
      isActive ? 'USER_ENABLE' : 'USER_DISABLE',
      'users',
      userId.toString(),
      { is_active: existingUser.is_active },
      { is_active: isActive },
    );

    return updatedUser;
  }

  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<User> {
    const existingUser = await this.findById(userId);

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { user_id: userId },
        data: {
          phone_number: dto.phoneNumber || '',
        },
      });

      await this.auditService.logAction(
        userId,
        'USER_UPDATE_PROFILE',
        'users',
        userId.toString(),
        {
          phone_number: existingUser.phone_number,
        },
        { phone_number: dto.phoneNumber },
      );

      return tx.user.findUniqueOrThrow({
        where: { user_id: userId },
        include: {
          role: true,
          student: {
            include: {
              degree: {
                include: {
                  department: true,
                },
              },
              specialization: {
                include: {
                  department: true,
                },
              },
            },
          },
          lecturer: { include: { department: true } },
        },
      });
    });
  }

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const existingUser = await this.findById(userId);

    const match = await bcrypt.compare(dto.currentPassword, existingUser.password_hash);
    if (!match) {
      throw new BadRequestException('Incorrect current password.');
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirmation password do not match.');
    }

    const hashed = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { user_id: userId },
      data: {
        password_hash: hashed,
      },
    });

    await this.auditService.logAction(
      userId,
      'USER_PASSWORD_CHANGE',
      'users',
      userId.toString(),
      null,
      { password_changed: true },
    );
  }

  async findAllLecturers() {
    return this.prisma.lecturer.findMany({
      include: {
        user: {
          select: {
            full_name: true,
            email: true,
          },
        },
        department: {
          select: {
            department_id: true,
            department_code: true,
            department_name: true,
          },
        },
        courses: {
          include: {
            course: true,
          },
        },
      },
      orderBy: {
        user: {
          full_name: 'asc',
        },
      },
    });
  }

  async getStudentsForStaff(
    page: number = 1,
    limit: number = 10,
    search?: string,
    status?: string,
    degreeId?: number,
    academicYear?: number,
    batch?: string,
  ) {
    const where: Prisma.StudentWhereInput = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (degreeId) {
      where.degree_id = degreeId;
    }

    if (batch && batch !== 'ALL') {
      where.batch = batch;
    }

    if (search) {
      where.OR = [
        { index_number: { contains: search, mode: 'insensitive' } },
        { registration_number: { contains: search, mode: 'insensitive' } },
        { user: { full_name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              user_id: true,
              full_name: true,
              name_with_initials: true,
              email: true,
              phone_number: true,
              nic_no: true,
              is_active: true,
            },
          },
          degree: {
            include: {
              department: true,
            },
          },
          specialization: true,
          semester_gpas: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              registrations: true,
              course_grades: true,
              grace_chance_applications: true,
              recorrection_requests: true,
              medical_submissions: true,
            },
          },
        },
        orderBy: { student_id: 'desc' },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStudentFullAcademicRecord(studentId: number) {
    const student = await this.prisma.student.findUnique({
      where: { student_id: studentId },
      include: {
        user: {
          select: {
            user_id: true,
            full_name: true,
            name_with_initials: true,
            email: true,
            nic_no: true,
            date_of_birth: true,
            phone_number: true,
            address: true,
            is_active: true,
            created_at: true,
          },
        },
        degree: {
          include: {
            department: true,
          },
        },
        specialization: true,
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    const [
      registrations,
      courseGrades,
      semesterGpas,
      graceApplications,
      recorrectionRequests,
      medicalSubmissions,
    ] = await Promise.all([
      this.prisma.courseRegistration.findMany({
        where: { student_id: studentId },
        include: {
          course: {
            include: {
              department: true,
            },
          },
        },
        orderBy: { registration_date: 'asc' },
      }),
      this.prisma.studentCourseGrade.findMany({
        where: { student_id: studentId },
        include: {
          course: {
            include: {
              department: true,
            },
          },
        },
        orderBy: { course_id: 'asc' },
      }),
      this.prisma.studentSemesterGpa.findMany({
        where: { student_id: studentId },
        orderBy: [{ academic_year: 'asc' }, { semester: 'asc' }],
      }),
      this.prisma.graceChanceApplication.findMany({
        where: { student_id: studentId },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.recorrectionRequest.findMany({
        where: { student_id: studentId },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.medicalSubmission.findMany({
        where: { student_id: studentId },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      student,
      registrations,
      courseGrades,
      semesterGpas,
      graceApplications,
      recorrectionRequests,
      medicalSubmissions,
    };
  }

  async updateStudentAcademicStatus(
    studentId: number,
    status: string,
    enrollmentDate?: string,
    graduationDate?: string,
    executorId?: number,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { student_id: studentId },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    const updated = await this.prisma.student.update({
      where: { student_id: studentId },
      data: {
        status,
        enrollment_date: enrollmentDate ? new Date(enrollmentDate) : student.enrollment_date,
        graduation_date: graduationDate ? new Date(graduationDate) : student.graduation_date,
      },
    });

    if (executorId) {
      await this.auditService.logAction(
        executorId,
        'STUDENT_STATUS_UPDATE',
        'students',
        studentId.toString(),
        student,
        updated,
      );
    }

    return updated;
  }

  async deleteUser(userId: number, executorId: number, executorRole: string) {
    if (userId === executorId) {
      throw new BadRequestException('You cannot delete your own active account.');
    }

    const existingUser = await this.findById(userId);
    if (executorRole === 'EXAM_DIVISION_STAFF' && existingUser.role_id === 1) {
      throw new ForbiddenException(
        'Staff members are not permitted to delete Administrator accounts.',
      );
    }

    const [recordedMarksCount, recordedViolationsCount] = await Promise.all([
      this.prisma.examMark.count({ where: { recorded_by_id: userId } }),
      this.prisma.examViolation.count({ where: { recorded_by_id: userId } }),
    ]);

    if (recordedMarksCount > 0 || recordedViolationsCount > 0) {
      throw new BadRequestException(
        'Cannot delete user because they have recorded exam marks or violations. Deactivate the account instead.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.updateMany({
        where: { user_id: userId },
        data: { user_id: null },
      });

      await tx.user.delete({
        where: { user_id: userId },
      });
    });

    await this.auditService.logAction(
      executorId,
      'USER_DELETE',
      'users',
      userId.toString(),
      {
        user_id: existingUser.user_id,
        email: existingUser.email,
        full_name: existingUser.full_name,
        role_id: existingUser.role_id,
      },
      null,
    );

    return { user_id: userId };
  }

  async deleteStudent(studentId: number, executorId: number, executorRole: string) {
    const student = await this.prisma.student.findUnique({
      where: { student_id: studentId },
      select: { student_id: true, user_id: true, registration_number: true },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    await this.deleteUser(student.user_id, executorId, executorRole);
    return { student_id: studentId, user_id: student.user_id };
  }
}
