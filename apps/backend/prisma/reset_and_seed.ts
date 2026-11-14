import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log(
    '🧹 1. Clearing all lecturer course assignments, student enrollments, exam marks, and grades...',
  );

  // Delete operational data to start clean
  await prisma.courseRegistration.deleteMany();
  console.log('  ✔ Cleared all student course registrations');

  await prisma.courseLecturer.deleteMany();
  console.log('  ✔ Cleared all course lecturer assignments');

  await prisma.examMark.deleteMany();
  console.log('  ✔ Cleared all exam marks');

  await prisma.studentCourseGrade.deleteMany();
  console.log('  ✔ Cleared all student course grades');

  await prisma.studentSemesterGpa.deleteMany();
  console.log('  ✔ Cleared all student semester GPAs');

  await prisma.coursePublishingProgress.deleteMany();
  console.log('  ✔ Cleared all course publishing progress records');

  // Reset marker assignments on courses
  await prisma.course.updateMany({
    data: {
      first_marker_lecturer_id: null,
      first_marker_name: null,
      first_marker_email: null,
      second_marker_lecturer_id: null,
      second_marker_name: null,
      second_marker_email: null,
      result_submission_status: null,
      rejection_reason: null,
      ca_published: false,
    },
  });
  console.log('  ✔ Reset all course lecturer/marker fields');

  const SALT_ROUNDS = 10;
  const passwordHash = await bcrypt.hash('StudentPassword123', SALT_ROUNDS);

  // Get BICT Degree
  const bictDegree = await prisma.degree.findFirst({
    where: { degree_code: 'BICT' },
  });

  if (!bictDegree) {
    throw new Error('BICT degree not found in database');
  }

  console.log(
    '\n✏️ 2. Updating existing 8 student accounts (Batch 21/22, ITT/2022/001 - 008, Index 001 - 008)...',
  );

  const batch2122Students = [
    {
      email: 'student1@ems.com',
      name: 'Kasun Perera',
      initials: 'K. Perera',
      reg: 'ITT/2022/001',
      index: '001',
      nic: '200200000101',
    },
    {
      email: 'student2@ems.com',
      name: 'Nimali Silva',
      initials: 'N. Silva',
      reg: 'ITT/2022/002',
      index: '002',
      nic: '200200000102',
    },
    {
      email: 'student3@ems.com',
      name: 'Kamal Fernando',
      initials: 'K. Fernando',
      reg: 'ITT/2022/003',
      index: '003',
      nic: '200200000103',
    },
    {
      email: 'student4@ems.com',
      name: 'Nuwan Bandara',
      initials: 'N. Bandara',
      reg: 'ITT/2022/004',
      index: '004',
      nic: '200200000104',
    },
    {
      email: 'student5@ems.com',
      name: 'Dilani Jayasinghe',
      initials: 'D. Jayasinghe',
      reg: 'ITT/2022/005',
      index: '005',
      nic: '200200000105',
    },
    {
      email: 'student6@ems.com',
      name: 'Sahan Gunawardena',
      initials: 'S. Gunawardena',
      reg: 'ITT/2022/006',
      index: '006',
      nic: '200200000106',
    },
    {
      email: 'student7@ems.com',
      name: 'Thilini Disanayake',
      initials: 'T. Disanayake',
      reg: 'ITT/2022/007',
      index: '007',
      nic: '200200000107',
    },
    {
      email: 'student8@ems.com',
      name: 'Ruwan Wickramasinghe',
      initials: 'R. Wickramasinghe',
      reg: 'ITT/2022/008',
      index: '008',
      nic: '200200000108',
    },
  ];

  for (const st of batch2122Students) {
    const user = await prisma.user.upsert({
      where: { email: st.email },
      update: {
        password_hash: passwordHash,
        full_name: st.name,
        name_with_initials: st.initials,
        is_active: true,
      },
      create: {
        full_name: st.name,
        name_with_initials: st.initials,
        email: st.email,
        password_hash: passwordHash,
        role_id: 4,
        is_active: true,
        nic_no: st.nic,
        date_of_birth: new Date('2002-05-15'),
        phone_number: '0711111111',
        address: 'Department of ICT, University Campus',
      },
    });

    await prisma.student.upsert({
      where: { user_id: user.user_id },
      update: {
        registration_number: st.reg,
        index_number: st.index,
        degree_id: bictDegree.degree_id,
        batch: '21/22',
        status: 'ACTIVE',
      },
      create: {
        user_id: user.user_id,
        registration_number: st.reg,
        index_number: st.index,
        degree_id: bictDegree.degree_id,
        batch: '21/22',
        status: 'ACTIVE',
      },
    });
    console.log(
      `  ✔ Updated Student: ${st.name} | Reg: ${st.reg} | Index: ${st.index} | Batch: 21/22`,
    );
  }

  console.log(
    '\n➕ 3. Adding 10 NEW student accounts (Batch 22/23, ITT/2023/001 - 010, Index 010 - 019)...',
  );

  const batch2223Students = [
    {
      email: 'student9@ems.com',
      name: 'Kavindu Perera',
      initials: 'K. Perera',
      reg: 'ITT/2023/001',
      index: '010',
      nic: '200300000101',
    },
    {
      email: 'student10@ems.com',
      name: 'Shenali Fernando',
      initials: 'S. Fernando',
      reg: 'ITT/2023/002',
      index: '011',
      nic: '200300000102',
    },
    {
      email: 'student11@ems.com',
      name: 'Lakshan Rajapaksha',
      initials: 'L. Rajapaksha',
      reg: 'ITT/2023/003',
      index: '012',
      nic: '200300000103',
    },
    {
      email: 'student12@ems.com',
      name: 'Rashmi Jayawardena',
      initials: 'R. Jayawardena',
      reg: 'ITT/2023/004',
      index: '013',
      nic: '200300000104',
    },
    {
      email: 'student13@ems.com',
      name: 'Isuru Herath',
      initials: 'I. Herath',
      reg: 'ITT/2023/005',
      index: '014',
      nic: '200300000105',
    },
    {
      email: 'student14@ems.com',
      name: 'Nethmi Cooray',
      initials: 'N. Cooray',
      reg: 'ITT/2023/006',
      index: '015',
      nic: '200300000106',
    },
    {
      email: 'student15@ems.com',
      name: 'Dineth Pathirana',
      initials: 'D. Pathirana',
      reg: 'ITT/2023/007',
      index: '016',
      nic: '200300000107',
    },
    {
      email: 'student16@ems.com',
      name: 'Chathuri Fonseka',
      initials: 'C. Fonseka',
      reg: 'ITT/2023/008',
      index: '017',
      nic: '200300000108',
    },
    {
      email: 'student17@ems.com',
      name: 'Bhashitha Rathnayake',
      initials: 'B. Rathnayake',
      reg: 'ITT/2023/009',
      index: '018',
      nic: '200300000109',
    },
    {
      email: 'student18@ems.com',
      name: 'Vihanga De Silva',
      initials: 'V. De Silva',
      reg: 'ITT/2023/010',
      index: '019',
      nic: '200300000110',
    },
  ];

  for (const st of batch2223Students) {
    const user = await prisma.user.upsert({
      where: { email: st.email },
      update: {
        password_hash: passwordHash,
        full_name: st.name,
        name_with_initials: st.initials,
        is_active: true,
      },
      create: {
        full_name: st.name,
        name_with_initials: st.initials,
        email: st.email,
        password_hash: passwordHash,
        role_id: 4,
        is_active: true,
        nic_no: st.nic,
        date_of_birth: new Date('2003-08-20'),
        phone_number: '0722222222',
        address: 'Department of ICT, University Campus',
      },
    });

    await prisma.student.upsert({
      where: { user_id: user.user_id },
      update: {
        registration_number: st.reg,
        index_number: st.index,
        degree_id: bictDegree.degree_id,
        batch: '22/23',
        status: 'ACTIVE',
      },
      create: {
        user_id: user.user_id,
        registration_number: st.reg,
        index_number: st.index,
        degree_id: bictDegree.degree_id,
        batch: '22/23',
        status: 'ACTIVE',
      },
    });
    console.log(
      `  ✔ Created Student: ${st.name} | Reg: ${st.reg} | Index: ${st.index} | Batch: 22/23`,
    );
  }

  console.log('\n🎉 Reset & Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error executing reset and seed script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
