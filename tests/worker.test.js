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

test('convert: Gemini quá tải (503) thì thử lại bằng model dự phòng', async () => {
    const calls = fakeGeminiSequence([overloaded, { status: 200, body: okReply(QUIZ) }]);
    const res = await worker.fetch(post('/api/convert', { text: QUIZ }), FALLBACK_ENV);
    assert.equal(res.status, 200);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /models\/gemini-3\.1-flash-lite:/);
    assert.match(calls[1].url, /models\/gemini-3\.5-flash-lite:/);
    const data = await res.json();
    assert.equal(data.text, QUIZ);
    assert.equal(data.model, 'gemini-3.5-flash-lite');
});

test('convert: model chính quá thời gian chờ thì cũng thử model dự phòng', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const calls = fakeGeminiSequence([timeout, { status: 200, body: okReply(QUIZ) }]);
    const res = await worker.fetch(post('/api/convert', { text: QUIZ }), FALLBACK_ENV);
    assert.equal(res.status, 200);
    assert.equal(calls.length, 2);
});

test('convert: Gemini báo 429 (hết hạn ngạch model) thì thử model dự phòng', async () => {
    const calls = fakeGeminiSequence([{ status: 429, body: { error: 'quota' } }, { status: 200, body: okReply(QUIZ) }]);
    const res = await worker.fetch(post('/api/convert', { text: QUIZ }), FALLBACK_ENV);
    assert.equal(res.status, 200);
    assert.equal(calls.length, 2);
});

test('convert: lỗi xác thực không thử model dự phòng', async () => {
    const calls = fakeGeminiSequence([{ status: 401, body: { error: 'bad key' } }]);
    const res = await worker.fetch(post('/api/convert', { text: QUIZ }), FALLBACK_ENV);
    assert.equal(res.status, 401);
    assert.equal(calls.length, 1);
});

test('convert: không cấu hình model dự phòng thì báo lỗi như cũ', async () => {
    const calls = fakeGeminiSequence([overloaded]);
    const res = await worker.fetch(post('/api/convert', { text: QUIZ }), AI_ENV);
    assert.equal(res.status, 503);
    assert.equal(calls.length, 1);
});

test('convert: cả hai model đều quá tải thì báo lỗi quá tải', async () => {
    const calls = fakeGeminiSequence([overloaded, overloaded]);
    const res = await worker.fetch(post('/api/convert', { text: QUIZ }), FALLBACK_ENV);
    assert.equal(res.status, 503);
    assert.equal(calls.length, 2);
    assert.match((await res.json()).error, /quá tải|không khả dụng/);
});

test('convert: model dự phòng dùng cấu hình riêng theo tên model', async () => {
    const calls = fakeGeminiSequence([overloaded, { status: 200, body: okReply(QUIZ) }]);
    await worker.fetch(post('/api/convert', { text: QUIZ }), { ...FALLBACK_ENV, GEMINI_FALLBACK_MODEL: 'gemini-2.5-flash' });
    assert.deepEqual(calls[0].body.generationConfig, { temperature: 1, maxOutputTokens: 16384 });
    assert.deepEqual(calls[1].body.generationConfig.thinkingConfig, { thinkingBudget: 1024 });
});

test('convert: kết quả ghi rõ model nào đã trả lời', async () => {
    fakeGemini(okReply(QUIZ));
    const res = await worker.fetch(post('/api/convert', { text: QUIZ }), FALLBACK_ENV);
    assert.equal((await res.json()).model, 'gemini-3.1-flash-lite');
});

test('convert: prompt cấm thêm dấu * khi đề không có dấu hiệu đáp án', async () => {
    const calls = fakeGemini(okReply(QUIZ));
    await worker.fetch(post('/api/convert', { text: QUIZ }), AI_ENV);
    assert.match(calls[0].body.contents[0].parts[0].text, /KHÔNG thêm dấu \* vào bất kỳ dòng nào/);
});

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

test('convert: gọi Gemini qua AI Gateway với model trong GEMINI_MODEL', async () => {
    const calls = fakeGemini(okReply(QUIZ));
    const res = await worker.fetch(post('/api/convert', { text: QUIZ }), { ...AI_ENV, GEMINI_MODEL: 'gemini-3.1-flash-lite' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).text, QUIZ);
    assert.equal(calls[0].url, 'https://gateway.ai.cloudflare.com/v1/acc/default/google-ai-studio/v1beta/models/gemini-3.1-flash-lite:generateContent');
});

test('convert: Gemini 3.x không nhận thinkingBudget, Gemini 2.5 thì có', async () => {
    const calls = fakeGemini(okReply(QUIZ));
    await worker.fetch(post('/api/convert', { text: QUIZ }), { ...AI_ENV, GEMINI_MODEL: 'gemini-3.1-flash-lite' });
    await worker.fetch(post('/api/convert', { text: QUIZ }), { ...AI_ENV, GEMINI_MODEL: 'gemini-2.5-flash' });
    assert.deepEqual(calls[0].body.generationConfig, { temperature: 1, maxOutputTokens: 16384 });
    assert.deepEqual(calls[1].body.generationConfig.thinkingConfig, { thinkingBudget: 1024 });
});

test('convert: không đặt GEMINI_MODEL thì dùng gemini-3.1-flash-lite', async () => {
    const calls = fakeGemini(okReply(QUIZ));
    await worker.fetch(post('/api/convert', { text: QUIZ }), AI_ENV);
    assert.match(calls[0].url, /models\/gemini-3\.1-flash-lite:/);
});

test('convert: prompt yêu cầu AI giữ nguyên công thức $...$', async () => {
    const calls = fakeGemini(okReply(QUIZ));
    await worker.fetch(post('/api/convert', { text: 'Câu 1: Tính $\\frac{1}{2}$\nA. 1\n*B. 2' }), AI_ENV);
    const prompt = calls[0].body.contents[0].parts[0].text;
    assert.match(prompt, /\$\.\.\.\$/);
    assert.ok(prompt.includes('Câu 1: Tính $\\frac{1}{2}$'));
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

test('convert: bỏ khối ``` mà AI lỡ bọc quanh kết quả', async () => {
    fakeGemini(okReply('```text\n' + QUIZ + '\n```'));
    const res = await worker.fetch(post('/api/convert', { text: QUIZ }), AI_ENV);
    assert.equal((await res.json()).text, QUIZ);
});

test('convert: thiếu cấu hình thì báo rõ thiếu biến nào', async () => {
    for (const missing of ['GEMINI_API_KEY', 'CF_AIG_TOKEN', 'CF_AIG_ACCOUNT_ID']) {
        const env = { ...AI_ENV };
        delete env[missing];
        const res = await worker.fetch(post('/api/convert', { text: QUIZ }), env);
        assert.equal(res.status, 500);
        assert.match((await res.json()).error, new RegExp(missing));
    }
});

test('convert: từ chối sai Content-Type, văn bản rỗng và văn bản quá dài', async () => {
    assert.equal((await worker.fetch(post('/api/convert', 'x', { 'Content-Type': 'text/plain' }), AI_ENV)).status, 415);
    assert.equal((await worker.fetch(post('/api/convert', { text: '   ' }), AI_ENV)).status, 400);
    assert.equal((await worker.fetch(post('/api/convert', { text: 'a'.repeat(50_001) }), AI_ENV)).status, 413);
});

test('convert: Gemini báo 429 thì trả 429 kèm lời nhắn dễ hiểu', async () => {
    fakeGemini({ error: 'quota' }, 429);
    const res = await worker.fetch(post('/api/convert', { text: QUIZ }), AI_ENV);
    assert.equal(res.status, 429);
    assert.match((await res.json()).error, /quá tải|hạn ngạch/);
});

test('convert: nội dung bị bộ lọc an toàn chặn thì trả 422', async () => {
    fakeGemini({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] });
    const res = await worker.fetch(post('/api/convert', { text: QUIZ }), AI_ENV);
    assert.equal(res.status, 422);
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
