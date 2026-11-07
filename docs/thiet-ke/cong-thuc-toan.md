# Thiết kế: giữ và hiển thị công thức toán

Ngày duyệt: 7/11/2026.

## Vấn đề

Đề Toán dạng `.docx` soạn bằng Equation có sẵn của Word bị mất hết công thức khi chuyển đổi.
Nguyên nhân: mammoth chỉ đọc chữ trong `w:t`, còn chữ của công thức nằm trong `m:t` bên trong `m:oMath`.
Vì vậy AI nhận được "Phương trình  có bao nhiêu nghiệm thực?".

Thử thật ngày 7/11/2026: gửi đề có LaTeX trong `$...$` lên `/api/convert`, Gemini (`gemini-3.1-flash-lite`)
giữ nguyên công thức từng ký tự và vẫn đánh dấu đúng đáp án; parser cũng đọc đúng. Vậy chỉ cần sửa hai đầu.

## Luồng

```
.docx → ① công thức Word đổi sang LaTeX "$...$" → ② AI sắp xếp đề, giữ nguyên $...$ → ③ trình duyệt vẽ bằng KaTeX
```

### ① Đổi công thức Word sang LaTeX (`index.html`)

- `ommlToLatex(node)`: duyệt cây OMML và ghép chuỗi LaTeX.
  Hỗ trợ: chữ và ký hiệu (`m:r`), phân số (`m:f`), mũ và chỉ số (`m:sSup`, `m:sSub`, `m:sSubSup`, `m:sPre`),
  căn (`m:rad`), ngoặc (`m:d`, kể cả hệ `{` và `[` chứa `m:eqArr`), tích phân, tổng, tích (`m:nary`),
  hàm (`m:func`), giới hạn (`m:limLow`, `m:limUpp`), dấu trên đầu (`m:acc`: vectơ, mũ, ngã),
  gạch trên/dưới (`m:bar`), ngoặc nhóm (`m:groupChr`), ma trận (`m:m`), mảng phương trình (`m:eqArr`).
  Phần tử lạ: lấy nội dung bên trong.
- `replaceOfficeMath(xmlDoc)`: thay mỗi `m:oMath` / `m:oMathPara` ngoài cùng bằng một `w:r` chứa `$latex$`.
  Gọi trong `preprocessDocxFormat` ngay sau khi đọc `document.xml`, **trước** khi gom `w:r` để đánh dấu định dạng
  (vì `m:r` cũng có tên cục bộ là `r`).
- Công thức MathType hoặc Equation 3.0 (`w:object` chứa `OLEObject` có `ProgID` bắt đầu bằng `Equation.`)
  không đọc được trên trình duyệt: web báo cách đổi bằng *MathType → Convert Equations → Microsoft Office Math*.

### ② AI (`worker.js`)

Thêm vào prompt quy tắc giữ nguyên mọi công thức `$...$`.

### ③ Vẽ công thức (`index.html`)

- Cú pháp `$...$` theo Pandoc: ngay sau `$` mở không phải dấu cách, ngay trước `$` đóng không phải dấu cách,
  sau `$` đóng không phải chữ số; không vắt qua nhiều dòng. Nhờ đó `$5 and $10` không phải công thức.
- `renderMathInHtml(html)`: chạy trên chuỗi **đã escape**. Phần ngoài công thức giữ nguyên; phần trong công thức
  được giải escape rồi đưa cho `katex.renderToString` (`throwOnError: false`, `trust: false`). Chưa có KaTeX thì trả nguyên chuỗi.
- `ensureKatex()`: chỉ tải KaTeX 0.18.11 (JS và CSS từ cdnjs, có SRI) khi đề có công thức; `startQuiz` chờ tải xong
  (tối đa 8 giây), tải lỗi thì hiện `$...$` dạng chữ.
- Áp vào tiêu đề câu, phương án trắc nghiệm, ý của câu đúng/sai.
- CSP: thêm `https://cdnjs.cloudflare.com` vào `style-src` và `font-src` (font của KaTeX).

## Test

- `tests/math.test.js`: `ommlToLatex` với các đoạn OMML mẫu; mọi kết quả phải được KaTeX thật (devDependency, cùng phiên bản)
  vẽ với `throwOnError: true`. `replaceOfficeMath` trên tài liệu mẫu. Cú pháp `$` và an toàn XSS của `renderMathInHtml`.
  `ensureKatex` gắn đúng `integrity`.
- `docs/dinh-dang-de.md`: mục công thức (parser giữ nguyên LaTeX).
- `tests/worker.test.js`: prompt có quy tắc giữ `$...$`; CSP cho phép CSS/font của KaTeX.
- Trình duyệt: file `.docx` có công thức đi qua toàn bộ luồng, chụp màn hình bài làm.

## Không làm lần này

Đổi công thức MathType, công thức trong PDF, công thức dạng khối riêng một dòng.
