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
      department_name: 'Computer Science and Engineering',
      department_code: 'CSE',
    },
    {
      department_id: 2,
      department_name: 'Electrical and Electronic Engineering',
      department_code: 'EEE',
    },
    { department_id: 3, department_name: 'Mechanical Engineering', department_code: 'ME' },
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

  // 3. Seed Default Admin User
  const adminEmail = 'admin@ems.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('AdminPassword123', 10);
    await prisma.user.create({
      data: {
        full_name: 'System Administrator',
        email: adminEmail,
        password_hash: passwordHash,
        role_id: 1, // Administrator
        is_active: true,
      },
    });
    console.log('Default Administrator created (admin@ems.com / AdminPassword123).');
  } else {
    console.log('Administrator already exists.');
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
