import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Seed Roles
  const roles = [
    { role_id: 1, role_name: 'Administrator' },
    { role_id: 2, role_name: 'Exam Division Staff' },
    { role_id: 3, role_name: 'Lecturer' },
    { role_id: 4, role_name: 'Student' },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { role_id: r.role_id },
      update: { role_name: r.role_name },
      create: r,
    });
  }
  console.log('Roles seeded successfully.');

  // 2. Seed Default Departments
  const departments = [
    {
      department_id: 1,
      department_name: 'Information and communication technology(ICT)',
      department_code: 'ICT',
    },
    {
      department_id: 2,
      department_name: 'Electrical and electronic technolgy(EET)',
      department_code: 'EET',
    },
    {
      department_id: 3,
      department_name: 'Materials technology(MTT)',
      department_code: 'MTT',
    },
    {
      department_id: 4,
      department_name: 'Food technology(FDT)',
      department_code: 'FDT',
    },
    {
      department_id: 5,
      department_name: 'bio process technology(BPT)',
      department_code: 'BPT',
    },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { department_id: dept.department_id },
      update: {
        department_name: dept.department_name,
        department_code: dept.department_code,
      },
      create: dept,
    });
  }
  console.log('Departments seeded successfully.');

  // Password hashes
  const adminPasswordHash = await bcrypt.hash('AdminPassword123', 10);
  const staffPasswordHash = await bcrypt.hash('StaffPassword123', 10);
  const lecturerPasswordHash = await bcrypt.hash('LecturerPassword123', 10);
  const studentPasswordHash = await bcrypt.hash('StudentPassword123', 10);

  // 3. Seed Default Admin User
  const adminEmail = 'admin@ems.com';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      full_name: 'System Administrator',
      password_hash: adminPasswordHash,
      role_id: 1,
      is_active: true,
    },
    create: {
      full_name: 'System Administrator',
      email: adminEmail,
      password_hash: adminPasswordHash,
      role_id: 1, // Administrator
      is_active: true,
    },
  });
  console.log('Default Administrator seeded/updated (admin@ems.com / AdminPassword123).');

  // 4. Seed Default Staff User
  const staffEmail = 'staff@ems.com';
  const existingStaff = await prisma.user.findUnique({
    where: { email: staffEmail },
  });

  if (!existingStaff) {
    await prisma.user.create({
      data: {
        full_name: 'Exam Staff Member',
        email: staffEmail,
        password_hash: staffPasswordHash,
        role_id: 2, // Exam Division Staff
        is_active: true,
      },
    });
    console.log('Default Staff User created (staff@ems.com / StaffPassword123).');
  }

  // 5. Seed Default Lecturer User
  const lecturerEmail = 'lecturer@ems.com';
  const existingLecturer = await prisma.user.findUnique({
    where: { email: lecturerEmail },
  });

  if (!existingLecturer) {
    const user = await prisma.user.create({
      data: {
        full_name: 'Dr. John Doe',
        email: lecturerEmail,
        password_hash: lecturerPasswordHash,
        role_id: 3, // Lecturer
        is_active: true,
      },
    });
    await prisma.lecturer.create({
      data: {
        user_id: user.user_id,
        employee_number: 'EMP001',
        department_id: 1, // CSE
        specialization: 'Computer Science',
      },
    });
    console.log('Default Lecturer created (lecturer@ems.com / LecturerPassword123).');
  }

  // 6. Seed Default Student User
  const studentEmail = 'student@ems.com';
  const existingStudent = await prisma.user.findUnique({
    where: { email: studentEmail },
  });

  if (!existingStudent) {
    const user = await prisma.user.create({
      data: {
        full_name: 'Jane Smith',
        email: studentEmail,
        password_hash: studentPasswordHash,
        role_id: 4, // Student
        is_active: true,
      },
    });
    await prisma.student.create({
      data: {
        user_id: user.user_id,
        registration_number: 'REG001',
        department_id: 1, // CSE
        academic_year: 2026,
        semester: '1.1',
      },
    });
    console.log('Default Student created (student@ems.com / StudentPassword123).');
  }

  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
