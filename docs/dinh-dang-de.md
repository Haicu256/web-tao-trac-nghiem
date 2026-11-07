# Định dạng đề mà web đọc được

Tài liệu này mô tả những kiểu đề `parseQuizData` trong `index.html` phải đọc đúng.
Mỗi ví dụ gồm một khối `de` (nội dung file `.txt`) và một khối `ket-qua` (điều web phải hiểu ra).
`npm test` chạy **toàn bộ** ví dụ ở đây (`tests/spec.test.js`), nên sửa tài liệu này là sửa test.

Cách viết khối `ket-qua`, mỗi dòng một ý:

| Dòng | Nghĩa |
|---|---|
| `số câu: 2` | đọc ra đúng 2 câu |
| `câu 1: B` | câu thứ nhất (theo thứ tự đọc được) có đáp án đúng B; nhiều đáp án viết `B,C`; không có viết `-` |
| `câu 1: ĐSĐS` | câu đúng/sai: ý A đúng, B sai, C đúng, D sai |
| `câu 1 tiêu đề: …` | nội dung câu hỏi; xuống dòng viết là ` / ` |
| `câu 1 phương án C: …` | nội dung phương án C |
| `câu 1 số phương án: 4` | số phương án |
| `câu 1 loại: đúng sai` | `trắc nghiệm` hoặc `đúng sai` |
| `không đọc được` | web phải báo không tạo được đề |

## 1. Cấu trúc cơ bản

Mỗi câu bắt đầu bằng dòng đánh số câu, sau đó mỗi phương án nằm trên một dòng.
Đáp án đúng được đánh dấu bằng `*` ở đầu dòng.

### Câu trắc nghiệm chuẩn
```de
Câu 1: Thủ đô của Việt Nam là gì?
A. Huế
*B. Hà Nội
C. Đà Nẵng
D. TP. Hồ Chí Minh
```
```ket-qua
số câu: 1
câu 1: B
câu 1 tiêu đề: Thủ đô của Việt Nam là gì?
câu 1 phương án B: Hà Nội
câu 1 loại: trắc nghiệm
```

### Có thể có tới 6 phương án
```de
Câu 1: Chọn số chẵn
A. 1
B. 3
C. 5
D. 7
E. 9
*F. 10
```
```ket-qua
câu 1 số phương án: 6
câu 1: F
```

### Nhiều đáp án đúng
```de
Câu 1: Số nào là số nguyên tố?
*A. 2
*B. 3
C. 4
D. 6
```
```ket-qua
câu 1: A,B
```

## 2. Cách đánh số câu

### Các kiểu tiền tố câu hỏi
```de
Câu 1: Một?
A. x
*B. y
Câu 2. Hai?
*A. x
B. y
Bài 3: Ba?
A. x
*B. y
Question 4. Four?
*A. x
B. y
Q5: Five?
A. x
*B. y
```
```ket-qua
số câu: 5
câu 1: B
câu 2: A
câu 3: B
câu 4: A
câu 5: B
câu 4 tiêu đề: Four?
```

### Đánh số trần 1. và 2)
```de
1. Thủ đô Pháp?
A. Berlin
*B. Paris
2) Thủ đô Ý?
A. Berlin
*B. Rome
```
```ket-qua
số câu: 2
câu 1: B
câu 2: B
câu 2 tiêu đề: Thủ đô Ý?
```

### Câu không có số thì không đọc được
Đề kiểu này cần dùng nút **Chuyển đổi file** để AI đánh số giúp.
```de
Thủ đô Việt Nam là gì?
A. Huế
*B. Hà Nội
```
```ket-qua
không đọc được
```

## 3. Cách viết phương án

### Các dấu sau chữ cái
```de
Câu 1: Dấu chấm phẩy?
A: x
*B: y
Câu 2: Dấu ngoặc?
A) x
*B) y
Câu 3: Dấu gạch chéo?
A/ x
*B/ y
Câu 4: Chữ thường trong ngoặc?
(a) x
*(b) y
```
```ket-qua
số câu: 4
câu 1: B
câu 2: B
câu 3: B
câu 4: B
câu 4 phương án B: y
```

### Nhiều phương án trên một dòng, cách nhau bằng tab hoặc từ 2 dấu cách
```de
Câu 1: 2 + 2 = ?
A. 3    *B. 4    C. 5    D. 6
Câu 2: 3 + 3 = ?
A. 5	*B. 6	C. 7	D. 8
```
```ket-qua
số câu: 2
câu 1 số phương án: 4
câu 1: B
câu 1 phương án D: 6
câu 2: B
```

## 4. Đánh dấu đáp án đúng ngay trong phương án

### Dấu * ở cuối phương án
```de
Câu 1: Thủ đô?
A. Huế
B. Hà Nội *
C. Vinh
```
```ket-qua
câu 1: B
câu 1 phương án B: Hà Nội
```

### Dấu (*) sau phương án
```de
Câu 1: Thủ đô?
A. Huế
B. Hà Nội (*)
C. Vinh
```
```ket-qua
câu 1: B
câu 1 phương án B: Hà Nội
```

### Chỉ một phương án in đậm kiểu Markdown
```de
Câu 1: Thủ đô?
A. Huế
**B. Hà Nội**
C. Vinh
```
```ket-qua
câu 1: B
câu 1 phương án B: Hà Nội
```

### Dấu * trong phép tính không phải đáp án
```de
Câu 1: Tính 2*3 + 1
A. 6
*B. 7
C. 2*3
```
```ket-qua
câu 1: B
câu 1 tiêu đề: Tính 2*3 + 1
câu 1 phương án C: 2*3
```

### Đã có * đầu dòng thì * trong nội dung giữ nguyên
Hay gặp trong đề lập trình C (con trỏ).
```de
Câu 1: Trong khai báo int *p; kiểu của p là gì?
A. int
*B. con trỏ tới int
C. int *
D. *int
```
```ket-qua
câu 1: B
câu 1 phương án C: int *
câu 1 phương án D: *int
```

## 5. Đáp án ghi ngay sau câu hỏi

### Dòng "Đáp án: B"
```de
Câu 1: 5 x 6 = ?
A. 11
B. 30
C. 56
D. 1
Đáp án: B
```
```ket-qua
câu 1: B
câu 1 số phương án: 4
```

### Lời giải có câu "Chọn B" thì dùng để lấy đáp án, không hiện ra
```de
Câu 1: 5 x 6 = ?
A. 11
B. 30
C. 56
D. 1
Lời giải: Ta có 5 x 6 = 30. Chọn B.
```
```ket-qua
câu 1: B
câu 1 phương án D: 1
```

## 6. Bảng đáp án ở cuối đề

### Tiêu đề "Đáp án:" đứng riêng một dòng
```de
Câu 1: Thủ đô Pháp?
A. Berlin
B. Paris
C. Rome
Câu 2: Thủ đô Ý?
A. Berlin
B. Paris
C. Rome
Đáp án:
1B 2C
```
```ket-qua
số câu: 2
câu 1: B
câu 2: C
câu 2 phương án C: Rome
```

### "Đáp án: 1B 2C" viết cùng dòng
```de
Câu 1: Thủ đô Pháp?
A. Berlin
B. Paris
C. Rome
Câu 2: Thủ đô Ý?
A. Berlin
B. Paris
C. Rome
Đáp án: 1B 2C
```
```ket-qua
số câu: 2
câu 1: B
câu 2: C
câu 2 phương án C: Rome
```

### "Đáp án: 1-B, 2-C" có gạch nối và dấu phẩy
```de
Câu 1: Thủ đô Pháp?
A. Berlin
B. Paris
Câu 2: Thủ đô Ý?
A. Rome
B. Paris
Đáp án: 1-B, 2-A
```
```ket-qua
câu 1: B
câu 2: A
```

### "Bảng đáp án" với số chấm chữ
```de
Câu 1: Thủ đô Pháp?
A. Berlin
B. Paris
Câu 2: Thủ đô Ý?
A. Rome
B. Paris

BẢNG ĐÁP ÁN
1.B 2.A
```
```ket-qua
câu 1: B
câu 2: A
câu 2 phương án B: Paris
```

### Tiêu đề kẻ gạch "----- ĐÁP ÁN -----"
```de
Câu 1: Thủ đô Pháp?
A. Berlin
B. Paris
Câu 2: Thủ đô Ý?
A. Rome
B. Paris
----- ĐÁP ÁN -----
1.B 2.A
```
```ket-qua
câu 1: B
câu 2: A
```

### Bảng hai dòng: hàng số câu và hàng đáp án
```de
Câu 1: Thủ đô Pháp?
A. Berlin
B. Paris
Câu 2: Thủ đô Ý?
A. Rome
B. Paris
Câu 3: Thủ đô Đức?
A. Berlin
B. Paris
Đáp án:
1 2 3
B A A
```
```ket-qua
câu 1: B
câu 2: A
câu 3: A
```

### Câu trắc nghiệm không có đáp án bị bỏ, câu có đáp án vẫn giữ
```de
Câu 1: Có đáp án
A. x
*B. y
Câu 2: Không có đáp án
A. x
B. y
```
```ket-qua
số câu: 1
câu 1 tiêu đề: Có đáp án
```

### Không câu nào có đáp án thì không tạo được đề
```de
Câu 1: a?
A. x
B. y
Câu 2: b?
A. x
B. y
```
```ket-qua
không đọc được
```

## 7. Câu đúng/sai

Bắt đầu bằng `câu hỏi đúng sai:`. Mỗi ý là một phát biểu; ý nào **đúng** thì có `*`.
Chấm theo thang của Bộ: đúng 1 ý được 0,1 điểm, 2 ý 0,25, 3 ý 0,5, cả 4 ý 1 điểm.

### Đánh dấu ý đúng bằng *
```de
câu hỏi đúng sai: Câu 1: Cho hàm số y = x².
*A. Hàm số chẵn
B. Đồ thị đi qua điểm (1; 2)
*C. Hàm số có cực tiểu
D. Hàm số đồng biến trên R
```
```ket-qua
câu 1 loại: đúng sai
câu 1: ĐSĐS
câu 1 tiêu đề: Cho hàm số y = x².
```

### Đáp án ghi sau câu: "a) Đ b) S c) Đ d) S"
```de
câu hỏi đúng sai: Câu 1: Cho hàm số y = x².
A. Hàm số chẵn
B. Đồ thị đi qua điểm (1; 2)
C. Hàm số có cực tiểu
D. Hàm số đồng biến trên R
Đáp án: a) Đ b) S c) Đ d) S
```
```ket-qua
câu 1: ĐSĐS
câu 1 phương án D: Hàm số đồng biến trên R
```

### Đáp án gọn "1. ĐSĐS" dưới dòng "Đáp án:"
```de
câu hỏi đúng sai: Câu 1: Cho hàm số y = x².
A. Hàm số chẵn
B. Đồ thị đi qua điểm (1; 2)
C. Hàm số có cực tiểu
D. Hàm số đồng biến trên R
Đáp án:
1. ĐSĐS
```
```ket-qua
câu 1: ĐSĐS
câu 1 phương án D: Hàm số đồng biến trên R
```

### Câu đúng/sai không có dấu * vẫn giữ, mọi ý coi là Sai
```de
câu hỏi đúng sai: Câu 1: Xét các mệnh đề
A. Mệnh đề p
B. Mệnh đề q
C. Mệnh đề r
D. Mệnh đề s
```
```ket-qua
số câu: 1
câu 1: SSSS
```

### Đề trộn hai phần
```de
PHẦN I. TRẮC NGHIỆM
Câu 1: 1 + 1 = ?
A. 1
*B. 2
PHẦN II. ĐÚNG SAI
câu hỏi đúng sai: Câu 1: Xét các phát biểu
*A. 2 là số chẵn
B. 3 là số chẵn
*C. 4 là số chẵn
D. 5 là số chẵn
```
```ket-qua
số câu: 2
câu 1 loại: trắc nghiệm
câu 1: B
câu 2 loại: đúng sai
câu 2: ĐSĐS
```

## 8. Nội dung nhiều dòng

### Câu hỏi nhiều dòng
```de
Câu 1: Cho đoạn code sau:
x = 1
x = x + 1
Giá trị của x là?
A. 1
*B. 2
```
```ket-qua
câu 1 tiêu đề: Cho đoạn code sau: / x = 1 / x = x + 1 / Giá trị của x là?
câu 1: B
```

### Phương án nhiều dòng (không có dòng trống ở giữa)
```de
Câu 1: Chọn câu đúng
A. Dòng một
của phương án A
*B. Phương án B
```
```ket-qua
câu 1 phương án A: Dòng một / của phương án A
câu 1: B
```

### Đoạn văn sau dòng trống thuộc về câu kế tiếp
```de
Câu 1: 1 + 1 = ?
A. 1
*B. 2
C. 3
D. 4

Đọc đoạn văn sau và trả lời câu 2:
Nam đi học lúc 7 giờ sáng.
Câu 2: Nam đi học lúc mấy giờ?
*A. 7 giờ
B. 8 giờ
```
```ket-qua
câu 1 phương án D: 4
câu 2 tiêu đề: Đọc đoạn văn sau và trả lời câu 2: / Nam đi học lúc 7 giờ sáng. / Nam đi học lúc mấy giờ?
câu 2: A
```

### Ghi chú sau dòng trống ở cuối đề vẫn nằm ở phương án cuối
```de
Câu 1: 1 + 1 = ?
A. 1
*B. 2
C. 3
D. 4

Ghi chú cuối đề
```
```ket-qua
câu 1 phương án D: 4 / Ghi chú cuối đề
```

### Đề cách dòng (mỗi dòng cách nhau một dòng trống)
```de
Câu 1: 1 + 1 = ?

A. 1

*B. 2

C. 3

D. 4

Câu 2: 2 + 2 = ?

A. 3

*B. 4
```
```ket-qua
số câu: 2
câu 1 số phương án: 4
câu 1 phương án D: 4
câu 2 tiêu đề: 2 + 2 = ?
câu 2: B
```

## 9. Những dòng được bỏ qua

### Mã đề, dòng kẻ và "HẾT"
```de
Mã đề: 101
Câu 1: 1 + 1 = ?
A. 1
*B. 2
-----------
Câu 2: 2 + 2 = ?
A. 3
*B. 4
----- HẾT -----
```
```ket-qua
số câu: 2
câu 2 phương án B: 4
```

### Ghi chú của giám thị ở cuối đề
```de
Câu 1: 1 + 1 = ?
A. 1
*B. 2
(Cán bộ coi thi không giải thích gì thêm)
```
```ket-qua
số câu: 1
câu 1 phương án B: 2
```

## 10. Giới hạn đã biết

- Ở câu đúng/sai, một ý chỉ gồm chữ Đ/S/T/F (ví dụ `D. S`) bị hiểu nhầm là dòng đáp án và mất ý đó. Phát biểu thật luôn dài hơn nên hiếm gặp.
- Đoạn văn đứng giữa hai câu chỉ được chuyển xuống câu sau khi có **dòng trống** ngăn với phương án cuối. Không có dòng trống thì nó bị nối vào phương án cuối của câu trước.
- Câu không đánh số (không có `Câu 1:`, `1.`…) không đọc được; dùng nút **Chuyển đổi file** để AI đánh số.

## 11. An toàn

### Thẻ HTML trong đề hiện ra như chữ, không chạy
```de
Câu 1: <img src=x onerror=alert(1)> là gì?
*A. <b>đậm</b>
B. a & b
```
```ket-qua
câu 1 tiêu đề: <img src=x onerror=alert(1)> là gì?
câu 1 phương án A: <b>đậm</b>
câu 1 phương án B: a & b
```
