// Chạy mọi ví dụ trong docs/dinh-dang-de.md: mỗi khối ```de được đọc bằng parseQuizData
// và so với khối ```ket-qua ngay sau nó. Sửa spec là sửa test, nên hai thứ không lệch nhau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadApp, plainText, answerOf } from './helpers/app.js';

const spec = fs.readFileSync(new URL('../docs/dinh-dang-de.md', import.meta.url), 'utf8');
const app = loadApp();

function collectExamples(markdown) {
    const examples = [];
    let heading = '';
    const blockRe = /^###\s+(.+)$|^```(de|ket-qua)\n([\s\S]*?)^```$/gm;
    let pending = null;
    for (const m of markdown.matchAll(blockRe)) {
        if (m[1]) { heading = m[1].trim(); continue; }
        if (m[2] === 'de') pending = { heading, input: m[3].replace(/\n$/, '') };
        else if (pending) { examples.push({ ...pending, expected: m[3].trim().split('\n') }); pending = null; }
    }
    return examples;
}

function check(expectedLines, result) {
    const { ok, questions } = result;
    for (const line of expectedLines) {
        if (line === 'không đọc được') { assert.equal(ok, false, 'parser phải từ chối đề này'); continue; }
        assert.equal(ok, true, 'parser phải đọc được đề này');
        let m;
        if ((m = line.match(/^số câu:\s*(\d+)$/))) {
            assert.equal(questions.length, Number(m[1]), line);
        } else if ((m = line.match(/^câu (\d+) tiêu đề:\s*(.*)$/))) {
            assert.equal(plainText(questions[m[1] - 1].title), m[2], line);
        } else if ((m = line.match(/^câu (\d+) phương án ([A-F]):\s*(.*)$/))) {
            const opt = questions[m[1] - 1].options[m[2].charCodeAt(0) - 65];
            assert.ok(opt, `${line} (không có phương án ${m[2]})`);
            assert.equal(plainText(opt.text), m[3], line);
        } else if ((m = line.match(/^câu (\d+) số phương án:\s*(\d+)$/))) {
            assert.equal(questions[m[1] - 1].options.length, Number(m[2]), line);
        } else if ((m = line.match(/^câu (\d+) loại:\s*(trắc nghiệm|đúng sai)$/))) {
            assert.equal(questions[m[1] - 1].type, m[2] === 'đúng sai' ? 'true_false' : 'multiple_choice', line);
        } else if ((m = line.match(/^câu (\d+):\s*(.+)$/))) {
            const q = questions[m[1] - 1];
            assert.ok(q, `${line} (không có câu ${m[1]})`);
            assert.equal(answerOf(q) || '-', m[2], line);
        } else {
            throw new Error(`Dòng kết quả không hiểu được trong spec: "${line}"`);
        }
    }
}

const examples = collectExamples(spec);

test('spec có ví dụ để chạy', () => {
    assert.ok(examples.length >= 20, `chỉ tìm thấy ${examples.length} ví dụ`);
});

for (const ex of examples) {
    test(`spec: ${ex.heading}`, () => check(ex.expected, app.parse(ex.input)));
}
