import { CreateUserDto } from '../dto/create-user.dto';

export interface IUserServiceFindByEmail {
  email: string;
}

export interface IUsersServiceCreateUser {
  createUserDto: CreateUserDto;
}
