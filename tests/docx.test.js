// Đường Word từ đầu đến cuối: dựng file .docx thật bằng JSZip, trích chữ như trên web (extractTextFromFile), dựng đề
// bằng bộ gắn nhãn dự phòng rồi đọc đáp án. Các ca ở đây là lỗi thật đã gặp (đánh dấu đáp án bằng màu, công thức).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { loadApp, answerOf } from './helpers/app.js';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const nodeMammoth = require('mammoth');
const app = loadApp({
    JSZip,
    mammoth: { ...nodeMammoth, convertToHtml: (input, o) => nodeMammoth.convertToHtml(input.arrayBuffer ? { buffer: Buffer.from(input.arrayBuffer) } : input, o) },
    DOMParser, XMLSerializer, Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
});
const fn = name => app.fn(name);

// extra: { numbering, footnotes } là nội dung word/numbering.xml, word/footnotes.xml (danh sách tự đánh số, chú thích).
async function docx(bodyXml, extra = {}) {
    const zip = new JSZip();
    const parts = [['numbering', 'numbering'], ['footnotes', 'footnotes']].filter(([k]) => extra[k]);
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + parts.map(([k, t]) => `<Override PartName="/word/${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${t}+xml"/>`).join('') + '</Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + parts.map(([k], i) => `<Relationship Id="rIdX${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${k}" Target="${k}.xml"/>`).join('') + '</Relationships>');
    for (const [k] of parts) zip.file(`word/${k}.xml`, extra[k]);
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>${bodyXml}</w:body></w:document>`);
    return new File([await zip.generateAsync({ type: 'nodebuffer' })], 'de.docx');
}

async function convert(bodyXml, extra) {
    const raw = await fn('extractTextFromFile')(await docx(bodyXml, extra));
    const exam = fn('keepFirstExamCode')(fn('prepareLines')(raw));
    const out = fn('assembleQuizText')(exam.lines, fn('labelLinesLocally')(exam.lines));
    return { raw, ...out, questions: [...app.parse(out.text).questions] };
}

const run = (text, rPr = '') => `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const para = (...runs) => `<w:p>${runs.join('')}</w:p>`;
const BLUE = '<w:color w:val="0000FF"/>';
const RED = '<w:color w:val="FF0000"/>';

test('Cả đề chữ xanh, ý đúng tô đỏ: chỉ màu đỏ là đáp án dù đề ngắn (màu xanh không chiếm quá 60%)', async () => {
    const r = await convert(
        para(run('câu hỏi đúng sai: Câu 1: Xét các phát biểu về nước', BLUE)) +
        para(run('a) ', BLUE), run('Nước sôi ở 90 độ', BLUE)) +
        para(run('b) ', BLUE), run('Nước là hợp chất của hiđro và oxi', RED)) +
        para(run('c) ', BLUE), run('Nước tinh khiết dẫn điện rất kém', RED)) +
        para(run('d) ', BLUE), run('Nước đá nhẹ hơn nước lỏng ở cùng điều kiện', RED)));
    assert.deepEqual(r.questions.map(answerOf), ['SĐĐĐ']);
});

test('Phương án là công thức Word được tô sáng vẫn là đáp án (định dạng nằm trong m:r)', async () => {
    const math = (t, rPr = '') => `<m:oMath><m:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<m:t>${t}</m:t></m:r></m:oMath>`;
    const r = await convert(
        para(run('Câu 1: Nghiệm của phương trình 2x = 4 là')) +
        ['x=1', 'x=2', 'x=3', 'x=4'].map((v, i) => para(run(`${'ABCD'[i]}. `), math(v, i === 1 ? '<w:highlight w:val="yellow"/>' : ''))).join(''));
    assert.deepEqual(r.questions.map(answerOf), ['B']);
    assert.deepEqual([...r.unanswered], []);
});

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const U = '<w:u w:val="single"/>';
const listPara = (numId, ...runs) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>${runs.join('')}</w:p>`;
const numbering = (fmt, lvlText, numIds) => `<?xml version="1.0"?><w:numbering ${W_NS}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${lvlText}"/></w:lvl></w:abstractNum>`
    + numIds.map(n => `<w:num w:numId="${n}"><w:abstractNumId w:val="0"/></w:num>`).join('') + '</w:numbering>';
const plain = t => String(t).replace(/<br>/g, ' / ').replace(/&quot;/g, '"');

test('Đúng/sai: chữ cái a) b) c) d) đều tô màu (trang trí) thì không phải đáp án, dùng bảng đáp án', async () => {
    const stmts = ['Nước sôi ở 100 độ C', 'Nước là hợp chất', 'Nước tinh khiết dẫn điện rất tốt', 'Nước đá nhẹ hơn nước lỏng'];
    const body = para(run('câu hỏi đúng sai: Câu 1. Xét các phát biểu về nước:')) + stmts.map((t, k) => para(run(`${'abcd'[k]}) `, BLUE), run(t))).join('');
    const withKey = await convert(body + para(run('ĐÁP ÁN')) + para(run('Câu 1: a) Đ b) Đ c) S d) Đ')));
    assert.deepEqual(withKey.questions.map(answerOf), ['ĐĐSĐ']);
    const noKey = await convert(body);
    assert.deepEqual(noKey.questions.map(answerOf), []);
});

test('Phương án tự đánh số của Word có chữ "Câu chuyện", "Bài văn" vẫn đánh A, B, C, D liên tục', async () => {
    const opts = ['Truyện ngắn hiện đại', 'Bài văn nghị luận', 'Câu chuyện cổ tích', 'Truyện thơ Nôm'];
    const r = await convert(para(run('Câu 1: Văn bản "Tấm Cám" thuộc thể loại nào?')) + opts.map(t => listPara(1, run(t))).join('') + para(run('Đáp án: C')),
        { numbering: numbering('upperLetter', '%1.', [1]) });
    assert.deepEqual(r.questions.map(answerOf), ['C']);
    assert.equal(plain(r.questions[0].options[2].text), 'Câu chuyện cổ tích');
    // Câu tự đánh số "Câu %1." mà đề bài bắt đầu bằng "Câu văn…", "Câu cảm thán…" vẫn đánh số 1, 2, 3.
    const stems = ['Thủ đô của Việt Nam là gì?', 'Câu văn nào sau đây là câu ghép?', 'Câu cảm thán dùng để làm gì?'];
    const q = await convert(stems.map((t, k) => listPara(5, run(t)) + ['x', 'y'].map((o, j) => para(run(`${'AB'[j]}. ${o}${k}`))).join('')).join('') + para(run('BẢNG ĐÁP ÁN')) + para(run('1. B  2. A  3. B')),
        { numbering: numbering('decimal', 'Câu %1.', [5]) });
    assert.deepEqual(q.questions.map(answerOf), ['B', 'A', 'B']);
});

test('Dòng lời giải tô màu ("Giải: Ta có…") sau phương án không làm phương án cuối thành đáp án', async () => {
    const r = await convert(para(run('Câu 1: Tính 1+1 bằng bao nhiêu?')) + ['1', '2', '3', '4'].map((v, k) => para(run(`${'ABCD'[k]}. ${v}`))).join('')
        + para(run('Giải: Ta có 1+1 = 2 nên chọn đáp án thích hợp', RED)));
    assert.deepEqual(r.questions.map(answerOf), []);
    const withKey = await convert(para(run('Câu 1: Tính 1+1 bằng bao nhiêu?')) + ['1', '2', '3', '4'].map((v, k) => para(run(`${'ABCD'[k]}. ${v}`))).join('')
        + para(run('Hướng dẫn: Ta có 1+1 = 2', RED)) + para(run('Đáp án: B')));
    assert.deepEqual(withKey.questions.map(answerOf), ['B']);
    assert.equal(plain(withKey.questions[0].options[3].text), '4');
});

test('Câu phát âm: phần gạch chân trong mọi phương án là đề bài, không phải dấu đáp án', async () => {
    const word = (a, u, b) => run(a) + run(u, U) + run(b);
    const body = para(run('Question 1: Mark the letter A, B, C, or D to indicate the word whose underlined part differs from the other three.'))
        + [['h', 'ou', 'r'], ['', 'ou', 'r'], ['t', 'ou', 'r'], ['f', 'ou', 'r']].map((w, k) => para(run(`${'ABCD'[k]}. `), word(...w))).join('');
    const noKey = await convert(body);
    assert.deepEqual(noKey.questions.map(answerOf), []);
    const withKey = await convert(body + para(run('ĐÁP ÁN')) + para(run('1. D')));
    assert.deepEqual(withKey.questions.map(answerOf), ['D']);
});

test('Chú thích cuối trang (footnote) của Word không thành phương án hay câu hỏi', async () => {
    const ref = n => `<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${n}"/></w:r>`;
    const body = para(run('Câu 1: Đọc đoạn thơ sau và cho biết tác giả'), ref(1), ref(2))
        + ['Tố Hữu', 'Xuân Diệu', 'Huy Cận', 'Chế Lan Viên'].map((t, k) => para(run(`${'ABCD'[k]}. ${t}`, k === 1 ? RED : ''))).join('');
    const footnotes = `<?xml version="1.0"?><w:footnotes ${W_NS}>` + [1, 2].map(i => `<w:footnote w:id="${i}"><w:p><w:r><w:t>Chú thích số ${i} giải nghĩa từ</w:t></w:r></w:p></w:footnote>`).join('') + '</w:footnotes>';
    const r = await convert(body, { footnotes });
    assert.deepEqual(r.questions.map(answerOf), ['B']);
    assert.equal(r.questions[0].options.length, 4);
    assert.ok(!/Chú thích|\[/.test(r.raw), r.raw);
});

test('Chữ trên/chữ dưới có ký tự không đổi được sang Unicode thì giữ dạng ^(…), _(…) để không mất nghĩa', async () => {
    const sup = t => run(t, '<w:vertAlign w:val="superscript"/>');
    const sub = t => run(t, '<w:vertAlign w:val="subscript"/>');
    const raw = await fn('extractTextFromFile')(await docx(para(run('Câu 1: Giá trị của 2'), sup('√2'), run(' ; a'), sup('r'), run(' ; x'), sup('2'), run(' ; log'), sub('b'), run('x ; Fe'), sub('2'), run('O'), sub('3'))));
    assert.ok(raw.includes('2^(√2)'), raw);
    assert.ok(raw.includes('a^(r)'), raw);
    assert.ok(raw.includes('x²'), raw);
    assert.ok(raw.includes('log_(b)x'), raw);
    assert.ok(raw.includes('Fe₂O₃'), raw);
});

test('Danh sách tự đánh số La Mã của Word ((I), (II), (III)) giữ số La Mã để khớp với phương án', async () => {
    const raw = await fn('extractTextFromFile')(await docx(para(run('Câu 1: Cho các phát biểu sau về kim loại:'))
        + ['Kim loại có ánh kim', 'Kim loại dẫn điện tốt', 'Kim loại mềm hơn phi kim'].map(t => listPara(1, run(t))).join('')
        + ['A. (I) và (II)', 'B. (II) và (III)'].map(t => para(run(t))).join(''), { numbering: numbering('upperRoman', '(%1)', [1]) }));
    assert.ok(raw.includes('(I) Kim loại có ánh kim') && raw.includes('(III) Kim loại mềm hơn phi kim'), raw);
});
