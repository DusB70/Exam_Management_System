import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dtos/users.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@ems/shared';

@Controller('users')
@Roles(UserRole.ADMINISTRATOR)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
    @Query('roleId') roleId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 10;
    const parsedRoleId = roleId ? parseInt(roleId, 10) : undefined;
    const parsedIsActive = isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    const data = await this.usersService.findAll(
      parsedPage,
      parsedLimit,
      search,
      parsedRoleId,
      parsedIsActive,
    );
    return {
      success: true,
      message: 'Users retrieved successfully',
      data,
    };
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findById(id);
    const safeUser = { ...(user as any) };
    delete safeUser.password_hash;
    return {
      success: true,
      message: 'User retrieved successfully',
      data: safeUser,
    };
  }

  @Post()
  async create(@Body() createUserDto: CreateUserDto, @GetUser('id') executorId: number) {
    const user = await this.usersService.create(createUserDto, executorId);
    const safeUser = { ...(user as any) };
    delete safeUser.password_hash;
    return {
      success: true,
      message: 'User created successfully',
      data: safeUser,
    };
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser('id') executorId: number,
  ) {
    const user = await this.usersService.update(id, updateUserDto, executorId);
    const safeUser = { ...(user as any) };
    delete safeUser.password_hash;
    return {
      success: true,
      message: 'User updated successfully',
      data: safeUser,
    };
  }

  @Patch(':id/status')
  async toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
    @GetUser('id') executorId: number,
  ) {
    const user = await this.usersService.updateStatus(id, isActive, executorId);
    const safeUser = { ...(user as any) };
    delete safeUser.password_hash;
    return {
      success: true,
      message: `User status changed successfully to ${isActive ? 'active' : 'inactive'}`,
      data: safeUser,
    };
  }
}
