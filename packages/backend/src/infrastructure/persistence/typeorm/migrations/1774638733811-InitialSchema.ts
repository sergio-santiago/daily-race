import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1774638733811 implements MigrationInterface {
    name = 'InitialSchema1774638733811'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "drivers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "google_id" character varying NOT NULL, "display_name" character varying NOT NULL, "email" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_49c2f7ecc928faca46509c76846" UNIQUE ("google_id"), CONSTRAINT "PK_92ab3fb69e566d3eb0cae896047" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "starting_grid_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "race_id" uuid NOT NULL, "driver_id" uuid NOT NULL, "position" smallint NOT NULL, "start_time" TIMESTAMP WITH TIME ZONE NOT NULL, "green_light" TIMESTAMP WITH TIME ZONE NOT NULL, "points" numeric(10,2) NOT NULL, "is_false_start" boolean NOT NULL DEFAULT false, "is_last_on_grid" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_0f1b2fe51570c578ce2df0d20bb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a4fcfe667fc3ec19223bb5589c" ON "starting_grid_entries" ("race_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a41164ba781e9d660d18254bcb" ON "starting_grid_entries" ("driver_id") `);
        await queryRunner.query(`CREATE TABLE "races" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conference_record_name" character varying NOT NULL, "meeting_code" character varying NOT NULL, "green_light" TIMESTAMP WITH TIME ZONE NOT NULL, "end_time" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying NOT NULL DEFAULT 'PROCESSED', "processed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_642119f6a6703c19d6ab038ca3e" UNIQUE ("conference_record_name"), CONSTRAINT "PK_ba7d19b382156bc33244426c597" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_642119f6a6703c19d6ab038ca3" ON "races" ("conference_record_name") `);
        await queryRunner.query(`CREATE INDEX "IDX_e62a377fcdc1da10aedd4a37bd" ON "races" ("green_light") `);
        await queryRunner.query(`ALTER TABLE "starting_grid_entries" ADD CONSTRAINT "FK_a4fcfe667fc3ec19223bb5589c5" FOREIGN KEY ("race_id") REFERENCES "races"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "starting_grid_entries" ADD CONSTRAINT "FK_a41164ba781e9d660d18254bcb9" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "starting_grid_entries" DROP CONSTRAINT "FK_a41164ba781e9d660d18254bcb9"`);
        await queryRunner.query(`ALTER TABLE "starting_grid_entries" DROP CONSTRAINT "FK_a4fcfe667fc3ec19223bb5589c5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e62a377fcdc1da10aedd4a37bd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_642119f6a6703c19d6ab038ca3"`);
        await queryRunner.query(`DROP TABLE "races"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a41164ba781e9d660d18254bcb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4fcfe667fc3ec19223bb5589c"`);
        await queryRunner.query(`DROP TABLE "starting_grid_entries"`);
        await queryRunner.query(`DROP TABLE "drivers"`);
    }

}
