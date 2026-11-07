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

test('API không tồn tại trả 404 dạng JSON', async () => {
    const res = await worker.fetch(new Request('https://x/api/khong-co'), {});
    assert.equal(res.status, 404);
    assert.ok((await res.json()).error);
});
