import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '@ems/shared';

const cookieExtractor = (req: Request): string | null => {
  if (req && req.headers && req.headers.cookie) {
    const rawCookies = req.headers.cookie.split(';');
    for (const rawCookie of rawCookies) {
      const [name, val] = rawCookie.split('=');
      if (name && val && name.trim() === 'access_token') {
        return decodeURIComponent(val);
      }
    }
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') ||
        'super-secret-access-token-key-change-in-production',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('User is inactive or no longer exists');
    }
    return {
      id: user.user_id,
      email: user.email,
      role: user.role.role_name,
      fullName: user.full_name,
      address: user.address,
      phoneNumber: user.phone_number,
    };
  }
}
