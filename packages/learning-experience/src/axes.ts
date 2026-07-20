/**
 * 5 TRỤC cấu hình một trải nghiệm học. Xương sống này là CODE (cố định, nhỏ) — mọi trải nghiệm,
 * dù môn gì / vai gì, đều là MỘT ĐIỂM trong không gian 5 trục. "Chất liệu" (công thức đặt sẵn,
 * nhãn hiển thị) là DỮ LIỆU ở nơi khác, không nhồi vào đây.
 *
 * Cùng triết lý với `@bingoo/facets`: đưa thứ PHÂN BIỆT vào dữ liệu có cấu trúc thay vì chôn trong
 * câu chữ, để "trải nghiệm này khác gì trải nghiệm kia" thành SO SÁNH CẤU TRÚC, không cần đoán.
 */

/** ① HỌC THEO TRẢI NGHIỆM GÌ — dạng hoạt động học. */
export const EXPERIENCE = ['learn', 'practice', 'arena', 'feed', 'project'] as const;
export type Experience = (typeof EXPERIENCE)[number];

/** ② TỔ CHỨC THẾ NÀO — định dạng phân phối. */
export const DELIVERY = ['live', 'async', 'classroom'] as const;
export type Delivery = (typeof DELIVERY)[number];

/** ③ HỌC CÙNG AI — người/máy đồng hành. `self` = học một mình, không có đồng hành. */
export const COMPANION = ['ai', 'teacher', 'mentor', 'ta', 'peer', 'self'] as const;
export type Companion = (typeof COMPANION)[number];

/** ④ BAO NHIÊU NGƯỜI — quy mô. `pair` = 1-kèm-1. */
export const SCALE = ['solo', 'pair', 'group', 'class'] as const;
export type Scale = (typeof SCALE)[number];

/** ⑤ KHI NÀO — hình thức thời gian. `live` = đang diễn ra trực tiếp. */
export const TIME = ['on-demand', 'scheduled', 'live'] as const;
export type Time = (typeof TIME)[number];

/** Tên 5 trục — thứ tự cố định để sinh khoá định danh ổn định. */
export const AXES = ['experience', 'delivery', 'companion', 'scale', 'time'] as const;
export type Axis = (typeof AXES)[number];

/** Bảng tra: trục → tập giá trị hợp lệ (dùng cho UI liệt kê, validate, sinh tổ hợp). */
export const AXIS_VALUES = {
  experience: EXPERIENCE,
  delivery: DELIVERY,
  companion: COMPANION,
  scale: SCALE,
  time: TIME,
} as const;

/** Kiểu giá trị của từng trục — `AxisValue<'companion'>` = Companion. */
export type AxisValue<A extends Axis> = (typeof AXIS_VALUES)[A][number];
