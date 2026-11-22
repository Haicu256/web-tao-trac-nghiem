# Thiết kế: Bộ 4 tối ưu cứu hộ chuyển đổi đề (VNI + Phẫu thuật câu rớt + OCR PDF Scan/Lỗi font + Khóa Schema)

Ngày lập: 22/11/2026.

## 1. Mục tiêu & Nguyên tắc bất biến

1. **Không làm chậm hoặc hỏng luồng mặc định:** File chuyển đổi bình thường vẫn đi đúng luồng `extractTextFromFile -> prepareLines -> labelChunkWithAI -> assembleQuizText`. Các nút và tác vụ cứu hộ **chỉ chạy khi người dùng chủ động bấm nút** trên màn hình kết quả chuyển đổi, tuyệt đối không tự động chạy ngầm liên tục.
2. **Không bao giờ để AI tự giải đề hoặc bịa đáp án:** Giữ vững nguyên tắc của [`gan-nhan-dong.md`](gan-nhan-dong.md) bằng **khóa vật lý trong `responseSchema`** của Gemini. Nếu văn bản gốc không có bằng chứng đáp án, schema đầu ra không chứa trường đáp án và hậu xử lý tước bỏ mọi dấu `*` đầu phương án.
3. **Bảo toàn 100% câu đã đọc đúng & mã hình `[[hình:xxxxxxxxxxxx]]`:** Chỉ gửi phần bị rớt khi đề vẫn đọc được câu khác; mã hình được che thành `[HINH_n]` trước khi gửi AI rồi khôi phục lại y nguyên.

---

## 2. Kiến trúc 4 tối ưu

### Tầng 0: Giải mã bảng mã `VNI-Windows` bằng JS thuần (0 ms AI)

- Tại `fixLegacyVietnamese(text)` trong `index.html`, bổ sung quy đổi **1 lượt duy nhất** (`VNI_CONVERT_REGEX`, không chạy 2 lượt để tránh biến đổi kép làm hỏng `đô -> đơ`) cho các cặp 2 ký tự VNI-Windows (`aù..yï`, `AÙ..YÏ`, `aâ..oä`, `AÂ..OÄ`, `aê..aë`, `AÊ..AË`) và các ký tự đơn đặc trưng VNI (`ñ/Ñ, ô/Ô, ö/Ö, æ/Æ, ó/Ó, ò/Ò, î/Î`).
- **Điều kiện kích hoạt chống nhận nhầm:**
  - `VNI_DISTINCT_REGEX` chỉ đếm các tổ hợp VNI đặc hiệu (không tính `oà/oá/oã` của tiếng Việt Unicode kiểu cũ và không tính chữ ngoại ngữ đứng đơn lẻ như `ã, ç, ö, ü, ô, ó`).
  - Kích hoạt khi `vniDistinct >= 5 && vniDistinct > 3 * viet`.
  - Từng dòng đã có chữ Việt Unicode giữ nguyên không đổi.

### Tầng 1: Cứu hộ "Phẫu thuật" các câu bị rớt (`droppedBlocks`)

- `assembleQuizText(lines, labels)` trả thêm mảng `droppedBlocks` ghi lại nguyên văn từng khối câu có `q.options.length < 2` (đã đếm vào `withoutOptions`), không làm thay đổi các trường trả về cũ (`text`, `questions`, `unanswered`, `withoutOptions`).
- Khi người dùng bấm nút `#aiRescueBtn` (`rescueWithAI()`):
  - **Nhánh phẫu thuật (đề đã đọc `> 0` câu nhưng có `droppedBlocks.length > 0`):** Chỉ cắt riêng `droppedBlocks` thành các đoạn `<= 2.800` ký tự gửi lên `POST /api/rescue` (`mode: 'text'`). Giữ nguyên 100% các câu đã đọc đúng; chèn câu cứu được vào **trước `BẢNG ĐÁP ÁN`** (nếu có) bằng `insertRescuedText`.
  - **Nhánh sửa chữ toàn phần (đề đọc ra `0` câu nhưng có chữ hợp lệ):** Cắt toàn văn bản đã đọc thành từng đoạn `<= 2.800` ký tự (tối đa `MAX_RESCUE_TEXT_CHUNKS = 20` đoạn) gửi lên `POST /api/rescue` (`mode: 'text'`).
  - Mọi văn bản trước khi gửi đi qua `protectImageTokens` (thay `[[hình:<12 hex>]]` thành `[HINH_n]`) và đi qua `restoreImageTokens` khi lắp lại.

### Tầng 2: OCR bằng AI Vision cho cả "PDF Scan" lẫn "PDF lỗi font nhúng"

- `classifyPdfPage(rawPageText, imageCount = 0, maxImageCoverage = 0)` phân loại từng trang PDF:
  1. **`'garbled'`**: sau khi chạy `fixLegacyVietnamese` và bỏ thẻ định dạng + `[[hình:...]]`, trang có `>= 5` ký tự lỗi (`\uFFFD`, vùng Private Use Area `[\uE000-\uF8FF]`, ký tự điều khiển) và tỷ lệ lỗi `>= 15%`.
  2. **`'scan'`**: tổng số chữ cái/số `[\p{L}\p{N}]` `<= 25` **VÀ** (`imageCount > 0` hoặc `maxImageCoverage >= 0.3`). Trang đề có hình công thức bình thường (ví dụ trang 7 đề Hóa Dược ~48 ký tự + 4 ảnh) hoặc trang trắng 0 ảnh vẫn được xếp là `'ok'`.
  3. **`'ok'`**: các trang đọc chữ bình thường.
- Khi bấm `#aiRescueBtn` và phát hiện `ocrPages.length > 0`:
  - Luôn hiện hộp thoại xác nhận `showModal` trước khi gửi ảnh (nêu rõ số trang sẽ OCR và giới hạn tối đa `MAX_OCR_PAGES = 15` trang/file).
  - Chỉ render **đúng các trang bị `'scan'` hoặc `'garbled'`** bằng `pdf.js` (`getDocument({ ..., isEvalSupported: false })`) ra ảnh JPEG (`maxWidth = 1240`, nền trắng, chất lượng `0.78`, tự hạ `0.55` nếu vượt 580 KB).
  - Gửi từng ảnh lên `POST /api/rescue` (`mode: 'ocr'`) nhận `{ dong: string[] }`, thay thế đúng trang lỗi trong `pdfPages`, rồi chạy lại toàn bộ chuỗi `keepFirstExamCode(prepareLines(...)) -> reconcileLabels(labelLinesLocally(...)) -> assembleQuizText`.

### Tầng 3: Endpoint `POST /api/rescue` & Khóa `responseSchema` chống bịa đáp án

- Endpoint mới `POST /api/rescue` dùng chung `CONVERT_LIMITER` (20 req/60s), giới hạn thân request `MAX_RESCUE_BODY_BYTES = 900_000`. Tuyệt đối không sửa nhánh `POST /api/convert`.
- **`mode: 'text'` (`text.length <= 15_000`):**
  - Sanitize thẻ `<tai_lieu>` thành `[tai_lieu_tag]` chống prompt injection.
  - Nếu `allowAnswers !== true` (code trình duyệt dùng `chunkHasAnswerEvidence`: chỉ bật khi có `*A.`, `(*)`, `⟦U/HL/CLR⟧`, hoặc `EXPLICIT_ANSWER_REGEX`; **không bật cho riêng `⟦B⟧`**): sử dụng `RESCUE_SCHEMA_NO_ANSWER` (JSON Schema không tồn tại trường `dap_an`) và tước mọi dấu `*` / `(*)` đầu phương án.
  - Nếu `allowAnswers === true`: sử dụng `RESCUE_SCHEMA_WITH_ANSWER` có trường `dap_an` và kiểm tra chỉ giữ chữ cái `[A-F]` / `Đ,S`.
- **`mode: 'ocr'`:**
  - Kiểm tra chuỗi base64 hợp lệ, giải mã bằng `Buffer.from`, giới hạn `<= 600_000` bytes, kiểm tra magic bytes qua `imageTypeOf(bytes)` (chỉ chấp nhận PNG/JPEG/WebP).
  - Gửi `inlineData` + prompt chép nguyên văn chữ nhìn thấy, dùng `OCR_SCHEMA` (`{ dong: string[] }`).
  - Hậu xử lý tước mọi dấu `*` đầu dòng phương án nếu AI tự ý thêm, nhưng giữ nguyên các dòng `Đáp án:` / `BẢNG ĐÁP ÁN` in sẵn trên ảnh.
- Hỗ trợ cơ chế fallback model qua `geminiModels(env)` giống `handleLabelLines`.

## 3. Chống bấm liên tục

- Nút `#aiRescueBtn` bị ẩn mặc định và chỉ hiện khi file chuyển đổi có `ocrPages.length > 0`, `questionsCount === 0` (có chữ hợp lệ), hoặc `droppedBlocks.length > 0`.
- Khóa nút (`disabled = true`) trong toàn bộ thời gian chạy; sau khi cứu hộ xong đặt `lastConvertMeta.rescuedOnce = true` và ẩn nút cho đến khi người dùng tải file mới.
