import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local from the monorepo root (two levels up from prisma/)
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ─── 1. Roles ────────────────────────────────────────────────────────────
  const roles = [
    { role_id: 1, role_name: 'Administrator' },
    { role_id: 2, role_name: 'Exam Division Staff' },
    { role_id: 3, role_name: 'Lecturer' },
    { role_id: 4, role_name: 'Student' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { role_id: role.role_id },
      update: { role_name: role.role_name },
      create: role,
    });
  }
  console.log('✅ Roles seeded');

  // ─── 2. A default Department (needed for Lecturer & Student profiles) ─────
  const department = await prisma.department.upsert({
    where: { department_code: 'GEN' },
    update: {},
    create: {
      department_name: 'General Studies',
      department_code: 'GEN',
    },
  });
  console.log('✅ Department seeded');

  // ─── 3. Users ────────────────────────────────────────────────────────────
  const SALT_ROUNDS = 10;

  // Admin
  const adminHash = await bcrypt.hash('AdminPassword123', SALT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ems.com' },
    update: { password_hash: adminHash },
    create: {
      full_name: 'System Administrator',
      email: 'admin@ems.com',
      password_hash: adminHash,
      role_id: 1,
      is_active: true,
    },
  });
  console.log(`✅ Admin user seeded (id: ${admin.user_id})`);

  // Exam Division Staff
  const staffHash = await bcrypt.hash('StaffPassword123', SALT_ROUNDS);
  const staff = await prisma.user.upsert({
    where: { email: 'staff@ems.com' },
    update: { password_hash: staffHash },
    create: {
      full_name: 'Exam Division Staff',
      email: 'staff@ems.com',
      password_hash: staffHash,
      role_id: 2,
      is_active: true,
    },
  });
  console.log(`✅ Staff user seeded (id: ${staff.user_id})`);

  // Lecturer
  const lecturerHash = await bcrypt.hash('LecturerPassword123', SALT_ROUNDS);
  const lecturer = await prisma.user.upsert({
    where: { email: 'lecturer@ems.com' },
    update: { password_hash: lecturerHash },
    create: {
      full_name: 'Demo Lecturer',
      email: 'lecturer@ems.com',
      password_hash: lecturerHash,
      role_id: 3,
      is_active: true,
    },
  });
  // Lecturer sub-profile (required by the system)
  await prisma.lecturer.upsert({
    where: { user_id: lecturer.user_id },
    update: {},
    create: {
      user_id: lecturer.user_id,
      employee_number: 'EMP-001',
      department_id: department.department_id,
      specialization: 'General',
    },
  });
  console.log(`✅ Lecturer user seeded (id: ${lecturer.user_id})`);

  // Student
  const studentHash = await bcrypt.hash('StudentPassword123', SALT_ROUNDS);
  const student = await prisma.user.upsert({
    where: { email: 'student@ems.com' },
    update: { password_hash: studentHash },
    create: {
      full_name: 'Demo Student',
      email: 'student@ems.com',
      password_hash: studentHash,
      role_id: 4,
      is_active: true,
    },
  });
  // Student sub-profile (required by the system)
  await prisma.student.upsert({
    where: { user_id: student.user_id },
    update: {},
    create: {
      user_id: student.user_id,
      registration_number: 'STU-2024-001',
      department_id: department.department_id,
      academic_year: 2024,
      semester: '1',
    },
  });
  console.log(`✅ Student user seeded (id: ${student.user_id})`);

  console.log('\n🎉 Seed complete! You can now log in with:');
  console.log('   Admin    → admin@ems.com / AdminPassword123');
  console.log('   Staff    → staff@ems.com / StaffPassword123');
  console.log('   Lecturer → lecturer@ems.com / LecturerPassword123');
  console.log('   Student  → student@ems.com / StudentPassword123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
