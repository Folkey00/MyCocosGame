const fs = require('fs');
const path = require('path');

// Путь к папке сборки web-mobile
const buildPath = path.join(__dirname, 'build', 'web-mobile');
const outHtmlPath = path.join(__dirname, 'build', 'single_build.html');

if (!fs.existsSync(buildPath)) {
    console.error('Ошибка: Папка build/web-mobile не найдена. Сначала сделай обычный билд Web Mobile в Cocos Creator!');
    process.exit(1);
}

// 1. Читаем исходный index.html
let html = fs.readFileSync(path.join(buildPath, 'index.html'), 'utf8');

// 2. Функция для конвертации файла в base64
function getBase64(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).toLowerCase();
    const data = fs.readFileSync(filePath);
    let mime = 'application/octet-stream';
    if (ext === '.png') mime = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
    else if (ext === '.webp') mime = 'image/webp';
    else if (ext === '.svg') mime = 'image/svg+xml';
    else if (ext === '.gif') mime = 'image/gif';
    else if (ext === '.json') mime = 'application/json';
    else if (ext === '.js') mime = 'application/javascript';
    else if (ext === '.css') mime = 'text/css';
    else if (ext === '.ttf') mime = 'font/ttf';
    else if (ext === '.woff') mime = 'font/woff';
    else if (ext === '.woff2') mime = 'font/woff2';

    return `data:${mime};base64,${data.toString('base64')}`;
}

// 3. Инлайним ВСЕ CSS (<link ... href="...">)
html = html.replace(/<link[^>]*?href="([^"]+\.css)"[^>]*>/g, (match, cssPath) => {
    const fullCssPath = path.join(buildPath, cssPath);
    if (fs.existsSync(fullCssPath)) {
        let cssContent = fs.readFileSync(fullCssPath, 'utf8');
        cssContent = cssContent.replace(/url\(['"]?([^'"()]+)['"]?\)/g, (urlMatch, assetPath) => {
            if (assetPath.startsWith('data:')) return urlMatch;
            const absoluteAssetPath = path.resolve(path.dirname(fullCssPath), assetPath);
            const b64 = getBase64(absoluteAssetPath);
            return b64 ? `url(${b64})` : urlMatch;
        });
        console.log(`[CSS] Встроено: ${cssPath}`);
        return `<style>\n${cssContent}\n</style>`;
    }
    return match;
});

// 4. Инлайним ВСЕ внешние JS и JSON-карты (<script src="...">)
html = html.replace(/<script[^>]*?src="([^"]+)"[^>]*>[\s\S]*?<\/script>/g, (match, jsPath) => {
    const fullJsPath = path.join(buildPath, jsPath);
    if (fs.existsSync(fullJsPath)) {
        const jsContent = fs.readFileSync(fullJsPath, 'utf8');
        console.log(`[JS/JSON] Встроено: ${jsPath}`);

        // Извлекаем все атрибуты скрипта, КРОМЕ src
        let attrs = match.match(/<script([^>]*)>/)[1].replace(/src="[^"]+"/, '').trim();

        // Для import-map типа
        if (jsPath.endsWith('.json')) {
            return `<script ${attrs}>\n${jsContent}\n</script>`;
        }

        return `<script ${attrs}>\n${jsContent}\n</script>`;
    }
    return match;
});

// 5. Встраиваем загрузку ассетов (Cocos грузит их JSON + BIN/Images через fetch)
// В Cocos Creator 3 сложно перехватить fetch/Image.src напрямую простым скриптом, 
// поэтому создадим инжектор XHR/Fetch
console.log('[Ассеты] Ищем файлы ресурсов...');

const allAssets = {};
function scanAssets(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanAssets(fullPath);
        } else {
            const relPath = path.relative(buildPath, fullPath).replace(/\\/g, '/');
            // Игнорим только сам .html, .css и те js, которые мы УЖЕ заинлайнили в теги
            if (relPath.endsWith('.html') || relPath.endsWith('.css')) continue;
            if (relPath === 'src/polyfills.bundle.js' || relPath === 'src/system.bundle.js' || relPath === 'src/import-map.json') continue;

            const b64 = getBase64(fullPath);
            if (b64) {
                allAssets[relPath] = b64;
            }
        }
    }
}
scanAssets(buildPath);

// Инжектим перехватчик прямо в HTML перед загрузкой движка
const xhrmock = `
<script>
window.__B64_ASSETS = ${JSON.stringify(allAssets)};

// Override Fetch for Cocos text/json assets
const originalFetch = window.fetch;
window.fetch = async function(url, options) {
    let lookupUrl = url;
    if (typeof url === 'string') {
        lookupUrl = url.replace(/^[./]+/, ''); // убираем ./
    }
    
    // Перебираем ключи на случай если путь запрашивается немного по-другому
    let matchUrl = null;
    for(let k in window.__B64_ASSETS) {
        if (lookupUrl.includes(window.__B64_ASSETS[k]) || lookupUrl === k || (typeof url === 'string' && url.includes(k))) {
            matchUrl = k; break;
        }
    }

    if (matchUrl && window.__B64_ASSETS[matchUrl]) {
        return {
            ok: true,
            status: 200,
            json: async () => {
                const b64 = window.__B64_ASSETS[matchUrl].split(',')[1];
                return JSON.parse(atob(b64));
            },
            text: async () => {
                const b64 = window.__B64_ASSETS[matchUrl].split(',')[1];
                return atob(b64);
            },
            arrayBuffer: async () => {
                const bstring = atob(window.__B64_ASSETS[matchUrl].split(',')[1]);
                const bytes = new Uint8Array(bstring.length);
                for (let i = 0; i < bstring.length; i++) bytes[i] = bstring.charCodeAt(i);
                return bytes.buffer;
            },
            blob: async () => {
                const bstring = atob(window.__B64_ASSETS[matchUrl].split(',')[1]);
                const mime = window.__B64_ASSETS[matchUrl].split(',')[0].split(':')[1].split(';')[0];
                const bytes = new Uint8Array(bstring.length);
                for (let i = 0; i < bstring.length; i++) bytes[i] = bstring.charCodeAt(i);
                return new Blob([bytes], {type: mime});
            }
        };
    }
    return originalFetch(url, options);
};

// Override SystemJS fetch removed from here because System is undefined in head// Override Image loading for Cocos
const OriginalImage = window.Image;
window.Image = function() {
    const img = new OriginalImage();
    const originalDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    Object.defineProperty(img, 'src', {
        get() { return originalDesc ? originalDesc.get.call(this) : this.getAttribute('src'); },
        set(val) {
            let lookupUrl = val.replace(/^[./]+/, '');
            let matchUrl = null;
            for(let k in window.__B64_ASSETS) {
                if (lookupUrl === k || val.includes(k)) {
                    matchUrl = k; break;
                }
            }
            if (matchUrl) {
                if (originalDesc) originalDesc.set.call(this, window.__B64_ASSETS[matchUrl]);
                else this.setAttribute('src', window.__B64_ASSETS[matchUrl]);
            } else {
                if (originalDesc) originalDesc.set.call(this, val);
                else this.setAttribute('src', val);
            }
        }
    });
    return img;
};

// Override XMLHttpRequest (fallback)
const OriginalXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    let b64Match = null;
    
    xhr.open = function(method, url) {
        let lookupUrl = typeof url === 'string' ? url.replace(/^[./]+/, '') : url;
        for(let k in window.__B64_ASSETS) {
            if (lookupUrl === k || (typeof url === 'string' && url.includes(k))) {
                b64Match = k; break;
            }
        }
        originalOpen.apply(xhr, arguments);
    };
    
    xhr.send = function() {
        if (b64Match) {
            Object.defineProperty(xhr, 'readyState', { value: 4, writable: false });
            Object.defineProperty(xhr, 'status', { value: 200, writable: false });
            
            const b64 = window.__B64_ASSETS[b64Match].split(',')[1];
            const mime = window.__B64_ASSETS[b64Match].split(',')[0].split(':')[1].split(';')[0];
            
            if (xhr.responseType === 'json') {
                Object.defineProperty(xhr, 'response', { value: JSON.parse(atob(b64)) });
            } else if (xhr.responseType === 'arraybuffer') {
                const bstring = atob(b64);
                const bytes = new Uint8Array(bstring.length);
                for (let i = 0; i < bstring.length; i++) bytes[i] = bstring.charCodeAt(i);
                Object.defineProperty(xhr, 'response', { value: bytes.buffer });
            } else {
                Object.defineProperty(xhr, 'responseText', { value: atob(b64) });
                Object.defineProperty(xhr, 'response', { value: atob(b64) });
            }
            
            if (xhr.onload) xhr.onload();
            if (xhr.onreadystatechange) xhr.onreadystatechange();
            
            return;
        }
        originalSend.apply(xhr, arguments);
    };
    return xhr;
};

// Имитация URL.createObjectURL для worker-ов (в 3 версии Cocos)
if (window.URL && window.URL.createObjectURL) {
    const originalCreate = window.URL.createObjectURL;
    window.URL.createObjectURL = function(obj) {
        return originalCreate(obj);
    };
}

// Перехватываем динамическое создание скриптов (Cocos Engine Loader & SystemJS)
const originalCreateElement = document.createElement;
document.createElement = function(tagName) {
    const el = originalCreateElement.call(document, tagName);
    if (tagName.toLowerCase() === 'script') {
        const originalSet = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src')?.set;
        Object.defineProperty(el, 'src', {
            get() { return this.getAttribute('src') || ''; },
            set(val) {
                let lookupUrl = typeof val === 'string' ? val.replace(/^[./]+/, '') : val;
                let matchUrl = null;
                
                // Проверяем прямое совпадение
                for(let k in window.__B64_ASSETS) {
                    if (lookupUrl === k || (typeof val === 'string' && val.includes(k))) {
                        matchUrl = k; break;
                    }
                }
                
                // Проверяем обрезку директорий, которые могут дублироваться
                if (!matchUrl && typeof lookupUrl === 'string') {
                    let trimUrl = lookupUrl;
                    let idx = trimUrl.indexOf('assets/'); 
                    if (idx !== -1) trimUrl = trimUrl.substring(idx);
                    for(let k in window.__B64_ASSETS) {
                        if (k.endsWith(trimUrl) || trimUrl.endsWith(k)) {
                            matchUrl = k; break;
                        }
                    }
                }

                if (matchUrl && window.__B64_ASSETS[matchUrl]) {
                    const b64 = window.__B64_ASSETS[matchUrl];
                    if (originalSet) originalSet.call(this, b64);
                    else this.setAttribute('src', b64);
                } else {
                    if (originalSet) originalSet.call(this, val);
                    else this.setAttribute('src', val);
                }
            }
        });
    }
    return el;
};
</script>
`;

// Вставляем XHR/Fetch перехватчик в <head>
html = html.replace('</head>', xhrmock + '\n</head>');

// 6. Удаляем manifest.json если есть
html = html.replace(/<link\s+rel="manifest".*?>/g, '');

fs.writeFileSync(outHtmlPath, html, 'utf8');

const originalSize = fs.readdirSync(path.join(buildPath, 'assets'), { recursive: true })
    .map(f => {
        const p = path.join(buildPath, 'assets', f);
        return fs.statSync(p).isDirectory() ? 0 : fs.statSync(p).size;
    }).reduce((a, b) => a + b, 0) / 1024 / 1024;
const newSize = fs.statSync(outHtmlPath).size / 1024 / 1024;

console.log('==============================================');
console.log('✅ Готово! Создан единый файл: ' + outHtmlPath);
console.log('Вес ассетов: ~' + originalSize.toFixed(2) + ' MB');
console.log('Итоговый размер HTML (включая base64): ' + newSize.toFixed(2) + ' MB');
console.log('Встроенных файлов: ' + Object.keys(allAssets).length);
console.log('==============================================');
