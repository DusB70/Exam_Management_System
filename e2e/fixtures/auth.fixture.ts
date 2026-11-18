import { Page } from '@playwright/test';

export interface MockUser {
  id: number;
  email: string;
  fullName: string;
  role: 'Student' | 'Lecturer' | 'Exam Division Staff' | 'Administrator';
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export const MOCK_USERS: Record<string, MockUser> = {
  student: {
    id: 1,
    email: 'student1@ems.com',
    fullName: 'Kasun Perera',
    role: 'Student',
  },
  lecturer: {
    id: 2,
    email: 'lecturer@ems.com',
    fullName: 'Demo Lecturer',
    role: 'Lecturer',
  },
  staff: {
    id: 3,
    email: 'staff@ems.com',
    fullName: 'Exam Staff',
    role: 'Exam Division Staff',
  },
  admin: {
    id: 4,
    email: 'admin@ems.com',
    fullName: 'System Administrator',
    role: 'Administrator',
  },
};

/**
 * Intercepts /api/auth/me to simulate an active logged-in user session.
 */
export async function mockAuthenticatedUser(page: Page, user: MockUser) {
  await page.route('**/api/auth/me', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    await route.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user,
      }),
    });
  });
}

/**
 * Intercepts /api/auth/me to simulate an unauthenticated guest session.
 */
export async function mockGuestUser(page: Page) {
  await page.route('**/api/auth/me', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    await route.fulfill({
      status: 401,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        message: 'Unauthorized',
      }),
    });
  });
}
