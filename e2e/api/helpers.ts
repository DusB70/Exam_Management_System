import { request, APIRequestContext } from '@playwright/test';

export const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

/**
 * Creates an authenticated Playwright APIRequestContext that stores session cookies.
 */
export async function getAuthContext(email: string, password: string): Promise<APIRequestContext> {
  const context = await request.newContext({
    baseURL: BACKEND_URL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const loginRes = await context.post('/api/auth/login', {
        data: { email, password },
      });

      if (loginRes.ok()) {
        return context;
      }
    } catch {
      // ignore network glitch on attempt
    }
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  return context;
}
