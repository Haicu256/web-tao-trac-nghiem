// Đường chuyển đổi mới (docs/thiet-ke/gan-nhan-dong.md): AI chỉ gắn nhãn dòng, code dựng đề từ dòng gốc
// và quyết định đáp án từ bằng chứng trong file. Các test ở đây không gọi AI: nhãn được viết tay hoặc lấy từ
// labelLinesLocally (bộ gắn nhãn dự phòng bằng regex).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, answerOf, plainText } from './helpers/app.js';

const app = loadApp();
const fn = name => app.fn(name);

// Nhãn viết tắt cho dễ đọc: Q câu hỏi, T câu đúng/sai, S nội dung câu hỏi, O phương án, C nội dung phương án,
// D dòng đáp án, K bảng đáp án, X bỏ qua.
const CODE = { Q: 'cau_hoi', T: 'cau_hoi_dung_sai', S: 'noi_dung_cau_hoi', O: 'phuong_an', C: 'noi_dung_phuong_an', D: 'dap_an', K: 'bang_dap_an', X: 'bo_qua' };
const labels = codes => codes.split('').map(c => CODE[c]);

function build(lines, codes) {
    return fn('assembleQuizText')(lines, labels(codes));
}

function parseAssembled(lines, codes) {
    const out = build(lines, codes);
    return { ...out, ...app.parse(out.text) };
}

test('prepareLines tách phương án viết cùng dòng và bỏ dòng trống', () => {
    const lines = fn('prepareLines')('Câu 1: 2+2?\n\nA. 3    B. 4    C. 5    D. 6\n');
    assert.deepEqual([...lines], ['Câu 1: 2+2?', 'A. 3', 'B. 4', 'C. 5', 'D. 6']);
});

test('prepareLines tách phương án cùng dòng khi chữ cái được in đậm (đề THPT 2022 môn Sinh)', () => {
    const lines = fn('prepareLines')('⟦B⟧A.⟦/B⟧ 2.\t⟦B⟧B.⟦/B⟧ 1.\t⟦B⟧C.⟦/B⟧ 3.\t⟦B⟧D.⟦/B⟧ 4.');
    assert.deepEqual([...lines].map(l => fn('stripFormattingTags')(l)), ['A. 2.', 'B. 1.', 'C. 3.', 'D. 4.']);
});

test('prepareLines tách khi thẻ nằm giữa chữ cái và dấu chấm, hoặc không có dấu cách sau thẻ', () => {
    const lines = fn('prepareLines')('⟦B⟧⟦HL⟧A⟦/HL⟧⟦/B⟧⟦HL⟧. Lào⟦/HL⟧\t⟦B⟧B⟦/B⟧. Huế\t⟦B⟧C.⟦/B⟧Vinh');
    assert.deepEqual([...lines].map(l => fn('stripFormattingTags')(l)), ['A. Lào', 'B. Huế', 'C.Vinh']);
});

test('prepareLines tách phương án cùng dòng dù thứ tự chữ cái bị đảo (lỗi gõ của đề gốc)', () => {
    const lines = fn('prepareLines')('⟦B⟧⟦HL⟧A.⟦/HL⟧  ⟦/B⟧⟦HL⟧Lào⟦/HL⟧\t⟦B⟧D.⟦/B⟧ Campuchia           ⟦B⟧C.⟦/B⟧Trung Quốc                   ⟦B⟧B.⟦/B⟧  Thái Lan');
    assert.deepEqual([...lines].map(l => fn('stripFormattingTags')(l).replace(/\s+/g, ' ')), ['A. Lào', 'D. Campuchia', 'C.Trung Quốc', 'B. Thái Lan']);
});

test('prepareLines tách hai phương án đảo thứ tự khi cách nhau bằng tab hoặc nhiều dấu cách', () => {
    const lines = fn('prepareLines')('A. Lào\tD. Campuchia\nC.Trung Quốc                   B.  Thái Lan');
    assert.deepEqual([...lines].map(l => l.replace(/\s+/g, ' ')), ['A. Lào', 'D. Campuchia', 'C.Trung Quốc', 'B. Thái Lan']);
});

test('prepareLines tách câu hỏi mới bị dính vào cuối dòng trước (đề THPT 2022 câu 118)', () => {
    const lines = fn('prepareLines')('D. Phép lai tạo ra F₁ có 9 loại kiểu gen. ⟦B⟧Câu 118:⟦/B⟧ Một loài thực vật lưỡng bội');
    assert.deepEqual([...lines], ['D. Phép lai tạo ra F₁ có 9 loại kiểu gen.', '⟦B⟧Câu 118:⟦/B⟧ Một loài thực vật lưỡng bội']);
});

test('prepareLines không tách khi đề bài chỉ nhắc tới "câu 5" bằng chữ thường', () => {
    const lines = fn('prepareLines')('Đọc đoạn văn sau. Trả lời câu 5: và câu 6.');
    assert.equal(lines.length, 1);
});

test('labelLinesLocally: tiêu đề phần và dòng "HẾT" là bỏ qua, không nối vào phương án', () => {
    const lines = ['Câu 1: a?', 'A. x', '*B. y', 'PHẦN II. TỰ LUẬN', 'Câu 1: Trình bày ý nghĩa', '------ HẾT ------'];
    assert.deepEqual([...fn('labelLinesLocally')(lines)], labels('QOOXQX'));
});

test('dựng đề: câu không có phương án A-D (tự luận, trả lời ngắn) không đưa vào đề và được đếm riêng', () => {
    const r = build(['Câu 1: a?', 'A. x', '*B. y', 'Câu 2: Trình bày ý nghĩa', 'Câu 3: b?', 'A. x', 'B. y'], 'QOOQQOO');
    assert.equal(r.text, 'Câu 1: a?\nA. x\n*B. y\nCâu 3: b?\nA. x\nB. y');
    assert.equal(r.questions, 2);
    assert.equal(r.withoutOptions, 1);
    assert.deepEqual([...r.unanswered], [3]);
});

test('labelLinesLocally nhận "C.Trung Quốc" (không có dấu cách) là phương án', () => {
    assert.deepEqual([...fn('labelLinesLocally')(['Câu 4: Nước nào?', 'A. Lào', 'C.Trung Quốc'])], labels('QOO'));
});

test('dựng đề: in đậm nội dung ở hai phương án trở lên thì không coi là đáp án (bằng chứng yếu)', () => {
    const r = build(['Câu 1: a?', '⟦B⟧A. x⟦/B⟧', '⟦B⟧B. y⟦/B⟧', 'C. z', 'D. t'], 'QOOOO');
    assert.ok(!r.text.includes('*'), r.text);
});

test('dựng đề: phương án không có nội dung (hình ảnh) không bao giờ thành đáp án', () => {
    const r = build(['Câu 119: Hình nào đúng?', '⟦B⟧A.⟦/B⟧', '⟦B⟧B. B.⟦/B⟧', '⟦B⟧C.⟦/B⟧', '⟦B⟧D.⟦/B⟧'], 'QOOOO');
    assert.ok(!r.text.includes('*'), r.text);
});

test('dựng đề: phương án gạch chân thành đáp án, thẻ định dạng không còn trong chữ', () => {
    const r = parseAssembled(['Câu 1: Thủ đô?', 'A. Huế', '⟦U⟧B. Hà Nội⟦/U⟧', 'C. Vinh'], 'QOOO');
    assert.equal(r.text, 'Câu 1: Thủ đô?\nA. Huế\n*B. Hà Nội\nC. Vinh');
    assert.equal(answerOf(r.questions[0]), 'B');
    assert.deepEqual([...r.unanswered], []);
});

test('dựng đề: chữ cái in đậm trang trí ở mọi phương án không phải đáp án', () => {
    const r = build(['Câu 81: Phân tử nào mang anticôđon?', '⟦B⟧A.⟦/B⟧ mARN.', '⟦B⟧B.⟦/B⟧ rARN.', '⟦B⟧C.⟦/B⟧ tARN.', '⟦B⟧D.⟦/B⟧ ADN.'], 'QOOOO');
    assert.ok(!r.text.includes('*'), r.text);
    assert.deepEqual([...r.unanswered], [81]);
});

test('dựng đề: chữ cái in đậm hết, chỉ một phương án in đậm cả nội dung thì đó là đáp án', () => {
    const r = parseAssembled(['Câu 1: Thủ đô?', '⟦B⟧A.⟦/B⟧ Huế', '⟦B⟧B. Hà Nội⟦/B⟧', '⟦B⟧C.⟦/B⟧ Vinh'], 'QOOO');
    assert.equal(answerOf(r.questions[0]), 'B');
});

test('dựng đề: tô sáng chỉ ở chữ cái đầu vẫn là đáp án', () => {
    const r = parseAssembled(['Câu 39: Bảng số liệu thể hiện gì?', '⟦B⟧⟦HL⟧A⟦/HL⟧⟦/B⟧⟦HL⟧. Quy mô sản lượng⟦/HL⟧', 'B. Cơ cấu', 'C. Tốc độ'], 'QOOO');
    assert.equal(answerOf(r.questions[0]), 'A');
    assert.equal(r.questions[0].qNum, 39);
});

test('dựng đề: cả câu cùng một màu thì không phải đáp án', () => {
    const r = build(['⟦CLR⟧Câu 1: Thủ đô?⟦/CLR⟧', '⟦CLR⟧A. Huế⟦/CLR⟧', '⟦CLR⟧B. Hà Nội⟦/CLR⟧'], 'QOO');
    assert.ok(!r.text.includes('*'));
});

test('dựng đề: gạch chân một từ nhỏ trong phương án (câu tìm lỗi sai) không phải đáp án', () => {
    const r = build(['Câu 1: Find the mistake', 'A. She ⟦U⟧go⟦/U⟧ to school every day with her friends', 'B. They are happy', 'C. We were late'], 'QOOO');
    assert.ok(!r.text.includes('*'), r.text);
});

test('dựng đề: giữ dấu * có sẵn, không thêm dấu thứ hai', () => {
    const r = parseAssembled(['Câu 1: Thủ đô?', 'A. Huế', '*⟦U⟧B. Hà Nội⟦/U⟧'], 'QOO');
    assert.equal(r.text, 'Câu 1: Thủ đô?\nA. Huế\n*B. Hà Nội');
    assert.equal(answerOf(r.questions[0]), 'B');
});

test('dựng đề: dòng đáp án sau câu được giữ để parser đọc', () => {
    const r = parseAssembled(['Câu 1: 5 x 6?', 'A. 11', 'B. 30', 'Đáp án: B'], 'QOOD');
    assert.equal(answerOf(r.questions[0]), 'B');
    assert.deepEqual([...r.unanswered], []);
});

test('dựng đề: bảng đáp án ở cuối được đưa xuống cuối đề và áp theo số câu', () => {
    const r = parseAssembled(['Câu 1: Pháp?', 'A. Berlin', 'B. Paris', 'Câu 2: Ý?', 'A. Rome', 'B. Paris', 'ĐÁP ÁN', '1.B 2.A'], 'QOOQOOKK');
    assert.deepEqual([...r.questions].map(answerOf), ['B', 'A']);
    assert.deepEqual([...r.unanswered], []);
});

test('dựng đề: đề chỉ thiếu đáp án vài câu thì chỉ những câu đó thiếu, câu khác giữ nguyên', () => {
    const r = build(['Câu 1: a?', 'A. x', '⟦U⟧B. y⟦/U⟧', 'Câu 2: b?', 'A. x', 'B. y', 'Câu 3: c?', '⟦HL⟧A. x⟦/HL⟧', 'B. y'], 'QOOQOOQOO');
    assert.deepEqual([...r.unanswered], [2]);
    assert.equal(r.text, 'Câu 1: a?\nA. x\n*B. y\nCâu 2: b?\nA. x\nB. y\nCâu 3: c?\n*A. x\nB. y');
});

test('dựng đề: câu đúng/sai có tiền tố và đánh dấu các ý được tô', () => {
    const r = parseAssembled(['Câu 1. Cho hàm số y = x².', '⟦U⟧a) Hàm số chẵn⟦/U⟧', 'b) Đồ thị qua (1;2)', '⟦U⟧c) Có cực tiểu⟦/U⟧', 'd) Đồng biến trên R'], 'TOOOO');
    assert.ok(r.text.startsWith('câu hỏi đúng sai: Câu 1: Cho hàm số y = x².'), r.text);
    assert.equal(r.questions[0].type, 'true_false');
    assert.equal(answerOf(r.questions[0]), 'ĐSĐS');
});

test('dựng đề: dòng đề bài trông như phương án hay câu hỏi được nối vào dòng trước, không tách sai', () => {
    const r = parseAssembled(['Câu 1: Cho các phát biểu:', 'a) Phát biểu một', '1. Phát biểu hai', 'Có bao nhiêu phát biểu đúng?', 'A. 1', '*B. 2'], 'QSSSOO');
    assert.equal(r.questions.length, 1);
    assert.equal(r.questions[0].options.length, 2);
    assert.ok(plainText(r.questions[0].title).includes('a) Phát biểu một'), r.questions[0].title);
});

test('dựng đề: phương án nhiều dòng được nối lại', () => {
    const r = parseAssembled(['Câu 1: Chọn câu đúng', 'A. Dòng một', 'của phương án A', '*B. Phương án B'], 'QOCO');
    assert.equal(plainText(r.questions[0].options[0].text), 'Dòng một của phương án A');
});

test('dựng đề: phương án không có chữ cái thì được đặt A, B, C theo thứ tự', () => {
    const r = build(['Câu 1: Thủ đô?', '- Huế', '⟦U⟧- Hà Nội⟦/U⟧', '- Vinh'], 'QOOO');
    assert.equal(r.text, 'Câu 1: Thủ đô?\nA. - Huế\n*B. - Hà Nội\nC. - Vinh');
});

test('dựng đề: câu không đánh số được đánh số tiếp theo câu trước', () => {
    const r = build(['Câu 5: a?', 'A. x', 'B. y', 'Thủ đô là gì?', 'A. x', 'B. y'], 'QOOQOO');
    assert.match(r.text, /\nCâu 6: Thủ đô là gì\?/);
});

test('dựng đề: dòng bỏ qua (tiêu đề, ma trận, tự luận) không xuất hiện trong đề', () => {
    const r = build(['SỞ GD&ĐT', 'Câu 1: a?', 'A. x', '*B. y', 'PHẦN II. TỰ LUẬN', 'Câu 1: Trình bày...'], 'XQOOXX');
    assert.equal(r.text, 'Câu 1: a?\nA. x\n*B. y');
});

test('dựng đề: mọi chữ trong đề dựng ra đều có trong file gốc (AI không thể thêm chữ)', () => {
    const lines = ['Câu 3: Tính $\\frac{1}{2}$ của 10', '⟦B⟧A.⟦/B⟧ 5', 'B. 2', 'Lời giải: Chọn A', 'ĐÁP ÁN', '3.A'];
    const r = build(lines, 'QOODKK');
    const source = lines.join('\n').replace(/⟦\/?(?:B|U|HL|CLR)⟧/g, '');
    for (const line of r.text.split('\n')) {
        const body = line.replace(/^câu hỏi đúng sai:\s*/, '').replace(/^Câu \d+:\s*/, '').replace(/^\*?[A-F]\.\s*/, '').replace(/^BẢNG ĐÁP ÁN$/, '');
        assert.ok(body === '' || source.includes(body), `"${line}" không có trong file gốc`);
    }
});

test('labelsFromRanges đổi đoạn nhãn thành nhãn từng dòng, từ chối đoạn sót hoặc trùng', () => {
    const to = fn('labelsFromRanges');
    assert.deepEqual([...to([{ tu: 1, den: 1, loai: 'cau_hoi' }, { tu: 2, den: 3, loai: 'phuong_an' }], 3)], ['cau_hoi', 'phuong_an', 'phuong_an']);
    assert.equal(to([{ tu: 1, den: 1, loai: 'cau_hoi' }, { tu: 3, den: 3, loai: 'phuong_an' }], 3), null);
    assert.equal(to([{ tu: 1, den: 2, loai: 'cau_hoi' }, { tu: 2, den: 3, loai: 'phuong_an' }], 3), null);
});

test('labelLinesLocally gắn nhãn đề chuẩn giống người', () => {
    const lines = ['TRƯỜNG THPT A', 'Câu 1: Thủ đô?', 'A. Huế', '*B. Hà Nội', 'câu hỏi đúng sai: Câu 2: Xét', 'A. p', 'B. q', 'Đáp án: a) Đ b) S', 'ĐÁP ÁN', '1.B'];
    assert.deepEqual([...fn('labelLinesLocally')(lines)], labels('XQOOTOODKK'));
});

test('labelLinesLocally: dòng "1. B" trong bảng đáp án không bị hiểu là câu hỏi', () => {
    const lines = ['Câu 1: Pháp?', 'A. Berlin', 'B. Paris', 'Câu 2: Ý?', 'A. Rome', 'B. Paris', 'ĐÁP ÁN', '1. B', '2. A', 'Câu\tĐáp án', '3\tC'];
    assert.deepEqual([...fn('labelLinesLocally')(lines)], labels('QOOQOOKKKKK'));
});

test('labelLinesLocally: dòng tiếp theo của đề bài và của phương án', () => {
    const lines = ['Câu 1: Cho bảng số liệu', 'Năm 2005 2010', 'Bảng trên thể hiện gì?', 'A. Quy mô', 'sản lượng', 'B. Cơ cấu'];
    assert.deepEqual([...fn('labelLinesLocally')(lines)], labels('QSSOCO'));
});

test('chunkLines chỉ cắt ở đầu câu hỏi và giữ vị trí dòng gốc', () => {
    const lines = [];
    for (let i = 1; i <= 8; i++) lines.push(`Câu ${i}: Nội dung câu hỏi số ${i} khá dài`, 'A. Một', 'B. Hai');
    const chunks = fn('chunkLines')(lines, 120);
    assert.ok(chunks.length >= 3);
    let expectedStart = 0;
    for (const c of chunks) {
        assert.equal(c.start, expectedStart);
        assert.match(c.lines[0], /^Câu \d+:/);
        expectedStart += c.lines.length;
    }
    assert.equal(expectedStart, lines.length);
});
