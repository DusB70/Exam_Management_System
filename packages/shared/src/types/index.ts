import { UserRole } from '../constants/index.js';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface JwtPayload {
  sub: number; // user_id
  email: string;
  role: UserRole;
  fullName: string;
}

export interface UserSession {
  user: {
    id: number;
    email: string;
    fullName: string;
    role: UserRole;
  };
  accessToken: string;
  refreshToken: string;
}
