// ===== Cấu hình chia sẻ link =====
const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90; // link tự hết hạn sau 90 ngày (KV tự xóa)
const MAX_SHARE_CHARS = 300_000;             // giới hạn độ dài nội dung đề được chia sẻ (khớp SHARE_MAX_CHARS ở index.html)
const SHARE_ID_REGEX = /^[0-9A-Za-z]{11}$/;  // khớp SHARE_ID_REGEX ở index.html
const MAX_TITLE_CHARS = 100;                 // độ dài tối đa của tên đề (khớp SHARE_TITLE_MAX ở index.html)

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/api/convert' && request.method === 'POST') {
            return handleConvert(request, env);
        }

        if (url.pathname === '/api/share' && request.method === 'POST') {
            return handleShareCreate(request, env);
        }

        // Trang mở link chia sẻ: /share?s=<id> (Worker chèn tên đề vào thẻ xem trước link)
        if (url.pathname === '/share' && (request.method === 'GET' || request.method === 'HEAD')) {
            return handleSharePage(request, env, url);
        }

        const shareMatch = url.pathname.match(/^\/api\/share\/([^/]+)$/);
        if (shareMatch && request.method === 'GET') {
            return handleShareGet(shareMatch[1], env);
        }

        // Không khớp route API nào -> trả 404 (asset tĩnh đã được Cloudflare xử lý trước khi tới đây)
        return new Response('Not Found', { status: 404 });
    }
};

async function handleConvert(request, env) {
    try {
        // Chặn spam: giới hạn số request theo IP (nếu binding rate limiter đã được cấu hình)
        if (env.CONVERT_LIMITER) {
            const ip = request.headers.get('cf-connecting-ip') || 'unknown';
            const { success } = await env.CONVERT_LIMITER.limit({ key: ip });
            if (!success) {
                return jsonResponse({ error: 'Bạn đang gửi quá nhiều yêu cầu, vui lòng thử lại sau ít phút.' }, 429);
            }
        }

        const body = await request.json().catch(() => null);
        const rawText = body?.text;
        const startIndex = Number.isInteger(body?.startIndex) ? body.startIndex : 1;

        if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
            return jsonResponse({ error: 'Thiếu nội dung văn bản.' }, 400);
        }

        // Chặn payload quá lớn gửi trực tiếp vào API (bỏ qua giới hạn chunk ở frontend)
        const MAX_INPUT_SIZE = 50_000; // ~8x lớn hơn 1 chunk hợp lệ lớn nhất từ frontend
        if (rawText.length > MAX_INPUT_SIZE) {
            return jsonResponse({ error: `Văn bản quá lớn (tối đa ${MAX_INPUT_SIZE.toLocaleString('vi-VN')} ký tự mỗi lần).` }, 413);
        }

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
            return jsonResponse({ error: 'Server chưa cấu hình GEMINI_API_KEY.' }, 500);
        }

        const prompt = buildPrompt(rawText, startIndex);
        const geminiUrl = `https://gateway.ai.cloudflare.com/v1/9cfdacf13184881724759ce98fa45d5a/default/google-ai-studio/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

        const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
            })
        });

        if (!geminiRes.ok) {
            let message = `Gemini lỗi: ${geminiRes.status}`;
            const errBody = await geminiRes.json().catch(() => null);
            if (errBody?.error?.message) message = `Gemini lỗi: ${errBody.error.message}`;
            return jsonResponse({ error: message }, 502);
        }

        const data = await geminiRes.json();
        const candidate = data?.candidates?.[0];
        let resultText = candidate?.content?.parts?.[0]?.text || '';
        const truncated = candidate?.finishReason === 'MAX_TOKENS';

        if (!resultText) {
            return jsonResponse({ error: 'AI không trả về kết quả.' }, 502);
        }

        // Loại bỏ markdown code block (``` hoặc ```text ... ```) nếu AI vô tình bọc lại
        resultText = resultText.trim();
        if (resultText.startsWith('```')) {
            resultText = resultText.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
        }

        return jsonResponse({ text: resultText, truncated });

    } catch (err) {
        return jsonResponse({ error: err.message || 'Lỗi không xác định.' }, 500);
    }
}

function jsonResponse(obj, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', ...extraHeaders }
    });
}

// ===== CHIA SẺ LINK =====
async function handleShareCreate(request, env) {
    try {
        if (!env.SHARES) {
            return jsonResponse({ error: 'Server chưa cấu hình tính năng chia sẻ (thiếu KV binding SHARES).' }, 500);
        }

        // Chặn spam: giới hạn số lần tạo link theo IP (nếu binding rate limiter đã được cấu hình)
        if (env.SHARE_LIMITER) {
            const ip = request.headers.get('cf-connecting-ip') || 'unknown';
            const { success } = await env.SHARE_LIMITER.limit({ key: ip });
            if (!success) {
                return jsonResponse({ error: 'Bạn tạo link quá nhanh, vui lòng thử lại sau ít phút.' }, 429);
            }
        }

        // Chặn sớm payload quá lớn trước khi đọc body (UTF-8 tối đa 4 byte/ký tự)
        const declaredLength = Number(request.headers.get('content-length'));
        if (declaredLength > MAX_SHARE_CHARS * 4 + 1024) {
            return jsonResponse({ error: tooLargeMessage() }, 413);
        }

        const body = await request.json().catch(() => null);
        const text = body?.text;

        if (typeof text !== 'string' || text.trim().length === 0) {
            return jsonResponse({ error: 'Thiếu nội dung đề.' }, 400);
        }
        if (text.length > MAX_SHARE_CHARS) {
            return jsonResponse({ error: tooLargeMessage() }, 413);
        }
        if (!looksLikeQuiz(text)) {
            return jsonResponse({ error: 'Nội dung không giống một đề trắc nghiệm nên không thể chia sẻ.' }, 400);
        }

        const title = cleanTitle(body?.title);
        const id = await makeShareId(title, text);

        try {
            // Cùng tên đề + cùng nội dung -> cùng link, không ghi lại KV (gói free chỉ có 1.000 lượt ghi/ngày)
            const existing = await env.SHARES.get(id);
            if (existing === null) {
                await env.SHARES.put(id, JSON.stringify({ v: 1, title, text }), { expirationTtl: SHARE_TTL_SECONDS });
            }
        } catch (kvErr) {
            console.error('KV share error:', kvErr);
            return jsonResponse({ error: 'Không lưu được link chia sẻ lúc này (có thể đã hết lượt ghi trong ngày). Vui lòng thử lại sau.' }, 503);
        }

        return jsonResponse({ id, title });

    } catch (err) {
        return jsonResponse({ error: err.message || 'Lỗi không xác định.' }, 500);
    }
}

async function handleShareGet(id, env) {
    try {
        if (!env.SHARES) {
            return jsonResponse({ error: 'Server chưa cấu hình tính năng chia sẻ (thiếu KV binding SHARES).' }, 500);
        }
        if (!SHARE_ID_REGEX.test(id)) {
            return jsonResponse({ error: 'Link chia sẻ không hợp lệ.' }, 400);
        }

        const stored = await env.SHARES.get(id);
        if (stored === null) {
            return jsonResponse({ error: 'Không tìm thấy đề này. Link có thể đã hết hạn hoặc bị sai.' }, 404);
        }

        const { text, title } = parseStoredShare(stored);

        // Nội dung theo id không bao giờ đổi -> cho phép trình duyệt cache ngắn hạn
        return jsonResponse({ text, title }, 200, { 'Cache-Control': 'public, max-age=300' });

    } catch (err) {
        console.error('KV share read error:', err);
        return jsonResponse({ error: 'Không đọc được đề lúc này. Vui lòng thử lại sau.' }, 500);
    }
}

// Làm sạch tên đề: bỏ ký tự điều khiển/ký tự ẩn, gộp khoảng trắng, cắt tối đa MAX_TITLE_CHARS ký tự (theo ký tự, không cắt đôi emoji)
function cleanTitle(raw) {
    if (typeof raw !== 'string') return '';
    const cleaned = raw
        .slice(0, 1000)
        .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return Array.from(cleaned).slice(0, MAX_TITLE_CHARS).join('').trim();
}

// Giá trị lưu trong KV: {"v":1,"title":...,"text":...}.
// Link tạo trước khi có tên đề lưu thẳng nội dung đề (không phải JSON) -> vẫn đọc được, title rỗng.
function parseStoredShare(stored) {
    try {
        const obj = JSON.parse(stored);
        if (obj && obj.v === 1 && typeof obj.text === 'string') {
            return { text: obj.text, title: cleanTitle(obj.title) };
        }
    } catch (e) { /* không phải JSON -> link cũ */ }
    return { text: stored, title: '' };
}

// ===== TRANG CHIA SẺ: /share?s=<id> =====
// Trả lại chính trang index.html. Nếu đề có tên thì thay các thẻ tiêu đề / xem trước link (og:title...)
// bằng tên đề, vì Zalo/Messenger đọc các thẻ này từ HTML gốc (họ không chạy JavaScript).
// Không có tên đề / link sai / KV lỗi -> vẫn trả trang gốc để trang tự báo lỗi cho người dùng.
async function handleSharePage(request, env, url) {
    const page = await env.ASSETS.fetch(new Request(`${url.origin}/`, { headers: { Accept: 'text/html' } }));
    if (!page.ok) return new Response('Not Found', { status: 404 });

    try {
        const id = url.searchParams.get('s') || '';
        if (env.SHARES && SHARE_ID_REGEX.test(id)) {
            const stored = await env.SHARES.get(id);
            if (stored !== null) {
                const { title } = parseStoredShare(stored);
                if (title) return withShareMeta(page, title, `${url.origin}/share?s=${id}`);
            }
        }
    } catch (err) {
        console.error('Share page meta error:', err);
    }
    return page;
}

function withShareMeta(page, title, shareUrl) {
    const pageTitle = `Đề trắc nghiệm: ${title}`;
    const description = 'Bấm vào để mở đề và làm bài trắc nghiệm ngay, không cần tải file.';

    // Tự escape khi ghi giá trị vào thuộc tính: HTMLRewriter.setAttribute không escape ký tự "&"
    // (đã thử trên runtime thật: tên đề "AT&amp;T" bị đọc thành "AT&T"), nên thay nguyên cả thẻ.
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const metaTag = (attr, key, value) => ({
        element(el) { el.replace(`<meta ${attr}="${key}" content="${esc(value)}">`, { html: true }); }
    });

    const rewritten = new HTMLRewriter()
        .on('title', { element(el) { el.setInnerContent(pageTitle); } })   // nội dung văn bản: runtime escape đúng
        .on('meta[name="description"]', metaTag('name', 'description', description))
        .on('meta[property="og:title"]', metaTag('property', 'og:title', pageTitle))
        .on('meta[property="og:description"]', metaTag('property', 'og:description', description))
        .on('meta[property="og:url"]', metaTag('property', 'og:url', shareUrl))   // mỗi link một địa chỉ riêng, nếu không Facebook sẽ gộp chung xem trước
        .on('meta[name="twitter:title"]', metaTag('name', 'twitter:title', pageTitle))
        .on('meta[name="twitter:description"]', metaTag('name', 'twitter:description', description))
        .on('link[rel="canonical"]', { element(el) { el.replace(`<link rel="canonical" href="${esc(shareUrl)}">`, { html: true }); } })
        .transform(page);

    const headers = new Headers(rewritten.headers);
    headers.delete('ETag');            // nội dung đã bị thay -> không dùng validator của file gốc
    headers.delete('Content-Length');
    headers.set('Cache-Control', 'public, max-age=300');
    return new Response(rewritten.body, { status: rewritten.status, headers });
}

function tooLargeMessage() {
    return `Đề quá lớn để chia sẻ (tối đa ${MAX_SHARE_CHARS.toLocaleString('vi-VN')} ký tự).`;
}

// Nhận diện giống parseQuizData ở frontend — tránh biến endpoint này thành nơi lưu file tùy ý
function looksLikeQuiz(text) {
    return /^\s*(câu\s*hỏi|câu|q|bài)\s*\d+/im.test(text)
        || /^\s*câu\s*hỏi\s*đúng\s*sai\s*[:.]?\s*câu\s*\d+/im.test(text);
}

// Id = 64 bit đầu của SHA-256 (tên đề + nội dung), mã hóa base62 (11 ký tự).
// Cùng tên đề + cùng nội dung luôn ra cùng một link; không đoán được link nếu không biết nội dung.
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
async function makeShareId(title, text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([title, text])));
    let n = 0n;
    for (const b of new Uint8Array(digest).slice(0, 8)) n = (n << 8n) | BigInt(b);
    let id = '';
    while (n > 0n) {
        id = BASE62[Number(n % 62n)] + id;
        n /= 62n;
    }
    return id.padStart(11, '0');
}

function buildPrompt(rawText, startIndex) {
    return `
Bạn là công cụ chuẩn hóa và chuyển đổi bố cục văn bản thành đề thi trắc nghiệm.
Nhiệm vụ: Sắp xếp lại văn bản được cung cấp thành định dạng chuẩn theo các quy tắc nghiêm ngặt sau:

QUY TẮC BẮT BUỘC:
1. XUỐNG DÒNG: Mỗi câu hỏi bắt đầu bằng một dòng mới. Mỗi lựa chọn đáp án (A., B., C., D.,...) BẮT BUỘC nằm trên MỘT DÒNG RIÊNG BIỆT. Tuyệt đối không để 2 đáp án trở lên trên cùng một dòng.
2. ĐÁNH DẤU ĐÁP ÁN ĐÚNG:
   - Nếu trong văn bản gốc CÓ dấu hiệu nhận biết đáp án đúng (in đậm, gạch chân, khoanh tròn, tô màu, có chú thích đáp án hoặc có bảng đáp án đi kèm), BẮT BUỘC đặt một dấu hoa thị * ngay đầu dòng trước chữ cái của đáp án đó (Ví dụ: *A. Nội dung, *B. Nội dung).
   - NẾU VĂN BẢN GỐC CHƯA CÓ ĐÁP ÁN HOẶC KHÔNG RÕ ĐÁP ÁN: TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ SUY ĐOÁN HOẶC TỰ BỊA ĐÁP ÁN ĐÚNG! Giữ nguyên tiền tố chữ cái thông thường (A., B., C., D.) và KHÔNG thêm bất kỳ dấu * nào. Nhiệm vụ duy nhất của bạn là chuẩn hóa bố cục văn bản, không phải giải đề.
3. ĐỊNH DẠNG XUẤT:
   - Chỉ xuất văn bản thô (plain text). TUYỆT ĐỐI KHÔNG bọc kết quả trong khối code markdown (không dùng \`\`\` hoặc \`\`\`text).
   - KHÔNG thêm bất kỳ lời chào, giải thích, ghi chú hay kết luận nào ngoài các câu hỏi đã chuẩn hóa.

A. ĐỐI VỚI CÂU HỎI TRẮC NGHIỆM ĐÚNG/SAI:
- Nhận diện: Các câu hỏi yêu cầu xác định Đúng hay Sai cho từng phát biểu/nhận định (True/False).
- Tiền tố bắt buộc: Thêm "câu hỏi đúng sai: Câu X:" ngay trước nội dung câu hỏi.
- Đánh số bắt đầu từ ${startIndex} nếu văn bản gốc không có số thứ tự câu.
- Đặt dấu * trước ý nào là ý Đúng (nếu phát hiện được từ văn bản gốc).
Mẫu:
câu hỏi đúng sai: Câu X: [nội dung câu hỏi]
*A. [nội dung ý A - nếu là ý đúng]
B. [nội dung ý B - nếu là ý sai]
*C. [nội dung ý C]
D. [nội dung ý D]

B. ĐỐI VỚI CÂU HỎI TRẮC NGHIỆM LỰA CHỌN THÔNG THƯỜNG:
- Chuẩn hóa tiền tố câu (Bài 1:, 1., 1/, Câu hỏi 1:, Q1,...) thành "Câu X:".
- GIỮ NGUYÊN số thứ tự nếu có sẵn; nếu văn bản không có số thứ tự thì đánh số tăng dần bắt đầu từ ${startIndex}.
- Không thay đổi nội dung từ ngữ của câu hỏi và đáp án.
- Giữ nguyên số lượng lựa chọn của câu hỏi theo đề bài gốc (thông thường là 4 lựa chọn A, B, C, D).
Mẫu:
Câu X: [nội dung câu hỏi]
A. [nội dung lựa chọn A]
*B. [nội dung lựa chọn B - nếu đây là đáp án đúng]
C. [nội dung lựa chọn C]
D. [nội dung lựa chọn D]

Văn bản cần xử lý:
${rawText}
`;
}