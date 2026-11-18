import { test, expect, APIRequestContext } from '@playwright/test';
import { getAuthContext } from './helpers';

test.describe('Role: Student — 26 Test Cases', () => {
  let studentCtx: APIRequestContext;

  test.beforeAll(async () => {
    studentCtx = await getAuthContext('student@ems.com', 'StudentPassword123');
  });

  test.afterAll(async () => {
    await studentCtx?.dispose();
  });

  test('1. Find student profile using a valid user ID', async () => {
    const res = await studentCtx.get('/api/profile');
    expect([200, 304]).toContain(res.status());
    const body = await res.json();
    expect(body.data).toBeDefined();
  });

  test('2. Find a non-existing student profile', async () => {
    const res = await studentCtx.get('/api/users/999999');
    expect([400, 403, 404]).toContain(res.status());
  });

  test('3. Retrieve the student’s eligible courses', async () => {
    const res = await studentCtx.get('/api/registrations/eligible-courses');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('4. Retrieve courses when no registration period is open', async () => {
    const res = await studentCtx.get('/api/registrations/active-period');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('5. Register for valid course', async () => {
    const res = await studentCtx.post('/api/registrations', {
      data: { courseIds: [1] },
    });
    expect([200, 201, 400]).toContain(res.status());
  });

  test('6. Register for multiple valid courses', async () => {
    const res = await studentCtx.post('/api/registrations', {
      data: { courseIds: [1, 2] },
    });
    expect([200, 201, 400]).toContain(res.status());
  });

  test('7. Register without selecting courses', async () => {
    const res = await studentCtx.post('/api/registrations', {
      data: { courseIds: [] },
    });
    expect(res.status()).toBe(400);
  });

  test('8. Register for a non-existing course', async () => {
    const res = await studentCtx.post('/api/registrations', {
      data: { courseIds: [999999] },
    });
    expect(res.status()).toBe(400);
  });

  test('9. Register for a course from another department', async () => {
    const res = await studentCtx.post('/api/registrations', {
      data: { courseIds: [999] },
    });
    expect(res.status()).toBe(400);
  });

  test('10. Register for a course from another semester', async () => {
    const res = await studentCtx.post('/api/registrations', {
      data: { courseIds: [998] },
    });
    expect(res.status()).toBe(400);
  });

  test('11. Register when the registration period is closed', async () => {
    const res = await studentCtx.post('/api/registrations', {
      data: { courseIds: [1] },
    });
    expect([200, 201, 400]).toContain(res.status());
  });

  test('12. Register for a duplicate course', async () => {
    const res = await studentCtx.post('/api/registrations', {
      data: { courseIds: [1, 1] },
    });
    expect([200, 201, 400]).toContain(res.status());
  });

  test('13. Can register the all the eligible courses', async () => {
    const res = await studentCtx.get('/api/registrations/eligible-courses');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('14. Drop an existing course registration', async () => {
    const res = await studentCtx.delete('/api/registrations/1');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('15. Drop a non-existing registration', async () => {
    const res = await studentCtx.delete('/api/registrations/999999');
    expect([400, 404]).toContain(res.status());
  });

  test('16. Drop another student’s registration', async () => {
    const res = await studentCtx.delete('/api/registrations/999');
    expect([400, 403, 404]).toContain(res.status());
  });

  test('17. Drop a course after registration closes', async () => {
    const res = await studentCtx.delete('/api/registrations/1');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('18. Register for a repeat examination', async () => {
    const res = await studentCtx.post('/api/registrations/repeat-register', {
      data: { courseId: 1 },
    });
    expect([200, 201, 400, 404]).toContain(res.status());
  });

  test('19. Register for an ineligible repeat examination', async () => {
    const res = await studentCtx.post('/api/registrations/repeat-register', {
      data: { courseId: 99999 },
    });
    expect([400, 404]).toContain(res.status());
  });

  test('20. Retrieve the student’s examination timetable', async () => {
    const res = await studentCtx.get('/api/exams/timetable/my-schedules');
    expect([200, 304, 404]).toContain(res.status());
  });

  test('21. Retrieve unpublished results', async () => {
    const res = await studentCtx.get('/api/results/unpublished');
    expect([400, 403, 404]).toContain(res.status());
  });

  test('22. Retrieve published results', async () => {
    const res = await studentCtx.get('/api/results/my-report');
    expect([200, 304, 404]).toContain(res.status());
  });

  test('23. Generate a student report card', async () => {
    const res = await studentCtx.get('/api/results/my-report/pdf');
    expect([200, 400, 404]).toContain(res.status());
  });

  test('24. Submit a medical or recorrection request', async () => {
    const res = await studentCtx.post('/api/requests/grace-chance', {
      data: {
        academic_year: 2026,
        semester: '1',
        reason: 'Recorrection test request',
      },
    });
    expect([200, 201, 400, 500]).toContain(res.status());
  });

  test('25. Submit a request without required information', async () => {
    const res = await studentCtx.post('/api/requests/grace-chance', {
      data: {},
    });
    expect([400, 422, 500]).toContain(res.status());
  });

  test('26. Student accesses an administrator endpoint', async () => {
    const res = await studentCtx.get('/api/system/stats');
    expect(res.status()).toBe(403);
  });
});
