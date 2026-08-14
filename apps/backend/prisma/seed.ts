import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local from the monorepo root
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

  // ─── 2. Departments ──────────────────────────────────────────────────────
  // Seed parent departments first
  const parentDepartments = [
    { department_name: 'Bio system technology', department_code: 'BST' },
    { department_name: 'Engineering technology', department_code: 'ET' },
    { department_name: 'Information and communication technology', department_code: 'ICT' },
  ];

  const seededDepts: Record<string, any> = {};

  for (const dept of parentDepartments) {
    const d = await prisma.department.upsert({
      where: { department_code: dept.department_code },
      update: { department_name: dept.department_name },
      create: dept,
    });
    seededDepts[dept.department_code] = d;
  }

  // Seed child departments
  const childDepartments = [
    {
      department_name: 'Electrical and Electronic Technology',
      department_code: 'EET',
      parent_code: 'ET',
    },
    { department_name: 'Materials Technology', department_code: 'MT', parent_code: 'ET' },
    { department_name: 'Bio Process Technology', department_code: 'BPT', parent_code: 'BST' },
    { department_name: 'Food Technology', department_code: 'FT', parent_code: 'BST' },
  ];

  for (const child of childDepartments) {
    const parent = seededDepts[child.parent_code];
    const d = await prisma.department.upsert({
      where: { department_code: child.department_code },
      update: {
        department_name: child.department_name,
        parent_department_id: parent.department_id,
      },
      create: {
        department_name: child.department_name,
        department_code: child.department_code,
        parent_department_id: parent.department_id,
      },
    });
    seededDepts[child.department_code] = d;
  }
  console.log('✅ Departments seeded');

  // ─── 3. Degrees ──────────────────────────────────────────────────────────
  const degrees = [
    {
      degree_name: 'Bachelor of Biosystems Technology',
      degree_code: 'BBST',
      department_code: 'BST',
    },
    {
      degree_name: 'Bachelor of Engineering Technology',
      degree_code: 'BET',
      department_code: 'ET',
    },
    {
      degree_name: 'Bachelor of Information and Communication Technology',
      degree_code: 'BICT',
      department_code: 'ICT',
    },
  ];

  const seededDegrees: Record<string, any> = {};

  for (const deg of degrees) {
    const dept = seededDepts[deg.department_code];
    const d = await prisma.degree.upsert({
      where: { degree_code: deg.degree_code },
      update: { degree_name: deg.degree_name, department_id: dept.department_id },
      create: {
        degree_name: deg.degree_name,
        degree_code: deg.degree_code,
        department_id: dept.department_id,
      },
    });
    seededDegrees[deg.degree_code] = d;
  }
  console.log('✅ Degrees seeded');

  // ─── 4. Specializations ──────────────────────────────────────────────────
  // Clear any existing specializations first to avoid outdated definitions
  await prisma.specialization.deleteMany();

  const specializations = [
    {
      specialization_name: 'Electrical and Electronic Technology',
      specialization_code: 'EET',
      degree_code: 'BET',
      dept_code: 'EET',
    },
    {
      specialization_name: 'Materials Technology',
      specialization_code: 'MT',
      degree_code: 'BET',
      dept_code: 'MT',
    },
    {
      specialization_name: 'Bio Process Technology',
      specialization_code: 'BPT',
      degree_code: 'BBST',
      dept_code: 'BPT',
    },
    {
      specialization_name: 'Food Technology',
      specialization_code: 'FT',
      degree_code: 'BBST',
      dept_code: 'FT',
    },
  ];

  for (const spec of specializations) {
    const deg = seededDegrees[spec.degree_code];
    const dept = seededDepts[spec.dept_code];
    await prisma.specialization.upsert({
      where: {
        degree_id_specialization_code: {
          degree_id: deg.degree_id,
          specialization_code: spec.specialization_code,
        },
      },
      update: {
        specialization_name: spec.specialization_name,
        department_id: dept.department_id,
      },
      create: {
        specialization_name: spec.specialization_name,
        specialization_code: spec.specialization_code,
        degree_id: deg.degree_id,
        department_id: dept.department_id,
      },
    });
  }
  console.log('✅ Specializations seeded');

  // ─── 5. Users ────────────────────────────────────────────────────────────
  const SALT_ROUNDS = 10;

  // Admin
  const adminHash = await bcrypt.hash('AdminPassword123', SALT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ems.com' },
    update: { password_hash: adminHash },
    create: {
      full_name: 'System Administrator',
      name_with_initials: 'S. Administrator',
      email: 'admin@ems.com',
      password_hash: adminHash,
      role_id: 1,
      is_active: true,
      nic_no: '199000000001',
      date_of_birth: new Date('1990-01-01'),
      phone_number: '0712345678',
      address: 'No. 1, Admin Road, Colombo',
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
      name_with_initials: 'E.D. Staff',
      email: 'staff@ems.com',
      password_hash: staffHash,
      role_id: 2,
      is_active: true,
      nic_no: '199100000002',
      date_of_birth: new Date('1991-02-02'),
      phone_number: '0722345678',
      address: 'No. 2, Staff Lane, Colombo',
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
      name_with_initials: 'D. Lecturer',
      email: 'lecturer@ems.com',
      password_hash: lecturerHash,
      role_id: 3,
      is_active: true,
      nic_no: '198500000003',
      date_of_birth: new Date('1985-03-03'),
      phone_number: '0732345678',
      address: 'No. 3, Lecturer Street, Kandy',
    },
  });
  // Lecturer sub-profile (required by the system)
  const ictDept = seededDepts['ICT'];
  await prisma.lecturer.upsert({
    where: { user_id: lecturer.user_id },
    update: { department_id: ictDept.department_id },
    create: {
      user_id: lecturer.user_id,
      employee_number: 'EMP-001',
      department_id: ictDept.department_id,
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
      name_with_initials: 'D. Student',
      email: 'student@ems.com',
      password_hash: studentHash,
      role_id: 4,
      is_active: true,
      nic_no: '200200000004',
      date_of_birth: new Date('2002-04-04'),
      phone_number: '0742345678',
      address: 'No. 4, Student Road, Galle',
    },
  });
  // Student sub-profile (required by the system)
  const bictDegree = seededDegrees['BICT'];
  await prisma.student.upsert({
    where: { user_id: student.user_id },
    update: { degree_id: bictDegree.degree_id },
    create: {
      user_id: student.user_id,
      registration_number: 'STU-2024-001',
      index_number: 'IDX-2024-001',
      degree_id: bictDegree.degree_id,
      academic_year: 2024,
      specialization_id: null, // First year has no specialization
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
