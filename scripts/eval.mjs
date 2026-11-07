// Đo độ chính xác đọc đề trên bộ đề mẫu (test_exams/) và đề thật (test_exams/private/).
//   npm run eval                 chạy hết; docx đi qua AI thật trên web (có cache)
//   npm run eval -- --no-ai      chỉ chạy file .txt
//   npm run eval -- --fresh      bỏ cache, gọi AI lại
//   npm run eval -- W-05         chỉ chạy file có tên chứa "W-05"
//   EVAL_ENDPOINT=http://127.0.0.1:8787/api/convert npm run eval   dùng worker chạy trên máy
// Đường .txt chạy y như trình duyệt: parseQuizData. Đường docx: extractTextFromFile (mammoth, JSZip như trên web)
// → splitIntoChunks → /api/convert → parseQuizData, giống convertRawFile + "Làm bài ngay".
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { loadApp, plainText, answerOf } from '../tests/helpers/app.js';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'test_exams');
const CACHE_FILE = path.join(ROOT, '.cache', 'ai.json');
const ENDPOINT = process.env.EVAL_ENDPOINT || 'https://web-tao-trac-nghiem.haicu25699652.workers.dev/api/convert';
const AI_GAP_MS = 3500;

const args = process.argv.slice(2);
const useAI = !args.includes('--no-ai');
const fresh = args.includes('--fresh');
const filters = args.filter(a => !a.startsWith('--'));

const nodeMammoth = require('mammoth');
// Bản mammoth cho trình duyệt nhận { arrayBuffer }, bản cho Node lại đòi { buffer }: đổi qua lại cho giống web.
const mammothLikeBrowser = {
    ...nodeMammoth,
    convertToHtml: (input, options) => nodeMammoth.convertToHtml(input.arrayBuffer ? { buffer: Buffer.from(input.arrayBuffer) } : input, options),
};

const app = loadApp({
    JSZip: require('jszip'),
    mammoth: mammothLikeBrowser,
    DOMParser,
    XMLSerializer,
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
});

function loadExpectations() {
    const sets = [];
    for (const dir of [ROOT, path.join(ROOT, 'private')]) {
        const file = path.join(dir, 'expected.json');
        if (!fs.existsSync(file)) continue;
        const { files } = JSON.parse(fs.readFileSync(file, 'utf8'));
        for (const [rel, expected] of Object.entries(files)) sets.push({ rel: path.relative(ROOT, path.join(dir, rel)), abs: path.join(dir, rel), expected });
    }
    return sets.filter(s => filters.length === 0 || filters.some(f => s.rel.includes(f)));
}

const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
let lastCall = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function convertWithAI(text, startIndex) {
    const key = crypto.createHash('sha256').update(`${ENDPOINT}\n${startIndex}\n${text}`).digest('hex');
    if (!fresh && cache[key]) return { ...cache[key], cached: true };
    const wait = lastCall + AI_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, startIndex }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`AI trả lỗi ${res.status}: ${data.error || ''}`);
    cache[key] = { text: data.text || '', truncated: !!data.truncated, model: data.model || '' };
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1));
    return cache[key];
}

async function runThroughAI(raw) {
    const chunks = app.fn('splitIntoChunks')(raw, 6000);
    let combined = '';
    let startIndex = 1;
    let truncated = false;
    let cachedAll = true;
    const models = new Set();
    for (const chunk of chunks) {
        const out = await convertWithAI(chunk, startIndex);
        cachedAll &&= !!out.cached;
        if (out.model) models.add(out.model);
        truncated ||= out.truncated;
        combined += out.text + '\n\n';
        startIndex += app.fn('countQuestionsInText')(out.text);
    }
    return { text: combined.trim(), chunks: chunks.length, truncated, cachedAll, models: [...models] };
}

// Đọc cấu trúc thô của kết quả AI, dùng khi đề không có đáp án (web sẽ từ chối làm bài, nhưng vẫn cần biết AI
// có tách đúng câu và có tự bịa đáp án hay không).
function readStructure(text) {
    const questions = [];
    let q = null;
    for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
        const head = line.match(/^(?:câu hỏi đúng sai:\s*)?Câu\s*\d+\s*[:.]\s*(.*)$/i);
        const opt = line.match(/^(\*?)\s*([A-F])[.)]\s*(.*)$/);
        if (head) { q = { title: head[1], options: [] }; questions.push(q); }
        else if (q && opt) q.options.push({ isCorrect: opt[1] === '*', text: opt[3] });
        else if (q && q.options.length === 0) q.title += ' / ' + line;
    }
    return questions;
}

function compare(expected, result) {
    const problems = [];
    if (expected.rawIncludes && !result.raw.includes(expected.rawIncludes)) problems.push(`chữ trích ra thiếu "${expected.rawIncludes}"`);
    if (expected.rejected) {
        if (result.ok) problems.push(`lẽ ra phải từ chối, nhưng đọc ra ${result.questions.length} câu`);
        return problems;
    }
    if (expected.questions === undefined) return problems;
    const qs = result.questions;
    if (qs.length !== expected.questions) problems.push(`số câu: mong đợi ${expected.questions}, đọc ra ${qs.length}`);
    (expected.answers || []).forEach((want, i) => {
        const q = qs[i];
        const got = q ? (answerOf(q) || '-') : '(thiếu câu)';
        if (got !== want) problems.push(`câu ${i + 1}: mong đợi ${want}, đọc ra ${got}`);
    });
    for (const c of expected.checks || []) {
        const q = qs[c.q - 1];
        if (!q) { problems.push(`câu ${c.q}: không có`); continue; }
        const title = plainText(q.title);
        if (c.title !== undefined && title !== c.title) problems.push(`câu ${c.q} tiêu đề: "${title}"`);
        if (c.titleIncludes && !title.includes(c.titleIncludes)) problems.push(`câu ${c.q} tiêu đề thiếu "${c.titleIncludes}": "${title}"`);
        if (c.options !== undefined && q.options.length !== c.options) problems.push(`câu ${c.q}: ${q.options.length} phương án thay vì ${c.options}`);
        if (c.option) {
            const opt = q.options[c.option.charCodeAt(0) - 65];
            const text = opt ? plainText(opt.text) : '(không có)';
            if (text !== c.text) problems.push(`câu ${c.q} phương án ${c.option}: "${text}"`);
        }
    }
    return problems;
}

async function evaluate({ rel, abs, expected }) {
    const ext = path.extname(abs).toLowerCase();
    if (ext === '.txt') {
        const raw = fs.readFileSync(abs, 'utf8');
        return { raw, ...app.parse(raw), via: 'parser' };
    }
    if (!useAI) return { skipped: 'bỏ qua (--no-ai)' };
    if (ext === '.pdf') return { skipped: 'script chưa đọc được PDF' };
    const buf = fs.readFileSync(abs);
    const raw = await app.fn('extractTextFromFile')(new File([buf], path.basename(abs)));
    if (expected.questions === undefined && !expected.rejected) return { raw, ok: false, questions: [], via: 'trích chữ' };
    const ai = await runThroughAI(raw);
    // Giống convertRawFile: đề gốc không có dấu hiệu đáp án thì bỏ mọi dấu * AI tự thêm.
    const finalized = app.fn('finalizeConvertedText')(ai.text, app.fn('checkTextHasAnswerHint')(raw));
    ai.removedMarks = finalized.removedMarks;
    ai.text = finalized.text;
    const noAnswers = (expected.answers || []).length > 0 && expected.answers.every(a => a === '-');
    if (noAnswers) return { raw, ai, ok: true, questions: readStructure(ai.text), via: 'AI (đọc cấu trúc)' };
    return { raw, ai, ...app.parse(ai.text), via: 'AI → parser' };
}

const sets = loadExpectations();
let pass = 0;
const failures = [];
for (const set of sets) {
    let result;
    try {
        result = await evaluate(set);
    } catch (err) {
        failures.push(set.rel);
        console.log(`💥 ${set.rel}: ${err.message}`);
        continue;
    }
    if (result.skipped) { console.log(`⏭️  ${set.rel}: ${result.skipped}`); continue; }
    const problems = compare(set.expected, result);
    const tag = `${result.via}${result.ai?.models?.length ? ', ' + result.ai.models.join('+') : ''}${result.ai?.removedMarks ? `, bỏ ${result.ai.removedMarks} đáp án AI đoán` : ''}${result.ai?.cachedAll ? ', cache' : ''}${result.ai?.truncated ? ', BỊ CẮT' : ''}`;
    if (problems.length === 0) { pass++; console.log(`✅ ${set.rel} (${tag})`); }
    else {
        failures.push(set.rel);
        console.log(`❌ ${set.rel} (${tag})\n   - ${problems.join('\n   - ')}`);
        if (set.expected.note) console.log(`   ghi chú: ${set.expected.note}`);
        if (process.env.EVAL_VERBOSE && result.ai) console.log('   --- AI trả về ---\n' + result.ai.text.split('\n').map(l => '   | ' + l).join('\n'));
    }
}
const ran = pass + failures.length;
console.log(`\nĐúng ${pass}/${ran} file${ran ? ` (${Math.round((pass / ran) * 100)}%)` : ''}. Endpoint AI: ${useAI ? ENDPOINT : 'không dùng'}`);
process.exit(failures.length ? 1 : 0);
