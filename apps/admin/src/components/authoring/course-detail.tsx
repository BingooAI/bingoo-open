'use client';

import { CourseWorkbench } from './course-workbench';

/**
 * Chi tiết vỏ khoá = BẢNG SOẠN KHOÁ (workbench): điều hướng bài bên trái, biên tập bài đang chọn bên
 * phải theo 3 bước (giáo án → nội dung → duyệt). Thay cho kiểu xổ phẳng mọi bài trước đây.
 */
export function CourseDetail({ slug }: { slug: string }) {
  return <CourseWorkbench slug={slug} />;
}
