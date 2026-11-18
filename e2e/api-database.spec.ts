import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

/**
 * Demonstrates testing the Backend (API) and PostgreSQL Database (Prisma)
 * directly within Playwright!
 */
const prisma = new PrismaClient();
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000/api';

test.describe('Backend API & PostgreSQL Database Tests (Playwright)', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------
  // 1. Direct PostgreSQL Database Testing with Prisma Client
  // -------------------------------------------------------------
  test('PostgreSQL: should query database directly and verify seeded roles exist', async () => {
    const roles = await prisma.role.findMany({
      select: { role_name: true },
    });

    expect(roles.length).toBeGreaterThan(0);

    const roleNames = roles.map((r) => r.role_name);
    expect(roleNames).toContain('Administrator');
    expect(roleNames).toContain('Student');
    expect(roleNames).toContain('Lecturer');
    expect(roleNames).toContain('Exam Division Staff');
  });

  test('PostgreSQL: should verify database connection via raw SQL query', async () => {
    // Execute a raw SQL health check ping against PostgreSQL
    const result = await prisma.$queryRaw<Array<{ health: number }>>`SELECT 1 AS health`;

    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    expect(Number(result[0].health)).toBe(1);
  });

  test('PostgreSQL: should enforce unique constraints on users table', async () => {
    // Look up an existing user
    const existingUser = await prisma.user.findFirst();
    test.skip(!existingUser, 'No users in database to test unique constraint');

    // Attempting to duplicate the NIC number must reject with Prisma P2002 constraint error
    await expect(
      prisma.user.create({
        data: {
          email: 'unique-test-temp@ems.com',
          full_name: 'Constraint Tester',
          name_with_initials: 'C. Tester',
          password_hash: 'hash',
          role_id: existingUser!.role_id,
          nic_no: existingUser!.nic_no, // Duplicate NIC!
          date_of_birth: new Date('2000-01-01'),
          phone_number: '0770000000',
          address: 'Test Address',
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2002', // Prisma unique constraint violation code
    });
  });

  // -------------------------------------------------------------
  // 2. Backend REST API Testing with Playwright's { request } fixture
  // -------------------------------------------------------------
  test('Backend API: should verify health check endpoint returns 200 OK', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/health`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('status');
  });

  test('Backend API: should reject login with invalid credentials', async ({ request }) => {
    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      data: {
        email: 'invalid-user@ems.com',
        password: 'IncorrectPassword',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    // NestJS UnauthorizedException returns { statusCode: 401, message: '...', error: 'Unauthorized' }
    expect(body.statusCode || response.status()).toBe(401);
    expect(body.message).toBeDefined();
  });

  // -------------------------------------------------------------
  // 3. Hybrid Test: API Action + Direct PostgreSQL Verification
  // -------------------------------------------------------------
  test('Hybrid: API login should match user record in PostgreSQL', async ({ request }) => {
    // Step A: Login via Backend API
    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      data: {
        email: 'admin@ems.com',
        password: 'AdminPassword123',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe('admin@ems.com');

    // Step B: Directly verify database state in PostgreSQL
    const dbUser = await prisma.user.findUnique({
      where: { email: 'admin@ems.com' },
      include: { role: true },
    });

    expect(dbUser).not.toBeNull();
    expect(dbUser?.email).toBe('admin@ems.com');
    expect(dbUser?.role.role_name).toBe('Administrator');
  });
});
