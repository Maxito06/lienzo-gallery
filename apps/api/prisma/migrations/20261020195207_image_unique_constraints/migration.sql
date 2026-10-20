/*
  Warnings:

  - A unique constraint covering the columns `[cloudinary_public_id]` on the table `artwork_image` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[artwork_id,position]` on the table `artwork_image` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "artwork_image_artwork_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "artwork_image_cloudinary_public_id_key" ON "artwork_image"("cloudinary_public_id");

-- CreateIndex
CREATE UNIQUE INDEX "artwork_image_artwork_id_position_key" ON "artwork_image"("artwork_id", "position");
