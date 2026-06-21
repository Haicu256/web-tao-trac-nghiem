export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/api/convert' && request.method === 'POST') {
            return handleConvert(request, env);
        }

        // Không khớp route API nào -> trả 404 (asset tĩnh đã được Cloudflare xử lý trước khi tới đây)
        return new Response('Not Found', { status: 404 });
    }
};

async function handleConvert(request, env) {
    try {
        const body = await request.json().catch(() => null);
        const rawText = body?.text;
        const startIndex = Number.isInteger(body?.startIndex) ? body.startIndex : 1;

        if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
            return jsonResponse({ error: 'Thiếu nội dung văn bản.' }, 400);
        }

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
            return jsonResponse({ error: 'Server chưa cấu hình GEMINI_API_KEY.' }, 500);
        }

        const prompt = buildPrompt(rawText, startIndex);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

        const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const resultText = candidate?.content?.parts?.[0]?.text || '';
        const truncated = candidate?.finishReason === 'MAX_TOKENS';

        if (!resultText) {
            return jsonResponse({ error: 'AI không trả về kết quả.' }, 502);
        }

        return jsonResponse({ text: resultText, truncated });

    } catch (err) {
        return jsonResponse({ error: err.message || 'Lỗi không xác định.' }, 500);
    }
}

function jsonResponse(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

// Giữ NGUYÊN nội dung prompt gốc, chỉ chuyển từ index.html sang đây
function buildPrompt(rawText, startIndex) {
    return `
Bạn là công cụ chuyển đổi bố cục văn bản thành câu hỏi trắc nghiệm (Multiple Choice) hoặc trắc nghiệm đúng/sai.
Nhiệm vụ: Sắp xếp lại văn bản thành định dạng chuẩn:

QUAN TRỌNG:
Đối với trắc nghiệm đúng/sai
- Phân loại câu hỏi: nếu câu hỏi có dạng đúng/sai (True/False) (ví dụ: "Đúng hay Sai", "True/False", "Nhận định nào đúng/sai", ...), hãy thêm tiêu đề "câu hỏi đúng sai: câu X:" trước nội dung câu hỏi.
- Với câu hỏi đúng/sai: sắp xếp các lựa chọn thành A, B, C, D (có thể thêm dấu * nếu phát hiện đáp án đúng từ văn bản gốc).
- Không thay đổi nội dung câu hỏi và lựa chọn.
- Nếu không có dạng câu hỏi rõ ràng, giữ nguyên văn bản.
- Đánh số bắt đầu từ ${startIndex}.
Thành quả phải có dạng như này:
câu hỏi đúng sai: Câu X: [nội dung câu hỏi]
A. [nội dung lựa chọn A]
B. [nội dung lựa chọn B]
C. [nội dung lựa chọn C]
D. [nội dung lựa chọn D]


Đối với trắc nghiệm lựa chọn:
1. GIỮ NGUYÊN số thứ tự câu hỏi từ văn bản gốc nếu có. Nếu văn bản có "Bài 1:", "1.", "1/", "Câu hỏi 1:" thì chuyển thành "Câu 1:". KHÔNG tự động đánh lại số thứ tự.
2. Nếu văn bản không có số thứ tự, hãy đánh số tăng dần từ 1.
3. sửa tiền tố (Bài, 1., 1/, Câu hỏi, ...) thành "Câu X:".
4. Không thay đổi nội dung câu hỏi, không thêm bớt từ.
5. Đảm bảo mỗi câu hỏi có đúng 4 lựa chọn A, B, C, D.
6. Nếu gặp đoạn văn không phải câu hỏi trắc nghiệm (không có 4 lựa chọn), hãy giữ nguyên nhưng không đánh số.
7. Xuất kết quả chỉ gồm các câu hỏi đã chuẩn hóa, không thêm giải thích.

Thành quả phải có dạng như này:
Câu X: [nội dung câu hỏi]
A. [nội dung lựa chọn A]
B. [nội dung lựa chọn B]
C. [nội dung lựa chọn C]
D. [nội dung lựa chọn D]


Văn bản cần xử lý:
${rawText}
`;
}
