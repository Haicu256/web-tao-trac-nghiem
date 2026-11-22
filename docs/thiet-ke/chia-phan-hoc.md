# Thiết kế: Chia phần để học (Gói đầy đủ)

Ngày lập: 22/11/2026.

## 1. Mục tiêu
Giúp người học ôn tập các ngân hàng đề dài (50–300 câu) theo từng phần nhỏ, cắt không trùng lặp, chuyển tiếp liền mạch sang phần tiếp theo hoặc ôn lại ngay các câu vừa làm sai, và ghi nhớ tiến độ các phần đã hoàn thành trên trình duyệt (100% phía trình duyệt, không sửa backend `worker.js`).

---

## 2. Giao diện & Chế độ chọn phạm vi (`#config-section`)

1. **Ba chế độ chọn phạm vi (`studyScopeMode`):**
   - `all` (**Toàn bộ đề**, mặc định): chạy đúng như trước đây (`activeStudyScope = null`).
   - `parts` (**Chia phần để học**): chọn kích thước phần theo mốc nhanh **`20`**, **`30`**, **`50` câu** hoặc nhập số câu tùy ý (`>= 1`). Hệ thống tự tính lưới các phần liên tiếp `Phần 1 (1–30)`, `Phần 2 (31–60)`... qua `computeStudyParts(total, partSize)`.
   - `range` (**Từ câu – đến câu**): nhập `Từ câu` và `Đến câu` (1-based). Hàm `normalizeStudyRange(from, to, total)` tự kẹp giá trị vào `[1, total]` và tự đảo nếu `from > to`.
2. **Tự thu gọn với đề ngắn ($\le 20$ câu):**
   - Khi `originalQuestions.length <= 20`: ẩn bảng chọn phần (`#studyPartPanel`), chỉ hiện nút gọn `#studyPartExpandBtn` (`📚 Chia phần để học`); bấm nút sẽ mở bảng chọn.
   - Khi `originalQuestions.length > 20`: hiện sẵn `#studyPartPanel`, mặc định chọn `Toàn bộ`.

---

## 3. Nguyên tắc cắt và trộn câu hỏi

1. **Cắt phần TRƯỚC, trộn câu SAU:** Khi học theo `parts` hoặc `range`, lấy lát cắt `originalQuestions.slice(start, end)` trước, sau đó mới áp dụng trộn câu hỏi (`shuffleQuestions`) và trộn phương án (`shuffleOptions`) bên trong lát cắt đó. Cách này bảo đảm làm hết các phần sẽ phủ 100% câu hỏi gốc mà không trùng hoặc sót câu.
2. **Bảo toàn 4 bất biến trộn đáp án:** Câu `true_false`, `hasLetterRef`, và phương án `optionRefersToOthers` vẫn giữ nguyên luật trộn như hiện có.

---

## 4. Học liền mạch sau khi nộp bài (`#result-box`)

1. **`#retryWrongBtn` (`🎯 Làm lại X câu sai`):**
   - `getWrongQuestions(questions, answers)` lọc ra các câu làm sai hoặc chưa chọn đủ đáp án (với câu Đúng/Sai: bất kỳ câu nào `countTFCorrect(q, idx) < q.options.length`).
   - Hiện nút khi số câu sai `> 0`; bấm `retryWrongQuestions()` vào làm lại đúng danh sách câu sai đó (`activeStudyScope.mode === 'wrong'`), giữ nguyên `parentScope` nếu đang ôn từ một phần để vẫn hiện nút sang phần tiếp theo sau khi sửa xong.
2. **`#nextPartBtn` (`➡️ Học tiếp Phần K+1 (start–end)`):**
   - Hiện khi đang làm chế độ `parts` (hoặc ôn câu sai có `parentScope.mode === 'parts'`) và `partIndex + 1 < totalParts`.
   - Bấm `startNextStudyPart()` tự động nạp `Phần K+1` và bắt đầu làm bài ngay.
3. **`#retryBtn`:**
   - Khi đang học theo phần/khoảng/câu sai: đổi nhãn thành `📋 Chọn phần khác`; bấm `retryQuiz()` quay về `#config-section` để thấy lưới phần đã cập nhật dấu `✅`.
   - Khi làm toàn bộ đề: giữ nguyên nhãn `🔄 Làm lại bài này`.

---

## 5. Ghi nhớ phần đã học (`localStorage`) & Khôi phục khi tải lại (`sessionStorage`)

1. **Ghi nhớ theo từng đề (`localStorage`):**
   - Khóa `wtnStudyDone:<hash16>` dùng hàm băm FNV-1a (2 nửa 32-bit, ra 16 ký tự hex) trên `sourceText`.
   - Khi nộp bài ở chế độ `parts` hoặc `range`, lưu điểm cho khóa `"<start>-<end>"` dưới dạng `{ points, total, pct }`.
   - Ô phần tương ứng trên lưới hiện nhãn `✅ <points>/<total>`. Nút `Xóa đánh dấu đã học` gọi `clearStudyDoneMap(sourceText)` (fallback `setItem(key, '')` nếu môi trường không có `removeItem`).
2. **Khôi phục F5 (`sessionStorage`):**
   - `saveQuizProgress()` lưu kèm `studyScope` (không chứa mảng `questions` để tránh phình dung lượng).
   - `restoreQuizProgress()` kiểm tra `expectedCount` khi có `s.studyScope.expectedCount` hợp lệ (`1..originalQuestions.length`); khi làm toàn bộ (`studyScope === null`) giữ nguyên kiểm tra `originalQuestions.length === s.finalQuestions.length`.
   - Chia sẻ link (`createShareLink`) luôn chia sẻ toàn bộ `sourceText`.
