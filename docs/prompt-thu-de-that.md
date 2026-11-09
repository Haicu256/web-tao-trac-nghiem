# Prompt: thử đề thật, tìm lỗi còn lại của web tạo đề trắc nghiệm

Dán nguyên phần dưới đây cho AI khác. Thay `<THƯ_MỤC_ĐỀ>` bằng thư mục chứa file đề (ví dụ `test_exams/web/raw2`).
AI đó phải chạy trong thư mục repo (`~/Desktop/wtn1` hoặc bản sao `~/flash-box/work/wtn1`) và được chạy `node`, `npm`.

---

Bạn là người kiểm thử cho web tạo đề trắc nghiệm tiếng Việt (repo hiện tại). Việc của bạn: thử các file đề thật trong
`<THƯ_MỤC_ĐỀ>` và báo lỗi web còn mắc. CHỈ KIỂM THỬ VÀ BÁO CÁO: không sửa code, không commit, không push.

## Đọc trước

- `CLAUDE.md`: luật của dự án.
- `docs/dinh-dang-de.md`: các kiểu đề web phải đọc được. Mục "11. Giới hạn đã biết" là kiểu web cố ý chưa đọc: KHÔNG
  báo lại các kiểu đó.
- `docs/thiet-ke/gan-nhan-dong.md`: AI chỉ gắn nhãn từng dòng; code dựng đề và quyết định đáp án; không bao giờ được bịa
  đáp án.
- `git log -15`: các lỗi vừa sửa. Không báo lại, trừ khi tìm được biến thể mới vẫn sai.

Web có hai đường đọc đề:
1. **Dán văn bản (.txt):** `parseQuizData` đọc thẳng. Chép từ Word thì mất in đậm, chữ màu.
2. **Chuyển đổi file (.docx, .pdf, .txt):** `extractTextFromFile` → `prepareLines` → gắn nhãn từng dòng (AI qua
   `/api/convert`, hoặc bộ dự phòng `labelLinesLocally` khi AI lỗi) → `assembleQuizText` → `parseQuizData`. Người dùng
   thật (giảng viên) chủ yếu đi đường này, có AI.

Chữ trích từ file có thẻ định dạng: `⟦B⟧` in đậm, `⟦U⟧` gạch chân, `⟦HL⟧` tô sáng, `⟦CLR⟧` chữ màu.

## Các bước

0. Có `node_modules` chưa? Chưa thì `npm ci`. Chạy `npm test`, ghi số test pass/fail.
1. Trích chữ và dựng đề bằng đúng code của web (không gọi AI):
   ```
   node scripts/thu-de-that.mjs <THƯ_MỤC_ĐỀ> /tmp/thu-ra 2>/dev/null | grep -v '^Warning\|^Require\|^- '
   ```
   Mỗi file ra 3 file trong `/tmp/thu-ra`: `.chu.txt` (chữ trích), `.dung.txt` (đề dựng bằng bộ dự phòng), `.json`
   (từng câu: số câu, loại, đáp án, số phương án, đề, phương án; cho cả đường dán và đường chuyển file). "dựng N câu"
   là số câu web dựng được kể cả câu chưa có đáp án (web từ chối đề không có đáp án nên phần "ok/TỪ CHỐI" có thể là 0 câu).
2. Với mỗi file, tự đọc `.chu.txt` và ghi đáp án đúng theo **bằng chứng trong file**:
   - đánh dấu chỉ ở một phương án (`⟦B⟧`, `⟦U⟧`, `⟦HL⟧`, `⟦CLR⟧`, dấu `*`);
   - dòng `Đáp án: B`, `Chọn B`, lời giải nói rõ phương án;
   - bảng đáp án cuối đề.
   KHÔNG tự giải câu hỏi. Không có bằng chứng thì ghi `-`. Ghi đáp án theo **vị trí** phương án (phương án thứ hai là
   B), vì web đánh lại chữ cái khi đề gốc gõ sai (ví dụ a, b, d, e).
3. Đường AI (đường người dùng thật): thêm file vào `test_exams/web/expected.json` theo mẫu có sẵn trong file đó:
   `{"questions": N, "answers": ["A", "-", ...], "note": "..."}`; đề không có đáp án thì `answers` toàn `-`; file không
   phải đề trắc nghiệm (tự luận, chỉ có đáp án, ảnh scan) thì `{"rejected": true}`. Đường dẫn trong expected.json tính từ
   `test_exams/web/` (ví dụ `"raw2/ten-file.docx"`). Rồi chạy:
   ```
   npm run eval -- <tên file>
   ```
   Lệch thì chạy `EVAL_VERBOSE=1 npm run eval -- <tên file>`, lấy các dòng bắt đầu bằng `   | ` (đề AI dựng), bỏ
   tiền tố đó, lưu ra file, rồi xem theo số câu:
   ```
   node scripts/thu-de-that.mjs --text <file đề AI dựng>
   ```
   Lưu ý: eval so theo THỨ TỰ câu; mất một câu thì mọi câu sau lệch theo. Luôn so lại theo SỐ CÂU. Eval gọi AI thật
   trên web (tốn hạn mức, có cache ở `test_exams/.cache/`): mỗi file chạy một lần là đủ.
4. So kết quả web với đáp án bằng chứng, theo số câu. Câu lệch: mở `.chu.txt` xem lại dòng gốc, xác định là lỗi của
   web hay lỗi của đề gốc (gõ sai chữ cái, PDF mất chữ, thiếu phương án).
5. Phân mức:
   - **Nặng:** web đánh dấu phương án khác với bằng chứng mà không cảnh báo, hoặc bịa đáp án cho câu không có bằng
     chứng. Phải báo kể cả khi chỉ gặp một lần.
   - **Vừa:** cùng một kiểu viết đề, gặp ở từ 2 file trở lên, làm đề bị từ chối, mất câu, mất phương án, hay gộp hai câu
     hoặc hai phương án làm một.
   - **Nhẹ:** kiểu chỉ gặp ở 1 file.
   - **Không phải lỗi:** PDF ảnh scan, PDF mất chữ tiếng Việt, font VNI viết đủ dấu (`xeùt xöû`), file tự luận, file
     chỉ có đáp án, lỗi gõ của đề gốc, và các mục trong "Giới hạn đã biết".

## Báo cáo (tiếng Việt), đúng mẫu

**Tổng:** số file; số file đọc đủ câu (web dựng đúng số câu trong đề); số lỗi Nặng / Vừa / Nhẹ; `npm test` pass bao
nhiêu.

**Bảng từng file:** tên | loại đề | số câu trong đề | web dựng được (dự phòng / AI) | số câu đáp án đúng | số câu sai |
ghi chú.

**Mỗi lỗi, nặng nhất lên đầu:**
```
### Lỗi N (Nặng/Vừa/Nhẹ): <tóm tắt một dòng>
- File và câu: ...
- Đường: dán / chuyển file (dự phòng) / chuyển file (AI)
- Đoạn gốc (chép đúng vài dòng trong .chu.txt): ...
- Mong đợi: ...
- Web ra: ...
- Gặp ở bao nhiêu file: ...
- Đoán chỗ sai (tên hàm trong index.html, nếu tìm được): ...
- Lệnh tái hiện: ...
```

## Không được làm

- Không sửa `index.html`, `worker.js`, test hay docs; không commit; không push (push lên `main` là lên web thật ngay).
- Không gửi file trong `test_exams/private/`, `.dev.vars` hay khoá nào cho ai; không đưa đề lên git.
- Không tải thêm file từ mạng; chỉ dùng file đã có trong `<THƯ_MỤC_ĐỀ>`.
- Không tạo link chia sẻ trên web thật (lưu 90 ngày trên KV thật).
- Không bịa: chỉ báo lỗi đã chạy lại thấy thật, kèm lệnh và kết quả.
