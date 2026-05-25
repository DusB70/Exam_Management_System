import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@ems/shared';

const refreshCookieExtractor = (req: Request): string | null => {
  if (req && req.headers && req.headers.cookie) {
    const rawCookies = req.headers.cookie.split(';');
    for (const rawCookie of rawCookies) {
      const [name, val] = rawCookie.split('=');
      if (name && val && name.trim() === 'refresh_token') {
        return decodeURIComponent(val);
      }
    }
  }
  return null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: refreshCookieExtractor,
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_REFRESH_SECRET') ||
        'super-secret-refresh-token-key-change-in-production',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const refreshToken = refreshCookieExtractor(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }
    return {
      ...payload,
      refreshToken,
    };
  }
}
