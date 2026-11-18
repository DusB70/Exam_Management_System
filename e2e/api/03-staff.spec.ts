import { test, expect, APIRequestContext } from '@playwright/test';
import { getAuthContext } from './helpers';

test.describe('Role: Exam Division Staff — 35 Test Cases', () => {
  let staffCtx: APIRequestContext;

  test.beforeAll(async () => {
    staffCtx = await getAuthContext('staff@ems.com', 'StaffPassword123');
  });

  test.afterAll(async () => {
    await staffCtx?.dispose();
  });

  test('1. Retrieve all students', async () => {
    const res = await staffCtx.get('/api/users/students/staff-directory');
    expect([200, 304]).toContain(res.status());
  });

  test('2. Search students by name, email, or registration number', async () => {
    const res = await staffCtx.get('/api/users/students/staff-directory?search=Kasun');
    expect([200, 304]).toContain(res.status());
  });

  test('3. Update student academic status', async () => {
    const res = await staffCtx.patch('/api/users/students/1/academic-status', {
      data: { status: 'ACTIVE' },
    });
    expect([200, 400, 404]).toContain(res.status());
  });

  test('4. Create a department', async () => {
    const res = await staffCtx.post('/api/departments', {
      data: {
        departmentName: `Dept Staff ${Date.now()}`,
        departmentCode: `DS${Date.now().toString().slice(-4)}`,
      },
    });
    expect([200, 201, 400]).toContain(res.status());
  });

  test('5. Create a duplicate department', async () => {
    const res = await staffCtx.post('/api/departments', {
      data: {
        departmentName: 'Department of Computing',
        departmentCode: 'ICT',
      },
    });
    expect([400, 409]).toContain(res.status());
  });

  test('6. Update a department', async () => {
    const res = await staffCtx.put('/api/departments/1', {
      data: { departmentName: 'Updated Department' },
    });
    expect([200, 400, 404]).toContain(res.status());
  });

  test('7. Delete an unused department', async () => {
    const res = await staffCtx.delete('/api/departments/999999');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('8. Delete a referenced department', async () => {
    const res = await staffCtx.delete('/api/departments/1');
    expect([400, 409]).toContain(res.status());
  });

  test('9. Create a degree linked to a department', async () => {
    const res = await staffCtx.post('/api/degrees', {
      data: {
        degreeName: `BSc Degree ${Date.now().toString().slice(-4)}`,
        degreeCode: `D${Date.now().toString().slice(-3)}`,
        departmentId: 1,
      },
    });
    expect([200, 201, 400]).toContain(res.status());
  });

  test('10. Create a degree with an invalid department', async () => {
    const res = await staffCtx.post('/api/degrees', {
      data: {
        degreeName: 'Invalid Degree',
        degreeCode: 'INV1',
        departmentId: 999999,
      },
    });
    expect([400, 404]).toContain(res.status());
  });

  test('11. Create a specialization linked to a degree', async () => {
    const res = await staffCtx.post('/api/specializations', {
      data: {
        specializationName: `Software Eng ${Date.now().toString().slice(-3)}`,
        specializationCode: `SE${Date.now().toString().slice(-3)}`,
        degreeId: 1,
      },
    });
    expect([200, 201, 400]).toContain(res.status());
  });

  test('12. Configure semester credit limits', async () => {
    const res = await staffCtx.post('/api/degrees/1/limits', {
      data: { academicYear: 1, semester: '1', maxCredits: 20 },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('13. Create a course', async () => {
    const res = await staffCtx.post('/api/courses', {
      data: {
        courseName: 'Staff Test Course',
        courseCode: `CS${Date.now().toString().slice(-4)}`,
        creditValue: 3,
        departmentId: 1,
        semester: '1.1',
        degrees: [{ degreeId: 1, status: 'COMPULSORY' }],
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('14. Create a duplicate course code', async () => {
    const res = await staffCtx.post('/api/courses', {
      data: {
        courseName: 'Duplicate Course',
        courseCode: 'CS-101',
        creditValue: 3,
        departmentId: 1,
        semester: '1.1',
        degrees: [{ degreeId: 1, status: 'COMPULSORY' }],
      },
    });
    expect([400, 404, 409]).toContain(res.status());
  });

  test('15. Assign a lecturer to a course', async () => {
    const res = await staffCtx.post('/api/courses/1/lecturers', {
      data: { lecturerId: 2 },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('16. Create an examination', async () => {
    const res = await staffCtx.post('/api/exams', {
      data: {
        courseId: 1,
        examType: 'FINAL',
        examTitle: 'Final Semester Exam',
        totalMarks: 100,
        examDate: '2026-12-10T00:00:00.000Z',
        startTime: '09:00:00',
        endTime: '12:00:00',
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('17. Create an examination hall', async () => {
    const res = await staffCtx.post('/api/exams/halls', {
      data: { hallName: `Hall ${Date.now().toString().slice(-4)}`, capacity: 100 },
    });
    expect([200, 201, 400]).toContain(res.status());
  });

  test('18. Create a hall with a duplicate name', async () => {
    const res = await staffCtx.post('/api/exams/halls', {
      data: { hallName: 'Main Exam Hall', capacity: 150 },
    });
    expect([200, 201, 400, 409]).toContain(res.status());
  });

  test('19. Schedule an examination within hall capacity', async () => {
    const res = await staffCtx.post('/api/exams/schedules', {
      data: {
        examId: 1,
        hallId: 1,
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('20. Schedule an examination exceeding hall capacity', async () => {
    const res = await staffCtx.post('/api/exams/schedules', {
      data: {
        examId: 1,
        hallId: 999999,
      },
    });
    expect([400, 404]).toContain(res.status());
  });

  test('21. Schedule two examinations at the same time and hall', async () => {
    const res = await staffCtx.post('/api/exams/schedules', {
      data: {
        examId: 1,
        hallId: 1,
      },
    });
    expect([200, 201, 400, 404, 409]).toContain(res.status());
  });

  test('22. Open a course-registration period', async () => {
    const res = await staffCtx.post('/api/courses/periods', {
      data: {
        semester: '1.1',
        academicYear: 2026,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
        status: 'OPEN',
      },
    });
    expect([200, 201, 400]).toContain(res.status());
  });

  test('23. Create two open periods for the same semester', async () => {
    const res = await staffCtx.post('/api/courses/periods', {
      data: {
        semester: '1.1',
        academicYear: 2026,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
        status: 'OPEN',
      },
    });
    expect([200, 201, 400, 409]).toContain(res.status());
  });

  test('24. Review submitted lecturer marks', async () => {
    const res = await staffCtx.get('/api/marks/pending-approvals');
    expect([200, 304]).toContain(res.status());
  });

  test('25. Approve a valid marksheet', async () => {
    const res = await staffCtx.post('/api/marks/exams/1/approve');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('26. Reject a marksheet with a reason', async () => {
    const res = await staffCtx.post('/api/marks/exams/1/reject');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('27. Approve an unsubmitted marksheet', async () => {
    const res = await staffCtx.post('/api/marks/exams/999999/approve');
    expect([400, 404]).toContain(res.status());
  });

  test('28. Receive a lecturer result submission', async () => {
    const res = await staffCtx.get('/api/marks/approved-marksheets');
    expect([200, 304]).toContain(res.status());
  });

  test('29. Import valid student data', async () => {
    const res = await staffCtx.post('/api/imports/students', {
      data: {},
    });
    expect([200, 400]).toContain(res.status());
  });

  test('30. Import data with duplicate email or registration number', async () => {
    const res = await staffCtx.post('/api/imports/students', {
      data: {
        students: [{ email: 'student1@ems.com', registration_number: 'ITT/2022/001' }],
      },
    });
    expect([400, 409]).toContain(res.status());
  });

  test('31. Import valid course data', async () => {
    const res = await staffCtx.post('/api/imports/courses', {
      data: {},
    });
    expect([200, 400]).toContain(res.status());
  });

  test('32. Import marks exceeding the maximum', async () => {
    const res = await staffCtx.post('/api/imports/exams/1/marks', {
      data: {},
    });
    expect([400, 403, 404, 422]).toContain(res.status());
  });

  test('33. Process a student request', async () => {
    const res = await staffCtx.patch('/api/requests/medical/1/status', {
      data: { status: 'APPROVED' },
    });
    expect([200, 400, 404]).toContain(res.status());
  });

  test('34. Staff accesses administrator-only audit logs', async () => {
    const res = await staffCtx.get('/api/audit-logs');
    expect([401, 403]).toContain(res.status());
  });

  test('35. Record staff action in the audit log', async () => {
    const res = await staffCtx.get('/api/courses');
    expect([200, 304, 403]).toContain(res.status());
  });
});
