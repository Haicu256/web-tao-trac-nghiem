// Phần logic phía trình duyệt ngoài parser: chấm điểm, chia đoạn gửi AI, nhận biết đề có đáp án.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

test('"Làm bài ngay" với đề chưa có đáp án thì báo rõ là thiếu đáp án', () => {
    app.run('originalQuestions = []');
    app.run(`UI.convertedText.value = ${JSON.stringify('Câu 1: Thủ đô?\nA. Huế\nB. Hà Nội\nCâu 2: 1 + 1 = ?\nA. 1\nB. 2')}`);
    app.fn('useConvertedTextImmediately')();
    assert.equal(app.run('originalQuestions.length'), 0);
    assert.match(app.lastToast, /thiếu đáp án/);
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

test('hai phương án cách nhau bằng khoảng trắng Unicode (em-space, cách ngang rộng) vẫn được tách', () => {
    for (const gap of ['  ', '　　', '  ', '  ']) {
        const p = app.parse(`Câu 1: Thủ đô của Việt Nam?\nA. Huế${gap}*B. Hà Nội${gap}C. Đà Nẵng${gap}D. Cần Thơ`);
        assert.equal(p.ok, true, JSON.stringify(gap));
        assert.equal(p.questions[0].options.length, 4, JSON.stringify(gap));
        assert.equal(p.questions[0].options[1].isCorrect, true, JSON.stringify(gap));
    }
});

// ===== Hình trong đề (docs/thiet-ke/hinh-anh.md) =====
test('renderImages: ký hiệu thành <img> lấy từ bộ nhớ, không có thì /img/', () => {
    app.fn('rememberImage')({ id: 'aaaaaaaaaaaa', dataUrl: 'data:image/png;base64,AA==' });
    assert.match(app.fn('renderImages')('x [[hình:aaaaaaaaaaaa]]'), /<img class="quiz-img"[^>]*src="data:image\/png;base64,AA=="/);
    assert.match(app.fn('renderImages')('[[hình:bbbbbbbbbbbb]]'), /<img class="quiz-img"[^>]*src="\/img\/bbbbbbbbbbbb"/);
});

test('renderImages: ký hiệu sai dạng (mã không đủ 12 ký tự hệ 16, thiếu ngoặc) giữ nguyên là chữ', () => {
    for (const t of ['[[hình:XYZ]]', '[[hình:abc]]', '[[hình:aaaaaaaaaaaa]', '[[hình:aaaaaaaaaaaaa]]', '[[hình:AAAAAAAAAAAA]]']) {
        assert.equal(app.fn('renderImages')(t), t);
    }
});

test('renderImages: chữ đã thoát cạnh ký hiệu vẫn là chữ thoát', () => {
    const out = app.fn('renderImages')(app.fn('escapeHTML')('<b>"x"</b>') + ' [[hình:aaaaaaaaaaaa]]');
    assert.ok(!out.includes('<b>'), out);
    assert.ok(out.includes('&lt;b&gt;&quot;x&quot;'), out);
    assert.match(out, /<img /);
});

test('renderRich: đề bài, phương án và ý đúng/sai đều vẽ hình (thay cho renderMathInHtml)', () => {
    assert.match(app.fn('renderRich')('Câu hỏi [[hình:aaaaaaaaaaaa]]'), /<img class="quiz-img"/);
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /qTitle\.innerHTML = `Câu \$\{qIndex \+ 1\}: \$\{renderRich\(q\.title\)\}`/);
    assert.match(html, /textSpan\.innerHTML = renderRich\(opt\.text\)/);
    assert.match(html, /btn\.innerHTML = `<b>\$\{prefix\}\.<\/b> \$\{renderRich\(opt\.text\)\}`/);
});

test('CSS: ảnh trong đề có nền trắng; ảnh tải lỗi được thay bằng (hình chưa lưu)', () => {
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const css = (html.match(/\.quiz-img\s*\{([^}]*)\}/) || [])[1] || '';
    assert.match(css, /background:\s*(?:#fff\b|#ffffff\b|white\b)/i);
    assert.match(css, /max-width:\s*100%/);
    assert.match(html, /\.img-missing\s*\{/);
    assert.match(html, /UI\.quizContainer\.addEventListener\(\s*'error'[\s\S]{0,400}?\(hình chưa lưu\)[\s\S]{0,200}?,\s*true\s*\)/);
});

test('Làm bài: câu còn phương án (hình chưa ghép) bị bỏ và báo, câu khác vẫn làm được', () => {
    const r = app.parse(['Câu 1: Cấu trúc nào là Aspirin?', '[[hình:aaaaaaaaaaaa]] [[hình:bbbbbbbbbbbb]]', '*A. (hình chưa ghép)', 'B. (hình chưa ghép)',
        'Câu 2: Thủ đô?', 'A. Huế', '*B. Hà Nội'].join('\n'));
    assert.equal(r.ok, true);
    assert.equal(r.questions.length, 1);
    assert.match(app.lastToast, /1 câu chưa ghép được hình/);
});

test('Gửi AI: ký hiệu hình thành chữ [hình], không gửi mã hình', async () => {
    let body = null;
    app.setGlobal('AbortSignal', AbortSignal);
    app.setGlobal('fetch', async (url, opts) => {
        body = JSON.parse(opts.body);
        return { ok: true, status: 200, json: async () => ({ doan: [{ tu: 1, den: 2, loai: 'phuong_an' }], model: 'm' }) };
    });
    await app.fn('labelChunkWithAI')(['A. [[hình:aaaaaaaaaaaa]]', 'B. chữ']);
    assert.deepEqual(body.lines, ['A. [hình]', 'B. chữ']);
});

test('imageNotes: báo các câu chưa ghép được hình và số hình không đọc được', () => {
    app.run('unreadableImageCount = 2');
    const notes = [...app.fn('imageNotes')(['Câu 3: X?', '[[hình:aaaaaaaaaaaa]]', 'A. (hình chưa ghép)', 'B. (hình chưa ghép)',
        'Câu 7: Y?', '[[hình:bbbbbbbbbbbb]]', 'A.', 'B.'])];
    assert.ok(notes.some(n => n.includes('Câu 3, 7: chưa ghép được hình với phương án')), notes.join(' | '));
    assert.ok(notes.some(n => n.includes('2 hình không đọc được')), notes.join(' | '));
    app.run('unreadableImageCount = 0');
    assert.deepEqual([...app.fn('imageNotes')(['Câu 1: X?', 'A. [[hình:aaaaaaaaaaaa]]', 'B. [[hình:bbbbbbbbbbbb]]'])], []);
});

test('Chuyển file: ghi chú câu chưa ghép được hình và hiện dòng "File .txt không chứa hình"', async () => {
    app.run('window._testSleepMs = 0');
    app.setGlobal('AbortSignal', AbortSignal);
    app.setGlobal('fetch', async () => ({ ok: false, status: 500, json: async () => ({ error: 'lỗi' }) }));
    const text = ['Câu 1: Thủ đô?', 'A. Huế', '*B. Hà Nội', 'Câu 2: Cấu trúc nào là Aspirin?',
        '[[hình:aaaaaaaaaaaa]]\t[[hình:bbbbbbbbbbbb]]\t[[hình:cccccccccccc]]', 'A\tB'].join('\n');
    await app.fn('convertRawFile')(new File([text], 'de.txt'));
    assert.match(app.document.getElementById('convertStatus').innerHTML, /Câu 2: chưa ghép được hình/);
    assert.equal(app.document.getElementById('txtImageNote').style.display, '');
});

const IMG_TEXT = 'Câu 1: Cấu trúc nào là Aspirin?\nA. [[hình:aaaaaaaaaaaa]]\n*B. [[hình:bbbbbbbbbbbb]]\nCâu 2: Thủ đô?\nA. Huế\n*B. Hà Nội';

test('Tạo link: chỉ gửi hình có ký hiệu trong đề và đang có trong bộ nhớ', async () => {
    app.run('quizImages = {}');
    for (const id of ['aaaaaaaaaaaa', 'cccccccccccc']) app.fn('rememberImage')({ id, dataUrl: 'data:image/png;base64,QUJD' });
    app.run(`sourceText = ${JSON.stringify(IMG_TEXT)}; sourceTitle = ''; UI.shareCreateBtn.disabled = false;`);
    let body = null;
    app.setGlobal('fetch', async (url, opts) => { body = JSON.parse(opts.body); return { ok: true, status: 200, json: async () => ({ id: 'AAAAAAAAAAA' }) }; });
    await app.fn('createShareLink')();
    assert.deepEqual(Object.keys(body.images), ['aaaaaaaaaaaa']);
    assert.equal(body.images.aaaaaaaaaaaa, 'QUJD');
    assert.equal(body.text, IMG_TEXT);
});

test('Tạo link: đề quá 2 MB hình hay quá 100 hình thì báo trước, không gọi server', async () => {
    let called = false;
    app.setGlobal('fetch', async () => { called = true; return { ok: true, json: async () => ({ id: 'AAAAAAAAAAA' }) }; });
    app.run('quizImages = {}');
    app.fn('rememberImage')({ id: 'aaaaaaaaaaaa', dataUrl: `data:image/png;base64,${'A'.repeat(2_800_000)}` });
    app.run(`sourceText = ${JSON.stringify(IMG_TEXT)}; UI.shareCreateBtn.disabled = false;`);
    await app.fn('createShareLink')();
    assert.equal(called, false);
    assert.match(app.lastToast, /quá nhiều hình|2 MB/);
    const many = Array.from({ length: 101 }, (_, k) => `[[hình:${String(k).padStart(12, '0')}]]`).join('\n');
    app.run(`quizImages = {}; sourceText = ${JSON.stringify(IMG_TEXT + '\n' + many)}; UI.shareCreateBtn.disabled = false;`);
    await app.fn('createShareLink')();
    assert.equal(called, false);
});

test('Tải lại trang: hình chưa chia sẻ lấy lại từ sessionStorage; hết chỗ thì bài vẫn khôi phục', async () => {
    resetProgressState();
    app.run('quizImages = {}');
    app.fn('rememberImage')({ id: 'aaaaaaaaaaaa', dataUrl: 'data:image/png;base64,QUJD' });
    app.fn('parseQuizData')(IMG_TEXT, null, '');
    app.run('finalQuestions = [originalQuestions[0], originalQuestions[1]]; selectedAnswers = {};');
    app.fn('saveQuizProgress')();
    app.run('quizImages = {}; originalQuestions = []; finalQuestions = [];');
    assert.equal(await app.fn('restoreQuizProgress')(), true);
    assert.equal(app.run("quizImages['aaaaaaaaaaaa']"), 'data:image/png;base64,QUJD');
    resetProgressState();
    app.run("quizImages = {}; globalThis.realSetImg = sessionStorage.setItem; sessionStorage.setItem = (k, v) => { if (k === 'quizImages') throw new Error('quota'); return realSetImg(k, v); };");
    app.fn('rememberImage')({ id: 'aaaaaaaaaaaa', dataUrl: 'data:image/png;base64,QUJD' });
    app.fn('parseQuizData')(IMG_TEXT, null, '');
    app.run('finalQuestions = [originalQuestions[0], originalQuestions[1]]; selectedAnswers = {};');
    app.fn('saveQuizProgress')();
    app.run('quizImages = {}; originalQuestions = []; finalQuestions = []; sessionStorage.setItem = realSetImg;');
    assert.equal(await app.fn('restoreQuizProgress')(), true);
    assert.equal(app.run("quizImages['aaaaaaaaaaaa']"), undefined);
    resetProgressState();
});

test('Làm bài: phương án giữ chỗ bị nối thêm hình (hình chưa ghép đứng sau) vẫn bị bỏ, không đến tay học sinh', () => {
    const r = app.parse(['Câu 1: Cấu trúc nào là Aspirin?', '*A. (hình chưa ghép)', '[[hình:bbbbbbbbbbbb]]', 'B. (hình chưa ghép)', '[[hình:cccccccccccc]]',
        'Câu 2: Thủ đô?', 'A. Huế', '*B. Hà Nội'].join('\n'));
    assert.equal(r.questions.length, 1);
    assert.match(app.lastToast, /chưa ghép được hình/);
});

// ===== 4 tối ưu cứu hộ AI & VNI-Windows (docs/thiet-ke/cuu-ho-ai.md) =====
test('fixLegacyVietnamese: đổi đúng VNI-Windows thường + hoa, giữ nguyên Unicode oà/oá/loài, ngoại ngữ và TCVN3', () => {
    const fix = app.fn('fixLegacyVietnamese');
    const vni = 'Caâu 1: Thuû ñoâ Vieät Nam - PHAÀN I TRAÉC NGHIEÄM ÑUÙNG SAI - Ñaø Naüng, Caàn Thô, töôûng töôïng, baùc só, chæ ñònh, vò trí, kî';
    assert.equal(fix(vni), 'Câu 1: Thủ đô Việt Nam - PHẦN I TRẮC NGHIỆM ĐÚNG SAI - Đà Nẵng, Cần Thơ, tưởng tượng, bác sĩ, chỉ định, vị trí, kỵ');
    const mixedUnicode = 'Hoà bình, hoá học, loài cá, toà nhà, xoá bỏ';
    assert.equal(fix(mixedUnicode), mixedUnicode);
    const pt = 'Câu 1: São exemplos de Associações\nA. PMI e IPMA\n*B. Ação e Gestão';
    assert.equal(fix(pt), pt);
    const tcvn3 = 'C©u 1. Th©n phô Hå ChÝ Minh lμ NguyÔn Sinh S¾c. ¤ng sinh n¨m nμo?\nC©u 2. HuyÖn B×nh Khª lμ n¬i Cô lμm g×?';
    assert.equal(fix(tcvn3), 'Câu 1. Thân phụ Hồ Chí Minh là Nguyễn Sinh Sắc. Ông sinh năm nào?\nCâu 2. Huyện Bình Khê là nơi Cụ làm gì?');
});

test('classifyPdfPage: phân loại đúng scan, garbled và ok (kể cả trang đề hình Hóa Dược)', () => {
    const classify = app.fn('classifyPdfPage');
    assert.equal(classify('[[hình:aaaaaaaaaaaa]]', 1, 0.9), 'scan');
    assert.equal(classify('Trang 2\n[[hình:aaaaaaaaaaaa]]', 1, 0.8), 'scan');
    assert.equal(classify('\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD abc', 0, 0), 'garbled');
    assert.equal(classify('\uE001\uE002\uE003\uE004\uE005\uE006', 0, 0), 'garbled');
    const hoaDuocPage7 = '13. Cấu trúc nào sau đây tương ứng với Cyanocobalamin?\nA. [[hình:aaaaaaaaaaaa]]\nB. [[hình:bbbbbbbbbbbb]]\nC. [[hình:cccccccccccc]]\nD. [[hình:dddddddddddd]]';
    assert.equal(classify(hoaDuocPage7, 4, 0.2), 'ok');
    assert.equal(classify('Câu 1: Thủ đô Việt Nam là thành phố nào?\nA. Huế', 0, 0), 'ok');
    assert.equal(classify('', 0, 0), 'ok');
});

test('protectImageTokens & restoreImageTokens: che và khôi phục chính xác mã hình, tái sử dụng cùng placeholder', () => {
    const protect = app.fn('protectImageTokens');
    const restore = app.fn('restoreImageTokens');
    const src = 'Câu 1: [[hình:7f15000f8c1c]] và [[hình:02898b59bf4f]] và lại [[hình:7f15000f8c1c]]';
    const { masked, tokens } = protect(src);
    assert.equal(tokens.length, 2);
    assert.equal(masked, 'Câu 1: [HINH_1] và [HINH_2] và lại [HINH_1]');
    assert.equal(restore(masked, tokens), src);
});

test('chunkHasAnswerEvidence: false cho đề trắng dù có ⟦B⟧ trang trí; true khi có dấu * / (*) / ⟦U⟧ / Đáp án', () => {
    const has = app.fn('chunkHasAnswerEvidence');
    assert.equal(has('Câu 1: Thủ đô?\n⟦B⟧A. Huế⟦/B⟧\n⟦B⟧B. Hà Nội⟦/B⟧'), false);
    assert.equal(has('Câu 1: Thủ đô?\nA. Huế\n*B. Hà Nội'), true);
    assert.equal(has('Câu 1: Thủ đô?\nA. Huế\nB. Hà Nội (*)'), true);
    assert.equal(has('Câu 1: Thủ đô?\nA. Huế\n⟦U⟧B. Hà Nội⟦/U⟧'), true);
    assert.equal(has('Câu 1: Thủ đô?\nA. Huế\nB. Hà Nội\nĐáp án: B'), true);
});

test('formatRescuedQuestions: khóa đáp án khi allowAnswers=false; hỗ trợ nhiều đáp án & SSSS khi allowAnswers=true', () => {
    const fmt = app.fn('formatRescuedQuestions');
    const noAns = fmt([{ so: '1', loai: 'trac_nghiem', de_bai: 'Thủ đô?', phuong_an: ['Huế', '*Hà Nội'], dap_an: 'B' }], false);
    assert.ok(!noAns.includes('*'));
    assert.ok(!noAns.includes('Đáp án:'));
    const multi = fmt([{ so: '1', loai: 'trac_nghiem', de_bai: 'Chẵn?', phuong_an: ['2', '3', '4'], dap_an: 'A, C' }], true);
    assert.ok(multi.includes('*A. 2'));
    assert.ok(multi.includes('B. 3'));
    assert.ok(multi.includes('*C. 4'));
    const tfFalse = fmt([{ so: '2', loai: 'dung_sai', de_bai: 'Xét?', phuong_an: ['1', '2', '3', '4'], dap_an: 'SSSS' }], true);
    assert.ok(tfFalse.includes('câu hỏi đúng sai: Câu 2: Xét?'));
    assert.ok(tfFalse.includes('Đáp án: SSSS'));
});

test('insertRescuedText: chèn vào trước BẢNG ĐÁP ÁN nếu có, nối cuối nếu không', () => {
    const insert = app.fn('insertRescuedText');
    const withTable = 'Câu 1: A?\nA. 1\n*B. 2\nBẢNG ĐÁP ÁN\n1. B';
    assert.equal(insert(withTable, 'Câu 2: B?\nA. 3\nB. 4'), 'Câu 1: A?\nA. 1\n*B. 2\nCâu 2: B?\nA. 3\nB. 4\nBẢNG ĐÁP ÁN\n1. B');
    assert.equal(insert('Câu 1: A?\nA. 1\n*B. 2', 'Câu 2: B?\nA. 3\nB. 4'), 'Câu 1: A?\nA. 1\n*B. 2\nCâu 2: B?\nA. 3\nB. 4');
});

test('assembleQuizText: trả về droppedBlocks cho câu bị rớt mà không đổi text/questions', () => {
    const lines = ['Câu 1: Một?', 'A. 1', '*B. 2', 'Câu 2: Câu bị dính không tách được phương án', 'Đoạn nối tiếp không có A B C D'];
    const labels = ['cau_hoi', 'phuong_an', 'phuong_an', 'cau_hoi', 'noi_dung_cau_hoi'];
    const res = app.fn('assembleQuizText')(lines, labels);
    assert.equal(res.questions, 1);
    assert.equal(res.withoutOptions, 1);
    assert.equal(res.droppedBlocks.length, 1);
    assert.match(res.droppedBlocks[0], /Câu 2: Câu bị dính/);
});

test('convertRawFile sạch: ẩn nút #aiRescueBtn', async () => {
    app.run('window._testSleepMs = 0');
    app.setGlobal('AbortSignal', AbortSignal);
    app.setGlobal('fetch', async () => ({ ok: false, status: 500, json: async () => ({ error: 'off' }) }));
    await app.fn('convertRawFile')(new File(['Câu 1: Thủ đô?\nA. Huế\n*B. Hà Nội'], 'clean.txt'));
    assert.equal(app.document.getElementById('aiRescueBtn').style.display, 'none');
});

test('convertRawFile + rescueWithAI (phẫu thuật): chỉ gửi đúng câu bị rớt, giữ nguyên câu đúng và ẩn nút sau khi cứu', async () => {
    app.run('window._testSleepMs = 0');
    app.setGlobal('AbortSignal', AbortSignal);
    const rescueCalls = [];
    app.setGlobal('fetch', async (url, opts) => {
        const body = JSON.parse(opts.body);
        if (url === '/api/convert') return { ok: false, status: 500, json: async () => ({ error: 'off' }) };
        if (url === '/api/rescue') {
            rescueCalls.push(body);
            return {
                ok: true, status: 200,
                json: async () => ({
                    model: 'm',
                    cau: [{ so: '2', loai: 'trac_nghiem', de_bai: 'Hai cộng hai?', phuong_an: ['3', '4'] }],
                }),
            };
        }
        return { ok: false, status: 404, json: async () => ({}) };
    });
    const raw = 'Câu 1: Thủ đô?\nA. Huế\n*B. Hà Nội\nCâu 2: Hai cộng hai là ba hay bốn?';
    await app.fn('convertRawFile')(new File([raw], 'partial.txt'));
    const btn = app.document.getElementById('aiRescueBtn');
    assert.notEqual(btn.style.display, 'none');
    assert.match(btn.textContent, /1 câu/);

    app.run('window._modalShown = false; window._origShowModal = showModal; showModal = opts => { window._modalShown = true; opts.onConfirm && opts.onConfirm(); };');
    try {
        await app.fn('rescueWithAI')();
    } finally {
        app.run('showModal = window._origShowModal;');
    }
    assert.equal(app.run('window._modalShown'), true);
    assert.equal(rescueCalls.length, 1);
    assert.equal(rescueCalls[0].mode, 'text');
    assert.ok(!rescueCalls[0].text.includes('Thủ đô?'), 'không gửi lại câu 1 đã đọc đúng');
    assert.ok(rescueCalls[0].text.includes('Hai cộng hai'), 'chỉ gửi câu 2 bị rớt');
    const out = app.document.getElementById('convertedText').value;
    assert.ok(out.includes('Câu 1: Thủ đô?'));
    assert.ok(out.includes('Câu 2: Hai cộng hai?'));
    assert.ok(out.includes('A. 3'));
    assert.equal(btn.style.display, 'none');
    assert.match(app.document.getElementById('convertStatus').innerHTML, /kiểm tra lại/i);
});

test('rescueWithAI (OCR PDF hỗn hợp & giới hạn 15 trang): chỉ OCR trang lỗi, ghép lại và chặn vượt 15 trang', async () => {
    app.run('window._testSleepMs = 0');
    app.setGlobal('AbortSignal', AbortSignal);
    const ocrCalls = [];
    app.setGlobal('fetch', async (url, opts) => {
        if (url === '/api/rescue') {
            const body = JSON.parse(opts.body);
            ocrCalls.push(body);
            return { ok: true, status: 200, json: async () => ({ model: 'm', dong: ['Câu 2: 1+1?', 'A. 1', '*B. 2'] }) };
        }
        return { ok: false, status: 500, json: async () => ({}) };
    });
    const rendered = [];
    app.run(`
        lastConvertMeta = {
            ext: 'pdf',
            file: { name: 'mixed.pdf' },
            title: 'mixed',
            questionsCount: 1,
            droppedBlocks: [],
            rescuedOnce: false,
            rawText: 'Câu 1: Thủ đô?\\nA. Huế\\n*B. Hà Nội\\n',
            pdfPages: [
                { pageNum: 1, text: 'Câu 1: Thủ đô?\\nA. Huế\\n*B. Hà Nội', status: 'ok' },
                { pageNum: 2, text: '[[hình:aaaaaaaaaaaa]]', status: 'scan' },
            ],
            ocrPages: [2],
        };
        window._origShowModal = showModal;
        showModal = opts => { opts.onConfirm && opts.onConfirm(); };
    `);
    app.setGlobal('_renderPdfPageForOcr', async (_file, pageNum) => {
        rendered.push(pageNum);
        return 'QUJD';
    });
    try {
        await app.fn('rescueWithAI')();
    } finally {
        app.run('showModal = window._origShowModal; window._renderPdfPageForOcr = undefined;');
    }
    assert.deepEqual(rendered, [2]);
    assert.equal(ocrCalls.length, 1);
    assert.equal(ocrCalls[0].mode, 'ocr');
    assert.equal(ocrCalls[0].imageBase64, 'QUJD');
    const out = app.document.getElementById('convertedText').value;
    assert.ok(out.includes('Câu 1: Thủ đô?'));
    assert.ok(out.includes('Câu 2: 1+1?'));
    assert.equal(app.document.getElementById('aiRescueBtn').style.display, 'none');

    const overRendered = [];
    app.setGlobal('_renderPdfPageForOcr', async (_file, pageNum) => {
        overRendered.push(pageNum);
        return 'QUJD';
    });
    app.run(`
        lastConvertMeta = {
            ext: 'pdf',
            file: { name: 'big.pdf' },
            title: 'big',
            questionsCount: 0,
            droppedBlocks: [],
            rescuedOnce: false,
            rawText: '',
            pdfPages: Array.from({ length: 18 }, (_, k) => ({ pageNum: k + 1, text: '', status: 'scan' })),
            ocrPages: Array.from({ length: 18 }, (_, k) => k + 1),
        };
        window._origShowModal = showModal;
        showModal = opts => { opts.onConfirm && opts.onConfirm(); };
    `);
    try {
        await app.fn('rescueWithAI')();
    } finally {
        app.run('showModal = window._origShowModal; window._renderPdfPageForOcr = undefined;');
    }
    assert.equal(overRendered.length, 15, 'tối đa 15 trang OCR mỗi lần');
});
