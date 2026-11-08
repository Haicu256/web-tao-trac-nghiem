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
- Bảng đáp án của đề nhiều phần đánh số lại (Phần I câu 1-18, Phần II câu 1-4) được chia theo phần rồi ghép theo từng
  loại câu (phần có đáp án chữ cái với phần trắc nghiệm, phần có Đ/S với phần đúng/sai); đề chỉ có một phần loại đó thì
  dùng cả bảng. Không ghép được thì không dùng bảng và nhắc ghi "Phần I", "Phần II".
- Đáp án gán theo **chữ cái ghi trong đề**, không theo vị trí: câu mất một phương án (A, C, D) thì "Đáp án: C" vẫn là
  phương án C; hai phương án cùng chữ cái (câu bị gộp) thì không gán.

## Sửa nhãn AI sai bằng quy tắc (`reconcileLabels`)

Prompt không bảo đảm được, nên các lỗi nhãn thấy rõ được sửa bằng code: dòng "Câu N:" đúng số kế tiếp (kể cả ở đầu phần
gửi AI sau) là câu mới; dòng có tiền tố "câu hỏi đúng sai:" là câu đúng/sai; dòng trông như **phương án kế tiếp** của dãy
("B." sau "A.") là phương án, dù AI gắn là đầu câu hay dòng nối tiếp; sau các phương án, dòng "Đáp án: …", "Chọn …",
"Lời giải" là dòng đáp án; dòng "đầu câu" không số ngay sau câu có số chưa có phương án là phần tiếp của đề bài; tiêu đề
"ĐÁP ÁN" không thể là câu hỏi hay phương án; "PHẦN II…" và tiêu đề/chân trang trang PDF ("Trang 2/4 - Mã đề 101") luôn
bỏ qua. Dòng "Câu N:" ngay sau tiêu đề phần cũng là câu mới (phần đánh số lại từ 1), kể cả khi AI gắn là phương án không
chữ cái hay dòng đáp án mà phần sau không phải đáp án ("Câu 2: B" vẫn là dòng đáp án). Sau tiêu đề bảng đáp án, hàng
"1.A 2.B" gắn là dòng đáp án hay bỏ qua vẫn thuộc bảng: nếu không, hàng đó đứng trước bảng và làm đảo thứ tự các phần.
Câu trong phần có tiêu đề "đúng sai" (đề THPT 2025) là câu đúng/sai. "B. Tự luận" ngay sau "A." là phương án, không phải
tiêu đề phần. Đoạn văn "Read the following passage…" sau phương án của câu trước thuộc câu sau, và được chép vào mọi câu
trong khoảng "questions from 2 to 4" để khi trộn câu vẫn có đoạn văn.

Khi AI lỗi ở một phần, bộ gắn nhãn dự phòng chạy trên cả tài liệu rồi lấy đúng phần đó, để phần bị cắt giữa câu vẫn biết
câu đang đọc; `chunkLines` cũng cắt ở câu đánh số trần "12." có phương án ngay sau.

Bảng đáp án nhiều mã đề ("Mã đề 101: 1.A…", bảng cột của Bộ) chỉ dùng phần của mã đề ghi ở đầu đề; `assembleQuizText`
giữ dòng mã đề đó cho parser, `keepFirstExamCode` giữ bảng đáp án chung ở cuối file khi cắt bỏ mã đề sau.

`npm run fuzz -- labels` thử hàng nghìn dãy nhãn ngẫu nhiên trên đề không có đáp án (không được ra đáp án nào);
`npm run fuzz -- noise` gắn nhầm 1-2 nhãn kiểu hợp lý trên đề có đáp án (được mất đáp án, không được ra đáp án khác với
file). Đo ngày 7/11/2026: trước khi thêm các quy tắc trên và gán theo chữ cái, 88/7500 lượt ra đáp án sai; sau đó 6/30000.
Ngày 8/11/2026, sau các quy tắc "Câu N" sau tiêu đề phần và hàng bảng đáp án: 0/120000 (8 seed); trước đó 32/60000.

## Không đổi

Đường `.txt` (parser trực tiếp). Worker vẫn nhận kiểu cũ `{ text }` để trang đang mở trước khi deploy không hỏng.

## Đo

`npm run eval`: bộ đề mẫu, đề thật (đề không đáp án phải ra 0 đáp án), và bản "thiếu đáp án vài câu" tạo từ đề thật.
