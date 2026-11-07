// Mỗi test ở đây gắn với một sự cố đã xảy ra thật, để nó không quay lại.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const wrangler = JSON.parse(read('wrangler.jsonc'));
const html = read('index.html');

test('KV SHARES dùng ID thật (ID giả làm hỏng mọi bản build từ 25/10 đến 6/11/2026)', () => {
    const shares = wrangler.kv_namespaces.find(k => k.binding === 'SHARES');
    assert.match(shares.id, /^[0-9a-f]{32}$/);
});

test('mọi biến worker.js cần đều có trong vars hoặc secrets.required', () => {
    const declared = new Set([...Object.keys(wrangler.vars || {}), ...(wrangler.secrets?.required || [])]);
    for (const name of ['GEMINI_API_KEY', 'CF_AIG_TOKEN', 'CF_AIG_ACCOUNT_ID', 'GEMINI_MODEL']) {
        assert.ok(declared.has(name), `${name} chưa được khai báo`);
    }
});

test('có model dự phòng khác model chính (Gemini từng quá tải ngày 7/11/2026)', () => {
    assert.ok(wrangler.vars.GEMINI_FALLBACK_MODEL, 'thiếu vars.GEMINI_FALLBACK_MODEL');
    assert.notEqual(wrangler.vars.GEMINI_FALLBACK_MODEL, wrangler.vars.GEMINI_MODEL);
});

test('secrets.required chỉ chứa thứ đã tạo trên Cloudflare (thiếu là deploy lỗi)', () => {
    assert.deepEqual([...wrangler.secrets.required].sort(), ['CF_AIG_TOKEN', 'GEMINI_API_KEY']);
});

test('worker chạy trước file tĩnh, để whitelist và header bảo mật luôn được áp', () => {
    assert.equal(wrangler.assets.run_worker_first, true);
});

test('3 thư viện CDN đều có mã SRI', () => {
    const tags = html.match(/<script[^>]+src="https:\/\/cdnjs[^"]+"[^>]*>/g) || [];
    assert.equal(tags.length, 3);
    tags.forEach(t => assert.match(t, /integrity="sha512-[A-Za-z0-9+/=]+"/, t));
});

test('pdf.js mở file với isEvalSupported: false (CVE-2024-4367)', () => {
    assert.match(html, /getDocument\(\{[^}]*isEvalSupported:\s*false/);
});

test('.assetsignore chặn các thư mục không phải web', () => {
    const lines = read('.assetsignore').split('\n').map(l => l.trim());
    for (const entry of ['.claude', 'tests/', 'docs/', 'node_modules', '*.md', 'worker.js', 'wrangler.jsonc']) {
        assert.ok(lines.includes(entry), `.assetsignore thiếu ${entry}`);
    }
});
