<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_origin_destination_different');
        DB::statement("ALTER TABLE deliveries ADD CONSTRAINT deliveries_origin_destination_different CHECK (
            origin <> destination
            OR (
                origin_location IS NOT NULL
                AND destination_location IS NOT NULL
                AND (
                    (origin_location->>'latitude')::double precision <> (destination_location->>'latitude')::double precision
                    OR (origin_location->>'longitude')::double precision <> (destination_location->>'longitude')::double precision
                )
            )
        )");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_origin_destination_different');
        DB::statement('ALTER TABLE deliveries ADD CONSTRAINT deliveries_origin_destination_different CHECK (origin <> destination)');
    }
};
