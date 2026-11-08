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
Khi làm bài, chọn trúng một trong các đáp án đúng là được điểm; lúc tạo đề web báo "Câu 1 có nhiều đáp án đúng" để giáo
viên kiểm tra lại (quyết định ngày 7/11/2026).
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

### Ghi chú điểm, mức độ sau số câu ("Câu 1 (0,25 điểm):", "Câu 2 [NB]:") không vào đề bài
```de
Câu 1 (0,25 điểm): Thủ đô?
A. Huế
*B. Hà Nội
Câu 2 [NB]: Thủ đô Pháp?
A. Berlin
*B. Paris
```
```ket-qua
số câu: 2
câu 1 tiêu đề: Thủ đô?
câu 2 tiêu đề: Thủ đô Pháp?
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

### Phương án có gạch đầu dòng ("• A.", "- A.") hoặc dấu chấm toàn chiều rộng ("A．")
Chép danh sách từ Word sang hay giữ lại dấu đầu dòng.
```de
Câu 1: Thủ đô?
• A. Huế
• B. Hà Nội
• C. Vinh
Đáp án: B
Câu 2: Thủ đô Pháp?
- A. Berlin
- B. Paris
Đáp án: B
Câu 3: Thủ đô Ý?
A． Rome
B． Paris
Đáp án: A
```
```ket-qua
số câu: 3
câu 1 số phương án: 3
câu 1: B
câu 1 phương án B: Hà Nội
câu 2: B
câu 3: A
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

### Dấu * viết liền cuối phương án ("Hà Nội*")
Hai phương án trở lên cùng có `*` viết liền (thường là ký hiệu, như `int*`) thì không coi là đánh dấu đáp án.
```de
Câu 1: Thủ đô?
A. Huế
B. Hà Nội*
C. Vinh
Câu 2: Thủ đô Pháp?
A. Berlin B. Paris* C. Rome D. Madrid
Câu 3: Chọn từ đúng
A. Huế*
B. Vinh*
C. Hà Nội
```
```ket-qua
số câu: 2
câu 1: B
câu 1 phương án B: Hà Nội
câu 2: B
câu 2 phương án B: Paris
```

### Dấu * đứng giữa hai phương án cùng dòng ("B. y * C. z") thì không đoán
Không biết `*` là của B (viết sau) hay của C (viết trước), nên câu bị bỏ. Viết liền vào chữ (`y*` hay `*C.`) thì rõ.
```de
Câu 1: Thủ đô?
A. Huế B. Hà Nội * C. Vinh D. Đà Nẵng
Câu 2: Thủ đô Pháp?
A. Berlin B. Madrid *C. Paris D. Rome
Câu 3: Thủ đô Ý?
A. Rome* B. Paris C. Huế D. Vinh
```
```ket-qua
số câu: 2
câu 1 tiêu đề: Thủ đô Pháp?
câu 1: C
câu 1 phương án C: Paris
câu 2: A
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

### Mọi phương án đều có "* " đầu dòng (gạch đầu dòng chép từ chatbot) thì không phải đánh dấu đáp án
```de
Câu 1: Thủ đô của Việt Nam là gì?
*   A. Huế
*   B. Hà Nội
*   C. Đà Nẵng
*   D. Cần Thơ
**Đáp án: B**
Câu 2: 2 + 2 bằng?
* A. 3
* B. 4
* C. 5
Câu 3: Thủ đô Pháp?
A. Berlin
*B. Paris
```
```ket-qua
số câu: 2
câu 1: B
câu 2 tiêu đề: Thủ đô Pháp?
câu 2: B
```

### Dấu * trong nội dung phương án (con trỏ C) mà dòng "Đáp án:" nói khác thì dòng đáp án thắng
Dấu * khi đó là nội dung nên được giữ lại. Dòng đáp án nói cùng phương án mà bỏ * làm hai phương án giống hệt nhau thì
cũng giữ *.
```de
Câu 1: Cho int *p; Phát biểu đúng là
A. p là biến nguyên
B. *p là địa chỉ
C. p lưu địa chỉ biến int
D. &p là giá trị
Đáp án: C
Câu 2: Cho int a = 5; int *p = &a; Biểu thức nào cho giá trị 5?
A. p
B. &p
C. *p
D. &a
Đáp án: C
```
```ket-qua
câu 1: C
câu 1 phương án B: *p là địa chỉ
câu 2: C
câu 2 phương án C: *p
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

### Dòng đáp án in đậm kiểu Markdown (chép từ chatbot) vẫn đọc được
```de
Câu 1: Thủ đô?
A. Huế
B. Hà Nội
C. Vinh
D. Đà Nẵng
**Đáp án: B**
Câu 2: Sông dài nhất?
A. Sông Hồng
B. Sông Đà
C. Sông Mê Kông
D. Sông Mã
**Đáp án:** C
Câu 3: Núi cao nhất?
A. Fansipan
B. Bà Đen
C. Ngọc Linh
D. Tây Côn Lĩnh
- Đáp án: **A**
```
```ket-qua
số câu: 3
câu 1: B
câu 2: C
câu 3: A
```

### Đáp án ghi cùng dòng phương án cuối, cách bằng tab
```de
Câu 1: 2 + 2 = ?
A. 3
B. 4
C. 5
D. 6	Đáp án đúng: B
```
```ket-qua
câu 1: B
câu 1 phương án D: 6
```

### Dòng đáp án giải thích "C đúng vì phương án A sai" vẫn là câu trắc nghiệm
```de
Câu 1: Chọn phát biểu đúng:
A. Một
B. Hai
C. Ba
D. Bốn
Đáp án: C đúng vì phương án A sai, B sai, D sai.
Câu 2: Chọn phát biểu đúng:
A. Một
B. Hai
C. Ba
D. Bốn
Đáp án: C đúng vì phương án A sai.
```
```ket-qua
số câu: 2
câu 1 loại: trắc nghiệm
câu 1: C
câu 2: C
```

### Lời giải xét từng phương án ("Xét phương án A: …") lấy đáp án theo "Chọn C"
"Phương án A" chỉ là nhắc tới phương án; đáp án là chữ cái đi sau "Chọn", "Đáp án", "Phương án đúng là".
```de
Câu 1: Kim loại nào tác dụng với HCl?
A. Cu
B. Ag
C. Fe
D. Au
Lời giải:
Xét phương án A: Cu đứng sau H nên không phản ứng.
Xét phương án C: Fe đứng trước H. Chọn C.
Câu 2: Kim loại nào tác dụng với HCl?
A. Cu
B. Ag
C. Fe
D. Au
Lời giải: Ở phương án A, Cu đứng sau H nên không phản ứng. Chọn C.
```
```ket-qua
số câu: 2
câu 1: C
câu 2: C
```

### "Vậy a bằng 2", "Vậy a ∈ (0; 1)" là lời giải có biến, không phải đáp án
```de
Câu 1: Tìm a biết a + 3 = 5.
A. 1
B. 2
C. 4
D. 5
Ta có a + 3 = 5.
Vậy a bằng 2.
Chọn B.
Câu 2: Tìm a để hàm số đồng biến.
A. a > 1
B. a < 0
C. a = 2
D. a = 3
Vậy a ∈ (0; 1)
Câu 3: Câu ba?
A. một
*B. hai
```
```ket-qua
số câu: 2
câu 1: B
câu 2 tiêu đề: Câu ba?
```

### Phương án viết liền số ("D.31") rồi đáp án cuối dòng
```de
Câu 1: Giá trị nào?
A.10
B.17
C.24
D.31	Đáp án đúng: A
```
```ket-qua
câu 1: A
câu 1 phương án D: 31
```

### Cả câu, phương án và đáp án trên một dòng, cách bằng tab
```de
Câu 1: 2 + 2 = ?	A. 3	B. 4	C. 5	D. 6	Đáp án đúng: B
Câu 2: 3 + 3 = ?
[A] 5
[B] 6
[C] 7
[D] 8	Đáp án đúng: B
```
```ket-qua
số câu: 2
câu 1: B
câu 1 phương án D: 6
câu 2: B
câu 2 phương án D: 8
```

### "Đáp án: Phương án B", "Suy ra B là phương án đúng"
```de
Câu 1: Thủ đô của Việt Nam là gì?
A. Huế
B. Hà Nội
C. Vinh
D. Đà Nẵng
Đáp án: Phương án B
Câu 2: Kim loại nào dẫn điện tốt nhất?
A. Cu
B. Ag
C. Al
D. Fe
Suy ra B là phương án đúng.
```
```ket-qua
số câu: 2
câu 1: B
câu 2: B
```

### Viết tắt "ĐA:", "Đ/A:" và mũi tên "→ Đáp án B"
```de
Câu 1: Thủ đô?
A. Huế
B. Hà Nội
ĐA: B
Câu 2: Sông dài nhất?
A. Sông Hồng
B. Sông Mê Kông
Đ/A: B
Câu 3: Núi cao nhất?
A. Fansipan
B. Bà Đen
→ Đáp án A
```
```ket-qua
số câu: 3
câu 1: B
câu 2: B
câu 3: A
```

### Dòng đề bài bắt đầu bằng "Đa…" không phải "ĐA:" (đáp án)
Chỉ "ĐA", "Đ/A", "Đ.A" viết hoa (hoặc có dấu "/") là viết tắt của "Đáp án".
```de
Câu 1: Ai đề xuất thuyết chọn lọc tự nhiên?
Đa-uyn: nhà tự nhiên học người Anh.
A. Lamac
B. Menđen
Đáp án: B
```
```ket-qua
số câu: 1
câu 1: B
câu 1 tiêu đề: Ai đề xuất thuyết chọn lọc tự nhiên? / Đa-uyn: nhà tự nhiên học người Anh.
```

### Dòng đáp án có gạch đầu dòng, dấu trích dẫn hay biểu tượng ("- **Đáp án:** B", "> Đáp án: B", "✅ Đáp án: B")
```de
Câu 1: Thủ đô?
A. Huế
B. Hà Nội
- **Đáp án:** B
Câu 2: Thủ đô Pháp?
A. Berlin
B. Paris
> **Đáp án: B**
Câu 3: Thủ đô Ý?
A. Rome
B. Paris
✅ **Đáp án: A**
Câu 4: Thủ đô Anh?
A. London
B. Paris
👉 Đáp án: A
```
```ket-qua
số câu: 4
câu 1: B
câu 1 phương án B: Hà Nội
câu 2: B
câu 3: A
câu 4: A
```

### Lời giải nhắc phương án sai ("Đáp án A chưa đúng", "Nếu chọn A thì…"), điểm "A(0;0;0)" không phải đáp án
```de
Câu 1: Một?
A. a
B. b
C. c
D. d
Lời giải
Đáp án A chưa đúng vì thiếu điều kiện.
Đáp án B không phải là đáp án đúng.
Nếu chọn đáp án D thì mâu thuẫn.
Vậy chọn C.
Câu 2: Tính góc giữa AC và BD.
A. 30°
B. 60°
C. 90°
D. 45°
Lời giải
Gắn hệ trục. Chọn A(0;0;0), B(1;0;0), D(0;1;0).
Ta có AC.BD = 0. Vậy chọn C.
Câu 3: Hai?
A. a
B. b
C. c
D. d
Lời giải
Gọi M là trung điểm. Chọn C làm gốc tọa độ.
Suy ra khẳng định B đúng.
Chọn B
```
```ket-qua
số câu: 3
câu 1: C
câu 2: C
câu 3: B
```

### Hai dòng lời giải khẳng định hai đáp án khác nhau thì không đoán
```de
Câu 1: Một?
A. a
B. b
C. c
Lời giải
Chọn A vì a đúng.
Vậy chọn C.
```
```ket-qua
không đọc được
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

### Lời giải có biến toán học: đáp án lấy theo "Chọn D", không theo chữ "a" trong lời giải
```de
Câu 1: Tìm a biết 2a = 4?
A. 1
B. 3
C. 4
D. 2
Lời giải: Suy ra a = 2. Chọn D.
```
```ket-qua
câu 1: D
```

### Lời giải nhắc cả phương án sai: chỉ lấy chữ cái được khẳng định là đáp án
Lời giải hay giải thích vì sao các phương án khác sai. Chữ cái đứng ngay trước "sai", sau "không chọn"/"loại",
hoặc nằm trong một danh sách "A, B, D" không phải đáp án.
```de
Câu 1: Câu một?
A. một
B. hai
C. ba
D. bốn
Lời giải: Chọn C vì phương án A sai.
Câu 2: Câu hai?
A. một
B. hai
C. ba
D. bốn
Lời giải: Đáp án C. Phương án A sai vì thiếu dữ kiện, phương án B sai vì nhầm đơn vị.
Câu 3: Câu ba?
A. một
B. hai
C. ba
D. bốn
Lời giải: Chọn C. Các đáp án A, B, D đều sai.
Câu 4: Câu bốn?
A. một
B. hai
C. ba
D. bốn
Lời giải: Đáp án đúng là C, không chọn A vì A là bẫy.
Câu 5: Câu năm?
A. một
B. hai
C. ba
D. bốn
Phương án A sai vì thiếu dữ kiện. Chọn C.
```
```ket-qua
số câu: 5
câu 1: C
câu 2: C
câu 3: C
câu 4: C
câu 5: C
```

### Lời giải khẳng định hai đáp án khác nhau thì không đoán
```de
Câu 1: Câu một?
A. một
B. hai
C. ba
D. bốn
Lời giải: Phương án B đúng, phương án C cũng đúng.
Câu 2: Câu hai?
*A. một
B. hai
```
```ket-qua
số câu: 1
câu 1 tiêu đề: Câu hai?
```

### Dòng "Vậy a = 2", "Suy ra b > 0" dưới phương án là lời giải có biến, không phải đáp án
```de
Câu 1: Tìm a biết a + 3 = 5.
A. 1
B. 3
C. 4
D. 5
Ta có a + 3 = 5.
Vậy a = 2
Câu 2: Tìm b biết b > 0 và b² = 4.
A. 1
B. 3
C. 4
D. 5
Suy ra b > 0
Câu 3: Câu ba?
A. một
*B. hai
```
```ket-qua
số câu: 1
câu 1 tiêu đề: Câu ba?
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

### Tiêu đề "ĐÁP ÁN:" với bảng chỉ có đáp án đúng/sai
```de
câu hỏi đúng sai: Câu 1: Hàm số f(x) liên tục trên R?
a) f(x) đồng biến trên R
b) f(x) có cực trị
c) f(x) nhận giá trị dương
d) f(x) là hàm chẵn

câu hỏi đúng sai: Câu 2: Phương trình g(x) = 0?
a) Có nghiệm dương
b) Có nghiệm âm
c) Vô nghiệm
d) Có 2 nghiệm

ĐÁP ÁN:
Câu 1: ĐSĐS
Câu 2: SĐSĐ
```
```ket-qua
số câu: 2
câu 1: ĐSĐS
câu 2: SĐSĐ
```

### "Đáp án:" rồi dòng sau ghi nội dung ("C2H5OH") không phải chữ cái thì không đoán
Dòng sau "Đáp án:" chỉ là đáp án khi là chữ cái đứng riêng ("B", "B.", "B. C2H5OH"); "C2H5OH" không phải phương án C.
```de
Câu 1: Chất nào là ancol?
A. CH4
B. C2H5OH
C. CH3COOH
D. HCHO
Đáp án:
C2H5OH
```
```ket-qua
không đọc được
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

### Đáp án theo phần như đề THPT: dòng "Câu 1: a) Đ b) S…" của Phần II không thành đáp án câu 1 Phần I
Phần II đánh số lại từ Câu 1, nên dòng đáp án đúng/sai của nó không được đè lên câu trắc nghiệm cùng số.
```de
PHẦN I. TRẮC NGHIỆM
Câu 1: Thủ đô của Việt Nam?
A. Huế
B. Hà Nội
C. Vinh
D. Đà Nẵng
Câu 2: Thành phố lớn nhất miền Nam?
A. Cần Thơ
B. Huế
C. TP. Hồ Chí Minh
D. Vũng Tàu
PHẦN II. ĐÚNG SAI
câu hỏi đúng sai: Câu 1: Về nước
a) Nước sôi ở 100 độ C.
b) Nước đóng băng ở 10 độ C.
c) Nước là hợp chất.
d) Nước tinh khiết dẫn điện tốt.
ĐÁP ÁN
PHẦN I
Câu 1 2
Đáp án B C
PHẦN II
Câu 1: a) Đ b) S c) Đ d) S
```
```ket-qua
số câu: 3
câu 1: B
câu 2: C
câu 3 loại: đúng sai
câu 3: ĐSĐS
```

### Bảng đáp án Phần II ghi "a-Đ, b-S", "a. Đ", "a: Đ" không thành đáp án "A" của câu trắc nghiệm
```de
PHẦN I. TRẮC NGHIỆM
Câu 1: Thủ đô của Việt Nam?
A. Huế
B. Hà Nội
C. Vinh
D. Đà Nẵng
Câu 2: Thành phố lớn nhất miền Nam?
A. Cần Thơ
B. Huế
C. TP. Hồ Chí Minh
D. Vũng Tàu
PHẦN II. ĐÚNG SAI
câu hỏi đúng sai: Câu 1: Về nước
a) Nước sôi ở 100 độ C.
b) Nước đóng băng ở 10 độ C.
c) Nước là hợp chất.
d) Nước tinh khiết dẫn điện tốt.
câu hỏi đúng sai: Câu 2: Về sắt
a) Sắt là kim loại.
b) Sắt là phi kim.
c) Sắt bị nam châm hút.
d) Sắt tan trong nước.
ĐÁP ÁN
PHẦN I
1.B 2.C
PHẦN II
Câu 1: a-Đ, b-S, c-Đ, d-S
Câu 2: a. Đ b. S c. Đ d. S
```
```ket-qua
số câu: 4
câu 1: B
câu 2: C
câu 3: ĐSĐS
câu 4: ĐSĐS
```

### Phần có tiêu đề "đúng sai" (đề THPT 2025): câu không có tiền tố vẫn là câu đúng/sai
Tiêu đề phần như "PHẦN II. Câu trắc nghiệm đúng sai." (cùng dòng hoặc dòng ngay sau) cho biết các câu trong phần là
câu đúng/sai, tới tiêu đề phần sau.
```de
PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.
Câu 1: Thủ đô của Việt Nam?
A. Huế
B. Hà Nội
C. Vinh
D. Đà Nẵng
PHẦN II.
Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu 2.
Câu 1: Về nước
a) Nước sôi ở 100 độ C.
b) Nước đóng băng ở 10 độ C.
c) Nước là hợp chất.
d) Nước tinh khiết dẫn điện tốt.
Câu 2: Về sắt
a) Sắt là kim loại.
b) Sắt là phi kim.
c) Sắt bị nam châm hút.
d) Sắt tan trong nước.
Đáp án:
a) Đúng
b) Sai
c) Đúng
d) Sai
BẢNG ĐÁP ÁN
PHẦN I
1.B
PHẦN II
Câu 1: a-Đ, b-S, c-Đ, d-S
```
```ket-qua
số câu: 3
câu 1: B
câu 2 loại: đúng sai
câu 2: ĐSĐS
câu 3 loại: đúng sai
câu 3: ĐSĐS
câu 3 phương án D: Sắt tan trong nước.
```

### "Đáp án:" rồi dòng "a) Đúng" ở câu trắc nghiệm không phải "chọn A"
```de
Câu 1: 2 + 2 = ?
A. 3
B. 4
Đáp án:
a) Đúng
```
```ket-qua
không đọc được
```

### Bảng đáp án theo khoảng câu ("Câu 1 - 3: C B D")
Số đáp án phải bằng số câu trong khoảng; không bằng thì dòng đó không dùng (không đoán câu nào nhận chữ nào).
```de
Câu 1: Câu số 1?
A. a1
B. b1
C. c1
D. d1
Câu 2: Câu số 2?
A. a2
B. b2
C. c2
D. d2
Câu 3: Câu số 3?
A. a3
B. b3
C. c3
D. d3
Câu 4: Câu số 4?
A. a4
B. b4
C. c4
D. d4
Câu 5: Câu số 5?
A. a5
B. b5
C. c5
D. d5
Câu 6: Câu số 6?
A. a6
B. b6
C. c6
D. d6
Câu 7: Câu số 7?
A. a7
B. b7
C. c7
D. d7
ĐÁP ÁN
Câu 1 - 3: C B D
4–6: A, B, D
Câu 7 - 9: A B
```
```ket-qua
số câu: 6
câu 1: C
câu 2: B
câu 3: D
câu 4: A
câu 5: B
câu 6: D
```

### Bảng đáp án nhiều mã đề: chỉ dùng phần của mã đề ghi ở đầu đề
```de
Mã đề 102
Câu 1: Một?
A. a1
B. b1
C. c1
D. d1
Câu 2: Hai?
A. a2
B. b2
C. c2
D. d2
ĐÁP ÁN
Mã đề 101: 1.A 2.B
Mã đề 102: 1.B 2.C
Mã đề 103: 1.C 2.D
```
```ket-qua
số câu: 2
câu 1: B
câu 2: C
```

### Bảng đáp án nhiều mã đề, mỗi mã đề một khối
```de
Mã đề 103
Câu 1: Một?
A. a1
B. b1
C. c1
D. d1
Câu 2: Hai?
A. a2
B. b2
C. c2
D. d2
BẢNG ĐÁP ÁN
Mã đề 101
1.A 2.B
Mã đề 103
1.D 2.A
```
```ket-qua
số câu: 2
câu 1: D
câu 2: A
```

### Bảng đáp án kiểu của Bộ: mỗi cột một mã đề
```de
Mã đề 103
Câu 1: Một?
A. a1
B. b1
C. c1
D. d1
Câu 2: Hai?
A. a2
B. b2
C. c2
D. d2
ĐÁP ÁN
Câu	101	102	103	104
1	A	B	C	D
2	B	C	D	A
```
```ket-qua
số câu: 2
câu 1: C
câu 2: D
```

### Không biết mã đề của đề thì không dùng bảng đáp án nhiều mã đề
Dùng nhầm cột là sai cả đề, nên web báo và không đoán.
```de
Câu 1: Một?
A. a1
B. b1
C. c1
D. d1
Câu 2: Hai?
A. a2
B. b2
C. c2
D. d2
ĐÁP ÁN
Mã đề 101: 1.A 2.B
Mã đề 102: 1.B 2.C
```
```ket-qua
không đọc được
```

### Hai phần cùng đánh số lại từ Câu 1, bảng đáp án chia theo phần
Bảng đáp án chỉ tra theo số câu thì phần sau sẽ nhận nhầm đáp án của phần đầu. Phần thứ hai của bảng (sau dòng
"Phần B", hoặc khi số câu trong bảng bắt đầu lại từ 1) áp cho phần thứ hai của đề.
```de
PHẦN A. ĐỌC HIỂU
Câu 1: Đọc hỏi 1
A. a
B. b
C. c
D. d
Câu 2: Đọc hỏi 2
A. a
B. b
C. c
D. d
PHẦN B. NGỮ PHÁP
Câu 1: Ngữ hỏi 1
A. a
B. b
C. c
D. d
Câu 2: Ngữ hỏi 2
A. a
B. b
C. c
D. d
ĐÁP ÁN
Phần A
1.A 2.B
Phần B
1.C 2.D
```
```ket-qua
số câu: 4
câu 1: A
câu 2: B
câu 3: C
câu 4: D
câu 4 tiêu đề: Ngữ hỏi 2
```

### Hai phần đánh số lại, bảng đáp án viết liền mỗi phần một dòng
```de
PHẦN A. ĐỌC HIỂU
Câu 1: Đọc hỏi 1
A. a
B. b
C. c
D. d
Câu 2: Đọc hỏi 2
A. a
B. b
C. c
D. d
PHẦN B. NGỮ PHÁP
Câu 1: Ngữ hỏi 1
A. a
B. b
C. c
D. d
Câu 2: Ngữ hỏi 2
A. a
B. b
C. c
D. d
ĐÁP ÁN
1.A 2.B
1.C 2.D
```
```ket-qua
số câu: 4
câu 3: C
câu 4: D
```

### Bảng đáp án không chia được theo phần thì không đoán
Đề có hai phần trắc nghiệm đánh số lại nhưng bảng chỉ có một dãy: không biết bảng là của phần nào, nên không dùng bảng
(web nhắc ghi "Phần I", "Phần II" trước đáp án của từng phần).
```de
PHẦN A
Câu 1: Một?
A. a
B. b
Câu 2: Hai?
A. a
B. b
Câu 3: Ba?
A. a
B. b
PHẦN B
Câu 1: Bốn?
A. a
B. b
Câu 2: Năm?
A. a
B. b
ĐÁP ÁN
1.A 2.B 3.B
```
```ket-qua
không đọc được
```

### Phần tự luận đánh số lại không làm mất bảng đáp án của phần trắc nghiệm
```de
PHẦN I. TRẮC NGHIỆM
Câu 1: Thủ đô của Việt Nam?
A. Huế
B. Hà Nội
C. Vinh
D. Đà Nẵng
Câu 2: 1 + 1 = ?
A. 1
B. 2
C. 3
D. 4
PHẦN II. TỰ LUẬN
Câu 1: Trình bày cảm nhận của em.
Câu 2: Giải phương trình sau.
BẢNG ĐÁP ÁN
1.B 2.B
```
```ket-qua
số câu: 2
câu 1: B
câu 2: B
```

### Tiêu đề phần trong bảng đáp án có ghi điểm ("Phần I (2 điểm)")
```de
PHẦN I. ĐỌC HIỂU
Câu 1: Hỏi 1?
A. a
B. b
Câu 2: Hỏi 2?
A. a
B. b
PHẦN II. VIẾT
Câu 1: Hỏi 3?
A. a
B. b
Câu 2: Hỏi 4?
A. a
B. b
ĐÁP ÁN
Phần I (2 điểm)
1.A 2.B
Phần II (8 điểm)
1.B 2.A
```
```ket-qua
số câu: 4
câu 1: A
câu 2: B
câu 3: B
câu 4: A
```

### Bảng đáp án có hai phần mà đề chỉ còn một phần: số câu có hai đáp án khác nhau thì không đoán
```de
Câu 1: Một?
A. x
B. y
C. z
D. t
Câu 2: Hai?
A. x
B. y
C. z
D. t
ĐÁP ÁN
Phần I
1.D
Phần II
1.B 2.C
```
```ket-qua
số câu: 1
câu 1 tiêu đề: Hai?
câu 1: C
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

### Bảng hai dòng có nhãn "ĐA" ở đầu hàng đáp án
```de
Câu 1: Thủ đô Pháp?
A. Berlin
B. Paris
Câu 2: Thủ đô Ý?
A. Rome
B. Paris
Đáp án:
Câu 1 2
ĐA B A
```
```ket-qua
câu 1: B
câu 2: A
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

### Ý có công thức f(x) hay đơn vị "1 s" không bị nhầm là dòng đáp án
```de
câu hỏi đúng sai: Câu 1: Cho hàm số y = f(x).
*A. Hàm số liên tục trên R
B. Hàm số có 2 cực trị
*C. Trên khoảng (1; 2) f(x) > 0
D. Đồ thị đi qua gốc tọa độ
câu hỏi đúng sai: Câu 2: Một vật chuyển động thẳng.
*A. Vận tốc ban đầu bằng 0
B. Gia tốc không đổi
*C. Từ t = 1 s đến t = 2 s vật đi được 4 m
D. Quãng đường tỉ lệ với thời gian
```
```ket-qua
số câu: 2
câu 1 số phương án: 4
câu 1: ĐSĐS
câu 2 số phương án: 4
câu 2: ĐSĐS
```

### Đáp án đúng/sai viết trên nhiều dòng, hoặc lời giải từng ý
```de
câu hỏi đúng sai: Câu 1: Cho hàm số y = x².
A. Hàm số chẵn
B. Đồ thị đi qua điểm (1; 2)
C. Hàm số có cực tiểu
D. Hàm số đồng biến trên R
Đáp án: a) Đúng, b) Sai
c) Đúng, d) Sai
câu hỏi đúng sai: Câu 2: Cho hàm số y = x².
A. Hàm số chẵn
B. Đồ thị đi qua điểm (1; 2)
C. Hàm số có cực tiểu
D. Hàm số đồng biến trên R
Lời giải:
a) Đúng. Vì f(-x) = f(x).
b) Sai. Vì f(1) = 1.
c) Đúng. Vì hàm số đạt cực tiểu tại x = 0.
d) Sai. Vì hàm số nghịch biến trên (-∞; 0).
```
```ket-qua
số câu: 2
câu 1: ĐSĐS
câu 2: ĐSĐS
câu 2 số phương án: 4
```

### Bảng đáp án đúng/sai cách nhau bằng tab (chép từ bảng Word)
```de
Câu 1: Một?
A. x
*B. y
câu hỏi đúng sai: Câu 2: Hai?
A. Nước sôi ở 100 độ C
B. Nước đóng băng ở 10 độ C
C. Nước là hợp chất
D. Nước tinh khiết dẫn điện tốt
BẢNG ĐÁP ÁN
Câu 2:	a) Đ	b) S	c) Đ	d) S
```
```ket-qua
số câu: 2
câu 1: B
câu 2: ĐSĐS
```

### Câu không có tiền tố "câu hỏi đúng sai:" nhưng dòng đáp án ghi từng ý Đúng/Sai là câu đúng/sai
Đề THPT từ 2025 có Phần II gồm các ý a), b), c), d). Dòng "Đáp án: a) Đúng b) Sai…" không bao giờ là "chọn A".
```de
PHẦN II. Câu trắc nghiệm đúng sai
Câu 1. Cho hàm số y = x. Xét tính đúng sai:
a) Hàm số đồng biến trên R.
b) Hàm số nghịch biến trên R.
c) Hàm số chẵn.
d) Hàm số lẻ.
Đáp án: a) Đúng b) Sai c) Sai d) Đúng
```
```ket-qua
câu 1 loại: đúng sai
câu 1: ĐSSĐ
câu 1 số phương án: 4
```

### Đáp án đúng/sai chỉ nói một số ý thì không tự coi các ý còn lại là Sai
Phải nói đủ từng ý (có thể trên nhiều dòng). Riêng kiểu liệt kê các ý Đúng ("a, c đúng", "Đáp án: a, c") thì các ý
còn lại là Sai.
```de
câu hỏi đúng sai: Câu 1: Xét các mệnh đề
A. 2 là số chẵn
B. 3 là số chẵn
C. 4 là số chẵn
D. 5 là số chẵn
Đáp án: a) Đúng, b) Sai
câu hỏi đúng sai: Câu 2: Xét các số
A. 2 là số chẵn
B. 3 là số chẵn
C. 4 là số chẵn
D. 5 là số chẵn
Đáp án: a, c đúng
```
```ket-qua
số câu: 1
câu 1 tiêu đề: Xét các số
câu 1: ĐSĐS
```

### Chuỗi Đ/S ngắn hơn số ý ("ĐS" cho câu 4 ý) cũng không tự coi các ý còn lại là Sai
```de
câu hỏi đúng sai: Câu 1: Cho các mệnh đề sau:
a) Mệnh đề 1
b) Mệnh đề 2
c) Mệnh đề 3
d) Mệnh đề 4
Đáp án: ĐS
câu hỏi đúng sai: Câu 2: Cho các mệnh đề sau:
a) Mệnh đề 1
b) Mệnh đề 2
c) Mệnh đề 3
d) Mệnh đề 4
Đáp án: Đúng, Sai
câu hỏi đúng sai: Câu 3: Cho các mệnh đề sau:
a) Mệnh đề 1
b) Mệnh đề 2
c) Mệnh đề 3
d) Mệnh đề 4
Đáp án: ĐSĐSĐ
Câu 4: Thủ đô?
A. Huế
*B. Hà Nội
```
```ket-qua
số câu: 1
câu 1 tiêu đề: Thủ đô?
```

### Câu đúng/sai có 5 ý (a–e): đáp án ghi từng ý hay bảng đáp án
```de
câu hỏi đúng sai: Câu 1: Cho 5 mệnh đề sau:
a) Mệnh đề 1
b) Mệnh đề 2
c) Mệnh đề 3
d) Mệnh đề 4
e) Mệnh đề 5
Đáp án: a đúng, b sai, c đúng, d sai, e đúng
câu hỏi đúng sai: Câu 2: Cho 5 mệnh đề sau:
a) Mệnh đề 1
b) Mệnh đề 2
c) Mệnh đề 3
d) Mệnh đề 4
e) Mệnh đề 5
câu hỏi đúng sai: Câu 3: Cho 4 mệnh đề sau:
a) Mệnh đề 1
b) Mệnh đề 2
c) Mệnh đề 3
d) Mệnh đề 4

BẢNG ĐÁP ÁN
Câu 2: ĐSĐSĐ
Câu 3: SSĐ
```
```ket-qua
số câu: 2
câu 1: ĐSĐSĐ
câu 2: ĐSĐSĐ
```

### Ý có nội dung chỉ là một chữ ("D. S") vẫn là ý, không phải dòng đáp án
```de
câu hỏi đúng sai: Câu 1: Chữ cái nào là phụ âm?
*A. B
B. A
*C. C
D. S
```
```ket-qua
câu 1 số phương án: 4
câu 1: ĐSĐS
câu 1 phương án D: S
```

### Ý viết liền chữ ("D.S") vẫn là ý
```de
câu hỏi đúng sai: Câu 1: Ký hiệu nguyên tố
*A. H
B. O
*C. N
D.S
```
```ket-qua
câu 1 số phương án: 4
câu 1: ĐSĐS
```

### Câu đúng/sai không có đáp án bị bỏ, giống câu trắc nghiệm thiếu đáp án
Web không tự coi mọi ý là Sai, vì như vậy là chấm theo đáp án không có trong đề (quyết định ngày 7/11/2026).
```de
câu hỏi đúng sai: Câu 1: Xét các mệnh đề
A. Mệnh đề p
B. Mệnh đề q
C. Mệnh đề r
D. Mệnh đề s
```
```ket-qua
không đọc được
```

### Câu đúng/sai không đáp án bị bỏ, câu khác trong đề vẫn giữ
```de
câu hỏi đúng sai: Câu 1: Xét các mệnh đề
A. Mệnh đề p
B. Mệnh đề q
C. Mệnh đề r
D. Mệnh đề s
Câu 2: Thủ đô?
A. Huế
*B. Hà Nội
```
```ket-qua
số câu: 1
câu 1 loại: trắc nghiệm
câu 1: B
```

### Câu đúng/sai mà cả 4 ý đều Sai thì ghi "Đáp án: SSSS"
```de
câu hỏi đúng sai: Câu 1: Xét các mệnh đề
A. Mệnh đề p
B. Mệnh đề q
C. Mệnh đề r
D. Mệnh đề s
Đáp án: SSSS
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

### Câu bị gộp có hai ý cùng chữ cái thì không nhận đáp án đúng/sai
Thường do mất dòng "Câu N" nên hai câu dính vào nhau (A–D rồi a–d). Không biết "SĐĐS" nói về ý nào nên câu không có
đáp án và bị bỏ, không đoán.
```de
Câu 1: Thủ đô?
A. Huế
B. Hà Nội
C. Vinh
D. Đà Nẵng
a) Ý một
b) Ý hai
c) Ý ba
d) Ý bốn
Đáp án: SĐĐS
câu hỏi đúng sai: Câu 2: Cho hàm số.
a) Ý một
b) Ý hai
c) Ý ba
d) Ý bốn
A. Thêm
Đáp án: ĐSĐS
Câu 3: Thủ đô Pháp?
A. Berlin
*B. Paris
```
```ket-qua
số câu: 1
câu 1 tiêu đề: Thủ đô Pháp?
câu 1: B
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

### Danh sách (a), (b), (c) trong đề bài không phải phương án
Đề Hoá, Sinh hay liệt kê thí nghiệm hay chất bằng chữ thường rồi mới hỏi; phương án thật bắt đầu lại từ A.
```de
Câu 1: Cho các thí nghiệm sau:
(a) Cho Na vào nước.
(b) Cho Fe vào dung dịch HCl.
(c) Cho Cu vào dung dịch HCl.
Số thí nghiệm có khí thoát ra là
A. 1
*B. 2
C. 3
D. 0
Câu 2: Cho các chất sau:
a) NaCl
b) HCl
c) NaOH
Có bao nhiêu chất là axit?
*A. 1
B. 2
C. 3
D. 0
```
```ket-qua
số câu: 2
câu 1 số phương án: 4
câu 1: B
câu 1 tiêu đề: Cho các thí nghiệm sau: / (a) Cho Na vào nước. / (b) Cho Fe vào dung dịch HCl. / (c) Cho Cu vào dung dịch HCl. / Số thí nghiệm có khí thoát ra là
câu 2 số phương án: 4
câu 2: A
câu 2 phương án A: 1
```

### Hội thoại "A: …", "B: …" trong đề bài (đề tiếng Anh) không phải phương án
Người nói ghi bằng chữ cái và dấu hai chấm, rồi phương án thật bắt đầu lại từ "A." nên dãy "A:", "B:" là đề bài.
Có gạch đầu dòng ("- A: …") cũng vậy.
```de
Câu 1: Choose the best response.
A: "Would you like a cup of tea?"
B: "______"
A. Yes, please.
B. No, I don't.
C. I like it.
D. Not at all.
Đáp án: A
Câu 2: Choose the best response.
- A: "Thank you very much."
- B: "______"
A. Not at all.
B. Yes, I do.
Đáp án: A
```
```ket-qua
số câu: 2
câu 1 số phương án: 4
câu 1: A
câu 1 tiêu đề: Choose the best response. / A: "Would you like a cup of tea?" / B: "______"
câu 1 phương án A: Yes, please.
câu 2 số phương án: 2
câu 2: A
câu 2 tiêu đề: Choose the best response. / - A: "Thank you very much." / - B: "______"
```

### Dòng đề bài bắt đầu bằng "Phần 1 của…", "Phần vi mô…" không phải tiêu đề phần
```de
Câu 1: Tác phẩm có mấy phần?
Phần 1 của tác phẩm nói về nội dung gì?
A. Tình yêu
*B. Chiến tranh
C. Gia đình
D. Quê hương
Câu 2: Kinh tế học
Phần vi mô của nền kinh tế nghiên cứu
A. Quốc gia
*B. Doanh nghiệp
C. Thế giới
D. Ngân hàng
```
```ket-qua
số câu: 2
câu 1: B
câu 1 tiêu đề: Tác phẩm có mấy phần? / Phần 1 của tác phẩm nói về nội dung gì?
câu 2: B
```

### Ký hiệu [A], (a) trong công thức ở đề bài không phải phương án
```de
Câu 1: Cho dung dịch:
[A]=0,1M và [B]=0,2M
Tỉ lệ là
A. 1:2
*B. 2:1
C. 1:1
D. 3:1
```
```ket-qua
câu 1 số phương án: 4
câu 1: B
câu 1 tiêu đề: Cho dung dịch: / [A]=0,1M và [B]=0,2M / Tỉ lệ là
```

### Phương án có tỉ lệ "a:1   b:2" không bị tách thành nhiều phương án
```de
Câu 1: Tỉ lệ thức nào đúng?
A. a:1   b:2   c:3   d:4
*B. a:2   b:4
```
```ket-qua
câu 1 số phương án: 2
câu 1: B
```

### Đề thiếu một phương án: đáp án theo chữ cái ghi trong đề, không theo vị trí
Câu 1 gõ thiếu phương án C nên "Đáp án: D" là phương án D (thứ ba trên màn hình). Câu 2 ghi "Đáp án: C" nhưng không có
phương án C nên không có đáp án (bị bỏ).
```de
Câu 1: Thủ đô của Việt Nam?
A. Huế
B. Vinh
D. Hà Nội
Đáp án: D
Câu 2: Câu hai?
A. một
B. hai
D. bốn
Đáp án: C
```
```ket-qua
số câu: 1
câu 1 số phương án: 3
câu 1: C
câu 1 phương án C: Hà Nội
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

### Tiêu đề, chân trang lặp lại mã đề và số trang không cắt đề, không dính vào phương án
Chép chữ từ file PDF thì tiêu đề và chân trang của mỗi trang nằm xen giữa các câu.
```de
Mã đề thi 101
Câu 1: Một?
A. x
*B. y
C. z
D. t
Trang 1/3 - Mã đề 101
Câu 2: Hai?
*A. x
B. y
Mã đề thi 101 - Trang 2/3
C. z
D. t
Mã đề thi 101                Trang 3/3
Câu 3: Ba?
A. x
B. y
*C. z
D. t
```
```ket-qua
số câu: 3
câu 1 phương án D: t
câu 2 số phương án: 4
câu 2 phương án B: y
câu 3: C
```

### File có hai mã đề khác nhau: chỉ đọc mã đề đầu
```de
Mã đề 101
Câu 1: Một?
A. x
*B. y
Câu 2: Hai?
*A. x
B. y
Mã đề 102
Câu 1: Hai?
A. y
*B. x
Câu 2: Một?
A. y
*B. x
```
```ket-qua
số câu: 2
câu 1: B
câu 2: A
```

### Tiêu đề "B. TỰ LUẬN" sau phương án cuối không thành phương án
```de
A. TRẮC NGHIỆM
Câu 1: Một?
A. x
B. y
C. z
*D. t
B. TỰ LUẬN
Câu 1: Trình bày ý kiến của em.
```
```ket-qua
số câu: 1
câu 1 số phương án: 4
câu 1: D
```

### Chân trang có mã đề rồi Phần II đánh số lại không bị coi là đề thứ hai
```de
PHẦN I. TRẮC NGHIỆM
Câu 1: Một?
A. x
*B. y
Câu 2: Hai?
*A. x
B. y
Trang 1/2 - Mã đề 101
PHẦN II. ĐÚNG SAI
Mã đề 101 - Trang 2/2
câu hỏi đúng sai: Câu 1: Ba?
*a) Ý một
b) Ý hai
*c) Ý ba
d) Ý bốn
```
```ket-qua
số câu: 3
câu 3 loại: đúng sai
câu 3: ĐSĐS
```

### Chân trang viết liền "Mã đề 132-Trang 1/4" cùng mã đề, không cắt đề
```de
Mã đề 132
Câu 1: Thủ đô của Việt Nam là
*A. Hà Nội
B. Huế
Mã đề 132-Trang 1/4
Câu 2: Sông dài nhất Việt Nam là
A. Hồng
*B. Mê Công
Mã đề 132-Trang 2/4
Câu 3: Núi cao nhất Việt Nam là
*A. Phan-xi-păng
B. Ngọc Linh
```
```ket-qua
số câu: 3
câu 1 số phương án: 2
câu 2: B
câu 3: A
```

### Tiêu đề trang có mã đề nằm giữa phần đã đánh số lại không cắt đề (đề không ghi mã ở đầu)
```de
PHẦN I. TRẮC NGHIỆM
Câu 1: Một?
A. x
*B. y
Câu 2: Hai?
*A. x
B. y
Câu 3: Ba?
A. x
*B. y
PHẦN II. TRẮC NGHIỆM
Câu 1: Bốn?
*A. x
B. y
Mã đề 101 - Trang 2/2
Câu 2: Năm?
A. x
*B. y
```
```ket-qua
số câu: 5
câu 5: B
câu 5 tiêu đề: Năm?
```

### Đề thứ hai mở đầu bằng "PHẦN I" (đề đầu không ghi mã): chỉ đọc đề đầu
"PHẦN I" là phần đầu tiên nên là đầu một đề mới; chỉ "PHẦN II" trở đi mới là phần tiếp theo của đề đang đọc.
```de
PHẦN I. TRẮC NGHIỆM
Câu 1: Một?
A. x
*B. y
Câu 2: Hai?
*A. x
B. y
Mã đề 102
PHẦN I. TRẮC NGHIỆM
Câu 1: Ba?
A. x
*B. y
```
```ket-qua
số câu: 2
câu 2 tiêu đề: Hai?
```

### Dòng "HẾT PHẦN I" giữa đề không dính vào câu nào
```de
Câu 1: Nội dung câu 1
A. một
*B. hai
C. ba
D. bốn

HẾT PHẦN I

Câu 2: Nội dung câu 2
A. một
B. hai
*C. ba
D. bốn
```
```ket-qua
số câu: 2
câu 1 phương án D: bốn
câu 2 tiêu đề: Nội dung câu 2
câu 2: C
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

## 10. Công thức toán

Công thức viết bằng LaTeX trong cặp dấu `$...$` (ví dụ `$\frac{1}{2}$`, `$x^{2}$`, `$\sqrt{3}$`).
Khi làm bài, web vẽ công thức bằng KaTeX. File Word dùng Equation có sẵn của Word được tự đổi sang dạng này
khi bấm **Chuyển đổi file** (xem `docs/thiet-ke/cong-thuc-toan.md`).
Quy ước: ngay sau `$` mở và ngay trước `$` đóng không có dấu cách, nên `$5 and $10` vẫn là chữ thường.

### Công thức trong câu hỏi và phương án được giữ nguyên
```de
Câu 1: Rút gọn biểu thức $\frac{x^{2}-1}{x+1}$ với $x \neq -1$.
A. $x+1$
*B. $x-1$
C. $\frac{1}{x-1}$
D. $x^{2}$
```
```ket-qua
câu 1: B
câu 1 tiêu đề: Rút gọn biểu thức $\frac{x^{2}-1}{x+1}$ với $x \neq -1$.
câu 1 phương án C: $\frac{1}{x-1}$
```

### Hệ phương trình trong câu hỏi
```de
Câu 1: Nghiệm của hệ $\begin{cases} x+y=3 \\ x-y=1 \end{cases}$ là
A. $(1;2)$
*B. $(2;1)$
```
```ket-qua
câu 1: B
câu 1 tiêu đề: Nghiệm của hệ $\begin{cases} x+y=3 \\ x-y=1 \end{cases}$ là
```

### Dấu * trong công thức không phải đáp án
```de
Câu 1: Tính $a*b$ với $a=2, b=3$
A. $5$
*B. $6$
C. $a*b$
```
```ket-qua
câu 1: B
câu 1 phương án C: $a*b$
```

### Công thức trong câu đúng/sai
```de
câu hỏi đúng sai: Câu 1: Cho hàm số $y = x^{3} - 3x$.
*A. Hàm số có hai điểm cực trị
B. $y'(0) = 3$
*C. $\lim_{x \to +\infty} y = +\infty$
D. Đồ thị đi qua điểm $(1; 2)$
```
```ket-qua
câu 1: ĐSĐS
câu 1 phương án C: $\lim_{x \to +\infty} y = +\infty$
```

### Công thức có (a + b) + (b + c) không bị tách thành nhiều phương án
```de
Câu 1: Rút gọn P
A. P = (a + b) + (b + c) + (c + d) với a > 0
*B. P = 0
C. P = 1
```
```ket-qua
câu 1 số phương án: 3
câu 1: B
câu 1 phương án A: P = (a + b) + (b + c) + (c + d) với a > 0
```

## 11. Giới hạn đã biết

- Ở câu đúng/sai, một ý chỉ gồm chuỗi Đ/S (ví dụ `ĐS`) bị hiểu là dòng đáp án. Phát biểu thật luôn dài hơn nên hiếm gặp.
- Phương án cách nhau đúng **một** dấu cách mà `*` đứng riêng giữa hai phương án (`B. y * C. z`) thì không biết là của
  phương án nào nên câu bị bỏ. Viết liền `*` vào phương án (`y*` hay `*C.`), hoặc dùng tab, nhiều dấu cách.
- Đường dán `.txt` chưa đọc `**(A) …**` (in đậm Markdown với chữ cái trong ngoặc); dùng `**A. …**` hoặc dấu `*`.
- Đề chỉ có **một** câu kèm bảng đáp án (`Đáp án: 1D`) không đọc được; ghi `Đáp án: D` ngay dưới câu.
- Câu đúng/sai không có tiền tố `câu hỏi đúng sai:`, không nằm trong phần có tiêu đề "đúng sai", mà đáp án chỉ nằm ở
  bảng cuối đề thì câu đó bị bỏ (không đoán). Thêm tiền tố hoặc tiêu đề phần, ghi `Đáp án: a) Đ b) S …` ngay dưới câu,
  hoặc dùng **Chuyển đổi file**.
- Đoạn văn đứng giữa hai câu chỉ được chuyển xuống câu sau khi có **dòng trống** ngăn với phương án cuối. Không có dòng trống thì nó bị nối vào phương án cuối của câu trước.
- Câu không đánh số (không có `Câu 1:`, `1.`…) không đọc được; dùng nút **Chuyển đổi file** để AI đánh số.

## 12. An toàn

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
