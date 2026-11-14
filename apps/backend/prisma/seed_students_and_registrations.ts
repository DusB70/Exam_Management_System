import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding Student Accounts and 1-1 Semester Registrations...');

  const SALT_ROUNDS = 10;
  const passwordHash = await bcrypt.hash('StudentPassword123', SALT_ROUNDS);

  // 1. Get BICT Degree ID (Degree ID 3)
  const bictDegree = await prisma.degree.findFirst({
    where: { degree_code: 'BICT' },
  });

  if (!bictDegree) {
    throw new Error('BICT degree not found in database');
  }

  // 2. Define Student Accounts to Create
  const studentData = [
    {
      full_name: 'Kasun Perera',
      name_with_initials: 'K. Perera',
      email: 'student1@ems.com',
      nic_no: '200200000101',
      reg_no: 'STU-2026-101',
      index_no: 'IDX-2026-101',
      phone: '0711111101',
    },
    {
      full_name: 'Nimali Silva',
      name_with_initials: 'N. Silva',
      email: 'student2@ems.com',
      nic_no: '200200000102',
      reg_no: 'STU-2026-102',
      index_no: 'IDX-2026-102',
      phone: '0711111102',
    },
    {
      full_name: 'Kamal Fernando',
      name_with_initials: 'K. Fernando',
      email: 'student3@ems.com',
      nic_no: '200200000103',
      reg_no: 'STU-2026-103',
      index_no: 'IDX-2026-103',
      phone: '0711111103',
    },
    {
      full_name: 'Nuwan Bandara',
      name_with_initials: 'N. Bandara',
      email: 'student4@ems.com',
      nic_no: '200200000104',
      reg_no: 'STU-2026-104',
      index_no: 'IDX-2026-104',
      phone: '0711111104',
    },
    {
      full_name: 'Dilani Jayasinghe',
      name_with_initials: 'D. Jayasinghe',
      email: 'student5@ems.com',
      nic_no: '200200000105',
      reg_no: 'STU-2026-105',
      index_no: 'IDX-2026-105',
      phone: '0711111105',
    },
    {
      full_name: 'Sahan Gunawardena',
      name_with_initials: 'S. Gunawardena',
      email: 'student6@ems.com',
      nic_no: '200200000106',
      reg_no: 'STU-2026-106',
      index_no: 'IDX-2026-106',
      phone: '0711111106',
    },
    {
      full_name: 'Thilini Disanayake',
      name_with_initials: 'T. Disanayake',
      email: 'student7@ems.com',
      nic_no: '200200000107',
      reg_no: 'STU-2026-107',
      index_no: 'IDX-2026-107',
      phone: '0711111107',
    },
    {
      full_name: 'Ruwan Wickramasinghe',
      name_with_initials: 'R. Wickramasinghe',
      email: 'student8@ems.com',
      nic_no: '200200000108',
      reg_no: 'STU-2026-108',
      index_no: 'IDX-2026-108',
      phone: '0711111108',
    },
  ];

  const createdStudents = [];

  for (const st of studentData) {
    // Upsert User
    const user = await prisma.user.upsert({
      where: { email: st.email },
      update: {
        password_hash: passwordHash,
        full_name: st.full_name,
        name_with_initials: st.name_with_initials,
        is_active: true,
      },
      create: {
        full_name: st.full_name,
        name_with_initials: st.name_with_initials,
        email: st.email,
        password_hash: passwordHash,
        role_id: 4, // Student Role
        is_active: true,
        nic_no: st.nic_no,
        date_of_birth: new Date('2003-05-15'),
        phone_number: st.phone,
        address: 'Faculty of Technology, University Campus',
      },
    });

    // Upsert Student profile
    const student = await prisma.student.upsert({
      where: { user_id: user.user_id },
      update: {
        degree_id: bictDegree.degree_id,
        batch: '21/22',
        status: 'ACTIVE',
      },
      create: {
        user_id: user.user_id,
        registration_number: st.reg_no,
        index_number: st.index_no,
        degree_id: bictDegree.degree_id,
        batch: '21/22',
        status: 'ACTIVE',
      },
    });

    createdStudents.push(student);
    console.log(`✅ Student created/updated: ${st.full_name} (${st.email}) - Reg: ${st.reg_no}`);
  }

  // 3. Ensure 1-1 Semester Registration Period is OPEN
  const now = new Date();
  const startDate = new Date(now.valueOf() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const endDate = new Date(now.valueOf() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  const existingPeriod = await prisma.registrationPeriod.findFirst({
    where: {
      academic_year: 2026,
      semester: '1.1',
      window_type: 'SEMESTER_REGISTRATION',
    },
  });

  if (existingPeriod) {
    await prisma.registrationPeriod.update({
      where: { period_id: existingPeriod.period_id },
      data: {
        status: 'OPEN',
        start_date: startDate,
        end_date: endDate,
      },
    });
    console.log(
      `✅ Registration Period updated to OPEN for 1.1 semester (ID: ${existingPeriod.period_id})`,
    );
  } else {
    const newPeriod = await prisma.registrationPeriod.create({
      data: {
        academic_year: 2026,
        semester: '1.1',
        window_type: 'SEMESTER_REGISTRATION',
        start_date: startDate,
        end_date: endDate,
        status: 'OPEN',
      },
    });
    console.log(
      `✅ Registration Period created & OPEN for 1.1 semester (ID: ${newPeriod.period_id})`,
    );
  }

  // 4. Ensure Degree Semester Limit exists
  await prisma.degreeSemesterLimit.upsert({
    where: {
      degree_id_academic_year_semester: {
        degree_id: bictDegree.degree_id,
        academic_year: 2026,
        semester: '1.1',
      },
    },
    update: { max_credits: 30.0 },
    create: {
      degree_id: bictDegree.degree_id,
      academic_year: 2026,
      semester: '1.1',
      max_credits: 30.0,
    },
  });

  // 5. Get 1.1 Semester Courses (including Health & Wellbeing, Personality Development, Programming, etc.)
  const courses11 = await prisma.course.findMany({
    where: {
      OR: [
        { semester: '1.1' },
        { course_code: 'CML-1204' }, // Health and Wellbeing
        { course_code: 'CML-1201' }, // Personality Development
      ],
    },
  });

  console.log(`Found ${courses11.length} courses for 1.1 semester registration.`);

  // 6. Register all 8 created students to 1.1 Courses
  for (const student of createdStudents) {
    for (const course of courses11) {
      await prisma.courseRegistration.upsert({
        where: {
          unique_student_course_attempt: {
            student_id: student.student_id,
            course_id: course.course_id,
            attempt_number: 1,
          },
        },
        update: { attempt_type: 'PROPER' },
        create: {
          student_id: student.student_id,
          course_id: course.course_id,
          attempt_type: 'PROPER',
          attempt_number: 1,
        },
      });
    }
  }
  console.log(
    `✅ All ${createdStudents.length} students registered for ${courses11.length} courses!`,
  );

  // 7. Verify Demo Lecturer Account & Course Assignments
  const demoLecturer = await prisma.lecturer.findFirst({
    where: { user: { email: 'lecturer@ems.com' } },
    include: { user: true },
  });

  if (demoLecturer) {
    console.log(
      `✅ Demo Lecturer confirmed: ${demoLecturer.user.full_name} (${demoLecturer.user.email})`,
    );

    // Ensure Demo Lecturer is assigned as lecturer and first marker for CML-1201 & CML-1204
    for (const course of courses11) {
      if (course.course_code.includes('CML-1201') || course.course_code.includes('CML-1204')) {
        await prisma.courseLecturer.upsert({
          where: {
            course_id_lecturer_id: {
              course_id: course.course_id,
              lecturer_id: demoLecturer.lecturer_id,
            },
          },
          update: {},
          create: {
            course_id: course.course_id,
            lecturer_id: demoLecturer.lecturer_id,
          },
        });

        await prisma.course.update({
          where: { course_id: course.course_id },
          data: {
            first_marker_lecturer_id: demoLecturer.lecturer_id,
            first_marker_name: demoLecturer.user.full_name,
            first_marker_email: demoLecturer.user.email,
          },
        });
        console.log(`✅ Assigned Demo Lecturer to ${course.course_code} - ${course.course_name}`);
      }
    }
  }

  console.log('\n🎉 Setup Complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error during setup script execution:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
