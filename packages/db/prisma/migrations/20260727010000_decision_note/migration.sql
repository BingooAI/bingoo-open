-- Lý do người duyệt nêu khi TỪ CHỐI hoặc SỬA một thẻ căn cứ.
-- Tách khỏi cột `reason` (câu AI tự lý giải) để giọng người và giọng máy không lẫn vào nhau.
ALTER TABLE "decision_record" ADD COLUMN IF NOT EXISTS "decidedNote" TEXT;
