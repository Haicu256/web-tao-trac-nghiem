// Phần logic phía trình duyệt ngoài parser: chấm điểm, chia đoạn gửi AI, nhận biết đề có đáp án.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/app.js';

const app = loadApp();

function tfQuestion(truth) {
    return { type: 'true_false', options: truth.map(isCorrect => ({ text: 'x', isCorrect })) };
}

test('câu đúng/sai 4 ý chấm theo thang 0,1 / 0,25 / 0,5 / 1', () => {
    const points = app.fn('getTFPoints');
    assert.deepEqual([0, 1, 2, 3, 4].map(n => points(n, 4)), [0, 0.1, 0.25, 0.5, 1]);
});

test('câu đúng/sai không đủ 4 ý chấm theo tỉ lệ', () => {
    assert.equal(app.fn('getTFPoints')(2, 3), 2 / 3);
});

test('điểm cả bài cộng trắc nghiệm và đúng/sai, làm tròn 2 chữ số', () => {
    app.run(`finalQuestions = ${JSON.stringify([
        { type: 'multiple_choice', options: [{ isCorrect: false }, { isCorrect: true }] },
        tfQuestion([true, false, true, false]),
    ])}`);
    app.run(`selectedAnswers = { 0: 1, 1: { 0: { dung: true, sai: false }, 1: { dung: false, sai: true }, 2: { dung: false, sai: true } } }`);
    const score = app.fn('calculateScore')();
    assert.deepEqual({ ...score }, { points: 1.25, total: 2, percentage: 63 });
});

test('chọn chỉ số đáp án không tồn tại không làm lỗi và không được điểm', () => {
    app.run(`finalQuestions = [{ type: 'multiple_choice', options: [{ isCorrect: true }] }]; selectedAnswers = { 0: 7 };`);
    assert.equal(app.fn('calculateScore')().points, 0);
});

test('chia đoạn: bảng đáp án viết cùng dòng được gắn vào mọi đoạn', () => {
    let body = '';
    for (let i = 1; i <= 6; i++) body += `Câu ${i}: Câu hỏi số ${i} khá dài để chia đoạn?\nA. Một\nB. Hai\nC. Ba\nD. Bốn\n`;
    const chunks = app.fn('splitIntoChunks')(body + 'Đáp án: 1B 2C 3A 4D 5B 6C', 200);
    assert.ok(chunks.length >= 2);
    chunks.forEach((c, i) => assert.ok(c.includes('6C'), `đoạn ${i + 1} thiếu bảng đáp án`));
});

test('chia đoạn: không cắt giữa một câu hỏi', () => {
    let body = '';
    for (let i = 1; i <= 10; i++) body += `Câu ${i}: Nội dung câu hỏi ${i}?\nA. Một\nB. Hai\nC. Ba\nD. Bốn\n`;
    const chunks = app.fn('splitIntoChunks')(body, 150);
    chunks.forEach(c => assert.match(c, /^Câu \d+:/, 'mỗi đoạn phải bắt đầu bằng một câu hỏi'));
});

test('nhận biết đề đã có đáp án', () => {
    const hasHint = app.fn('checkTextHasAnswerHint');
    assert.equal(hasHint('Câu 1: a?\nA. x\n*B. y'), true);
    assert.equal(hasHint('Câu 1: a?\nA. x\nB. y\nĐáp án: B'), true);
    assert.equal(hasHint('Câu 1: a?\nA. x\n⟦U⟧B. y⟦/U⟧\nC. z'), true);
    assert.equal(hasHint('Câu 1: a?\nA. x\nB. y\nC. z'), false);
});

test('đề gốc không có đáp án: bỏ mọi dấu * AI tự thêm và đếm số dấu đã bỏ', () => {
    const ai = 'Câu 1: Thủ đô?\nA. Huế\n*B. Hà Nội\nC. Vinh\n\ncâu hỏi đúng sai: Câu 2: Xét\n*A. p\nB. q\n  * C. r\nD. s';
    const { text, removedMarks } = app.fn('finalizeConvertedText')(ai, false);
    assert.equal(removedMarks, 3);
    assert.equal(text, 'Câu 1: Thủ đô?\nA. Huế\nB. Hà Nội\nC. Vinh\n\ncâu hỏi đúng sai: Câu 2: Xét\nA. p\nB. q\n  C. r\nD. s');
});

test('đề gốc có đáp án: giữ nguyên kết quả của AI', () => {
    const ai = 'Câu 1: Thủ đô?\nA. Huế\n*B. Hà Nội';
    assert.deepEqual({ ...app.fn('finalizeConvertedText')(ai, true) }, { text: ai, removedMarks: 0 });
});

test('bỏ dấu * không đụng vào dấu * nằm trong nội dung hay công thức', () => {
    const ai = 'Câu 1: Tính $a*b$\nA. 2*3\nB. $x^*$\n*C. 6';
    const { text, removedMarks } = app.fn('finalizeConvertedText')(ai, false);
    assert.equal(removedMarks, 1);
    assert.equal(text, 'Câu 1: Tính $a*b$\nA. 2*3\nB. $x^*$\nC. 6');
});

test('tên đề lấy từ tên file, bỏ đuôi file', () => {
    assert.equal(app.fn('titleFromFileName')('De thi HK1.docx'), 'De thi HK1');
});
