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

test('nhận biết đề đã có đáp án', () => {
    const hasHint = app.fn('checkTextHasAnswerHint');
    assert.equal(hasHint('Câu 1: a?\nA. x\n*B. y'), true);
    assert.equal(hasHint('Câu 1: a?\nA. x\nB. y\nĐáp án: B'), true);
    assert.equal(hasHint('Câu 1: a?\nA. x\n⟦U⟧B. y⟦/U⟧\nC. z'), true);
    assert.equal(hasHint('Câu 1: a?\nA. x\nB. y\nC. z'), false);
});

test('tên đề lấy từ tên file, bỏ đuôi file', () => {
    assert.equal(app.fn('titleFromFileName')('De thi HK1.docx'), 'De thi HK1');
});

test('"Làm bài ngay" nhận đề có đáp án chỉ nằm trong lời giải "Chọn B" (như parser)', () => {
    app.run('originalQuestions = []');
    app.run(`UI.convertedText.value = ${JSON.stringify('Câu 1: 5 x 6 = ?\nA. 11\nB. 30\nC. 56\nD. 1\nLời giải: Ta có 5 x 6 = 30. Chọn B.')}`);
    app.fn('useConvertedTextImmediately')();
    assert.equal(app.run('originalQuestions.length'), 1);
});

test('đề có câu nhiều đáp án đúng vẫn tạo được, nhưng báo để giáo viên kiểm tra lại (quyết định 7/11/2026)', () => {
    app.run('originalQuestions = []');
    assert.equal(app.fn('parseQuizData')('Câu 1: Số nào là số nguyên tố?\n*A. 2\n*B. 3\nC. 4\nD. 6\nCâu 2: 1 + 1 = ?\nA. 1\n*B. 2', null, ''), true);
    assert.match(app.lastToast, /Câu 1 có nhiều đáp án đúng/);
});
