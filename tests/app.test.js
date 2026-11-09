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

// --- Bài đang làm: lưu vào sessionStorage để tải lại trang không mất, cảnh báo trước khi rời trang ---

const SAVE_TEXT = 'Câu 1: Một?\nA. a1\n*B. b1\nCâu 2: Hai?\nA. a2\n*B. b2';
const savedProgress = () => JSON.parse(app.run("sessionStorage.getItem('quizProgress')"));
function resetProgressState() {
    app.run("sessionStorage.removeItem('quizProgress'); originalQuestions = []; finalQuestions = []; selectedAnswers = {}; answeredCount = {}; quizSubmitted = false; quizMode = 'immediate'; UI.resultBox.style.display = 'none'; UI.configSection.style.display = 'block'");
}

test('bài đang làm dở: đã chọn đáp án và chưa hiện kết quả (chọn câu A vị trí 0 cũng tính)', () => {
    resetProgressState();
    const inProgress = app.fn('isQuizInProgress');
    app.run(`finalQuestions = ${JSON.stringify([{ type: 'multiple_choice', options: [{}, {}] }, tfQuestion([true, false])])}`);
    assert.equal(inProgress(), false, 'chưa chọn gì');
    app.run('selectedAnswers = { 0: 0 }');
    assert.equal(inProgress(), true, 'chọn phương án đầu (chỉ số 0)');
    app.run('selectedAnswers = { 1: { 0: { dung: false, sai: false } } }');
    assert.equal(inProgress(), false, 'ý đúng/sai đã bỏ chọn');
    app.run('selectedAnswers = { 1: { 0: { dung: false, sai: true } } }');
    assert.equal(inProgress(), true);
    app.run("UI.resultBox.style.display = 'block'");
    assert.equal(inProgress(), false, 'đã có kết quả');
    resetProgressState();
});

test('rời trang khi đang làm dở thì trình duyệt hỏi lại; làm xong hay chưa chọn gì thì không hỏi', () => {
    resetProgressState();
    const handler = app.run('window.listeners.beforeunload');
    assert.equal(typeof handler, 'function');
    const fire = () => { const e = { prevented: false, preventDefault() { this.prevented = true; }, returnValue: undefined }; handler(e); return e; };
    app.run(`finalQuestions = ${JSON.stringify([{ type: 'multiple_choice', options: [{}, {}] }])}`);
    assert.equal(fire().prevented, false, 'chưa chọn gì');
    app.run('selectedAnswers = { 0: 1 }');
    const e = fire();
    assert.equal(e.prevented, true);
    assert.equal(e.returnValue, '');
    app.run("UI.resultBox.style.display = 'block'");
    assert.equal(fire().prevented, false, 'đã nộp');
    resetProgressState();
});

test('bắt đầu làm bài thì lưu đề đã trộn, chế độ và địa chỉ trang', () => {
    resetProgressState();
    app.fn('parseQuizData')(SAVE_TEXT, null, 'Đề thử');
    app.fn('startQuizNow')();
    const s = savedProgress();
    assert.equal(s.at, '/');
    assert.equal(s.title, 'Đề thử');
    assert.equal(s.mode, 'immediate');
    assert.equal(s.submitted, false);
    assert.equal(s.finalQuestions.length, 2);
    assert.deepEqual(s.selectedAnswers, {});
    assert.ok(s.text.includes('Câu 2: Hai?'));
    resetProgressState();
});

test('chọn đáp án thì lưu lại ngay (chế độ làm hết mới nộp)', () => {
    resetProgressState();
    app.fn('parseQuizData')(SAVE_TEXT, null, '');
    app.run("document.getElementById('viewModeEnd').checked = true; quizMode = 'end'");
    app.fn('startQuizNow')();
    const btn = { disabled: false, classList: { add() {}, remove() {} } };
    app.fn('handleSelection')(btn, { querySelectorAll: () => [btn] }, 1, 1, 'end');
    assert.deepEqual(savedProgress().selectedAnswers, { 1: 1 });
    resetProgressState();
});

test('không lưu khi chưa có bài; lưu lỗi (hết chỗ, bị chặn) không làm hỏng trang', () => {
    resetProgressState();
    app.fn('saveQuizProgress')();
    assert.equal(app.run("sessionStorage.getItem('quizProgress')"), null);
    app.run(`finalQuestions = [{ type: 'multiple_choice', options: [{}, {}] }]; const realSet = sessionStorage.setItem; sessionStorage.setItem = () => { throw new Error('quota'); }; saveQuizProgress(); sessionStorage.setItem = realSet;`);
    resetProgressState();
});

test('đọc bài đã lưu: chỉ nhận dữ liệu đủ dạng và đúng địa chỉ trang', () => {
    const read = app.fn('readQuizProgress');
    const good = { at: '/', text: 'x', mode: 'end', submitted: false, finalQuestions: [{ options: [{}] }], selectedAnswers: {} };
    assert.ok(read(JSON.stringify(good), '/'));
    assert.equal(read(JSON.stringify(good), '/share?s=abc'), null, 'khác địa chỉ trang');
    assert.equal(read('không phải JSON', '/'), null);
    assert.equal(read(null, '/'), null);
    assert.equal(read(JSON.stringify({ ...good, finalQuestions: [] }), '/'), null);
    assert.equal(read(JSON.stringify({ ...good, finalQuestions: [{ options: 'x' }] }), '/'), null);
    assert.equal(read(JSON.stringify({ ...good, selectedAnswers: null }), '/'), null);
    assert.equal(read(JSON.stringify({ ...good, text: 5 }), '/'), null);
});

test('tải lại trang: dựng lại đề, giữ nguyên thứ tự câu đã trộn, chế độ và cấu hình ẩn', async () => {
    resetProgressState();
    app.fn('parseQuizData')(SAVE_TEXT, null, 'Đề thử');
    app.run("finalQuestions = [originalQuestions[1], originalQuestions[0]]; quizMode = 'end'; selectedAnswers = {};");
    app.fn('saveQuizProgress')();
    app.run("originalQuestions = []; finalQuestions = []; selectedAnswers = {}; quizMode = 'immediate'; UI.configSection.style.display = 'block'");
    assert.equal(await app.fn('restoreQuizProgress')(), true);
    assert.deepEqual([...app.run('finalQuestions.map(q => q.title)')], ['Hai?', 'Một?']);
    assert.equal(app.run('originalQuestions.length'), 2);
    assert.equal(app.run('quizMode'), 'end');
    assert.equal(app.run('UI.configSection.style.display'), 'none');
    assert.equal(app.run('sourceTitle'), 'Đề thử');
    resetProgressState();
});

test('tải lại trang: không có gì đã lưu, hay đề đã lưu hỏng thì không khôi phục (và xoá phần hỏng)', async () => {
    resetProgressState();
    assert.equal(await app.fn('restoreQuizProgress')(), false);
    const bad = { at: '/', text: 'không có câu hỏi nào', mode: 'end', submitted: false, finalQuestions: [{ options: [{}] }], selectedAnswers: {} };
    app.run(`sessionStorage.setItem('quizProgress', ${JSON.stringify(JSON.stringify(bad))})`);
    assert.equal(await app.fn('restoreQuizProgress')(), false);
    assert.equal(app.run("sessionStorage.getItem('quizProgress')"), null);
    const mismatch = { at: '/', text: SAVE_TEXT, mode: 'end', submitted: false, finalQuestions: [{ options: [{}] }], selectedAnswers: {} };
    app.run(`sessionStorage.setItem('quizProgress', ${JSON.stringify(JSON.stringify(mismatch))})`);
    assert.equal(await app.fn('restoreQuizProgress')(), false, 'số câu đã lưu khác số câu của đề');
    assert.equal(app.run("sessionStorage.getItem('quizProgress')"), null);
    resetProgressState();
});

test('"Làm lại bài này" xoá bài đã lưu', () => {
    resetProgressState();
    app.fn('parseQuizData')(SAVE_TEXT, null, '');
    app.fn('startQuizNow')();
    assert.ok(app.run("sessionStorage.getItem('quizProgress')"));
    app.fn('retryQuiz')();
    assert.equal(app.run("sessionStorage.getItem('quizProgress')"), null);
    resetProgressState();
});

test('nộp bài thì lưu trạng thái đã nộp để tải lại vẫn thấy kết quả', () => {
    resetProgressState();
    app.fn('parseQuizData')(SAVE_TEXT, null, '');
    app.fn('startQuizNow')();
    app.run('selectedAnswers = { 0: 1 }');
    app.fn('forceSubmit')();
    const s = savedProgress();
    assert.equal(s.submitted, true);
    assert.deepEqual(s.selectedAnswers, { 0: 1 });
    resetProgressState();
});
