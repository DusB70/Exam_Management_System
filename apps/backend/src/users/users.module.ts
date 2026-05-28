import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { UsersController } from './users.controller';
import { LecturersController } from './lecturers.controller';
import { ProfileController } from './profile.controller';

@Module({
  controllers: [UsersController, LecturersController, ProfileController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
