import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameIsLastOnGridToIsWorstOnGrid1776459161734 implements MigrationInterface {
    name = 'RenameIsLastOnGridToIsWorstOnGrid1776459161734'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "starting_grid_entries" RENAME COLUMN "is_last_on_grid" TO "is_worst_on_grid"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "starting_grid_entries" RENAME COLUMN "is_worst_on_grid" TO "is_last_on_grid"`);
    }

}
