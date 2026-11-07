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

async function docx(bodyXml) {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>${bodyXml}</w:body></w:document>`);
    return new File([await zip.generateAsync({ type: 'nodebuffer' })], 'de.docx');
}

async function convert(bodyXml) {
    const raw = await fn('extractTextFromFile')(await docx(bodyXml));
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
