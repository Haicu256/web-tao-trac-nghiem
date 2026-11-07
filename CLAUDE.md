# web-tao-trac-nghiem

Web tạo đề và làm bài trắc nghiệm: https://web-tao-trac-nghiem.haicu25699652.workers.dev

- `index.html`: toàn bộ giao diện, CSS và JS trong **một file** (giữ nguyên như vậy, quyết định ngày 7/11/2026).
- `worker.js`: Cloudflare Worker. `/api/convert` với `{ lines }` nhờ Gemini **gắn nhãn từng dòng** theo JSON schema (AI không viết chữ), `/api/share` lưu đề vào KV để chia sẻ, và phục vụ file tĩnh theo danh sách cho phép. Kiểu cũ `{ text }` (AI viết lại đề) chỉ còn để trang mở từ trước không hỏng; sẽ bỏ.
- `docs/dinh-dang-de.md`: các kiểu đề web phải đọc được. Đây cũng là test.
- `docs/thiet-ke/gan-nhan-dong.md`: vì sao AI chỉ gắn nhãn, còn code dựng đề và quyết định đáp án. **Không bao giờ cho AI tự đánh dấu đáp án** (đo ngày 7/11/2026: AI bịa 15/40 đáp án ở đề không có đáp án dù prompt cấm).

Thư mục này là nơi phát triển chính. `~/Desktop/wtn` (Antigravity/Gemini) chỉ là kho cũ: không copy file từ đó sang, và không theo quy tắc, test hay spec trong đó.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm test` | chạy toàn bộ test (`node --test`, không cần thư viện ngoài) |
| `npm run check` | test và `wrangler deploy --dry-run`; phải pass trước khi push |
| `npm run fuzz` | sinh hàng nghìn đề có đáp án biết trước (văn bản, Word, nhãn AI ngẫu nhiên) và so kết quả; mã lỗi khi có đáp án bịa ra hoặc crash. Xem đầu file `scripts/fuzz.mjs` |
| `npm run dev` | chạy web trên máy ở cổng 8787. Muốn thử `/api/convert` thì cần `.dev.vars` có `GEMINI_API_KEY`, `CF_AIG_TOKEN` |

## Deploy

1. `npm run check` pass.
2. Commit rồi `git push` lên `main` (đã cấu hình SSH deploy key `~/.ssh/wtn_deploy_ed25519` qua `core.sshCommand`).
3. Cloudflare Workers Builds tự chạy `npx wrangler deploy` và **lên web thật luôn**, không có môi trường thử.
4. Xem check "Workers Builds" của commit trên GitHub. Build lỗi thì Cloudflare giữ bản cũ và không báo gì khác, nên luôn phải xem.
5. Thử web thật: `GET /` có header `content-security-policy`; `POST /api/convert` với một đề nhỏ trả 200.

Không có môi trường thử với secret thật: Cloudflare không tạo preview URL cho worker có Durable Object
(`USProxy`), đã thử ngày 7/11/2026. Thay đổi ở `worker.js` phải được test bằng `tests/worker.test.js` rồi
kiểm tra ngay trên web thật sau khi deploy; lỗi thì `git revert` và push lại.

Đo độ chính xác đọc đề: `npm run eval` (xem đầu file `scripts/eval.mjs`). Đề thật để trong `test_exams/private/` kèm `expected.json`, không lên git.

## Cấu hình Cloudflare

- Secret (giá trị chỉ có trên Cloudflare): `GEMINI_API_KEY`, `CF_AIG_TOKEN`. `secrets.required` chỉ được liệt kê secret đã tạo, thiếu là deploy lỗi.
- `vars` trong `wrangler.jsonc`: `CF_AIG_ACCOUNT_ID`, `GEMINI_MODEL`. File này là nơi quyết định; sửa trên dashboard sẽ bị ghi đè ở lần deploy sau (`keep_vars: true` chỉ giữ biến *không* có trong file).
- KV `SHARES` phải dùng ID thật. Một ID giả từng làm mọi bản build hỏng từ 25/10 đến 6/11/2026.
- `USProxy` (Durable Object, `locationHint: wnam`) giữ mọi lệnh gọi Gemini đi từ Mỹ, vì gọi từ Hong Kong từng bị lỗi. Không bỏ.
- Model `gemini-3.1-flash-lite` (Google tắt sớm nhất 7/5/2027). Worker chọn `temperature` và `thinkingConfig` theo tiền tố tên model, nên khi đổi model phải xem lại đoạn đó và test trong `tests/worker.test.js`.
- AI Gateway tên `default`, có bật xác thực (cần `CF_AIG_TOKEN`).

## Khi sửa code

- Sửa lỗi: viết test tái hiện lỗi, thấy nó fail rồi mới sửa.
- Thêm hoặc sửa kiểu đề parser đọc: thêm ví dụ (khối `de` và `ket-qua`) vào `docs/dinh-dang-de.md` trước. Parser là hơn 700 dòng regex, sửa một chỗ dễ hỏng chỗ khác, nên chạy lại toàn bộ test.
- Chữ đến từ người dùng, từ file đề hay từ AI phải qua `escapeHTML` trước khi gán vào `innerHTML`.
- Worker chạy trước file tĩnh (`run_worker_first`). Thêm file tĩnh mới thì phải thêm vào `isAllowedAsset` trong `worker.js`.
- Không dùng lookbehind `(?<=` `(?<!` trong regex của `index.html`: Safari dưới 16.4 (iPhone đời cũ) báo lỗi cú pháp và cả trang không chạy. Test trong `tests/config.test.js` chặn việc này.
- Thư viện CDN phải có `integrity` (SRI). Đổi phiên bản thì tính lại mã băm và so với cdnjs.
- Viết chú thích khi cần giải thích *vì sao*; không có quy tắc cấm chú thích.
- `tests/helpers/app.js` nạp các `<script>` nội tuyến của `index.html` vào `node:vm`. Đổi cấu trúc script thì sửa loader này.

## Không làm

- Không đưa `.wrangler/`, `.claude/`, `node_modules/`, `.dev.vars` lên git.
- Không tạo dữ liệu thử trên KV thật: link chia sẻ thử sẽ tồn tại 90 ngày.
- Không đổi tên worker hay địa chỉ `workers.dev`, vì mọi link chia sẻ cũ sẽ hỏng.
