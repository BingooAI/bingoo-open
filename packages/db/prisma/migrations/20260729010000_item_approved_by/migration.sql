-- Ai đã duyệt một item nội dung, và lúc nào. Nhật ký hệ thống có ghi nhưng khoá item nằm trong
-- một mảng, nên "ai duyệt đúng item này" không trả lời được bằng một truy vấn thẳng.
ALTER TABLE "content_item" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "content_item" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
