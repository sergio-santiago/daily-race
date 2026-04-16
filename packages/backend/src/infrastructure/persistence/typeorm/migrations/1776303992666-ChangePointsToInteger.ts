import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangePointsToInteger1776303992666 implements MigrationInterface {
    name = 'ChangePointsToInteger1776303992666'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "starting_grid_entries" ALTER COLUMN "points" TYPE integer USING "points"::integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "starting_grid_entries" ALTER COLUMN "points" TYPE numeric(12,6)`);
    }

}
