import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueRaceDriverConstraint1776303541185 implements MigrationInterface {
    name = 'AddUniqueRaceDriverConstraint1776303541185'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "starting_grid_entries" ADD CONSTRAINT "UQ_31805d6974cc940065d47b269bb" UNIQUE ("race_id", "driver_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "starting_grid_entries" DROP CONSTRAINT "UQ_31805d6974cc940065d47b269bb"`);
    }

}
