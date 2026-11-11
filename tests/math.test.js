// Công thức toán: đổi công thức Word (OMML) sang LaTeX, và vẽ $...$ bằng KaTeX khi làm bài.
// Xem docs/thiet-ke/cong-thuc-toan.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { loadApp } from './helpers/app.js';

const katex = createRequire(import.meta.url)('katex');
const app = loadApp();
const ommlToLatex = app.fn('ommlToLatex');

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:v="urn:schemas-microsoft-com:vml"';
const parse = xml => new DOMParser().parseFromString(xml, 'application/xml');
const r = t => `<m:r><m:t>${t}</m:t></m:r>`;
const textRun = t => `<m:r><m:rPr><m:nor/></m:rPr><m:t>${t}</m:t></m:r>`;
const e = inner => `<m:e>${inner}</m:e>`;

function latexOf(inner) {
    const doc = parse(`<m:oMath ${NS}>${inner}</m:oMath>`);
    return ommlToLatex(doc.documentElement);
}

const CASES = [
    ['chữ và phép tính', r('x+1=0'), 'x+1=0'],
    ['phân số', `<m:f><m:num>${r('1')}</m:num><m:den>${r('2')}</m:den></m:f>`, '\\frac{1}{2}'],
    ['phân số viết ngang', `<m:f><m:fPr><m:type m:val="lin"/></m:fPr><m:num>${r('a')}</m:num><m:den>${r('b')}</m:den></m:f>`, '{a}/{b}'],
    ['số mũ', `<m:sSup>${e(r('x'))}<m:sup>${r('2')}</m:sup></m:sSup>`, 'x^{2}'],
    ['số mũ của biểu thức nhiều ký tự', `<m:sSup>${e(r('ab'))}<m:sup>${r('n')}</m:sup></m:sSup>`, '{ab}^{n}'],
    ['chỉ số dưới', `<m:sSub>${e(r('a'))}<m:sub>${r('n')}</m:sub></m:sSub>`, 'a_{n}'],
    ['chỉ số dưới và mũ', `<m:sSubSup>${e(r('x'))}<m:sub>${r('1')}</m:sub><m:sup>${r('2')}</m:sup></m:sSubSup>`, 'x_{1}^{2}'],
    ['căn bậc hai', `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/>${e(r('x'))}</m:rad>`, '\\sqrt{x}'],
    ['căn bậc ba', `<m:rad><m:deg>${r('3')}</m:deg>${e(r('x'))}</m:rad>`, '\\sqrt[3]{x}'],
    ['ngoặc tròn', `<m:d>${e(r('x+1'))}</m:d>`, '\\left(x+1\\right)'],
    ['giá trị tuyệt đối', `<m:d><m:dPr><m:begChr m:val="|"/><m:endChr m:val="|"/></m:dPr>${e(r('x'))}</m:d>`, '\\left|x\\right|'],
    ['ngoặc nhọn tập hợp', `<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val="}"/><m:sepChr m:val=";"/></m:dPr>${e(r('1'))}${e(r('2'))}</m:d>`, '\\left\\{1;2\\right\\}'],
    ['hệ phương trình', `<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr>${e(`<m:eqArr>${e(r('x+y=3'))}${e(r('x-y=1'))}</m:eqArr>`)}</m:d>`, '\\begin{cases}x+y=3\\\\x-y=1\\end{cases}'],
    ['hệ "hoặc" ngoặc vuông', `<m:d><m:dPr><m:begChr m:val="["/><m:endChr m:val=""/></m:dPr>${e(`<m:eqArr>${e(r('x=1'))}${e(r('x=2'))}</m:eqArr>`)}</m:d>`, '\\left[\\begin{array}{l}x=1\\\\x=2\\end{array}\\right.'],
    ['tích phân có cận', `<m:nary><m:sub>${r('0')}</m:sub><m:sup>${r('1')}</m:sup>${e(r('2xdx'))}</m:nary>`, '\\int_{0}^{1} 2xdx'],
    ['tổng', `<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub>${r('k=1')}</m:sub><m:sup>${r('n')}</m:sup>${e(r('k'))}</m:nary>`, '\\sum_{k=1}^{n} k'],
    ['hàm lượng giác', `<m:func><m:fName>${textRun('sin')}</m:fName>${e(r('x'))}</m:func>`, '\\sin{x}'],
    ['giới hạn', `<m:func><m:fName><m:limLow>${e(textRun('lim'))}<m:lim>${r('x→0')}</m:lim></m:limLow></m:fName>${e(r('f(x)'))}</m:func>`, '\\lim_{x\\to 0}{f(x)}'],
    ['vectơ', `<m:acc><m:accPr><m:chr m:val="⃗"/></m:accPr>${e(r('AB'))}</m:acc>`, '\\overrightarrow{AB}'],
    ['gạch trên', `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr>${e(r('AB'))}</m:bar>`, '\\overline{AB}'],
    ['ma trận', `<m:m><m:mr>${e(r('1'))}${e(r('2'))}</m:mr><m:mr>${e(r('3'))}${e(r('4'))}</m:mr></m:m>`, '\\begin{matrix}1&2\\\\3&4\\end{matrix}'],
    ['ký hiệu so sánh và chữ Hy Lạp', r('x≤π, y≠∞'), 'x\\le \\pi , y\\ne \\infty'],
    ['độ', r('30°'), '30^{\\circ}'],
    ['chữ tiếng Việt trong công thức', `${r('x')}${textRun(' với ')}${r('x>0')}`, 'x\\text{ với }x>0'],
    ['ký tự đặc biệt của LaTeX', r('{a}%'), '\\{a\\}\\%'],
    ['công thức gõ dạng tuyến tính x^2 (Word chưa dựng lại)', r('x^2+1'), 'x^2+1'],
    ['chỉ số gõ dạng tuyến tính a_n', r('a_n'), 'a_n'],
    ['phần tử lạ thì lấy nội dung bên trong', `<m:box>${e(r('y'))}</m:box>`, 'y'],
];

for (const [name, inner, expected] of CASES) {
    test(`OMML → LaTeX: ${name}`, () => {
        const latex = latexOf(inner);
        assert.equal(latex, expected);
        assert.doesNotThrow(() => katex.renderToString(latex, { throwOnError: true }), `KaTeX không vẽ được: ${latex}`);
    });
}

function wordDoc(bodyXml) {
    return parse(`<w:document ${NS}><w:body>${bodyXml}</w:body></w:document>`);
}

function paragraphTexts(doc) {
    const out = [];
    const ps = doc.getElementsByTagName('w:p');
    for (let i = 0; i < ps.length; i++) {
        const ts = ps[i].getElementsByTagName('w:t');
        let s = '';
        for (let j = 0; j < ts.length; j++) s += ts[j].textContent;
        out.push(s);
    }
    return out;
}

test('replaceOfficeMath thay công thức trong đoạn văn bằng chữ $...$ đúng vị trí', () => {
    const doc = wordDoc(`<w:p><w:r><w:t xml:space="preserve">Tính </w:t></w:r><m:oMath><m:f><m:num>${r('1')}</m:num><m:den>${r('2')}</m:den></m:f></m:oMath><w:r><w:t xml:space="preserve"> nhé</w:t></w:r></w:p>`);
    const count = app.fn('replaceOfficeMath')(doc);
    assert.equal(count, 1);
    assert.deepEqual(paragraphTexts(doc), ['Tính $\\frac{1}{2}$ nhé']);
    assert.equal(doc.getElementsByTagName('m:oMath').length, 0);
});

test('replaceOfficeMath xử lý công thức đứng riêng một dòng (m:oMathPara)', () => {
    const doc = wordDoc(`<w:p><m:oMathPara><m:oMath>${r('x=1')}</m:oMath></m:oMathPara></w:p>`);
    assert.equal(app.fn('replaceOfficeMath')(doc), 1);
    assert.deepEqual(paragraphTexts(doc), ['$x=1$']);
    assert.match(new XMLSerializer().serializeToString(doc), /<w:r><w:t xml:space="preserve">\$x=1\$<\/w:t><\/w:r>/);
});

test('countLegacyEquations đếm công thức MathType / Equation 3.0', () => {
    const doc = wordDoc(`<w:p><w:r><w:object><v:shape/><o:OLEObject Type="Embed" ProgID="Equation.DSMT4"/></w:object></w:r><w:r><w:object><o:OLEObject ProgID="Equation.3"/></w:object></w:r><w:r><w:object><o:OLEObject ProgID="Excel.Sheet.12"/></w:object></w:r></w:p>`);
    assert.equal(app.fn('countLegacyEquations')(doc), 2);
});

const render = html => {
    app.setGlobal('katex', katex);
    try { return app.fn('renderMathInHtml')(html); } finally { app.setGlobal('katex', undefined); }
};

test('renderMathInHtml vẽ $...$ và giữ nguyên phần chữ xung quanh', () => {
    const out = render('Tính $\\frac{1}{2}$ nhé');
    assert.ok(out.startsWith('Tính <span class="katex">'), out.slice(0, 60));
    assert.ok(out.endsWith(' nhé'));
});

test('renderMathInHtml không coi giá tiền là công thức', () => {
    for (const s of ['It costs $5 and $10.', 'Giá $5, còn lại', '$ 1 + 1 $', 'a$']) assert.equal(render(s), s);
    assert.match(render('giá $5, còn $x$ là ẩn'), /^giá \$5, còn <span class="katex">/);
});

test('renderMathInHtml không vắt công thức qua nhiều dòng', () => {
    assert.equal(render('$a<br>b$'), '$a<br>b$');
});

test('renderMathInHtml giải escape bên trong công thức trước khi vẽ', () => {
    const out = render('$x &lt; 1$');
    assert.ok(out.includes('class="katex"'));
    assert.ok(!out.includes('&amp;lt;'));
});

test('renderMathInHtml an toàn với HTML lạ nằm trong hoặc ngoài công thức', () => {
    const out = render('&lt;img src=x onerror=alert(1)&gt; $&lt;img src=x onerror=alert(1)&gt;$');
    assert.ok(!/<img/i.test(out), out);
    assert.ok(out.startsWith('&lt;img src=x onerror=alert(1)&gt; '));
});

test('renderMathInHtml không làm gì khi chưa tải được KaTeX', () => {
    assert.equal(app.fn('renderMathInHtml')('Tính $\\frac{1}{2}$'), 'Tính $\\frac{1}{2}$');
});

test('renderMathInHtml: LaTeX sai cú pháp không làm hỏng trang', () => {
    const out = render('Câu $\\frac{1}{$ này');
    assert.ok(out.startsWith('Câu '));
    assert.ok(out.endsWith(' này'));
});

test('questionsHaveMath chỉ đúng khi có công thức hợp lệ', () => {
    const has = app.fn('questionsHaveMath');
    assert.equal(has([{ title: 'Tính $x^{2}$', options: [] }]), true);
    assert.equal(has([{ title: 'a', options: [{ text: '$\\sqrt{2}$' }] }]), true);
    assert.equal(has([{ title: 'It costs $5 and $10', options: [{ text: 'x' }] }]), false);
});

test('ensureKatex tải KaTeX từ cdnjs có SRI, đúng phiên bản đã test', async () => {
    const version = createRequire(import.meta.url)('katex/package.json').version;
    const head = app.document.head;
    head.children.length = 0;
    const loading = app.fn('ensureKatex')();
    const [link, script] = head.children;
    assert.equal(link.href, `https://cdnjs.cloudflare.com/ajax/libs/KaTeX/${version}/katex.min.css`);
    assert.equal(script.src, `https://cdnjs.cloudflare.com/ajax/libs/KaTeX/${version}/katex.min.js`);
    for (const el of [link, script]) {
        assert.match(el.integrity, /^sha512-[A-Za-z0-9+/=]{88}$/);
        assert.equal(el.crossOrigin, 'anonymous');
    }
    app.setGlobal('katex', katex);
    script.onload();
    await loading;
    app.setGlobal('katex', undefined);
});

test('replaceOfficeMath giữ định dạng chung của công thức (tô sáng, màu, gạch chân, in đậm dùng để đánh dấu đáp án)', () => {
    const doc = wordDoc('<w:p><w:r><w:t xml:space="preserve">B. </w:t></w:r><m:oMath><m:r><w:rPr><w:highlight w:val="yellow"/><w:b/></w:rPr><m:t>x=</m:t></m:r><m:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><m:t>2</m:t></m:r></m:oMath></w:p>');
    app.fn('replaceOfficeMath')(doc);
    const xml = new XMLSerializer().serializeToString(doc);
    assert.match(xml, /<w:r><w:rPr><w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">\$x=2\$<\/w:t><\/w:r>/);
});

test('renderMathInHtml không coi giá tiền viết sau số ("5$, 6$") là công thức', () => {
    for (const s of ['Giá 5$, 6$ và 8$', 'Mua 2 cái giá 10$ và 20$']) assert.equal(render(s), s);
});

test('replaceOfficeMath chỉ giữ định dạng khi mọi phần của công thức cùng một giá trị (đỏ một chữ không phải cả công thức)', () => {
    const doc = wordDoc('<w:p><m:oMath><m:r><w:rPr><w:color w:val="FF0000"/></w:rPr><m:t>x</m:t></m:r><m:r><w:rPr><w:color w:val="000000"/></w:rPr><m:t>+y+z=0</m:t></m:r></m:oMath></w:p>');
    app.fn('replaceOfficeMath')(doc);
    assert.doesNotMatch(new XMLSerializer().serializeToString(doc), /FF0000/);
});

test('renderMathInHtml vẽ được hai công thức viết liền nhau "$a$$b$"', () => {
    const out = render('Tính $a$$b$ nhé');
    assert.equal((out.match(/class="katex"/g) || []).length, 2, out);
});

test('renderMathInHtml vẽ công thức "$$…$$" thành một công thức hiển thị, không vẽ lại HTML của KaTeX', () => {
    const out = render('Cho $$x + 1$$ nhé');
    assert.equal((out.match(/class="katex-display"/g) || []).length, 1, out.slice(0, 300));
    assert.ok(out.length < 8000, `HTML phình to: ${out.length} byte`);
    assert.doesNotMatch(out, /<mi>s<\/mi><mi>p<\/mi><mi>a<\/mi><mi>n<\/mi>/);
});

test('renderMathInHtml: "$$…$$" và "$…$" trong cùng một câu đều được vẽ', () => {
    const out = render('Với $a$ thì $$a^{2}+1$$ và $b$');
    assert.equal((out.match(/class="katex"/g) || []).length, 3, out.slice(0, 300));
    assert.equal((out.match(/class="katex-display"/g) || []).length, 1);
});
