import { MigrationInterface, QueryRunner } from "typeorm";

export class DropTranscriptEntries1776424589547 implements MigrationInterface {
    name = 'DropTranscriptEntries1776424589547'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transcript_entries" DROP CONSTRAINT IF EXISTS "FK_c42b714bf6ca201fa018b65c708"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_c42b714bf6ca201fa018b65c70"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "transcript_entries"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "transcript_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "race_id" uuid NOT NULL, "speaker_name" character varying NOT NULL, "text" text NOT NULL, "start_time" TIMESTAMP WITH TIME ZONE NOT NULL, "end_time" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3e5b2b4f31822aee184cf8ee281" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c42b714bf6ca201fa018b65c70" ON "transcript_entries" ("race_id") `);
        await queryRunner.query(`ALTER TABLE "transcript_entries" ADD CONSTRAINT "FK_c42b714bf6ca201fa018b65c708" FOREIGN KEY ("race_id") REFERENCES "races"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
