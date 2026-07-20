/**
 * SUY RA MẠCH (strand) CỦA KC TỪ OBJECTIVE map vào nó — thuần, không I/O, test được offline.
 *
 * Vì sao KC không tự mang strand: strand là nhãn RIÊNG CỦA TỪNG KHUNG (Cambridge chia Toán thành
 * "Counting and sequences", "Integers and powers"…), y hệt `stage`. Một KC canonical là trung lập với
 * khung, nên nó KHÔNG có một strand cố định — bộ trích khái niệm từng đoán bừa một strand thô ("number")
 * cho mọi KC, làm việc gom nhóm đồ thị vô nghĩa. Sự thật nằm ở OBJECTIVE (lấy nguyên văn từ chương
 * trình). Nên strand để GOM NHÓM một KC = strand của (các) objective MAPS_TO nó, trong khung đang xem.
 *
 * Đây đúng luật đã áp cho `stage`: nhãn của khung sống trên OBJECTIVE, KC suy ra qua objective→MAPS_TO→KC.
 */

export interface StrandObjective {
  readonly id: string;
  readonly strand: string | null;
}

export interface MapsToEdge {
  readonly fromId: string; // objective
  readonly toId: string; // KC
}

/**
 * kcId → strand để gom nhóm. Một KC có thể được NHIỀU objective map vào (thậm chí khác mạch); chọn
 * mạch PHỔ BIẾN NHẤT trong số đó, hoà thì lấy theo alphabet → tất định (không phụ thuộc thứ tự duyệt,
 * nên hai lần dựng đồ thị cho cùng dữ liệu luôn ra cùng nhóm). KC không objective nào map vào → vắng mặt.
 */
export function deriveKcStrands(
  objectives: readonly StrandObjective[],
  mapsTo: readonly MapsToEdge[],
): Map<string, string> {
  const strandByObj = new Map<string, string>();
  for (const o of objectives) {
    const s = o.strand?.trim();
    if (s) strandByObj.set(o.id, s);
  }

  // kcId → { strand → số objective của mạch đó map vào KC }
  const counts = new Map<string, Map<string, number>>();
  for (const e of mapsTo) {
    const s = strandByObj.get(e.fromId);
    if (!s) continue;
    let m = counts.get(e.toId);
    if (!m) {
      m = new Map();
      counts.set(e.toId, m);
    }
    m.set(s, (m.get(s) ?? 0) + 1);
  }

  const out = new Map<string, string>();
  for (const [kcId, m] of counts) {
    let best: string | undefined;
    let bestN = -1;
    // Duyệt theo alphabet trước → khi số phiếu bằng nhau, cái đứng trước alphabet thắng (tất định).
    for (const [strand, n] of [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (n > bestN) {
        bestN = n;
        best = strand;
      }
    }
    if (best) out.set(kcId, best);
  }
  return out;
}
