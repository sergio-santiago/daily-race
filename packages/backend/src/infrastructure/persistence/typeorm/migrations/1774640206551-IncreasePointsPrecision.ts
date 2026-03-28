import { MigrationInterface, QueryRunner } from "typeorm";

export class IncreasePointsPrecision1774640206551 implements MigrationInterface {
    name = 'IncreasePointsPrecision1774640206551'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "starting_grid_entries" ALTER COLUMN "points" TYPE numeric(12,6)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "starting_grid_entries" ALTER COLUMN "points" TYPE numeric(10,2)`);
    }

}
