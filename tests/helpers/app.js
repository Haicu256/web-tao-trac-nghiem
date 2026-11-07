// Nạp các <script> nội tuyến của index.html vào một "trình duyệt giả" (node:vm)
// để gọi thẳng parseQuizData, splitIntoChunks, calculateScore... mà không cần mở trình duyệt.
import fs from 'node:fs';
import vm from 'node:vm';

const indexPath = new URL('../../index.html', import.meta.url);

function fakeElement(tag = 'div') {
    const classes = new Set();
    return {
        tagName: tag.toUpperCase(),
        style: {},
        dataset: {},
        children: [],
        value: '',
        textContent: '',
        innerHTML: '',
        checked: false,
        disabled: false,
        classList: {
            add: (...c) => c.forEach(x => classes.add(x)),
            remove: (...c) => c.forEach(x => classes.delete(x)),
            contains: c => classes.has(c),
            toggle: c => (classes.has(c) ? classes.delete(c) : classes.add(c)),
        },
        addEventListener() {},
        removeEventListener() {},
        setAttribute(k, v) { this[k] = v; },
        getAttribute(k) { return this[k] ?? null; },
        appendChild(c) { this.children.push(c); return c; },
        removeChild() {},
        prepend() {},
        remove() {},
        insertAdjacentElement() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        scrollIntoView() {},
        focus() {},
        select() {},
        click() {},
    };
}

function makeBrowser() {
    const byId = new Map();
    const document = {
        getElementById(id) {
            if (!byId.has(id)) byId.set(id, Object.assign(fakeElement(), { id }));
            return byId.get(id);
        },
        createElement: tag => fakeElement(tag),
        createDocumentFragment: () => fakeElement('fragment'),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener() {},
        documentElement: fakeElement('html'),
        head: fakeElement('head'),
        body: fakeElement('body'),
    };
    const storage = new Map();
    const browser = {
        document,
        console,
        setTimeout,
        clearTimeout,
        URL,
        URLSearchParams,
        Blob,
        TextEncoder,
        TextDecoder,
        structuredClone,
        Audio: class { play() { return Promise.resolve(); } pause() {} addEventListener() {} },
        location: { search: '', pathname: '/', origin: 'http://localhost' },
        history: { replaceState() {} },
        navigator: {},
        localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) },
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        requestAnimationFrame: cb => cb(),
        scrollTo() {},
        scrollY: 0,
        addEventListener() {},
    };
    browser.window = browser;
    return browser;
}

export function loadApp(extraGlobals = {}) {
    const html = fs.readFileSync(indexPath, 'utf8');
    const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
    const context = vm.createContext(Object.assign(makeBrowser(), extraGlobals));
    for (const code of scripts) vm.runInContext(code, context);
    const run = code => vm.runInContext(code, context);
    return {
        run,
        parse(text) {
            run('originalQuestions = []');
            const ok = context.parseQuizData(text, null, '');
            return { ok, questions: run('originalQuestions') };
        },
        fn: name => context[name],
        setGlobal(name, value) { context[name] = value; },
        document: context.document,
        get lastToast() { return context.document.getElementById('toast').textContent; },
    };
}

export function plainText(html) {
    return String(html)
        .replace(/<br>/g, ' / ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&#96;/g, '`')
        .replace(/&amp;/g, '&');
}

export function answerOf(question) {
    if (question.type === 'true_false') return question.options.map(o => (o.isCorrect ? 'Đ' : 'S')).join('');
    return question.options.map((o, i) => (o.isCorrect ? String.fromCharCode(65 + i) : null)).filter(Boolean).join(',');
}
