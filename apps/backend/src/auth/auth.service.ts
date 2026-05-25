import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dtos/auth.dto';
import { UserRole } from '@ems/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    let user;
    try {
      user = await this.usersService.findByEmail(email);
    } catch {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.user_id,
      email: user.email,
      role: user.role.role_name as UserRole,
      fullName: user.full_name,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret:
        this.configService.get<string>('JWT_ACCESS_SECRET') ||
        'super-secret-access-token-key-change-in-production',
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret:
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'super-secret-refresh-token-key-change-in-production',
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    // Store refresh token in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        user_id: user.user_id,
        token: refreshToken,
        expires_at: expiresAt,
      },
    });

    // Return tokens and safe user summary
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role.role_name as UserRole,
      },
    };
  }

  async logout(userId: number, refreshToken: string) {
    // Revoke current token
    await this.prisma.refreshToken.updateMany({
      where: {
        user_id: userId,
        token: refreshToken,
      },
      data: {
        is_revoked: true,
      },
    });
  }

  async refreshTokens(
    userId: number,
    email: string,
    role: UserRole,
    fullName: string,
    refreshToken: string,
  ) {
    // 1. Lookup current token
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh session');
    }

    // 2. Compromise Detection: if token is already revoked, reuse occurred!
    if (tokenRecord.is_revoked) {
      this.logger.warn(
        `Security Warning: Refresh token reuse detected for user ID ${userId}! Revoking all sessions.`,
      );
      // Revoke all tokens for this user immediately
      await this.prisma.refreshToken.updateMany({
        where: { user_id: userId },
        data: { is_revoked: true },
      });
      throw new UnauthorizedException('Session compromised. Please sign in again.');
    }

    // 3. Check expiration
    if (new Date() > tokenRecord.expires_at) {
      throw new UnauthorizedException('Session expired');
    }

    // 4. Mark old token as revoked (single-use rotation)
    await this.prisma.refreshToken.update({
      where: { token_id: tokenRecord.token_id },
      data: { is_revoked: true },
    });

    // 5. Generate new pair
    const payload = { sub: userId, email, role, fullName };

    const newAccessToken = await this.jwtService.signAsync(payload, {
      secret:
        this.configService.get<string>('JWT_ACCESS_SECRET') ||
        'super-secret-access-token-key-change-in-production',
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m',
    });

    const newRefreshToken = await this.jwtService.signAsync(payload, {
      secret:
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'super-secret-refresh-token-key-change-in-production',
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    // 6. Save new token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        user_id: userId,
        token: newRefreshToken,
        expires_at: expiresAt,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    let user;
    try {
      user = await this.usersService.findByEmail(email);
    } catch {
      // Security practice: do not reveal that a user does not exist.
      // Simply return a successful status code.
      return { message: 'Password recovery email sent if user exists.' };
    }

    if (!user) {
      return { message: 'Password recovery email sent if user exists.' };
    }

    // Generate signed recovery token (15-minute expiration)
    const resetToken = await this.jwtService.signAsync(
      { email: user.email, type: 'reset' },
      {
        secret:
          this.configService.get<string>('JWT_ACCESS_SECRET') ||
          'super-secret-access-token-key-change-in-production',
        expiresIn: '15m',
      },
    );

    // Mock Email Delivery: Log in terminal for development
    const recoveryLink = `http://localhost:3000/reset-password?token=${resetToken}`;
    this.logger.log(
      `\n========================================\n[MAIL MOCK] Password Recovery Link for ${email}:\n${recoveryLink}\n========================================`,
    );

    return { message: 'Password recovery email sent if user exists.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, password } = resetPasswordDto;

    let payload;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret:
          this.configService.get<string>('JWT_ACCESS_SECRET') ||
          'super-secret-access-token-key-change-in-production',
      });
    } catch {
      throw new BadRequestException('Reset token is invalid or has expired');
    }

    if (!payload || payload.type !== 'reset') {
      throw new BadRequestException('Invalid token format');
    }

    const user = await this.usersService.findByEmail(payload.email);
    if (!user) {
      throw new BadRequestException('User no longer exists');
    }

    // Update password
    const newPasswordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { user_id: user.user_id },
      data: { password_hash: newPasswordHash },
    });

    // Security practice: revoke all active refresh sessions on password change
    await this.prisma.refreshToken.updateMany({
      where: { user_id: user.user_id },
      data: { is_revoked: true },
    });

    return { message: 'Password reset successful' };
  }
}
