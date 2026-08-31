import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSeasonAnnouncements1788200140007 implements MigrationInterface {
    name = 'CreateSeasonAnnouncements1788200140007'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "season_announcements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "season_label" character varying NOT NULL, "announced_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_season_announcements_season_label" UNIQUE ("season_label"), CONSTRAINT "PK_season_announcements" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "season_announcements"`);
    }

}
