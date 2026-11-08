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

// ===== Lỗi do Gemini 4 Argon rà soát ngày 7/11/2026 tìm ra (và lỗi AI gắn nhầm "Câu N:") =====
const stars = text => text.split('\n').filter(l => l.startsWith('*')).length;

test('Argon #2: câu đúng/sai có cả 4 ý gạch chân thì cả 4 ý là Đúng', () => {
    const r = parseAssembled(['Câu 1: Xét:', '⟦U⟧a) 1+1=2⟦/U⟧', '⟦U⟧b) 2+2=4⟦/U⟧', '⟦U⟧c) 3+3=6⟦/U⟧', '⟦U⟧d) 4+4=8⟦/U⟧'], 'TOOOO');
    assert.equal(answerOf(r.questions[0]), 'ĐĐĐĐ');
});

test('Argon #2: câu đúng/sai có 2 ý in đậm cả nội dung thì 2 ý đó là Đúng', () => {
    const r = parseAssembled(['Câu 1: Xét:', '⟦B⟧a) Ý một đúng⟦/B⟧', 'b) Ý hai', '⟦B⟧c) Ý ba đúng⟦/B⟧', 'd) Ý bốn'], 'TOOOO');
    assert.equal(answerOf(r.questions[0]), 'ĐSĐS');
});

test('Argon #3: câu trắc nghiệm có 3 phương án tô màu không đoán đáp án', () => {
    assert.equal(stars(build(['Câu 1: a?', '⟦CLR⟧A.⟦/CLR⟧ x', '⟦CLR⟧B.⟦/CLR⟧ y', '⟦CLR⟧C.⟦/CLR⟧ z', 'D. t'], 'QOOOO').text), 0);
});

test('Argon #3: câu trắc nghiệm có hai loại đánh dấu chỉ vào hai phương án khác nhau thì không đoán', () => {
    assert.equal(stars(build(['Câu 1: a?', '⟦U⟧A. x⟦/U⟧', 'B. y', '⟦HL⟧C. z⟦/HL⟧', 'D. t'], 'QOOOO').text), 0);
});

test('Argon #3: chữ cái in đậm kiểu Markdown **A.** ở mọi phương án không phải đáp án', () => {
    assert.equal(stars(build([...fn('prepareLines')('Câu 1: a?\n**A.** Huế\n**B.** Hà Nội\n**C.** Vinh')], 'QOOO').text), 0);
});

test('Argon #3: chỉ một phương án in đậm cả dòng kiểu Markdown thì đó là đáp án', () => {
    const r = parseAssembled([...fn('prepareLines')('Câu 1: Thủ đô?\nA. Huế\n**B. Hà Nội**\nC. Vinh')], 'QOOO');
    assert.equal(answerOf(r.questions[0]), 'B');
});

test('Argon #3: dấu nhân ở cuối dòng rồi xuống dòng không bị hiểu là đáp án', () => {
    const r = build(['Câu 1: Phép tính nào đúng?', 'A. 2 *', '3 = 5', 'B. 2 * 3 = 6'], 'QOCO');
    assert.equal(stars(r.text), 0);
    assert.deepEqual([...r.unanswered], [1]);
});

test('Argon #3: dấu (*) ở dòng nối tiếp của phương án vẫn được tính', () => {
    const r = parseAssembled(['Câu 1: Chọn câu đúng', 'A. Dòng một', 'của phương án A (*)', 'B. Phương án B'], 'QOCO');
    assert.equal(answerOf(r.questions[0]), 'A');
});

test('Argon #4: lời giải nhiều dòng không lọt vào đề bài, đáp án lấy theo "Chọn D"', () => {
    const lines = ['Câu 1: Tìm a biết 2a = 4?', 'A. 1', 'B. 3', 'C. 4', 'D. 2', 'Lời giải:', 'Suy ra a = 2. Chọn D.'];
    assert.deepEqual([...fn('labelLinesLocally')(lines)], labels('QOOOODD'));
    const r = parseAssembled(lines, 'QOOOODD');
    assert.equal(answerOf(r.questions[0]), 'D');
    assert.ok(!plainText(r.questions[0].title).includes('Suy ra'));
});

test('Argon #4: dòng đáp án không có từ khoá vẫn được hiểu là lời giải, không nối vào phương án D', () => {
    const r = parseAssembled(['Câu 1: 2+2?', 'A. 3', 'B. 4', 'C. 5', 'D. 6', 'Ta có 2 + 2 = 4 nên chọn B.'], 'QOOOOD');
    assert.equal(answerOf(r.questions[0]), 'B');
    assert.equal(plainText(r.questions[0].options[3].text), '6');
});

test('Argon #5: dòng bắt đầu bằng "Phần lớn", "Phần mềm" không phải tiêu đề phần', () => {
    assert.deepEqual([...fn('labelLinesLocally')(['Câu 1: Đặc điểm địa hình?', 'Phần lớn diện tích là đồi núi.', 'A. Đúng', '*B. Sai'])], labels('QSOO'));
    assert.deepEqual([...fn('labelLinesLocally')(['Câu 1: Phần mềm nào?', 'A. Word', '*B. Excel', 'Phần mềm diệt virus'])], labels('QOOC'));
});

test('Argon #6: đề có hai mã đề chỉ giữ mã đề đầu', () => {
    const lines = ['Mã đề 101', 'Câu 1: a?', 'A. x', '*B. y', 'Mã đề 102', 'Câu 1: a?', '*A. y', 'B. x'];
    const r = fn('keepFirstExamCode')(lines);
    assert.deepEqual([...r.lines], lines.slice(0, 4));
    assert.equal(r.cut, true);
    assert.equal(fn('keepFirstExamCode')(lines.slice(0, 4)).cut, false);
});

test('Argon #8: đoạn văn đọc hiểu được AI gắn là đầu câu vẫn đi vào câu kế tiếp', () => {
    const r = build(['Câu 4: 1+1?', 'A. 1', '*B. 2', 'Đọc đoạn văn sau và trả lời câu 5:', 'Nước sôi ở 100 độ C.', 'Câu 5: Nước sôi ở mấy độ?', '*A. 100', 'B. 50'], 'QOOQSQOO');
    assert.equal(r.withoutOptions, 0);
    assert.match(r.text, /Câu 5: Đọc đoạn văn sau và trả lời câu 5:\nNước sôi ở 100 độ C\.\nNước sôi ở mấy độ\?/);
});

test('Argon #9: giữ số câu thập phân và số La Mã', () => {
    assert.deepEqual(build(['Câu 1.1: a?', 'A. 1', '*B. 2', 'Câu 1.2: b?', '*A. 3', 'B. 4'], 'QOOQOO').text.match(/^Câu [^:]+:/gm), ['Câu 1.1:', 'Câu 1.2:']);
    assert.equal(build(['Câu II: a?', 'A. 1', '*B. 2'], 'QOO').text.split('\n')[0], 'Câu II: a?');
});

test('Argon #10: chunkLines không cắt ở dòng phát biểu "1. ..." hay dòng bảng đáp án "15. B"', () => {
    const lines = ['Câu 1: ' + 'x'.repeat(60), 'A. a', 'B. b', 'Câu 2: Cho các phát biểu:', '1. Phát biểu thứ nhất khá dài', '2. Phát biểu hai', 'A. 1', 'B. 2', 'ĐÁP ÁN', '1. A', '2. B'];
    for (const c of fn('chunkLines')(lines, 100)) assert.match(c.lines[0], /^(Câu \d+:|ĐÁP ÁN)/, c.lines[0]);
});

test('Argon #11: phương án không có chữ cái, chỉ gạch chân một từ đầu dòng thì không phải đáp án', () => {
    assert.equal(stars(build(['Câu 1: Câu nào sai?', '- ⟦U⟧Anh⟦/U⟧ trai tôi đang học ở trường đại học quốc gia', '- Chị gái tôi đang làm việc tại ngân hàng', '- Mẹ tôi là giáo viên trường trung học'], 'QOOO').text), 0);
});

test('AI gắn nhầm "Câu N:" là nội dung câu hỏi thì code sửa lại thành câu mới (đề THPT 2022)', () => {
    const lines = ['Câu 83: a?', 'A. 1', 'B. 2', 'Câu 84: b?', 'A. 3', 'B. 4', 'Câu 9 trong sách: không phải câu mới'];
    const fixed = fn('reconcileLabels')(lines, labels('QOOSOOS'));
    assert.deepEqual([...fixed], labels('QOOQOOS'));
});

test('AI gắn "phuong_an" cho dòng không có chữ cái giữa các phương án có chữ cái thì coi là dòng nối tiếp', () => {
    const lines = ['Câu 1: a?', 'A. Cây hoa đỏ : 3 cây', 'hoa đỏ : 5 cây hoa trắng.', 'B. Khác'];
    assert.deepEqual([...fn('reconcileLabels')(lines, labels('QOOO'))], labels('QOCO'));
});

test('Argon #1: bảng đáp án có tiêu đề "ĐÁP ÁN TRẮC NGHIỆM" vẫn được áp', () => {
    const r = parseAssembled(['Câu 1: Pháp?', 'A. Berlin', 'B. Paris', 'Câu 2: Ý?', 'A. Rome', 'B. Paris', 'ĐÁP ÁN TRẮC NGHIỆM', '1.B 2.A'], 'QOOQOOKK');
    assert.deepEqual([...r.questions].map(answerOf), ['B', 'A']);
});

test('Argon #1: bảng đáp án câu đúng/sai "Câu 1: ĐSĐS" vẫn được áp', () => {
    const r = parseAssembled(['Câu 1: Xét các phát biểu', 'a) Phát biểu một', 'b) Phát biểu hai', 'c) Phát biểu ba', 'd) Phát biểu bốn', 'BẢNG ĐÁP ÁN PHẦN II', 'Câu 1: ĐSĐS'], 'TOOOOKK');
    assert.equal(answerOf(r.questions[0]), 'ĐSĐS');
});

test('"Đáp án:" rồi xuống dòng chữ cái đáp án vẫn được đọc (không thêm tiền tố vào dòng chữ cái)', () => {
    const r = parseAssembled(['Câu 1: Thủ đô?', 'A. Huế', 'B. Hà Nội', 'Đáp án:', 'B'], 'QOODD');
    assert.equal(answerOf(r.questions[0]), 'B');
    assert.deepEqual([...r.unanswered], []);
});

// Đường chuyển file đầy đủ với bộ gắn nhãn dự phòng, như convertRawFile khi không gọi được AI.
function convertLocally(raw) {
    const exam = fn('keepFirstExamCode')(fn('prepareLines')(raw));
    const out = fn('assembleQuizText')(exam.lines, fn('labelLinesLocally')(exam.lines));
    const parsed = app.parse(out.text);
    // Mảng tạo trong node:vm khác "realm" nên chép ra mảng thường để so sánh chặt được.
    return { ...out, cut: exam.cut, ok: parsed.ok, questions: [...parsed.questions] };
}

test('Tiêu đề trang lặp lại cùng mã đề (chép từ PDF) không cắt đề và không dính vào phương án', () => {
    const r = convertLocally('Mã đề thi 101\nCâu 1: Một?\nA. x\n*B. y\nC. z\nD. t\nTrang 1/3 - Mã đề 101\nCâu 2: Hai?\n*A. x\nB. y\nMã đề thi 101 - Trang 2/3\nC. z\nD. t\nMã đề thi 101                Trang 3/3\nCâu 3: Ba?\nA. x\nB. y\n*C. z\nD. t');
    assert.equal(r.cut, false);
    assert.deepEqual(r.questions.map(answerOf), ['B', 'A', 'C']);
    assert.deepEqual(r.questions.map(q => q.options.length), [4, 4, 4]);
    assert.equal(plainText(r.questions[0].options[3].text), 't');
    assert.equal(plainText(r.questions[1].options[1].text), 'y');
});

test('Mã đề xuất hiện sau khi đề đã bắt đầu (chỉ có ở chân trang 1) mà số câu chạy tiếp thì không cắt', () => {
    const r = convertLocally('Câu 1: Một?\nA. x\n*B. y\nMã đề 101\nCâu 2: Hai?\n*A. x\nB. y');
    assert.equal(r.cut, false);
    assert.deepEqual(r.questions.map(answerOf), ['B', 'A']);
});

test('Không có mã đề đầu, gặp mã đề rồi số câu bắt đầu lại từ 1 thì là đề thứ hai', () => {
    const r = convertLocally('Câu 1: Một?\nA. x\n*B. y\nCâu 2: Hai?\n*A. x\nB. y\nMã đề 102\nCâu 1: Hai?\nA. y\n*B. x');
    assert.equal(r.cut, true);
    assert.deepEqual(r.questions.map(answerOf), ['B', 'A']);
});

test('Danh sách (a)/(b)/(c) và a)/b)/c) trong đề bài không thành phương án (đường chuyển file)', () => {
    const r = convertLocally('Câu 1: Cho các thí nghiệm sau:\n(a) Cho Na vào nước.\n(b) Cho Fe vào dung dịch HCl.\n(c) Cho Cu vào dung dịch HCl.\nSố thí nghiệm có khí thoát ra là\nA. 1\n*B. 2\nC. 3\nD. 0\nCâu 2: Cho các chất sau:\na) NaCl\nb) HCl\nc) NaOH\nCó bao nhiêu chất là axit?\n*A. 1\nB. 2\nC. 3\nD. 0');
    assert.deepEqual(r.questions.map(answerOf), ['B', 'A']);
    assert.deepEqual(r.questions.map(q => q.options.length), [4, 4]);
    const title = plainText(r.questions[0].title);
    for (const part of ['Cho Na vào nước.', 'Cho Cu vào dung dịch HCl.', 'Số thí nghiệm có khí thoát ra là']) assert.ok(title.includes(part), title);
});

test('Đáp án đúng/sai hai dòng và lời giải từng ý vẫn đọc đúng sau khi dựng đề (đường chuyển file)', () => {
    const stmts = 'a) Hàm số chẵn\nb) Đồ thị đi qua điểm (1; 2)\nc) Hàm số có cực tiểu\nd) Hàm số đồng biến trên R';
    const r = convertLocally(`câu hỏi đúng sai: Câu 1: Cho hàm số y = x².\n${stmts}\nĐáp án: a) Đúng, b) Sai\nc) Đúng, d) Sai\ncâu hỏi đúng sai: Câu 2: Cho hàm số y = x².\n${stmts}\nLời giải:\na) Đúng. Vì f(-x) = f(x).\nb) Sai. Vì f(1) = 1.\nc) Đúng. Vì hàm số đạt cực tiểu tại x = 0.\nd) Sai. Vì hàm số nghịch biến trên (-∞; 0).`);
    assert.deepEqual(r.questions.map(answerOf), ['ĐSĐS', 'ĐSĐS']);
    assert.deepEqual(r.questions.map(q => q.options.length), [4, 4]);
});

test('Ý đúng/sai có f(x) hay "1 s" không bị cắt (đường chuyển file)', () => {
    const r = convertLocally('câu hỏi đúng sai: Câu 1: Cho hàm số y = f(x).\n*a) Hàm số liên tục trên R\nb) Hàm số có 2 cực trị\n*c) Trên khoảng (1; 2) f(x) > 0\nd) Đồ thị đi qua gốc tọa độ');
    assert.deepEqual(r.questions.map(answerOf), ['ĐSĐS']);
});

test('"**" trong biểu thức (x**2, 2**3) không phải in đậm Markdown, không thành đáp án', () => {
    const r = convertLocally('Câu 1: Biểu thức nào bằng x bình phương?\nA. x**2\nB. x**2 + y**2\nC. 2**x\nD. x*2');
    assert.deepEqual([...r.unanswered], [1]);
    assert.ok(!/^\*/m.test(r.text), r.text);
    assert.ok(r.text.includes('B. x**2 + y**2'), r.text);
});

test('Các bước "1. … 2. …" trong lời giải không thành câu hỏi mới, đáp án "Vậy chọn B" vẫn được đọc', () => {
    const r = convertLocally('Câu 1: a?\nA. a\nB. b\nC. c\nD. d\nLời giải\nTa thực hiện:\n1. Đặt t = x\n2. Giải phương trình\nVậy chọn B.\nCâu 2: b?\nA. a\nB. b\nChọn A');
    assert.deepEqual(r.questions.map(answerOf), ['B', 'A']);
    assert.deepEqual([...r.unanswered], []);
});

test('Đề đánh số trần: câu mới ngay sau dòng đáp án vẫn là câu mới', () => {
    const r = convertLocally('1. Một?\nA. x\nB. y\nĐáp án: B\n2. Hai?\nA. x\nB. y\nĐáp án: A');
    assert.deepEqual(r.questions.map(answerOf), ['B', 'A']);
});

test('reconcileLabels biết số câu của phần trước nên sửa được dòng đầu của phần sau', () => {
    const out = fn('reconcileLabels')(['Câu 66: Hỏi?', 'A. a', 'B. b'], ['noi_dung_cau_hoi', 'phuong_an', 'phuong_an'], 65);
    assert.equal(out[0], 'cau_hoi');
});

test('chunkLines không cắt ở dòng bảng đáp án "Câu 35: D"', () => {
    const lines = [];
    for (let n = 1; n <= 40; n++) lines.push(`Câu ${n}: Nội dung câu hỏi số ${n} khá dài để chia phần?`, 'A. một', 'B. hai', 'C. ba', 'D. bốn');
    lines.push('ĐÁP ÁN');
    for (let n = 1; n <= 40; n++) lines.push(`Câu ${n}: ${'ABCD'[n % 4]}`);
    // Ngưỡng 3500 làm điểm cắt thường rơi vào giữa bảng đáp án (nhưng chưa tới giới hạn cứng 1,5 lần).
    const chunks = fn('chunkLines')(lines, 3500);
    for (const c of chunks.slice(1)) assert.ok(!/^Câu \d+: [A-D]$/.test(c.lines[0]), c.lines[0]);
});

test('Phương án cách nhau bằng tab rồi dấu cách vẫn được tách', () => {
    const lines = fn('prepareLines')('Câu 1: 2+2?\nA. 3\t B. 4\t C. 5\t D. 6');
    assert.deepEqual([...lines], ['Câu 1: 2+2?', 'A. 3', 'B. 4', 'C. 5', 'D. 6']);
});

test('Phương án viết liền số sau chữ cái ("A.2", "D.50") vẫn là phương án', () => {
    const r = convertLocally('Câu 1: Giá trị của x?\nA.2\nB.3\nC.4\n*D.50\nCâu 2: Tổng?\nA.2    B.3    C.4    *D.50');
    assert.deepEqual(r.questions.map(q => q.options.length), [4, 4]);
    assert.deepEqual(r.questions.map(answerOf), ['D', 'D']);
});

test('Dấu * sát chữ cái ("B*.", "(*B)") và "(*)" ngay sau chữ cái vẫn là đáp án (đường chuyển file)', () => {
    for (const line of ['B*. Hà Nội', '(*B) Hà Nội', 'B. (*) Hà Nội']) {
        const r = convertLocally(`Câu 1: Thủ đô?\nA. Huế\n${line}\nC. Vinh\nD. Đà Nẵng`);
        assert.deepEqual(r.questions.map(answerOf), ['B'], line);
        assert.deepEqual([...r.unanswered], [], line);
    }
});

test('Bảng đáp án theo phần "Phần 1: 1.A 2.B" vẫn được đọc (đường chuyển file)', () => {
    const r = convertLocally('Câu 1: Một?\nA. x\nB. y\nCâu 2: Hai?\nA. x\nB. y\nĐÁP ÁN\nPhần 1: 1.A 2.B');
    assert.deepEqual(r.questions.map(answerOf), ['A', 'B']);
});

test('Phương án "Cả a, b, c đều đúng" (chữ thường) không bị xáo trộn chỗ', () => {
    app.parse('Câu 1: Chọn?\nA. x\nB. y\nC. z\n*D. Cả a, b, c đều đúng');
    assert.equal(app.run('originalQuestions[0].hasLetterRef'), true);
});

test('AI gắn câu hỏi chính sau bảng số liệu ("Vẽ biểu đồ…") là đầu câu mới thì code nối lại vào câu (đề Địa thật)', () => {
    const lines = ['Câu 2. Cho bảng số liệu sau đây:', 'Năm 1990 1995 2000', 'GDP 41,9 228,9 441,7', 'Vẽ biểu đồ thích hợp nhất thể hiện sự thay đổi GDP là?', 'A. Biểu đồ Miền', '*B. Biểu đồ Cột', 'C. Biểu đồ Tròn', 'D. Biểu đồ Đường'];
    const fixed = fn('reconcileLabels')(lines, labels('QSSQOOOO'));
    const out = fn('assembleQuizText')(lines, fixed);
    const parsed = app.parse(out.text);
    assert.equal(parsed.questions.length, 1);
    assert.equal(answerOf(parsed.questions[0]), 'B');
    assert.ok(plainText(parsed.questions[0].title).includes('GDP 41,9'), out.text);
    assert.equal(out.withoutOptions, 0);
});

test('"***B. Hà Nội***" (đậm nghiêng Markdown) vẫn là đáp án B ở đường chuyển file', () => {
    const r = convertLocally('Câu 1: Thủ đô của Việt Nam là gì?\nA. Huế\n***B. Hà Nội***\nC. Đà Nẵng\nD. Cần Thơ');
    assert.deepEqual(r.questions.map(answerOf), ['B']);
    assert.deepEqual(r.questions.map(q => q.options.length), [4]);
});

test('Câu đánh số trần ngay sau dòng đáp án, có danh sách "1) 2)" trong đề bài, giữ đủ đề bài', () => {
    const r = convertLocally('1. Câu một?\nA. x\nB. y\nĐáp án: B\n2. Cho các phát biểu sau:\n1) Phát biểu một.\n2) Phát biểu hai.\nSố phát biểu đúng là:\nA. 1\n*B. 2');
    assert.deepEqual(r.questions.map(answerOf), ['B', 'B']);
    const title = plainText(r.questions[1].title);
    for (const part of ['Cho các phát biểu sau:', 'Phát biểu một.', 'Số phát biểu đúng là:']) assert.ok(title.includes(part), title);
});

test('reconcileLabels không đổi câu hỏi "C. Mác và Ph. Ăng-ghen…" (AI gắn đúng là câu) thành phương án', () => {
    const lines = ['Thủ đô của Việt Nam là gì?', 'A. Huế', '*B. Hà Nội', 'C. Đà Nẵng', 'D. Cần Thơ', 'C. Mác và Ph. Ăng-ghen đã sáng lập học thuyết nào?', '*A. Chủ nghĩa xã hội khoa học', 'B. Thuyết tương đối', 'C. Thuyết tiến hóa', 'D. Định luật vạn vật hấp dẫn'];
    const out = fn('reconcileLabels')(lines, labels('QOOOOQOOOO'));
    assert.equal(out[5], 'cau_hoi');
    // AI gắn nhầm "B. 2" (phương án tiếp theo của dãy) là đầu câu thì vẫn sửa thành phương án.
    assert.equal(fn('reconcileLabels')(['Câu 1: x?', 'A. 1', 'B. 2', 'C. 3'], labels('QOQO'))[2], 'phuong_an');
});

test('Cả câu một dòng kèm "Đáp án đúng: B" cuối dòng: có đáp án và không bị báo "chưa có đáp án"', () => {
    const r = convertLocally('Câu 1: 2 + 2 = ?\tA. 3\tB. 4\tC. 5\tD. 6\tĐáp án đúng: B');
    assert.deepEqual(r.questions.map(answerOf), ['B']);
    assert.deepEqual([...r.unanswered], []);
});

test('Chân trang "Trang 1/2 - Mã đề 101" rồi Phần II đánh số lại: không cắt đề (đường chuyển file)', () => {
    const r = convertLocally('PHẦN I. TRẮC NGHIỆM\nCâu 1: Một?\nA. x\n*B. y\nCâu 2: Hai?\n*A. x\nB. y\nTrang 1/2 - Mã đề 101\nPHẦN II. ĐÚNG SAI\nMã đề 101 - Trang 2/2\ncâu hỏi đúng sai: Câu 1: Ba?\n*a) Ý một\nb) Ý hai\n*c) Ý ba\nd) Ý bốn');
    assert.equal(r.cut, false);
    assert.deepEqual(r.questions.map(answerOf), ['B', 'A', 'ĐSĐS']);
});

test('Tiêu đề trang "Mã đề 101 - Trang 2/2" trong phần đánh số lại không cắt đề (đường chuyển file, không có mã ở đầu)', () => {
    const r = convertLocally('PHẦN I. TRẮC NGHIỆM\nCâu 1: Một?\nA. x\n*B. y\nCâu 2: Hai?\n*A. x\nB. y\nCâu 3: Ba?\nA. x\n*B. y\nPHẦN II. TRẮC NGHIỆM\nCâu 1: Bốn?\n*A. x\nB. y\nMã đề 101 - Trang 2/2\nCâu 2: Năm?\nA. x\n*B. y');
    assert.equal(r.cut, false);
    assert.deepEqual(r.questions.map(answerOf), ['B', 'A', 'B', 'A', 'B']);
});

test('Đề thứ hai không ghi "Trang" (Mã đề 102, số câu bắt đầu lại, không có tiêu đề phần) vẫn bị cắt', () => {
    const r = convertLocally('Câu 1: Một?\nA. x\n*B. y\nCâu 2: Hai?\n*A. x\nB. y\n----- HẾT -----\nMã đề 102\nCâu 1: Hai?\nA. y\n*B. x');
    assert.equal(r.cut, true);
    assert.deepEqual(r.questions.map(answerOf), ['B', 'A']);
});

test('AI gắn nhầm ý b) là dòng đáp án: các ý còn lại vẫn nhận đúng Đ/S theo chữ cái, không bị lệch', () => {
    const lines = ['câu hỏi đúng sai: Câu 1: Xét các phát biểu', 'a) Ý một.', 'b) Ý hai.', 'c) Ý ba.', 'd) Ý bốn.', 'Đáp án: a) Sai, b) Đúng', 'c) Đúng, d) Sai'];
    const out = fn('assembleQuizText')(lines, labels('TODOODD'));
    const q = app.parse(out.text).questions[0];
    // Câu còn ý a, c, d: a Sai, c Đúng, d Sai (không phải a Sai, c Đúng(b), d Đúng(c)).
    assert.deepEqual([...q.options].map(o => plainText(o.text)), ['Ý một.', 'Ý ba.', 'Ý bốn.']);
    assert.equal(answerOf(q), 'SĐS');
});

test('AI gắn nhầm phương án C là dòng nối tiếp: "Đáp án: D" vẫn là phương án D (theo chữ cái), không lệch sang C', () => {
    const lines = ['Câu 1: Thủ đô?', 'A. Huế', 'B. Vinh', 'C. Đà Nẵng', 'D. Hà Nội', 'Đáp án: D'];
    const out = fn('assembleQuizText')(lines, labels('QOOCOD'));
    const q = app.parse(out.text).questions[0];
    const correct = [...q.options].filter(o => o.isCorrect).map(o => plainText(o.text));
    assert.deepEqual(correct, ['Hà Nội']);
});

test('Câu bị gộp (chữ cái phương án lặp A–D rồi A–D): "Đáp án: B" mơ hồ nên không gán', () => {
    const r = app.parse('Câu 1: Một?\nA. x\nB. y\nC. z\nD. t\nA. p\nB. q\nC. r\nD. s\nĐáp án: B\nCâu 2: Hai?\n*A. x\nB. y');
    assert.deepEqual([...r.questions].map(q => plainText(q.title)), ['Hai?']);
});

test('reconcileLabels: dòng "PHẦN II. TRẮC NGHIỆM" bị AI gắn là nội dung thì thành bỏ qua', () => {
    const out = fn('reconcileLabels')(['Câu 1: x?', 'A. 1', 'B. 2', 'PHẦN II. TRẮC NGHIỆM', 'Câu 1: y?'], labels('QOOSQ'));
    assert.equal(out[3], 'bo_qua');
});

test('reconcileLabels: dòng có tiền tố "câu hỏi đúng sai:" mà AI gắn là câu trắc nghiệm thì thành câu đúng/sai', () => {
    const out = fn('reconcileLabels')(['câu hỏi đúng sai: Câu 1: Xét', 'a) Ý một.', 'b) Ý hai.'], labels('QOO'));
    assert.equal(out[0], 'cau_hoi_dung_sai');
});

test('reconcileLabels: phương án kế tiếp ("B. …") bị AI gắn là dòng nối tiếp của A thì thành phương án', () => {
    const lines = ['Câu 1: Thủ đô?', 'A. Huế', '⟦U⟧B. Hà Nội⟦/U⟧', 'C. Vinh', 'D. Đà Nẵng'];
    const fixed = fn('reconcileLabels')(lines, labels('QOCOO'));
    assert.equal(fixed[2], 'phuong_an');
    const q = app.parse(fn('assembleQuizText')(lines, fixed).text).questions[0];
    assert.equal(answerOf(q), 'B');
});

test('reconcileLabels: dòng "**Đáp án: C**" sau các phương án bị AI gắn là dòng nối tiếp thì thành dòng đáp án', () => {
    const lines = ['Câu 1: x?', 'A.10', 'B.17', 'C.24', 'D.31', '⟦B⟧Đáp án: C⟦/B⟧'];
    const fixed = fn('reconcileLabels')(lines, labels('QOOOOC'));
    assert.equal(fixed[5], 'dap_an');
    assert.equal(answerOf(app.parse(fn('assembleQuizText')(lines, fixed).text).questions[0]), 'C');
});

test('Đề đánh số trần nhảy số (1 rồi 3) ngay sau dòng đáp án vẫn đọc được câu 3 (đường chuyển file)', () => {
    const r = convertLocally('1. Thủ đô Pháp?\nA. Berlin\n*B. Paris\nĐáp án: B\n3. Thủ đô Ý?\nA. Berlin\n*B. Rome');
    assert.deepEqual(r.questions.map(q => plainText(q.title)), ['Thủ đô Pháp?', 'Thủ đô Ý?']);
});

test('Đề thứ hai mở đầu bằng "PHẦN I" bị cắt (đường chuyển file)', () => {
    const r = convertLocally('PHẦN I. TRẮC NGHIỆM\nCâu 1: Một?\nA. x\n*B. y\nCâu 2: Hai?\n*A. x\nB. y\nMã đề 102\nPHẦN I. TRẮC NGHIỆM\nCâu 1: Ba?\nA. x\n*B. y');
    assert.equal(r.cut, true);
    assert.equal(r.questions.length, 2);
});

test('Hội thoại "A: …", "B: …" trước phương án "A." là đề bài (đường chuyển file)', () => {
    const r = convertLocally('Câu 1: Choose the best response.\nA: "Would you like a cup of tea?"\nB: "______"\nA. Yes, please.\nB. No, I don\'t.\nC. I like it.\nD. Not at all.\nĐáp án: A\nCâu 2: Ai đề xuất thuyết tiến hoá?\nĐa-uyn: nhà tự nhiên học.\nA. Lamac\nB. Menđen\nĐA: B');
    assert.deepEqual(r.questions.map(answerOf), ['A', 'B']);
    assert.deepEqual(r.questions.map(q => q.options.length), [4, 2]);
    assert.ok(plainText(r.questions[0].title).includes('B: "______"'), r.questions[0].title);
    assert.ok(plainText(r.questions[1].title).includes('Đa-uyn: nhà tự nhiên học.'), r.questions[1].title);
});

test('reconcileLabels: dòng "câu hỏi đúng sai: Câu 1" bị gắn là dòng nối tiếp vẫn là đầu câu đúng/sai (phần đánh số lại)', () => {
    const lines = ['Phần I: trắc nghiệm', 'Câu 1: Thủ đô?', 'A. Huế', 'B. Hà Nội', 'C. Vinh', 'D. Đà Nẵng', 'PHẦN II. ĐÚNG SAI', 'câu hỏi đúng sai: Câu 1: Cho hàm số.', 'a) Ý một', 'b) Ý hai', 'c) Ý ba', 'd) Ý bốn', 'Đáp án: SĐĐS', 'BẢNG ĐÁP ÁN', '1.B'];
    const given = labels('XQOOOOXCOOOODKK');
    const fixed = [...fn('reconcileLabels')(lines, given)];
    assert.equal(fixed[7], 'cau_hoi_dung_sai');
    const out = fn('assembleQuizText')(lines, fixed);
    const parsed = app.parse(out.text);
    assert.deepEqual([...parsed.questions].map(answerOf), ['B', 'SĐĐS']);
});

test('reconcileLabels: "Câu 1" ngay sau tiêu đề "PHẦN II" bị gắn là dòng nối tiếp vẫn là đầu câu', () => {
    const lines = ['Phần I: trắc nghiệm', 'Câu 1: Một?', 'A. x', 'B. y', 'Câu 2: Hai?', 'A. x', 'B. y', 'PHẦN II. TRẮC NGHIỆM', 'Câu 1: Ba?', 'A. x', 'B. y', 'BẢNG ĐÁP ÁN', 'Phần I', '1.A 2.B', 'Phần II', '1.B'];
    const fixed = [...fn('reconcileLabels')(lines, labels('XQOOQOOXSOOKXXXK'))];
    assert.equal(fixed[8], 'cau_hoi');
    assert.equal(fixed[13], 'bang_dap_an');
    const out = fn('assembleQuizText')(lines, fixed);
    assert.deepEqual([...app.parse(out.text).questions].map(answerOf), ['A', 'B', 'B']);
});

test('reconcileLabels: tiêu đề "ĐÁP ÁN" và dòng "1.C 2.B" của bảng bị gắn là dòng đáp án vẫn thuộc bảng đáp án', () => {
    const lines = ['Phần I: trắc nghiệm', 'Câu 1: Một?', 'A. x', 'B. y', 'C. z', 'Câu 2: Hai?', 'A. x', 'B. y', 'C. z', 'PHẦN II. TRẮC NGHIỆM', 'Câu 1: Ba?', 'A. x', 'B. y', 'C. z', 'Câu 2: Bốn?', 'A. x', 'B. y', 'C. z', 'ĐÁP ÁN', '1.A 2.A', 'Phần II (3 điểm)', '1.C 2.B'];
    const fixed = [...fn('reconcileLabels')(lines, labels('XQOOOQOOOXQOOOQOOODKXD'))];
    assert.equal(fixed[18], 'bang_dap_an');
    assert.equal(fixed[21], 'bang_dap_an');
    const out = fn('assembleQuizText')(lines, fixed);
    assert.deepEqual([...app.parse(out.text).questions].map(answerOf), ['A', 'A', 'C', 'B']);
});

test('reconcileLabels: "Câu 2" gắn là phương án (không có chữ cái) hay dòng đáp án, "Đáp án: A" gắn là phương án', () => {
    const lines = ['Câu 1: Một?', 'A. x', 'B. y', '⟦B⟧Đáp án: B⟦/B⟧', 'Câu 2: Hai?', '*A. x', 'B. y', 'Câu 3: Ba?', 'A. x', 'B. y', 'Đáp án: B đúng vì A sai.', 'Câu 4: Bốn?', '⟦B⟧A. x⟦/B⟧', 'B. y', 'Câu 5: Năm?', 'A. x', 'B. y', '⟦B⟧Đáp án: A⟦/B⟧'];
    const fixed = [...fn('reconcileLabels')(lines, labels('QOODOOOQOODDOOQOOO'))];
    assert.deepEqual([fixed[4], fixed[11], fixed[17]], ['cau_hoi', 'cau_hoi', 'dap_an']);
    const out = fn('assembleQuizText')(lines, fixed);
    assert.deepEqual([...app.parse(out.text).questions].map(answerOf), ['B', 'A', 'B', 'A', 'A']);
    // Dòng "Câu 2: B" trong phần đáp án vẫn là dòng đáp án.
    const keep = [...fn('reconcileLabels')(['Câu 1: Một?', 'A. x', 'B. y', 'Câu 2: B'], labels('QOOD'))];
    assert.equal(keep[3], 'dap_an');
});

test('Bảng đáp án nhiều mã đề ở cuối file: chỉ dùng phần của mã đề đầu (đường chuyển file)', () => {
    const q = 'Câu 1: Một?\nA. a1\nB. b1\nC. c1\nD. d1\nCâu 2: Hai?\nA. a2\nB. b2\nC. c2\nD. d2';
    const inline = convertLocally(`Mã đề 102\n${q}\nĐÁP ÁN\nMã đề 101: 1.A 2.B\nMã đề 102: 1.B 2.C`);
    assert.deepEqual(inline.questions.map(answerOf), ['B', 'C']);
    const columns = convertLocally(`Mã đề 103\n${q}\nĐÁP ÁN\nCâu\t101\t102\t103\t104\n1\tA\tB\tC\tD\n2\tB\tC\tD\tA`);
    assert.deepEqual(columns.questions.map(answerOf), ['C', 'D']);
    // Hai mã đề trong một file rồi bảng đáp án chung: giữ mã đề đầu và bảng đáp án của nó.
    const two = convertLocally(`Mã đề 101\n${q}\nMã đề 102\n${q.replace(/Một/, 'Ba').replace(/Hai/, 'Bốn')}\nĐÁP ÁN\nMã đề 101: 1.D 2.A\nMã đề 102: 1.B 2.C`);
    assert.equal(two.cut, true);
    assert.deepEqual(two.questions.map(q => plainText(q.title)), ['Một?', 'Hai?']);
    assert.deepEqual(two.questions.map(answerOf), ['D', 'A']);
});
