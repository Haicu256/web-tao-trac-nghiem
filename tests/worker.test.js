// Kiểm tra worker.js bằng Request/Response thật của Node; KV và Gemini được thay bằng bản giả.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const QUIZ = 'Câu 1: Thủ đô?\nA. Huế\n*B. Hà Nội';
const AI_ENV = { GEMINI_API_KEY: 'k', CF_AIG_TOKEN: 't', CF_AIG_ACCOUNT_ID: 'acc' };

function post(path, body, headers = { 'Content-Type': 'application/json' }) {
    return new Request(`https://x${path}`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

function fakeGemini(reply, status = 200) {
    const calls = [];
    globalThis.fetch = async (url, opts) => {
        calls.push({ url, body: JSON.parse(opts.body) });
        return new Response(JSON.stringify(reply), { status, headers: { 'Content-Type': 'application/json' } });
    };
    return calls;
}

const okReply = text => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });

function fakeGeminiSequence(steps) {
    const calls = [];
    globalThis.fetch = async (url, opts) => {
        calls.push({ url, body: JSON.parse(opts.body) });
        const step = steps[Math.min(calls.length, steps.length) - 1];
        if (step instanceof Error) throw step;
        return new Response(JSON.stringify(step.body), { status: step.status, headers: { 'Content-Type': 'application/json' } });
    };
    return calls;
}

const overloaded = { status: 503, body: { error: { code: 503, message: 'This model is currently experiencing high demand.' } } };
const FALLBACK_ENV = { ...AI_ENV, GEMINI_MODEL: 'gemini-3.1-flash-lite', GEMINI_FALLBACK_MODEL: 'gemini-3.5-flash-lite' };

function fakeKV(initial = {}) {
    const data = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
    const puts = [];
    return {
        puts,
        data,
        get: async k => data.get(k) ?? null,
        put: async (k, v, opts) => { puts.push({ k, v: JSON.parse(v), opts }); data.set(k, v); },
    };
}

test('convert: kiểu cũ { text } (AI viết lại đề, tự đánh dấu đáp án) bị từ chối và không gọi AI', async () => {
    const calls = fakeGemini(okReply(QUIZ));
    const res = await worker.fetch(post('/api/convert', { text: QUIZ }), AI_ENV);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).text, undefined);
    assert.equal(calls.length, 0);
});

// ===== Chế độ gắn nhãn dòng (docs/thiet-ke/gan-nhan-dong.md) =====
const LINES = ['SỞ GD&ĐT', 'Câu 1: Thủ đô?', 'A. Huế', '⟦U⟧B. Hà Nội⟦/U⟧'];
const labelReply = doan => okReply(JSON.stringify({ doan }));
const GOOD_LABELS = [
    { tu: 1, den: 1, loai: 'bo_qua' },
    { tu: 2, den: 2, loai: 'cau_hoi' },
    { tu: 3, den: 4, loai: 'phuong_an' },
];

test('gắn nhãn: trả về các đoạn nhãn và tên model', async () => {
    fakeGemini(labelReply(GOOD_LABELS));
    const res = await worker.fetch(post('/api/convert', { lines: LINES }), AI_ENV);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.doan, GOOD_LABELS);
    assert.equal(data.model, 'gemini-3.1-flash-lite');
    assert.equal(data.text, undefined, 'chế độ gắn nhãn không trả chữ');
});

test('gắn nhãn: bắt Gemini trả JSON đúng khuôn (responseSchema với danh sách nhãn cố định)', async () => {
    const calls = fakeGemini(labelReply(GOOD_LABELS));
    await worker.fetch(post('/api/convert', { lines: LINES }), AI_ENV);
    const cfg = calls[0].body.generationConfig;
    assert.equal(cfg.responseMimeType, 'application/json');
    const item = cfg.responseSchema.properties.doan.items;
    assert.deepEqual(item.required, ['tu', 'den', 'loai']);
    assert.deepEqual(item.properties.loai.enum, ['cau_hoi', 'cau_hoi_dung_sai', 'noi_dung_cau_hoi', 'phuong_an', 'noi_dung_phuong_an', 'dap_an', 'bang_dap_an', 'bo_qua']);
    assert.equal(item.properties.tu.type, 'INTEGER');
});

test('gắn nhãn: AI nhận dòng đã đánh số, không có thẻ định dạng', async () => {
    const calls = fakeGemini(labelReply(GOOD_LABELS));
    await worker.fetch(post('/api/convert', { lines: LINES }), AI_ENV);
    const prompt = calls[0].body.contents[0].parts[0].text;
    assert.ok(prompt.includes('L2: Câu 1: Thủ đô?'));
    assert.ok(prompt.includes('L4: B. Hà Nội'));
    assert.ok(!prompt.includes('⟦U⟧'));
});

test('gắn nhãn: đoạn nhãn bỏ sót hoặc trùng dòng thì báo lỗi để trình duyệt thử lại', async () => {
    for (const bad of [
        [{ tu: 1, den: 1, loai: 'bo_qua' }, { tu: 3, den: 4, loai: 'phuong_an' }],
        [{ tu: 1, den: 2, loai: 'bo_qua' }, { tu: 2, den: 4, loai: 'phuong_an' }],
        [{ tu: 1, den: 5, loai: 'bo_qua' }],
    ]) {
        fakeGemini(labelReply(bad));
        const res = await worker.fetch(post('/api/convert', { lines: LINES }), AI_ENV);
        assert.equal(res.status, 502, JSON.stringify(bad));
    }
});

test('gắn nhãn: AI trả không phải JSON thì báo lỗi 502', async () => {
    fakeGemini(okReply('Câu 1: đây là chữ chứ không phải JSON'));
    const res = await worker.fetch(post('/api/convert', { lines: LINES }), AI_ENV);
    assert.equal(res.status, 502);
});

test('gắn nhãn: từ chối danh sách dòng rỗng, sai kiểu hoặc quá dài', async () => {
    assert.equal((await worker.fetch(post('/api/convert', { lines: [] }), AI_ENV)).status, 400);
    assert.equal((await worker.fetch(post('/api/convert', { lines: ['a', 3] }), AI_ENV)).status, 400);
    assert.equal((await worker.fetch(post('/api/convert', { lines: Array(2001).fill('x') }), AI_ENV)).status, 413);
    assert.equal((await worker.fetch(post('/api/convert', { lines: ['a'.repeat(50_001)] }), AI_ENV)).status, 413);
});

test('gắn nhãn: model chính quá tải thì dùng model dự phòng', async () => {
    const calls = fakeGeminiSequence([overloaded, { status: 200, body: labelReply(GOOD_LABELS) }]);
    const res = await worker.fetch(post('/api/convert', { lines: LINES }), FALLBACK_ENV);
    assert.equal(res.status, 200);
    assert.equal(calls.length, 2);
    assert.equal((await res.json()).model, 'gemini-3.5-flash-lite');
});

const labelsOk = { status: 200, body: labelReply(GOOD_LABELS) };
const convert = env => worker.fetch(post('/api/convert', { lines: LINES }), env);

test('gắn nhãn: model chính quá thời gian chờ thì cũng thử model dự phòng', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const calls = fakeGeminiSequence([timeout, labelsOk]);
    const res = await convert(FALLBACK_ENV);
    assert.equal(res.status, 200);
    assert.equal(calls.length, 2);
});

test('gắn nhãn: Gemini báo 429 (hết hạn ngạch model) thì thử model dự phòng', async () => {
    const calls = fakeGeminiSequence([{ status: 429, body: { error: 'quota' } }, labelsOk]);
    assert.equal((await convert(FALLBACK_ENV)).status, 200);
    assert.equal(calls.length, 2);
});

test('gắn nhãn: lỗi xác thực không thử model dự phòng', async () => {
    const calls = fakeGeminiSequence([{ status: 401, body: { error: 'bad key' } }]);
    assert.equal((await convert(FALLBACK_ENV)).status, 401);
    assert.equal(calls.length, 1);
});

test('gắn nhãn: không cấu hình model dự phòng thì báo lỗi như cũ', async () => {
    const calls = fakeGeminiSequence([overloaded]);
    assert.equal((await convert(AI_ENV)).status, 503);
    assert.equal(calls.length, 1);
});

test('gắn nhãn: cả hai model đều quá tải thì báo lỗi quá tải', async () => {
    const calls = fakeGeminiSequence([overloaded, overloaded]);
    const res = await convert(FALLBACK_ENV);
    assert.equal(res.status, 503);
    assert.equal(calls.length, 2);
    assert.match((await res.json()).error, /quá tải|không khả dụng/);
});

test('gắn nhãn: model dự phòng dùng cấu hình riêng theo tên model', async () => {
    const calls = fakeGeminiSequence([overloaded, labelsOk]);
    await convert({ ...FALLBACK_ENV, GEMINI_FALLBACK_MODEL: 'gemini-2.5-flash' });
    assert.equal(calls[0].body.generationConfig.temperature, 1);
    assert.equal(calls[0].body.generationConfig.thinkingConfig, undefined);
    assert.deepEqual(calls[1].body.generationConfig.thinkingConfig, { thinkingBudget: 1024 });
});

test('gắn nhãn: gọi Gemini qua AI Gateway với model trong GEMINI_MODEL, mặc định gemini-3.1-flash-lite', async () => {
    const calls = fakeGemini(labelReply(GOOD_LABELS));
    assert.equal((await convert({ ...AI_ENV, GEMINI_MODEL: 'gemini-2.5-flash' })).status, 200);
    await convert(AI_ENV);
    assert.equal(calls[0].url, 'https://gateway.ai.cloudflare.com/v1/acc/default/google-ai-studio/v1beta/models/gemini-2.5-flash:generateContent');
    assert.match(calls[1].url, /models\/gemini-3\.1-flash-lite:/);
});

test('gắn nhãn: Gemini 3.x không nhận thinkingBudget, Gemini 2.5 thì có', async () => {
    const calls = fakeGemini(labelReply(GOOD_LABELS));
    await convert({ ...AI_ENV, GEMINI_MODEL: 'gemini-3.1-flash-lite' });
    await convert({ ...AI_ENV, GEMINI_MODEL: 'gemini-2.5-flash' });
    assert.equal(calls[0].body.generationConfig.temperature, 1);
    assert.equal(calls[0].body.generationConfig.thinkingConfig, undefined);
    assert.deepEqual(calls[1].body.generationConfig.thinkingConfig, { thinkingBudget: 1024 });
});

test('convert: thiếu cấu hình thì báo rõ thiếu biến nào', async () => {
    for (const missing of ['GEMINI_API_KEY', 'CF_AIG_TOKEN', 'CF_AIG_ACCOUNT_ID']) {
        const env = { ...AI_ENV };
        delete env[missing];
        const res = await convert(env);
        assert.equal(res.status, 500);
        assert.match((await res.json()).error, new RegExp(missing));
    }
});

test('convert: từ chối sai Content-Type', async () => {
    assert.equal((await worker.fetch(post('/api/convert', 'x', { 'Content-Type': 'text/plain' }), AI_ENV)).status, 415);
});

test('gắn nhãn: Gemini báo 429 thì trả 429 kèm lời nhắn dễ hiểu', async () => {
    fakeGemini({ error: 'quota' }, 429);
    const res = await convert(AI_ENV);
    assert.equal(res.status, 429);
    assert.match((await res.json()).error, /quá tải|hạn ngạch/);
});

test('gắn nhãn: nội dung bị bộ lọc an toàn chặn thì trả 422', async () => {
    fakeGemini({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] });
    assert.equal((await convert(AI_ENV)).status, 422);
});

test('share: cùng tên và nội dung luôn ra cùng một link 11 ký tự', async () => {
    const kv = fakeKV();
    const a = await (await worker.fetch(post('/api/share', { text: QUIZ, title: 'Đề 1' }), { SHARES: kv })).json();
    const b = await (await worker.fetch(post('/api/share', { text: QUIZ, title: 'Đề 1' }), { SHARES: kv })).json();
    assert.match(a.id, /^[0-9A-Za-z]{11}$/);
    assert.equal(a.id, b.id);
    assert.equal(kv.puts.length, 1, 'lần tạo thứ hai trong vòng 7 ngày không ghi lại KV');
});

test('share: từ chối nội dung không giống đề trắc nghiệm', async () => {
    const res = await worker.fetch(post('/api/share', { text: 'Xin chào, đây là một đoạn văn bình thường.' }), { SHARES: fakeKV() });
    assert.equal(res.status, 400);
});

test('share: mở link trả lại đúng nội dung và tên đề', async () => {
    const kv = fakeKV();
    const { id } = await (await worker.fetch(post('/api/share', { text: QUIZ, title: 'Đề 1' }), { SHARES: kv })).json();
    const res = await worker.fetch(new Request(`https://x/api/share/${id}`), { SHARES: kv });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { text: QUIZ, title: 'Đề 1' });
});

test('share: link sai định dạng trả 400, link không có trả 404', async () => {
    assert.equal((await worker.fetch(new Request('https://x/api/share/abc'), { SHARES: fakeKV() })).status, 400);
    assert.equal((await worker.fetch(new Request('https://x/api/share/AAAAAAAAAAA'), { SHARES: fakeKV() })).status, 404);
});

test('share: mở đề đã lưu hơn 30 ngày thì gia hạn thêm 90 ngày', async () => {
    const old = Math.floor(Date.now() / 1000) - 40 * 86400;
    const kv = fakeKV({ AAAAAAAAAAA: { v: 1, title: 'Đề', text: QUIZ, c: old } });
    const res = await worker.fetch(new Request('https://x/api/share/AAAAAAAAAAA'), { SHARES: kv });
    assert.equal(res.status, 200);
    assert.equal(kv.puts.length, 1);
    assert.equal(kv.puts[0].opts.expirationTtl, 90 * 86400);
    assert.ok(kv.puts[0].v.c > old);
});

test('share: mở đề mới lưu không ghi lại KV', async () => {
    const kv = fakeKV({ AAAAAAAAAAA: { v: 1, title: 'Đề', text: QUIZ, c: Math.floor(Date.now() / 1000) - 86400 } });
    await worker.fetch(new Request('https://x/api/share/AAAAAAAAAAA'), { SHARES: kv });
    assert.equal(kv.puts.length, 0);
});

test('share: đề lưu kiểu cũ (không có thời điểm tạo) được gia hạn ở lần mở đầu', async () => {
    const kv = fakeKV({ AAAAAAAAAAA: { v: 1, title: '', text: QUIZ } });
    await worker.fetch(new Request('https://x/api/share/AAAAAAAAAAA'), { SHARES: kv });
    assert.equal(kv.puts.length, 1);
});

test('share: ghi gia hạn bị lỗi vẫn trả đề bình thường', async () => {
    const kv = { get: async () => JSON.stringify({ v: 1, title: '', text: QUIZ }), put: async () => { throw new Error('hết lượt ghi'); } };
    const res = await worker.fetch(new Request('https://x/api/share/AAAAAAAAAAA'), { SHARES: kv });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).text, QUIZ);
});

function fakeAssets() {
    const served = [];
    return {
        served,
        fetch: async req => { served.push(new URL(req.url).pathname); return new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }); },
    };
}

test('file tĩnh: chỉ phục vụ danh sách cho phép, kèm header bảo mật', async () => {
    const assets = fakeAssets();
    for (const p of ['/worker.js', '/wrangler.jsonc', '/package.json', '/.claude/launch.json', '/tests/app.test.js', '/music/../worker.js']) {
        const res = await worker.fetch(new Request(`https://x${p}`), { ASSETS: assets });
        assert.equal(res.status, 404, p);
    }
    assert.deepEqual(assets.served, []);
    const home = await worker.fetch(new Request('https://x/'), { ASSETS: assets });
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(home.headers.get('x-frame-options'), 'DENY');
});

test('file tĩnh: method khác GET, HEAD trả 405 và không chuyển cho ASSETS', async () => {
    const assets = fakeAssets();
    for (const [method, p] of [['POST', '/'], ['PUT', '/index.html'], ['DELETE', '/favicon.png']]) {
        const res = await worker.fetch(new Request(`https://x${p}`, { method }), { ASSETS: assets });
        assert.equal(res.status, 405, `${method} ${p}`);
        assert.equal(res.headers.get('allow'), 'GET, HEAD');
    }
    assert.deepEqual(assets.served, []);
    assert.equal((await worker.fetch(new Request('https://x/', { method: 'HEAD' }), { ASSETS: assets })).status, 200);
});

// HTMLRewriter chỉ có trên Cloudflare: bản giả ghi lại các hàm xử lý để test gọi thử với thẻ giả.
class FakeRewriter {
    constructor() { this.handlers = []; FakeRewriter.last = this; }
    on(selector, handler) { this.handlers.push([selector, handler]); return this; }
    transform(res) { return res; }
}
function rewrites() {
    const out = {};
    for (const [selector, h] of FakeRewriter.last.handlers) {
        h.element({ replace: (html, opt) => { out[selector] = { html, opt }; }, setInnerContent: (text, opt) => { out[selector] = { text, opt }; } });
    }
    return out;
}

test('trang /share: link chia sẻ có tên đề cho bản xem trước, tên đề được thoát ký tự HTML', async () => {
    globalThis.HTMLRewriter = FakeRewriter;
    try {
        const kv = fakeKV({ AAAAAAAAAAA: { v: 1, title: 'Đề <script>alert(1)</script> "x"', text: QUIZ, c: Math.floor(Date.now() / 1000) } });
        const assets = fakeAssets();
        const res = await worker.fetch(new Request('https://x/share?s=AAAAAAAAAAA'), { ASSETS: assets, SHARES: kv });
        assert.equal(res.status, 200);
        assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
        assert.equal(res.headers.get('x-frame-options'), 'DENY');
        assert.deepEqual(assets.served, ['/']);
        const r = rewrites();
        assert.equal(r.title.text, 'Đề trắc nghiệm: Đề <script>alert(1)</script> "x"');
        assert.equal(r.title.opt, undefined, 'tên đề là chữ, không phải HTML');
        const og = r['meta[property="og:title"]'];
        assert.equal(og.html, '<meta property="og:title" content="Đề trắc nghiệm: Đề &lt;script&gt;alert(1)&lt;/script&gt; &quot;x&quot;">');
        assert.match(r['link[rel="canonical"]'].html, /href="https:\/\/x\/share\?s=AAAAAAAAAAA"/);
        const head = await worker.fetch(new Request('https://x/share?s=AAAAAAAAAAA', { method: 'HEAD' }), { ASSETS: assets, SHARES: kv });
        assert.equal(head.status, 200);
        assert.equal(head.body, null);
    } finally {
        delete globalThis.HTMLRewriter;
    }
});

test('trang /share: mã không có trong KV vẫn trả trang (trang tự báo không tìm thấy đề); link cũ /?s= chuyển sang /share', async () => {
    const res = await worker.fetch(new Request('https://x/share?s=AAAAAAAAAAA'), { ASSETS: fakeAssets(), SHARES: fakeKV() });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    const old = await worker.fetch(new Request('https://x/?s=AAAAAAAAAAA'), { ASSETS: fakeAssets() });
    assert.equal(old.status, 301);
    assert.equal(old.headers.get('location'), 'https://x/share?s=AAAAAAAAAAA');
});

test('CSP cho phép CSS và font của KaTeX từ cdnjs, không mở thêm gì khác', async () => {
    const res = await worker.fetch(new Request('https://x/'), { ASSETS: fakeAssets() });
    const csp = Object.fromEntries(res.headers.get('content-security-policy').split(';').map(s => s.trim()).filter(Boolean).map(s => {
        const [k, ...v] = s.split(/\s+/);
        return [k, v];
    }));
    assert.ok(csp['style-src'].includes('https://cdnjs.cloudflare.com'));
    assert.ok(csp['font-src'].includes('https://cdnjs.cloudflare.com'));
    assert.deepEqual(csp['connect-src'], ["'self'"]);
    assert.ok(!csp['script-src'].includes("'unsafe-eval'"));
});

test('API không tồn tại trả 404 dạng JSON', async () => {
    const res = await worker.fetch(new Request('https://x/api/khong-co'), {});
    assert.equal(res.status, 404);
    assert.ok((await res.json()).error);
});

test('Argon #12: model chính trả nhãn sai khuôn thì worker thử model dự phòng', async () => {
    const bad = labelReply([{ tu: 1, den: 2, loai: 'bo_qua' }]);
    const calls = fakeGeminiSequence([{ status: 200, body: bad }, { status: 200, body: labelReply(GOOD_LABELS) }]);
    const res = await worker.fetch(post('/api/convert', { lines: LINES }), FALLBACK_ENV);
    assert.equal(res.status, 200);
    assert.equal(calls.length, 2);
    assert.equal((await res.json()).model, 'gemini-3.5-flash-lite');
});

test('share: trình duyệt hỏi lại bằng If-None-Match (304) vẫn gia hạn đề đã lưu hơn 30 ngày', async () => {
    const old = Math.floor(Date.now() / 1000) - 40 * 86400;
    const kv = fakeKV({ AAAAAAAAAAA: { v: 1, title: 'Đề', text: QUIZ, c: old } });
    const res = await worker.fetch(new Request('https://x/api/share/AAAAAAAAAAA', { headers: { 'If-None-Match': '"AAAAAAAAAAA"' } }), { SHARES: kv });
    assert.equal(res.status, 304);
    assert.equal(kv.puts.length, 1);
});

test('share: chuỗi dài dòng trống hay dấu cách không làm worker chạy lâu (regex bậc hai)', async () => {
    const kv = { async get() { return null; }, async put() {} };
    for (const text of ['\n'.repeat(60000) + 'x', ' '.repeat(60000) + 'x\nCâu 1: a\n', '\t'.repeat(60000) + 'A. x']) {
        const t0 = performance.now();
        const res = await worker.fetch(post('/api/share', { text }), { SHARES: kv });
        assert.equal(res.status, 400);
        assert.ok(performance.now() - t0 < 1500, `${Math.round(performance.now() - t0)}ms`);
    }
});

test('gắn nhãn: dòng "<" + nhiều dấu cách không làm worker chạy lâu trước khi gọi AI', async () => {
    fakeGemini(okReply(JSON.stringify({ doan: [{ tu: 1, den: 1, loai: 'bo_qua' }] })));
    const t0 = performance.now();
    const res = await worker.fetch(post('/api/convert', { lines: ['<' + ' '.repeat(45000) + 'x'] }), AI_ENV);
    assert.equal(res.status, 200);
    assert.ok(performance.now() - t0 < 1000, `${Math.round(performance.now() - t0)}ms`);
});

test('share: đề có phương án gạch đầu dòng ("• A.") hay dấu toàn chiều rộng ("A．") vẫn tạo được link', async () => {
    const kv = { async get() { return null; }, async put() {} };
    for (const text of ['Câu 1: Thủ đô?\n• A. Huế\n• *B. Hà Nội\n• C. Vinh', 'Câu 1: Thủ đô?\nA． Huế\n*B． Hà Nội']) {
        const res = await worker.fetch(post('/api/share', { text }), { SHARES: kv });
        assert.equal(res.status, 200, text);
    }
});
