# Thiết kế: AI chỉ gắn nhãn dòng, code dựng đề và quyết định đáp án

Ngày duyệt: 7/11/2026.

## Vì sao

Đo ngày 7/11/2026 trên đề thật: đề tham khảo THPT 2022 môn Sinh **không có đáp án**, nhưng AI (khi được phép viết lại
đề) tự điền đáp án cho 15/40 câu, dù prompt ghi "TUYỆT ĐỐI KHÔNG". Lớp chặn cũ (xoá `*` khi cả đề không có dấu hiệu
đáp án) để lọt vì chữ cái A./B./C./D. in đậm trang trí làm hàm nhận biết đoán nhầm. Prompt không thể bảo đảm AI tuân thủ.

## Nguyên tắc

AI **không viết chữ**. AI chỉ trả về nhãn cho từng dòng của file gốc, theo JSON schema mà Gemini bắt buộc phải tuân
(constrained decoding). Trong khuôn chỉ có số dòng và một nhãn thuộc danh sách cố định, nên AI không thể đưa chữ mới,
câu hỏi mới hay dấu `*` nào vào đề. Code dựng đề từ chính các dòng gốc và quyết định đáp án từ bằng chứng trong file.

## Luồng

```
extractTextFromFile → prepareLines (tách phương án viết cùng dòng, bỏ dòng trống, đánh số)
  → chunkLines (cắt ở đầu câu hỏi, ~8000 ký tự)
  → /api/convert { lines } → { doan: [{ tu, den, loai }], model }   (AI gắn nhãn, JSON schema)
       AI lỗi / sai khuôn sau khi thử lại → labelLinesLocally (gắn nhãn bằng regex, như parser)
  → assembleQuizText (dựng đề dạng chuẩn từ dòng gốc + quyết định đáp án theo thẻ định dạng)
  → ô "Kết quả chuyển đổi" (người dùng xem/sửa) → parseQuizData
```

## Nhãn

| `loai` | Nghĩa |
|---|---|
| `cau_hoi` | dòng bắt đầu một câu trắc nghiệm |
| `cau_hoi_dung_sai` | dòng bắt đầu một câu đúng/sai (các ý a/b/c/d) |
| `noi_dung_cau_hoi` | dòng tiếp theo của đề bài: đoạn văn, bảng số liệu, phát biểu I/II/III |
| `phuong_an` | dòng bắt đầu một phương án / một ý |
| `noi_dung_phuong_an` | dòng tiếp theo của phương án ngay trước |
| `dap_an` | dòng ghi đáp án hoặc lời giải của câu ngay trước ("Đáp án: B", "Chọn B") |
| `bang_dap_an` | dòng thuộc bảng đáp án chung |
| `bo_qua` | mọi thứ khác: tiêu đề, họ tên, ma trận, hướng dẫn, "HẾT", tự luận, trả lời ngắn |

Worker kiểm tra các đoạn `tu..den` phủ đúng mỗi dòng một lần; sai thì trả 502 để trình duyệt thử lại.

## Code quyết định đáp án

Đề dựng ra ở dạng chuẩn rồi đi qua `parseQuizData`, nên mọi cách ghi đáp án parser đã hiểu (dấu `*` sẵn có, `(*)`,
dòng "Đáp án: B", lời giải "Chọn B", bảng đáp án) vẫn dùng được. Phần mới duy nhất là **thẻ định dạng**:

- Một thẻ được tính cho một phương án nếu nó bọc chữ cái đầu (A/B/…) hoặc bọc ít nhất 60% nội dung phương án.
  Thẻ chỉ bọc một cụm từ nhỏ (tìm lỗi sai, từ cần chú ý) không tính.
- Gạch chân / tô sáng / chữ màu: thẻ nào chỉ có ở một số phương án (không phải tất cả) của câu thì các phương án đó
  là đáp án. In đậm chỉ xét khi không có ba loại trên, và phải bọc nội dung chứ không chỉ chữ cái.
- Câu không có bằng chứng thì không có đáp án; trình duyệt liệt kê các câu đó để người dùng tự thêm `*`.
- Câu đúng/sai chỉ có đáp án khi **mọi ý** đều được nói Đ hay S (có thể trên nhiều dòng); ý không được nhắc tới không
  tự coi là Sai, trừ kiểu liệt kê các ý Đúng ("Đáp án: a, c").
- Lời giải chỉ cho đáp án khi mọi lời khẳng định ("Chọn C", "Đáp án đúng là C") chỉ cùng một chữ cái; chữ cái đứng trước
  "sai", sau "không/loại", trong danh sách "A, B" hay là biến ("Vậy a = 2") không tính.
- Bảng đáp án của đề nhiều phần đánh số lại (Phần I câu 1-18, Phần II câu 1-4) được chia theo phần; không chia khớp được
  thì câu trùng số không nhận đáp án từ bảng.

## Sửa nhãn AI sai bằng quy tắc (`reconcileLabels`)

Prompt không bảo đảm được, nên các lỗi nhãn thấy rõ được sửa bằng code: dòng "Câu N:" đúng số kế tiếp (kể cả ở đầu phần
gửi AI sau) là câu mới; dòng trông như phương án ("B. 2") không thể là đầu câu; tiêu đề "ĐÁP ÁN" không thể là câu hỏi
hay phương án; tiêu đề/chân trang trang PDF ("Trang 2/4 - Mã đề 101") luôn bỏ qua. `npm run fuzz -- labels` thử hàng
nghìn dãy nhãn ngẫu nhiên trên đề không có đáp án để xem còn đường nào nhãn tạo ra được đáp án.

## Không đổi

Đường `.txt` (parser trực tiếp). Worker vẫn nhận kiểu cũ `{ text }` để trang đang mở trước khi deploy không hỏng.

## Đo

`npm run eval`: bộ đề mẫu, đề thật (đề không đáp án phải ra 0 đáp án), và bản "thiếu đáp án vài câu" tạo từ đề thật.
