-- CreateEnum
CREATE TYPE "artwork_status" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD');

-- CreateTable
CREATE TABLE "technique" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_es" TEXT NOT NULL,
    "name_en" TEXT,

    CONSTRAINT "technique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_es" TEXT NOT NULL,
    "name_en" TEXT,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artwork" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "width_cm" DECIMAL(6,1),
    "height_cm" DECIMAL(6,1),
    "status" "artwork_status" NOT NULL DEFAULT 'AVAILABLE',
    "reference_price_cop" INTEGER,
    "description_es" TEXT,
    "description_en" TEXT,
    "technique_id" UUID NOT NULL,
    "series_id" UUID,
    "published_at" TIMESTAMPTZ(3),
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "artwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artwork_image" (
    "id" UUID NOT NULL,
    "artwork_id" UUID NOT NULL,
    "cloudinary_public_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artwork_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_session" (
    "id" UUID NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "technique_slug_key" ON "technique"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "technique_name_es_key" ON "technique"("name_es");

-- CreateIndex
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "series_name_es_key" ON "series"("name_es");

-- CreateIndex
CREATE UNIQUE INDEX "artwork_slug_key" ON "artwork"("slug");

-- CreateIndex
CREATE INDEX "artwork_technique_id_idx" ON "artwork"("technique_id");

-- CreateIndex
CREATE INDEX "artwork_series_id_idx" ON "artwork"("series_id");

-- CreateIndex
CREATE INDEX "artwork_published_at_idx" ON "artwork"("published_at");

-- CreateIndex
CREATE INDEX "artwork_image_artwork_id_idx" ON "artwork_image"("artwork_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_email_key" ON "admin_user"("email");

-- CreateIndex
CREATE INDEX "admin_session_admin_user_id_idx" ON "admin_session"("admin_user_id");

-- CreateIndex
CREATE INDEX "admin_session_expires_at_idx" ON "admin_session"("expires_at");

-- AddForeignKey
ALTER TABLE "artwork" ADD CONSTRAINT "artwork_technique_id_fkey" FOREIGN KEY ("technique_id") REFERENCES "technique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artwork" ADD CONSTRAINT "artwork_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artwork_image" ADD CONSTRAINT "artwork_image_artwork_id_fkey" FOREIGN KEY ("artwork_id") REFERENCES "artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_session" ADD CONSTRAINT "admin_session_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only one primary image per artwork (partial unique index; Prisma cannot express it in the schema)
CREATE UNIQUE INDEX "artwork_image_one_primary_per_artwork"
ON "artwork_image" ("artwork_id")
WHERE "is_primary" = true;