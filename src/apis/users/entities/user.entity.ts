import { Comment } from 'src/apis/comments/entities/comment.entity';
import { Question } from 'src/apis/questions/entities/question.entity';
import { StudyUser } from 'src/apis/studies/entities/studyUser.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column()
  password: string;

  @Column()
  profileImgUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Comment, (post) => post.user, { cascade: true })
  posts: Comment[];

  @OneToMany(() => Comment, (comment) => comment.user, { cascade: true })
  comments: Comment[];

  @OneToMany(() => Question, (question) => question.user, { cascade: true })
  questions: Question[];

  @OneToMany(() => StudyUser, (studyUser) => studyUser.user)
  studyUsers: StudyUser[];
}
