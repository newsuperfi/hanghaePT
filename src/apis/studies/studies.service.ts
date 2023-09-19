import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Study } from './entities/study.entity';
import { DataSource, Repository } from 'typeorm';
import { StudyUser } from './entities/studyUser.entity';
import {
  IStudiesServiceCreateStudy,
  IStudiesServiceFindByUserId,
  IStudiesServiceFindStudies,
  IStudiesServiceFindStudiesByTopic,
  IStudiesServiceFindUserStudy,
  IStudiesServiceForcedExitStudy,
  IStudiesServiceJoinStudy,
  IStudiesServiceOutStudy,
} from './interfaces/studies-service.interface';

@Injectable()
export class StudiesService {
  constructor(
    @InjectRepository(Study)
    private readonly studiesRepository: Repository<Study>,
    @InjectRepository(StudyUser)
    private readonly studyUsersRepository: Repository<StudyUser>,
    private readonly dataSource: DataSource,
  ) {}

  async createStudy({
    createStudyDto,
    userId,
  }: IStudiesServiceCreateStudy): Promise<Study> {
    const study = await this.studiesRepository.save(createStudyDto);

    await this.studyUsersRepository.save({
      study: { id: study.id },
      user: { id: userId },
      isHost: true,
    });

    return study;
  }

  async joinStudy({
    studyId,
    guestId,
    hostId,
  }: IStudiesServiceJoinStudy): Promise<void> {
    const hostStudyUser = await this.findUserStudy({ studyId, userId: hostId });
    if (!hostStudyUser)
      throw new NotFoundException('해당하는 스터디가 없습니다.');
    if (!hostStudyUser.isHost) throw new HttpException('권한이 없습니다.', 401);

    const isExistStduyUser = await this.findUserStudy({
      studyId,
      userId: guestId,
    });

    if (isExistStduyUser)
      throw new ConflictException('이미 등록된 유저입니다.');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const study = await queryRunner.manager.findOne(Study, {
        where: { id: studyId },
        lock: { mode: 'pessimistic_write' },
      });

      if (study.maxCount <= study.joinCount)
        throw new ConflictException('최대 수용인원을 초과하였습니다');

      await queryRunner.manager.insert(StudyUser, {
        study: { id: studyId },
        user: { id: guestId },
        isHost: false,
      });

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new HttpException(error.message, error.status || 500);
    } finally {
      await queryRunner.release();
    }
  }

  async outStudy({ userId, studyId }: IStudiesServiceOutStudy): Promise<void> {
    const studyUser = await this.findUserStudy({ userId, studyId });
    if (studyUser.isHost)
      throw new ConflictException('스터디장은 스터디를 나갈 수 없습니다.');

    if (!studyUser) throw new NotFoundException('스터디에 없는 유저입니다.');

    await this.studyUsersRepository.delete({ id: studyUser.id });
  }

  async forcedExitStudy({
    hostId,
    studyId,
    forcedExitStudyDto,
  }: IStudiesServiceForcedExitStudy): Promise<void> {
    const { guestId } = forcedExitStudyDto;

    const hostStudyUser = await this.findUserStudy({ userId: hostId, studyId });
    if (!hostStudyUser.isHost)
      throw new HttpException('강퇴할 권한이 없습니다.', 401);

    const guestStudyUser = await this.findUserStudy({
      userId: guestId,
      studyId,
    });
    if (!guestStudyUser)
      throw new NotFoundException('스터디에 없는 유저입니다.');

    await this.studyUsersRepository.delete({ id: guestStudyUser.id });
  }

  async findUserStudy({
    userId,
    studyId,
  }: IStudiesServiceFindUserStudy): Promise<StudyUser> {
    const studyUser = await this.studyUsersRepository.findOne({
      where: { study: { id: studyId }, user: { id: userId } },
    });

    return studyUser;
  }

  async findStudies({
    pageReqDto,
  }: IStudiesServiceFindStudies): Promise<Study[]> {
    const { page, size } = pageReqDto;

    const studies = await this.studiesRepository.find({
      order: { createdAt: 'DESC' },
      take: size,
      skip: (page - 1) * size,
    });

    return studies;
  }

  async findStudiesByTopic({
    topicReqDto,
  }: IStudiesServiceFindStudiesByTopic): Promise<Study[]> {
    const { page, size, topic } = topicReqDto;

    const studies = await this.studiesRepository.find({
      where: { topic },
      order: { createdAt: 'DESC' },
      take: size,
      skip: (page - 1) * size,
    });

    return studies;
  }

  async findByUserId({
    userId,
    pageReqDto,
  }: IStudiesServiceFindByUserId): Promise<Study[]> {
    const { page, size } = pageReqDto;

    const studies = await this.studiesRepository
      .createQueryBuilder('study')
      .select([
        'study.id',
        'study.topic',
        'study.createdAt',
        'study.updatedAt',
        'studyUser.id',
        'user.id',
        'user.name',
      ])
      .leftJoin('study.studyUsers', 'studyUser')
      .leftJoin('studyUser.user', 'user')
      .where('user.id = :userId', { userId })
      .orderBy('study.createdAt', 'DESC')
      .take(size)
      .skip((page - 1) * size)
      .getMany();

    return studies;
  }
}
