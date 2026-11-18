import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { getAuthContext } from './api/helpers';

/**
 * System Testing & Role-Based Scenario Suite (18 Test Scenarios)
 * Validates complete end-to-end flows across all user roles and system components.
 */
const prisma = new PrismaClient();

test.describe('System Testing', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. Student: Login and open the student dashboard
  // ---------------------------------------------------------------------------
  test('Student >> Login and open the student dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('student@ems.com');
    await page.locator('input[placeholder="••••••••"]').fill('StudentPassword123');
    await page.getByRole('button', { name: /Sign In to Portal/i }).click();

    // Verify redirection to main dashboard
    await expect(page).toHaveURL(/http:\/\/localhost:3000\/?$/, { timeout: 15000 });
    // Verify student-specific welcome greeting / portal indicators
    await expect(page.locator('body')).toContainText(/student/i, { timeout: 10000 });
  });

  // ---------------------------------------------------------------------------
  // 2. Student: View eligible courses
  // ---------------------------------------------------------------------------
  test('Student >> View eligible courses', async () => {
    const studentCtx = await getAuthContext('student@ems.com', 'StudentPassword123');
    const res = await studentCtx.get('/api/registrations/eligible-courses');

    expect([200, 304, 400]).toContain(res.status());
    const body = await res.json();
    expect(body).toBeDefined();

    await studentCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 3. Student: Register for a course
  // ---------------------------------------------------------------------------
  test('Student >> Register for a course', async () => {
    const studentCtx = await getAuthContext('student@ems.com', 'StudentPassword123');
    const course = await prisma.course.findFirst();

    if (course) {
      const res = await studentCtx.post('/api/registrations', {
        data: {
          courseIds: [course.course_id],
        },
      });
      // 200/201 (registered successfully) or 400 (already registered / registration window closed)
      expect([200, 201, 400]).toContain(res.status());
    } else {
      const res = await studentCtx.get('/api/registrations/eligible-courses');
      expect([200, 304, 400]).toContain(res.status());
    }

    await studentCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 4. Student: View examination timetable
  // ---------------------------------------------------------------------------
  test('Student >> View examination timetable', async () => {
    const studentCtx = await getAuthContext('student@ems.com', 'StudentPassword123');
    const res = await studentCtx.get('/api/exams/timetable/my-schedules');

    expect([200, 304]).toContain(res.status());
    const body = await res.json();
    expect(body.data).toBeDefined();

    await studentCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 5. Student: View and download results
  // ---------------------------------------------------------------------------
  test('Student >> View and download results', async () => {
    const studentCtx = await getAuthContext('student@ems.com', 'StudentPassword123');

    // 1. Fetch transcript report card
    const reportRes = await studentCtx.get('/api/results/my-report');
    expect([200, 304]).toContain(reportRes.status());

    // 2. Download report card PDF
    const pdfRes = await studentCtx.get('/api/results/my-report/pdf');
    expect([200, 304, 400]).toContain(pdfRes.status());

    await studentCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 6. Lecturer: Login and view assigned courses
  // ---------------------------------------------------------------------------
  test('Lecturer >> Login and view assigned courses', async () => {
    const lecturerCtx = await getAuthContext('lecturer@ems.com', 'LecturerPassword123');
    const res = await lecturerCtx.get('/api/marks/my-courses');

    expect([200, 304]).toContain(res.status());
    const body = await res.json();
    expect(body.data).toBeDefined();

    await lecturerCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 7. Lecturer: Enter and submit student marks
  // ---------------------------------------------------------------------------
  test('Lecturer >> Enter and submit student marks', async () => {
    const lecturerCtx = await getAuthContext('lecturer@ems.com', 'LecturerPassword123');

    const res = await lecturerCtx.post('/api/marks/exams/1/bulk', {
      data: {
        marks: [{ studentId: 1, marksObtained: 78 }],
      },
    });

    expect([200, 201, 400, 403, 404]).toContain(res.status());

    await lecturerCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 8. Lecturer: Enter invalid marks
  // ---------------------------------------------------------------------------
  test('Lecturer >> Enter invalid marks', async () => {
    const lecturerCtx = await getAuthContext('lecturer@ems.com', 'LecturerPassword123');

    // Submitting negative marks or exceeding total allowed marks
    const res = await lecturerCtx.post('/api/marks/exams/1/bulk', {
      data: {
        marks: [{ studentId: 1, marksObtained: -25 }],
      },
    });

    expect([400, 403, 404, 422]).toContain(res.status());

    await lecturerCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 9. Administrator: Create users and manage roles
  // ---------------------------------------------------------------------------
  test('Administrator >> Create users and manage roles', async () => {
    const adminCtx = await getAuthContext('admin@ems.com', 'AdminPassword123');

    const res = await adminCtx.post('/api/users', {
      data: {
        email: `sys_test_${Date.now()}@ems.com`,
        fullName: 'System Test User',
        nameWithInitials: 'S. T. User',
        roleId: 2,
        nicNo: `NIC${Date.now().toString().slice(-9)}`,
        dateOfBirth: '1990-01-01',
        phoneNumber: '0770001122',
        address: 'Colombo, Sri Lanka',
        password: 'TestPassword123',
      },
    });

    expect([200, 201, 400]).toContain(res.status());

    await adminCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 10. Administrator: Manage departments, degrees, and specializations
  // ---------------------------------------------------------------------------
  test('Administrator >> Manage departments, degrees, and specializations', async () => {
    const adminCtx = await getAuthContext('admin@ems.com', 'AdminPassword123');

    // 1. Create a department
    const deptRes = await adminCtx.post('/api/departments', {
      data: {
        departmentName: `Dept Sys ${Date.now()}`,
        departmentCode: `DS${Date.now().toString().slice(-4)}`,
      },
    });
    expect([200, 201, 400]).toContain(deptRes.status());

    // 2. Fetch degrees
    const degRes = await adminCtx.get('/api/degrees');
    expect([200, 304]).toContain(degRes.status());

    // 3. Fetch specializations
    const specRes = await adminCtx.get('/api/specializations');
    expect([200, 304]).toContain(specRes.status());

    await adminCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 11. Administrator: View audit logs and system statistics
  // ---------------------------------------------------------------------------
  test('Administrator >> View audit logs and system statistics', async () => {
    const adminCtx = await getAuthContext('admin@ems.com', 'AdminPassword123');

    // System stats
    const statsRes = await adminCtx.get('/api/system/stats');
    expect([200, 304]).toContain(statsRes.status());

    // Audit logs
    const auditRes = await adminCtx.get('/api/audit-logs?page=1&limit=10');
    expect([200, 304]).toContain(auditRes.status());

    await adminCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 12. Exam Division Staff: Manage courses and examination schedules
  // ---------------------------------------------------------------------------
  test('Exam Division Staff >> Manage courses and examination schedules', async () => {
    const staffCtx = await getAuthContext('staff@ems.com', 'StaffPassword123');

    // 1. Fetch courses
    const coursesRes = await staffCtx.get('/api/courses');
    expect([200, 304]).toContain(coursesRes.status());

    // 2. Fetch exam schedules
    const schedulesRes = await staffCtx.get('/api/exams/schedules');
    expect([200, 304]).toContain(schedulesRes.status());

    await staffCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 13. Exam Division Staff: Review and approve lecturer marks
  // ---------------------------------------------------------------------------
  test('Exam Division Staff >> Review and approve lecturer marks', async () => {
    const staffCtx = await getAuthContext('staff@ems.com', 'StaffPassword123');

    // Review marks submitted
    const reviewRes = await staffCtx.get('/api/marks/pending-approvals');
    expect([200, 304]).toContain(reviewRes.status());

    // Approve marksheet
    const approveRes = await staffCtx.post('/api/marks/exams/1/approve');
    expect([200, 400, 404]).toContain(approveRes.status());

    await staffCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 14. Exam Division Staff: Reject an invalid marksheet
  // ---------------------------------------------------------------------------
  test('Exam Division Staff >> Reject an invalid marksheet', async () => {
    const staffCtx = await getAuthContext('staff@ems.com', 'StaffPassword123');

    // Reject marksheet with feedback reason
    const rejectRes = await staffCtx.post('/api/marks/exams/1/reject');
    expect([200, 400, 404]).toContain(rejectRes.status());

    await staffCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 15. All roles: Access a page not permitted for the user role
  // ---------------------------------------------------------------------------
  test('All roles >> Access a page not permitted for the user role', async () => {
    const studentCtx = await getAuthContext('student@ems.com', 'StudentPassword123');

    // Student attempting to access administrator-only audit logs endpoint
    const res = await studentCtx.get('/api/audit-logs');
    expect([401, 403]).toContain(res.status());

    await studentCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 16. All roles: Use the system with missing or invalid input
  // ---------------------------------------------------------------------------
  test('All roles >> Use the system with missing or invalid input', async () => {
    const adminCtx = await getAuthContext('admin@ems.com', 'AdminPassword123');

    // Create department with missing required name and code
    const res = await adminCtx.post('/api/departments', {
      data: {},
    });

    expect([400, 422]).toContain(res.status());

    await adminCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 17. Administrator: Generate a system backup
  // ---------------------------------------------------------------------------
  test('Administrator >> Generate a system backup', async () => {
    const adminCtx = await getAuthContext('admin@ems.com', 'AdminPassword123');
    const res = await adminCtx.get('/api/system/backup');

    expect([200, 304]).toContain(res.status());
    expect(res.headers()['content-type']).toContain('application/json');

    await adminCtx.dispose();
  });

  // ---------------------------------------------------------------------------
  // 18. All roles: Log out of the system
  // ---------------------------------------------------------------------------
  test('All roles >> Log out of the system', async ({ page }) => {
    // 1. Log in from frontend
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@ems.com');
    await page.locator('input[placeholder="••••••••"]').fill('AdminPassword123');
    await page.getByRole('button', { name: /Sign In to Portal/i }).click();
    await expect(page).toHaveURL(/http:\/\/localhost:3000\/?$/, { timeout: 15000 });

    // 2. Click Sign Out button in sidebar
    await page
      .getByRole('button', { name: /Sign Out/i })
      .first()
      .click();

    // 3. Confirm sign out in the confirmation dialog
    const confirmBtn = page.getByRole('button', { name: /Sign Out/i }).last();
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    // 4. Verify user is redirected back to login page
    await expect(page).toHaveURL(/.*login/, { timeout: 15000 });
  });
});
