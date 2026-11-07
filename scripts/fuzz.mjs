// Fuzz: sinh hàng nghìn đề hợp lệ có đáp án biết trước rồi so với kết quả web đọc ra (không gọi AI, không mạng).
//   npm run fuzz                     chạy cả 3 phần
//   npm run fuzz -- text 6000        chỉ đề văn bản: đường dán .txt (parseQuizData) và đường chuyển file
//                                    (prepareLines → labelLinesLocally → assembleQuizText → parseQuizData)
//   npm run fuzz -- docx 600         chỉ đề Word có gạch chân / tô sáng / chữ màu / in đậm đánh dấu đáp án
//   npm run fuzz -- labels 2500      đề KHÔNG có đáp án + nhãn AI ngẫu nhiên: không dãy nhãn nào được làm ra đáp án
//   thêm --seed=N để đổi bộ đề, --show=N để in N ví dụ mỗi nhóm lỗi
// Thoát với mã 1 nếu có đáp án bị bịa ra từ đề không có bằng chứng (text, docx), hoặc bị lỗi chạy (crash).
// Các nhóm lỗi đã biết, mức thấp (xem docs/dinh-dang-de.md, mục "Giới hạn đã biết") chỉ được in ra.
import { createRequire } from 'node:module';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { loadApp, plainText, answerOf } from '../tests/helpers/app.js';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const nodeMammoth = require('mammoth');
const mammothLikeBrowser = {
    ...nodeMammoth,
    convertToHtml: (input, options) => nodeMammoth.convertToHtml(input.arrayBuffer ? { buffer: Buffer.from(input.arrayBuffer) } : input, options),
};
const app = loadApp({ JSZip, mammoth: mammothLikeBrowser, DOMParser, XMLSerializer, Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 } });
const fn = name => app.fn(name);

const args = process.argv.slice(2);
const modes = args.filter(a => ['text', 'docx', 'labels'].includes(a));
const countArg = Number(args.find(a => /^\d+$/.test(a)) || 0);
let seed = Number((args.find(a => a.startsWith('--seed=')) || '--seed=777').slice(7));
const SHOW = Number((args.find(a => a.startsWith('--show=')) || '--show=1').slice(7));
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const chance = p => rnd() < p;
const norm = s => String(s).replace(/ \/ /g, ' ').replace(/\s+/g, ' ').trim();
const LETTERS = 'ABCDEF';

const summarize = qs => [...qs].map(q => ({ type: q.type, title: plainText(q.title), options: [...q.options].map(o => plainText(o.text)), answer: answerOf(q) || '-' }));
function parseTxt(text) {
    const r = app.parse(text);
    return { ok: r.ok, questions: summarize(r.questions) };
}
function convertText(raw, aiLabels) {
    const exam = fn('keepFirstExamCode')(fn('prepareLines')(raw || ''));
    const labels = new Array(exam.lines.length);
    for (const c of fn('chunkLines')(exam.lines, 8000)) {
        const before = fn('lastQuestionNumber')(exam.lines.slice(0, c.start), labels.slice(0, c.start));
        const got = aiLabels ? fn('reconcileLabels')(c.lines, aiLabels([...c.lines], c.start), before) : fn('labelLinesLocally')(c.lines);
        [...got].forEach((l, j) => { labels[c.start + j] = l; });
    }
    const assembled = fn('assembleQuizText')(exam.lines, labels);
    const parsed = app.parse(assembled.text);
    return { lines: [...exam.lines], labels, text: assembled.text, unanswered: [...assembled.unanswered], ok: parsed.ok, questions: summarize(parsed.questions) };
}

const report = { fabricated: 0, crashed: 0 };
function printGroups(title, groups, describe) {
    console.log(`\n## ${title}: ${[...groups.values()].reduce((a, l) => a + l.length, 0)} lượt sai, ${groups.size} nhóm`);
    for (const [key, list] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
        console.log(`### ${list.length}× ${key}`);
        for (const ex of list.slice(0, SHOW)) console.log(describe(ex));
    }
}
const addGroup = (groups, key, item) => { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); };

// ---------------- Đề văn bản ----------------
const WORDS = ['Hà Nội', 'Huế', 'nước', 'tế bào', 'quang hợp', 'năng lượng', 'phản ứng', 'dân số', 'kinh tế', 'lịch sử',
    'hiệp định', 'vận tốc', 'gia tốc', 'điện trở', 'hàm số', 'đạo hàm', 'tích phân', 'protein', 'gen', 'nhiễm sắc thể',
    'axit', 'bazơ', 'muối ăn', 'khí hậu', 'địa hình', 'sông Hồng', 'đồng bằng', 'thuật toán', 'biến đếm', 'vòng lặp',
    'mạng máy tính', 'nông nghiệp', 'công nghiệp', 'dịch vụ', 'miền Bắc', 'miền Nam'];
const EXTRAS = ['2,5', '0,5', '10%', 'năm 1945', 'x = 2', 'TP. Hồ Chí Minh', 'Vitamin C', 'CO₂', 'H₂O', '$x^2+1$',
    '"Tắt đèn"', 'khoảng 3 km', 'thế kỉ XX', 'Điều 5', '(1) và (2)'];
const words = (n, extras) => Array.from({ length: n }, () => (extras && chance(0.15) ? pick(EXTRAS) : pick(WORDS))).join(' ');
const QFMT = { 'Câu N:': n => `Câu ${n}:`, 'Câu N.': n => `Câu ${n}.`, 'Bài N:': n => `Bài ${n}:`, 'Question N.': n => `Question ${n}.`, 'N.': n => `${n}.`, 'N)': n => `${n})` };
const OFMT = { 'A.': L => `${L}.`, 'A)': L => `${L})`, 'A:': L => `${L}:`, 'A/': L => `${L}/`, '(A)': L => `(${L})` };
const EVIDENCE = ['none', 'star-prefix', 'star-prefix', 'star-suffix', 'star-paren', 'md-bold', 'answer-line', 'choose-line',
    'table-inline', 'table-lines', 'table-grid', 'partial'];
const STEM_EXTRA = {
    none: [],
    source: ['(Nguồn: Niên giám thống kê 2020)'],
    yearData: ['Năm 2019: 96,5 triệu người; năm 2020: 97,6 triệu người.'],
    roman: ['Cho các phát biểu sau:', 'I. Rừng ngập mặn có ở ven biển.', 'II. Rừng tràm có ở Đồng Tháp.', 'Có bao nhiêu phát biểu đúng?'],
    paren: ['Cho các phát biểu sau:', '(1) Rừng ngập mặn có ở ven biển.', '(2) Rừng tràm có ở Đồng Tháp.', 'Số phát biểu đúng là'],
    numbered: ['Cho các nhận định sau:', '1. Rừng ngập mặn có ở ven biển.', '2. Rừng tràm có ở Đồng Tháp.', 'Số nhận định đúng là'],
    letters: ['Cho các thí nghiệm sau:', '(a) Cho Na vào nước.', '(b) Cho Fe vào dung dịch HCl.', 'Số thí nghiệm có khí là'],
    poem: ['Đọc đoạn thơ sau:', '"Mình về mình có nhớ ta', 'Mười lăm năm ấy thiết tha mặn nồng"'],
};
const HEADER = ['SỞ GIÁO DỤC VÀ ĐÀO TẠO HÀ NỘI', 'ĐỀ KIỂM TRA CUỐI KÌ I - MÔN ĐỊA LÍ 12', 'Thời gian làm bài: 45 phút', 'Họ và tên: ............ SBD: ......', 'Mã đề 101'];

function genTextCase() {
    const c = { qfmt: pick(Object.keys(QFMT)), ofmt: pick(Object.keys(OFMT)), layout: pick(['lines', 'lines', 'tab', 'spaces4', 'pairs', 'space1']), evidence: pick(EVIDENCE) };
    c.simple = c.layout === 'space1' || chance(0.3);
    c.header = chance(0.5) ? HEADER : [];
    c.footer = chance(0.3) ? [pick(['HẾT', '----- HẾT -----'])] : [];
    c.pageFooter = chance(0.2);
    const allowTF = !c.evidence.startsWith('table') && !['star-suffix', 'star-paren', 'md-bold', 'choose-line'].includes(c.evidence);
    c.qs = [];
    for (let n = 1, count = 1 + Math.floor(rnd() * 5); n <= count; n++) {
        const tf = allowTF && chance(0.25);
        let extraKind = 'none';
        if (!tf && chance(0.35)) extraKind = pick(Object.keys(STEM_EXTRA).filter(k => !(k === 'numbered' && /^N/.test(c.qfmt)) && !(k === 'letters' && c.ofmt === '(A)')));
        const q = { n, tf, stem: words(3 + Math.floor(rnd() * 4), !c.simple) + '?', extra: STEM_EXTRA[extraKind] };
        if (tf) {
            q.marker = pick(['A.', 'a)']);
            q.opts = Array.from({ length: 4 }, () => words(3, !c.simple));
            q.truth = Array.from({ length: 4 }, () => chance(0.5));
            if (!q.truth.some(Boolean)) q.truth[Math.floor(rnd() * 4)] = true;
        } else {
            const seen = new Set();
            q.opts = [];
            while (q.opts.length < 4) { const t = words(1 + Math.floor(rnd() * 3), !c.simple); if (!seen.has(t)) { seen.add(t); q.opts.push(t); } }
            q.correct = Math.floor(rnd() * 4);
        }
        q.hasEvidence = c.evidence === 'none' ? false : c.evidence === 'partial' ? chance(0.5) : true;
        c.qs.push(q);
    }
    return c;
}

function renderText(c) {
    const out = [...c.header];
    for (const q of c.qs) {
        out.push(`${q.tf ? `câu hỏi đúng sai: Câu ${q.n}:` : QFMT[c.qfmt](q.n)} ${q.stem}`, ...q.extra);
        if (q.tf) {
            const star = q.hasEvidence && (c.evidence === 'star-prefix' || c.evidence === 'partial');
            q.opts.forEach((t, i) => out.push(`${star && q.truth[i] ? '*' : ''}${q.marker === 'a)' ? 'abcd'[i] + ')' : LETTERS[i] + '.'} ${t}`));
            if (q.hasEvidence && c.evidence === 'answer-line') {
                const ds = q.truth.map(v => (v ? 'Đ' : 'S'));
                out.push(pick([`Đáp án: ${ds.join('')}`, `Đáp án: ${ds.map((v, i) => `${'abcd'[i]}) ${v}`).join(' ')}`]));
            }
        } else {
            const ev = c.evidence === 'partial' ? 'star-prefix' : c.evidence;
            const opts = q.opts.map((t, i) => {
                const m = OFMT[c.ofmt](LETTERS[i]);
                if (!(q.hasEvidence && i === q.correct)) return `${m} ${t}`;
                return { 'star-prefix': `*${m} ${t}`, 'star-suffix': `${m} ${t} *`, 'star-paren': `${m} ${t} (*)`, 'md-bold': `**${m} ${t}**` }[ev] || `${m} ${t}`;
            });
            if (c.layout === 'lines') out.push(...opts);
            else if (c.layout === 'tab') out.push(opts.join('\t'));
            else if (c.layout === 'spaces4') out.push(opts.join('    '));
            else if (c.layout === 'pairs') out.push(opts.slice(0, 2).join('\t'), opts.slice(2).join('\t'));
            else out.push(opts.join(' '));
            if (q.hasEvidence && c.evidence === 'answer-line') out.push(pick([`Đáp án: ${LETTERS[q.correct]}`, `Đáp án đúng: ${LETTERS[q.correct]}`, `**Đáp án: ${LETTERS[q.correct]}**`]));
            if (q.hasEvidence && c.evidence === 'choose-line') out.push(pick([`Lời giải: Vì ${words(3, false)} nên chọn ${LETTERS[q.correct]}.`, `Lời giải: Chọn ${LETTERS[q.correct]} vì phương án ${LETTERS[(q.correct + 1) % 4]} sai.`]));
        }
        if (c.pageFooter && q.n === 1) out.push('Trang 1/2 - Mã đề 101');
    }
    const mcs = c.qs.filter(q => !q.tf);
    if (c.evidence === 'table-inline') { const f = pick(['', '-', '.']); out.push('Đáp án: ' + mcs.map(q => `${q.n}${f}${LETTERS[q.correct]}`).join(f === '-' ? ', ' : ' ')); }
    if (c.evidence === 'table-lines') out.push(pick(['Đáp án:', 'BẢNG ĐÁP ÁN', '----- ĐÁP ÁN -----']), mcs.map(q => `${q.n}.${LETTERS[q.correct]}`).join(' '));
    if (c.evidence === 'table-grid') out.push('Đáp án:', mcs.map(q => q.n).join(' '), mcs.map(q => LETTERS[q.correct]).join(' '));
    out.push(...c.footer);
    return out.join('\n');
}

function runText(n) {
    const groups = new Map();
    for (let i = 0; i < n; i++) {
        const c = genTextCase();
        const text = renderText(c);
        const want = c.qs.filter(q => q.hasEvidence).map(q => ({
            type: q.tf ? 'true_false' : 'multiple_choice',
            answer: q.tf ? q.truth.map(v => (v ? 'Đ' : 'S')).join('') : LETTERS[q.correct],
            title: norm([q.stem, ...q.extra].join(' / ')),
            options: q.opts.map(norm),
        }));
        for (const path of ['txt', 'convert']) {
            let got;
            try { got = path === 'txt' ? parseTxt(text) : convertText(text); } catch (err) { got = { crash: String(err && err.stack || err).split('\n')[0] }; }
            const problems = [];
            if (got.crash) { problems.push('CRASH ' + got.crash); report.crashed++; }
            else if (want.length === 0) {
                if (got.ok && got.questions.length) { problems.push('BỊA ĐÁP ÁN'); report.fabricated++; }
            } else if (!got.ok) problems.push('từ chối');
            else {
                if (got.questions.length !== want.length) problems.push('số câu');
                want.forEach((w, k) => {
                    const g = got.questions[k];
                    if (!g) return;
                    if (g.type !== w.type) problems.push('loại câu');
                    if (g.answer !== w.answer) problems.push('đáp án');
                    if (g.options.length !== w.options.length) problems.push('số phương án');
                    else if (w.options.some((o, j) => norm(g.options[j]) !== o)) problems.push('chữ phương án');
                    if (norm(g.title) !== w.title) problems.push('đề bài');
                });
            }
            if (problems.length) addGroup(groups, `${path} | ${c.evidence} | ${[...new Set(problems)].join(', ')} | ${c.qs.length === 1 ? '1 câu' : 'nhiều câu'} | ${c.layout}`, { text, got });
        }
    }
    printGroups(`Đề văn bản (${n} đề × 2 đường)`, groups, ex => ex.text.split('\n').map(l => '    | ' + l).join('\n') + `\n    → ${JSON.stringify((ex.got.questions || []).map(q => [q.type[0], q.answer, q.options.length]))}`);
}

// ---------------- Đề Word ----------------
const FMT = { U: '<w:u w:val="single"/>', HL: '<w:highlight w:val="yellow"/>', CLR: '<w:color w:val="FF0000"/>', B: '<w:b/>', BLUE: '<w:color w:val="0000FF"/>' };
const DOCX_KINDS = ['U-content', 'U-letter', 'HL', 'CLR', 'B-content', 'star', 'none', 'none-bold-letters', 'none-all-blue',
    'CLR-on-blue', 'none-stem-underline', 'none-partial-word', 'none-all-bold', 'conflict', 'math-HL', 'none-math'];
const DOCX_ANSWERED = new Set(['U-content', 'U-letter', 'HL', 'CLR', 'B-content', 'star', 'CLR-on-blue', 'math-HL']);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function runs(text, fmts) {
    const pieces = [];
    for (let rest = text; rest.length > 0;) {
        const cut = rest.length <= 3 || chance(0.6) ? rest.length : 1 + Math.floor(rnd() * (rest.length - 1));
        pieces.push(rest.slice(0, cut));
        rest = rest.slice(cut);
    }
    const rPr = fmts.length ? `<w:rPr>${fmts.map(f => FMT[f]).join('')}</w:rPr>` : '';
    return pieces.map(p => `<w:r>${rPr}<w:t xml:space="preserve">${esc(p)}</w:t></w:r>`).join('');
}
async function makeDocx(bodyXml) {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>${bodyXml}</w:body></w:document>`);
    return zip.generateAsync({ type: 'nodebuffer' });
}

async function runDocx(n) {
    const groups = new Map();
    for (let i = 0; i < n; i++) {
        const kind = pick(DOCX_KINDS);
        const layout = kind.includes('math') ? 'lines' : pick(['lines', 'lines', 'tab', 'pairs']);
        const base = kind === 'none-all-blue' || kind === 'CLR-on-blue' ? ['BLUE'] : [];
        const body = [];
        const want = [];
        for (let q = 1, count = 1 + Math.floor(rnd() * 3); q <= count; q++) {
            const tf = ['U-content', 'HL', 'CLR', 'star', 'none', 'none-all-blue', 'CLR-on-blue', 'none-stem-underline'].includes(kind) && chance(0.25);
            const opts = [];
            const seen = new Set();
            while (opts.length < 4) { const t = Array.from({ length: tf ? 3 : 1 + Math.floor(rnd() * 3) }, () => pick(WORDS)).join(' '); if (!seen.has(t)) { seen.add(t); opts.push(t); } }
            const correct = Math.floor(rnd() * 4);
            let truth = null;
            if (tf) { truth = [0, 1, 2, 3].map(() => chance(0.5)); if (!truth.some(Boolean)) truth[correct] = true; if (truth.every(Boolean)) truth[(correct + 1) % 4] = false; }
            const right = k => (tf ? truth[k] : k === correct);
            const stem = Array.from({ length: 4 }, () => pick(WORDS)).join(' ') + '?';
            const head = `${tf ? 'câu hỏi đúng sai: ' : ''}Câu ${q}: `;
            if (kind === 'none-stem-underline') { const w = stem.split(' '); body.push(`<w:p>${runs(head + w.slice(0, 2).join(' ') + ' ', base)}${runs(w[2], [...base, 'U'])}${runs(' ' + w.slice(3).join(' '), base)}</w:p>`); }
            else body.push(`<w:p>${runs(head + stem, base)}</w:p>`);
            const optXml = opts.map((t, k) => {
                const L = tf ? 'abcd'[k] + ')' : 'ABCD'[k] + '.';
                if (kind === 'math-HL' || kind === 'none-math') {
                    const rPr = kind === 'math-HL' && right(k) ? `<w:rPr>${FMT.HL}</w:rPr>` : '';
                    return `${runs(L + ' ', [])}<m:oMath><m:r>${rPr}<m:t>x=${k + 1}</m:t></m:r></m:oMath>`;
                }
                let letterF = [...base], contentF = [...base];
                if (right(k) && kind === 'U-content') contentF.push('U');
                if (right(k) && kind === 'U-letter') letterF.push('U');
                if (right(k) && kind === 'HL') contentF.push('HL');
                if (right(k) && (kind === 'CLR' || kind === 'CLR-on-blue')) contentF = [...contentF.filter(f => f !== 'BLUE'), 'CLR'];
                if (right(k) && kind === 'B-content') contentF.push('B');
                if (kind === 'none-bold-letters') letterF.push('B');
                if (kind === 'none-all-bold') { letterF.push('B'); contentF.push('B'); }
                if (kind === 'conflict' && k === correct) contentF.push('U');
                if (kind === 'conflict' && k === (correct + 1) % 4) contentF.push('HL');
                if (kind === 'none-partial-word' && k === correct && t.split(' ').length >= 3) { const w = t.split(' '); return runs(L + ' ', letterF) + runs(w[0], [...base, 'U']) + runs(' ' + w.slice(1).join(' '), base); }
                return runs(`${kind === 'star' && right(k) ? '*' : ''}${L}`, letterF) + runs(' ', base) + runs(t, contentF);
            });
            if (layout === 'lines' || tf) optXml.forEach(o => body.push(`<w:p>${o}</w:p>`));
            else if (layout === 'tab') body.push(`<w:p>${optXml.join('<w:r><w:tab/></w:r>')}</w:p>`);
            else body.push(`<w:p>${optXml[0]}<w:r><w:tab/></w:r>${optXml[1]}</w:p>`, `<w:p>${optXml[2]}<w:r><w:tab/></w:r>${optXml[3]}</w:p>`);
            const noEvidence = !DOCX_ANSWERED.has(kind) || (kind === 'none-partial-word');
            want.push(noEvidence ? '-' : tf ? truth.map(v => (v ? 'Đ' : 'S')).join('') : 'ABCD'[correct]);
        }
        let got;
        try {
            const raw = await fn('extractTextFromFile')(new File([await makeDocx(body.join(''))], 'de.docx'));
            got = convertText(raw);
        } catch (err) { got = { crash: String(err) }; }
        const problems = [];
        if (got.crash) { problems.push('CRASH ' + got.crash); report.crashed++; }
        else {
            const gotAnswers = got.ok ? got.questions.map(q => q.answer).join(',') : '';
            const wantAnswers = want.filter(a => a !== '-').join(',');
            if (gotAnswers !== wantAnswers) {
                problems.push(`đáp án [${gotAnswers}] thay vì [${wantAnswers}]`);
                if (wantAnswers === '' && gotAnswers !== '') report.fabricated++;
            }
        }
        if (problems.length) addGroup(groups, `${kind} | ${problems[0].replace(/\[[^\]]*\]/g, '[..]')}`, { problems, text: got.text || '' });
    }
    printGroups(`Đề Word (${n} file)`, groups, ex => '    ' + ex.problems.join('; ') + '\n' + ex.text.split('\n').map(l => '    | ' + l).join('\n'));
}

// ---------------- Nhãn AI ngẫu nhiên trên đề không có đáp án ----------------
const LABELS = ['cau_hoi', 'cau_hoi_dung_sai', 'noi_dung_cau_hoi', 'phuong_an', 'noi_dung_phuong_an', 'dap_an', 'bang_dap_an', 'bo_qua'];
const NO_ANSWER_EXAMS = [
    'ĐỀ KIỂM TRA 15 PHÚT\nChọn đáp án đúng nhất cho mỗi câu sau.\nCâu 1: Thủ đô của Việt Nam là\nA. Huế\nB. Hà Nội\nC. Vinh\nD. Đà Nẵng\nCâu 2: Phát biểu nào sau đây đúng?\nA. Nước sôi ở 90 độ C\nB. Nước sôi ở 100 độ C\nC. Nước đóng băng ở 10 độ C\nD. Nước không bay hơi',
    'Câu 1. Cho các phát biểu sau:\nI. Rừng ngập mặn có ở ven biển.\nII. Rừng tràm có ở Đồng Tháp.\nCó bao nhiêu phát biểu đúng?\nA. 1\nB. 2\nC. 3\nD. 4\nCâu 2. Năm 2019 dân số nước ta khoảng\nA. 86 triệu\nB. 90 triệu\nC. 96 triệu\nD. 100 triệu\nĐÁP ÁN\n1\n2',
    'câu hỏi đúng sai: Câu 1: Cho hàm số y = x².\na) Hàm số chẵn.\nb) Đồ thị đi qua (1; 2).\nc) Hàm số có cực tiểu.\nd) Hàm số đồng biến trên R.\nCâu 2: Chọn câu đúng.\nA. a = 2\nB. b = 3\nC. c = 4\nD. d = 5',
    'PHẦN I\nCâu 1: Đơn vị của điện trở là\nA. Ôm\nB. Vôn\nC. Ampe\nD. Oát\nPhương án nào đúng?\nCâu 2: Đâu là số nguyên tố?\nA. 4\nB. 6\nC. 7\nD. 9\nPHẦN II\nCâu 1: Lại hỏi?\nA. a\nB. b\nHẾT',
    'Câu 1: Từ nào viết đúng chính tả?\nA. Sán lạn\nB. Xán lạn\nC. Sáng lạng\nD. Xán lạng\nGhi chú: A, B, C, D là các phương án.\nCâu 2: Python in ra gì với print(2**3 + 4**2)?\nA. 24\nB. 24.0\nC. 14\nD. 10',
    'Câu 1: Tìm a?\nA. 1\nB. 2\nC. 3\nD. 4\nVậy a = 2\nLời giải: Phương án A sai, phương án B sai.\nCâu 2: Cho các chất sau:\na) NaCl\nb) HCl\nCó bao nhiêu chất là axit?\nA. 1\nB. 2\nC. 3\nD. 0',
];
function runLabels(tries) {
    const kinds = new Map();
    for (const exam of NO_ANSWER_EXAMS) {
        const base = convertText(exam);
        for (let t = 0; t < tries; t++) {
            const labels = chance(0.2) ? base.lines.map(() => pick(LABELS)) : [...base.labels];
            for (let k = 0, m = 1 + Math.floor(rnd() * 4); k < m; k++) labels[Math.floor(rnd() * labels.length)] = pick(LABELS);
            const r = convertText(exam, () => labels);
            const answered = r.ok ? r.questions.filter(q => q.answer !== '-') : [];
            if (!answered.length && !/^\*/m.test(r.text)) continue;
            const key = answered.map(q => `${q.type === 'true_false' ? 'đúng/sai' : 'trắc nghiệm'} ${q.answer}`).join(', ') || 'có dấu * trong đề dựng';
            addGroup(kinds, key, { r });
        }
    }
    // Không tính là lỗi chặn: các dãy nhãn ở đây là nhãn sai phi lý; dùng để thấy đường nào nhãn có thể tạo ra đáp án.
    printGroups(`Nhãn AI ngẫu nhiên (${NO_ANSWER_EXAMS.length} đề × ${tries} dãy nhãn)`, kinds, ex => ex.r.lines.map((l, i) => `    ${String(ex.r.labels[i]).padEnd(18)} ${l}`).join('\n'));
}

const run = modes.length ? modes : ['text', 'docx', 'labels'];
if (run.includes('text')) runText(countArg || 3000);
if (run.includes('docx')) await runDocx(countArg || 400);
if (run.includes('labels')) runLabels(countArg || 1500);
console.log(`\nĐáp án bịa ra từ đề không có bằng chứng: ${report.fabricated}. Lỗi chạy: ${report.crashed}.`);
process.exit(report.fabricated || report.crashed ? 1 : 0);
