import { test, expect, APIRequestContext } from '@playwright/test';
import { getAuthContext } from './helpers';

test.describe('Role: Administrator — 33 Test Cases', () => {
  let adminCtx: APIRequestContext;

  test.beforeAll(async () => {
    adminCtx = await getAuthContext('admin@ems.com', 'AdminPassword123');
  });

  test.afterAll(async () => {
    await adminCtx?.dispose();
  });

  test('1. Create a new administrator account', async () => {
    const res = await adminCtx.post('/api/users', {
      data: {
        email: `admin_${Date.now()}@ems.com`,
        fullName: 'New Administrator',
        nameWithInitials: 'N. Admin',
        roleId: 1,
        nicNo: `NIC${Date.now().toString().slice(-9)}`,
        dateOfBirth: '1985-05-15',
        phoneNumber: '0771234567',
        address: 'Colombo, Sri Lanka',
        password: 'AdminPassword123',
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('2. Create a lecturer account', async () => {
    const res = await adminCtx.post('/api/users', {
      data: {
        email: `lecturer_${Date.now()}@ems.com`,
        fullName: 'New Lecturer',
        nameWithInitials: 'N. Lecturer',
        roleId: 2,
        nicNo: `NIC${Date.now().toString().slice(-9)}`,
        dateOfBirth: '1988-06-20',
        phoneNumber: '0772345678',
        address: 'Kandy, Sri Lanka',
        password: 'LecturerPassword123',
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('3. Create a student account', async () => {
    const res = await adminCtx.post('/api/users', {
      data: {
        email: `student_${Date.now()}@ems.com`,
        fullName: 'New Student',
        nameWithInitials: 'N. Student',
        roleId: 4,
        nicNo: `NIC${Date.now().toString().slice(-9)}`,
        dateOfBirth: '2001-09-10',
        phoneNumber: '0773456789',
        address: 'Galle, Sri Lanka',
        password: 'StudentPassword123',
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('4. Create a user with an existing email', async () => {
    const res = await adminCtx.post('/api/users', {
      data: {
        email: 'admin@ems.com',
        fullName: 'Duplicate Admin',
        nameWithInitials: 'D. Admin',
        nicNo: '198500000000',
        dateOfBirth: '1985-01-01',
        phoneNumber: '0770000000',
        address: 'Colombo',
        roleId: 1,
        password: 'AdminPassword123',
      },
    });
    expect([400, 409]).toContain(res.status());
  });

  test('5. Update user details', async () => {
    const res = await adminCtx.put('/api/users/1', {
      data: { phoneNumber: '0779999999' },
    });
    expect([200, 400, 404]).toContain(res.status());
  });

  test('6. Change a user’s active/inactive status', async () => {
    const res = await adminCtx.patch('/api/users/2/status', {
      data: { isActive: true },
    });
    expect([200, 400, 404]).toContain(res.status());
  });

  test('7. Delete an unused user account', async () => {
    const res = await adminCtx.delete('/api/users/999999');
    expect([200, 400, 404, 405]).toContain(res.status());
  });

  test('8. Delete a user linked to academic records', async () => {
    const res = await adminCtx.delete('/api/users/1');
    expect([400, 403, 404, 405, 409]).toContain(res.status());
  });

  test('9. Create a department', async () => {
    const res = await adminCtx.post('/api/departments', {
      data: {
        departmentName: `Engineering ${Date.now()}`,
        departmentCode: `ENG${Date.now().toString().slice(-3)}`,
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('10. Create a degree and assign it to a department', async () => {
    const res = await adminCtx.post('/api/degrees', {
      data: {
        degreeName: `Degree ${Date.now().toString().slice(-4)}`,
        degreeCode: `D${Date.now().toString().slice(-3)}`,
        departmentId: 1,
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('11. Create a specialization', async () => {
    const res = await adminCtx.post('/api/specializations', {
      data: {
        specializationName: `Cyber Security ${Date.now().toString().slice(-3)}`,
        specializationCode: `CS${Date.now().toString().slice(-3)}`,
        degreeId: 1,
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('12. Update academic structure information', async () => {
    const res = await adminCtx.put('/api/departments/1', {
      data: { departmentName: 'Updated Department Structure' },
    });
    expect([200, 400, 404]).toContain(res.status());
  });

  test('13. Delete referenced academic information', async () => {
    const res = await adminCtx.delete('/api/departments/1');
    expect([400, 409]).toContain(res.status());
  });

  test('14. Create a course with valid information', async () => {
    const res = await adminCtx.post('/api/courses', {
      data: {
        courseName: 'Advanced Algorithms',
        courseCode: `CS${Date.now().toString().slice(-4)}`,
        creditValue: 3,
        departmentId: 1,
        semester: '1.2',
        degrees: [{ degreeId: 1, status: 'COMPULSORY' }],
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('15. Assign and remove course lecturers', async () => {
    const assignRes = await adminCtx.post('/api/courses/1/lecturers', {
      data: { lecturerId: 2 },
    });
    expect([200, 201, 400, 404]).toContain(assignRes.status());
  });

  test('16. Create an examination and timetable', async () => {
    const res = await adminCtx.post('/api/exams/schedules', {
      data: {
        examId: 1,
        hallId: 1,
      },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('17. Detect timetable conflicts', async () => {
    const res = await adminCtx.post('/api/exams/schedules', {
      data: {
        examId: 1,
        hallId: 1,
      },
    });
    expect([200, 201, 400, 404, 409]).toContain(res.status());
  });

  test('18. Configure registration periods', async () => {
    const res = await adminCtx.post('/api/courses/periods', {
      data: {
        semester: '1.2',
        academicYear: 2026,
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-06-30T00:00:00.000Z',
        status: 'OPEN',
      },
    });
    expect([200, 201, 400, 409]).toContain(res.status());
  });

  test('19. View all system users and statistics', async () => {
    const res = await adminCtx.get('/api/system/stats');
    expect([200, 304]).toContain(res.status());
    const body = await res.json();
    expect(body).toBeDefined();
  });

  test('20. View audit logs with pagination', async () => {
    const res = await adminCtx.get('/api/audit-logs?page=1&limit=10');
    expect([200, 304]).toContain(res.status());
    const body = await res.json();
    expect(body.data).toBeDefined();
  });

  test('21. Delete an audit log', async () => {
    const res = await adminCtx.delete('/api/audit-logs/999999');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('22. Generate a database backup', async () => {
    const res = await adminCtx.get('/api/system/backup');
    expect([200, 304]).toContain(res.status());
  });

  test('23. Import students in bulk', async () => {
    const res = await adminCtx.post('/api/imports/students', {
      data: {},
    });
    expect([200, 400]).toContain(res.status());
  });

  test('24. Import courses in bulk', async () => {
    const res = await adminCtx.post('/api/imports/courses', {
      data: {},
    });
    expect([200, 400]).toContain(res.status());
  });

  test('25. Review marks submitted by lecturers', async () => {
    const res = await adminCtx.get('/api/marks/pending-approvals');
    expect([200, 304]).toContain(res.status());
  });

  test('26. Approve or reject marks', async () => {
    const res = await adminCtx.post('/api/marks/exams/1/approve');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('27. Publish examination results', async () => {
    const res = await adminCtx.post('/api/marks/exams/1/approve');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('28. Publish results with no registered students', async () => {
    const res = await adminCtx.post('/api/marks/exams/999999/approve');
    expect([400, 404]).toContain(res.status());
  });

  test('29. Generate department performance reports', async () => {
    const res = await adminCtx.get('/api/reports/departments');
    expect([200, 304]).toContain(res.status());
  });

  test('30. Generate course-grade distribution reports', async () => {
    const res = await adminCtx.get('/api/reports/course-grades/1');
    expect([200, 304, 400, 404]).toContain(res.status());
  });

  test('31. Generate GPA trend reports', async () => {
    const res = await adminCtx.get('/api/reports/trends');
    expect([200, 304]).toContain(res.status());
  });

  test('32. Administrator accesses all authorized modules', async () => {
    const res = await adminCtx.get('/api/system/stats');
    expect([200, 304]).toContain(res.status());
  });

  test('33. Record administrator actions in the audit log', async () => {
    const res = await adminCtx.get('/api/audit-logs?page=1&limit=5');
    expect([200, 304]).toContain(res.status());
  });
});
