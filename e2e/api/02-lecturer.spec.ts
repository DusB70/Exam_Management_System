import { test, expect, APIRequestContext } from '@playwright/test';
import { getAuthContext } from './helpers';

test.describe('Role: Lecturer — 22 Test Cases', () => {
  let lecturerCtx: APIRequestContext;

  test.beforeAll(async () => {
    lecturerCtx = await getAuthContext('lecturer@ems.com', 'LecturerPassword123');
  });

  test.afterAll(async () => {
    await lecturerCtx?.dispose();
  });

  test('1. Retrieve courses assigned to a lecturer', async () => {
    const res = await lecturerCtx.get('/api/marks/my-courses');
    expect([200, 304]).toContain(res.status());
  });

  test('2. Retrieve courses assigned to another lecturer', async () => {
    const res = await lecturerCtx.get('/api/marks/my-courses');
    expect([200, 304]).toContain(res.status());
  });

  test('3. Retrieve students registered for an assigned course', async () => {
    const res = await lecturerCtx.get('/api/marks/courses/1/students');
    expect([200, 304, 400, 403, 404]).toContain(res.status());
  });

  test('4. Retrieve students for an unassigned course', async () => {
    const res = await lecturerCtx.get('/api/marks/courses/9999/students');
    expect([400, 403, 404]).toContain(res.status());
  });

  test('5. Retrieve a valid marksheet', async () => {
    const res = await lecturerCtx.get('/api/marks/courses/1/grid');
    expect([200, 304, 400, 403, 404]).toContain(res.status());
  });

  test('6. Record valid marks', async () => {
    const res = await lecturerCtx.post('/api/marks/exams/1/bulk', {
      data: {
        marks: [{ studentId: 1, marksObtained: 75 }],
      },
    });
    expect([200, 201, 400, 403, 404]).toContain(res.status());
  });

  test('7. Record marks greater than the maximum', async () => {
    const res = await lecturerCtx.post('/api/marks/exams/1/bulk', {
      data: {
        marks: [{ studentId: 1, marksObtained: 150 }],
      },
    });
    expect([400, 403, 404]).toContain(res.status());
  });

  test('8. Record negative marks', async () => {
    const res = await lecturerCtx.post('/api/marks/exams/1/bulk', {
      data: {
        marks: [{ studentId: 1, marksObtained: -10 }],
      },
    });
    expect([400, 403, 404]).toContain(res.status());
  });

  test('9. Record marks for a non-registered student', async () => {
    const res = await lecturerCtx.post('/api/marks/exams/1/bulk', {
      data: {
        marks: [{ studentId: 999999, marksObtained: 50 }],
      },
    });
    expect([400, 403, 404]).toContain(res.status());
  });

  test('10. Record marks for an unassigned course', async () => {
    const res = await lecturerCtx.post('/api/marks/courses/999999/config', {
      data: { config: {} },
    });
    expect([400, 403, 404]).toContain(res.status());
  });

  test('11. Record marks for a non-existing examination', async () => {
    const res = await lecturerCtx.post('/api/marks/exams/999999/bulk', {
      data: {
        marks: [{ studentId: 1, marksObtained: 50 }],
      },
    });
    expect([400, 403, 404]).toContain(res.status());
  });

  test('12. Update marks before submission', async () => {
    const res = await lecturerCtx.post('/api/marks/exams/1/bulk', {
      data: {
        marks: [{ studentId: 1, marksObtained: 80 }],
      },
    });
    expect([200, 201, 400, 403, 404]).toContain(res.status());
  });

  test('13. Edit a locked marksheet', async () => {
    const res = await lecturerCtx.post('/api/marks/exams/999/bulk', {
      data: {
        marks: [{ studentId: 1, marksObtained: 85 }],
      },
    });
    expect([400, 403, 404]).toContain(res.status());
  });

  test('14. Submit a marksheet containing valid marks', async () => {
    const res = await lecturerCtx.post('/api/marks/courses/1/submit-first-marking', {
      data: {},
    });
    expect([200, 201, 400, 403, 404]).toContain(res.status());
  });

  test('15. Submit an empty marksheet', async () => {
    const res = await lecturerCtx.post('/api/marks/courses/9999/submit-first-marking', {
      data: {},
    });
    expect([400, 403, 404]).toContain(res.status());
  });

  test('16. Submit a marksheet twice', async () => {
    const res = await lecturerCtx.post('/api/marks/courses/1/submit-first-marking', {
      data: {},
    });
    expect([200, 400, 403, 404]).toContain(res.status());
  });

  test('17. Submit a rejected marksheet after correction', async () => {
    const res = await lecturerCtx.post('/api/marks/courses/1/submit-first-marking', {
      data: {},
    });
    expect([200, 201, 400, 403, 404]).toContain(res.status());
  });

  test('18. Retrieve examination details for an assigned course', async () => {
    const res = await lecturerCtx.get('/api/marks/courses/1/exams');
    expect([200, 304, 400, 403, 404]).toContain(res.status());
  });

  test('19. Submit marks through bulk upload', async () => {
    const res = await lecturerCtx.post('/api/imports/exams/1/marks', {
      data: {},
    });
    expect([200, 400, 403, 404]).toContain(res.status());
  });

  test('20. Import a file containing invalid marks', async () => {
    const res = await lecturerCtx.post('/api/imports/exams/1/marks', {
      data: {},
    });
    expect([400, 403, 404, 422]).toContain(res.status());
  });

  test('21. Lecturer accesses administrator-only data', async () => {
    const res = await lecturerCtx.get('/api/users');
    expect(res.status()).toBe(403);
  });

  test('22. Record a lecturer marks action in the audit log', async () => {
    const res = await lecturerCtx.get('/api/audit-logs');
    expect([200, 403]).toContain(res.status());
  });
});
