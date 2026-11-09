// Thử đề thật bằng đúng code của web (không gọi AI). Chạy ở thư mục gốc repo:
//   node scripts/thu-de-that.mjs <thư_mục_đề> <thư_mục_ra>   trích chữ từng file (.docx .pdf .txt), dựng đề bằng bộ gắn nhãn dự phòng
//   node scripts/thu-de-that.mjs --text <file.txt>        đọc một văn bản đề (ví dụ đề AI dựng, lấy từ EVAL_VERBOSE) theo số câu
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('package.json'));
const { loadApp, answerOf, plainText } = await import(path.resolve('tests/helpers/app.js'));
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const mammoth = require('mammoth');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');
const app = loadApp({ pdfjsLib, JSZip: require('jszip'), DOMParser, XMLSerializer, Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    mammoth: { ...mammoth, convertToHtml: (i, o) => mammoth.convertToHtml(i.arrayBuffer ? { buffer: Buffer.from(i.arrayBuffer) } : i, o) } });
const fn = n => app.fn(n);
const list = text => {
    const p = app.parse(text);
    return { ok: p.ok, thongBao: app.lastToast || '', cau: [...p.questions].map(q => ({ so: q.qNum, loai: q.type, dapAn: answerOf(q) || '-',
        soPhuongAn: q.options.length, de: plainText(q.title).slice(0, 80), phuongAn: [...q.options].map(o => plainText(o.text).slice(0, 40)) })) };
};
if (process.argv[2] === '--text') {
    console.log(JSON.stringify(list(fs.readFileSync(process.argv[3], 'utf8')), null, 1));
} else {
    const [dir, out] = process.argv.slice(2);
    fs.mkdirSync(out, { recursive: true });
    for (const f of fs.readdirSync(dir).sort()) {
        let raw;
        try { raw = await fn('extractTextFromFile')(new File([fs.readFileSync(path.join(dir, f))], f)); }
        catch (e) { console.log(`💥 ${f}: ${e.message}`); continue; }
        const exam = fn('keepFirstExamCode')(fn('prepareLines')(raw));
        const dung = fn('assembleQuizText')(exam.lines, fn('labelLinesLocally')(exam.lines));
        fs.writeFileSync(path.join(out, `${f}.chu.txt`), raw);
        fs.writeFileSync(path.join(out, `${f}.dung.txt`), dung.text);
        // Đề không có đáp án bị web từ chối (0 câu) nhưng vẫn dựng được: đếm câu đã dựng để biết đọc đủ câu chưa.
        const daDung = (dung.text.match(/^(?:câu hỏi đúng sai: )?Câu [^:\n]+:/gm) || []).length;
        const ket = { file: f, kyTu: raw.length, dan: list(fn('stripFormattingTags')(raw)), chuyenFile: { ...list(dung.text), daDung, chuaCoDapAn: dung.unanswered || [] } };
        fs.writeFileSync(path.join(out, `${f}.json`), JSON.stringify(ket, null, 1));
        const tom = r => `${r.ok ? 'ok' : 'TỪ CHỐI'} ${r.cau.length} câu, ${r.cau.filter(c => c.dapAn !== '-').length} có đáp án`;
        console.log(`${f}: ${raw.length} ký tự | dán: ${tom(ket.dan)} | chuyển file: dựng ${daDung} câu, ${tom(ket.chuyenFile)}`);
    }
}
