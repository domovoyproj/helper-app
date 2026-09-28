/* Read-only KYD boundary. No credentials, payments, or local debt mutations. */
(function (root) {
    'use strict';
    function profileAddress(value) {
        const url = new URL(value);
        const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Нужна HTTPS-ссылка на профиль KYD.');
        if (url.username || url.password) throw new Error('Ссылка не должна содержать пароль.');
        const match = url.pathname.match(/^\/p\/([a-zA-Z0-9_-]{1,80})\/?$/);
        if (!match) throw new Error('Вставьте ссылку на публичный профиль: https://ваш-kyd.ru/p/имя');
        const profile = `${url.origin}/p/${match[1]}`;
        return { profile, endpoint: profile };
    }
    function validateSnapshot(raw) {
        if (!raw || raw.source !== 'KYD' || raw.version !== 1 || raw.currency !== 'RUB') throw new Error('Неподдерживаемый формат сводки KYD.');
        const num = (value, max) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
        if (!num(raw.progressPct, 100) || !Number.isInteger(raw.totalDebtsCount) || !num(raw.totalDebtsCount, 100000)) throw new Error('Некорректные показатели KYD.');
        if (typeof raw.publicShowAmounts !== 'boolean') throw new Error('Не указаны настройки приватности KYD.');
        if (raw.publicShowAmounts && !num(raw.totalCurrentBalance, 1e14)) throw new Error('Некорректный остаток долга.');
        if (typeof raw.generatedAt !== 'string' || !Number.isFinite(Date.parse(raw.generatedAt))) throw new Error('Не указана дата сводки.');
        const date = raw.debtFreeDate;
        if (date !== null && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)))) throw new Error('Некорректная дата прогноза.');
        return {
            source: 'KYD', version: 1, currency: 'RUB', generatedAt: raw.generatedAt,
            progressPct: raw.progressPct, totalDebtsCount: raw.totalDebtsCount,
            publicShowAmounts: raw.publicShowAmounts,
            totalCurrentBalance: raw.publicShowAmounts ? raw.totalCurrentBalance : null,
            debtFreeDate: date
        };
    }
    function parseProfile(content) {
        if (!content) throw new Error('Пустой ответ от KYD.');
        if (typeof content === 'object') {
            if (content.source === 'KYD') return content;
            throw new Error('Неподдерживаемый формат сводки KYD.');
        }
        if (typeof content !== 'string') throw new Error('Некорректный ответ KYD.');
        const trimmed = content.trim();
        if (trimmed.startsWith('{')) {
            try {
                const json = JSON.parse(trimmed);
                if (json && json.source === 'KYD') return json;
            } catch {}
        }
        if (/<title>404|Страница не найдена|Профиль не найден/i.test(content)) {
            throw new Error('Профиль закрыт или не найден в KYD.');
        }
        let progressPct = null;
        const progressMatch = content.match(/Прогресс ликвидации долгов[\s\S]{1,300}?(?:num[^>"]*">|children":\[?)\s*(\d+)/i)
                           || content.match(/Прогресс ликвидации долгов[\s\S]{1,500}?width:\s*(\d+)%/i)
                           || content.match(/class="[^"]*num[^"]*"[^>]*>\s*(\d+)\s*(?:<!-- -->)?\s*%/i);
        if (progressMatch) {
            progressPct = parseInt(progressMatch[1], 10);
        }
        let debtFreeDate = null;
        const dateMatch = content.match(/Дата свободы[\s\S]{1,300}?(?:num[^>"]*">|children":")\s*([^<"]+)/i);
        if (dateMatch) {
            const rawDateText = dateMatch[1].trim();
            if (!/пока нет|—|-/i.test(rawDateText)) {
                const isoMatch = rawDateText.match(/(\d{4})-(\d{2})(?:-(\d{2}))?/);
                if (isoMatch) {
                    debtFreeDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3] || '01'}`;
                } else {
                    const monthMap = {
                        'янв': '01', 'фев': '02', 'мар': '03', 'апр': '04', 'май': '05', 'мая': '05',
                        'июн': '06', 'июл': '07', 'авг': '08', 'сен': '09', 'окт': '10', 'ноя': '11', 'дек': '12'
                    };
                    const ruMatch = rawDateText.match(/(янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек)[^\d]*(\d{4})/i);
                    if (ruMatch) {
                        const prefix = ruMatch[1].toLowerCase().slice(0, 3);
                        const mm = monthMap[prefix] || '01';
                        const yyyy = ruMatch[2];
                        debtFreeDate = `${yyyy}-${mm}-01`;
                    }
                }
            }
        }
        let totalCurrentBalance = null;
        let publicShowAmounts = false;
        const balanceMatch = content.match(/Текущий остаток[\s\S]{1,300}?(?:num[^>"]*">|children":")\s*([^<"]+)/i);
        if (balanceMatch) {
            const balanceText = balanceMatch[1].replace(/<!--[\s\S]*?-->/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
            if (/скрыт/i.test(balanceText)) {
                publicShowAmounts = false;
                totalCurrentBalance = null;
            } else {
                const numMatch = balanceText.match(/([\d\s]+)\s*₽/);
                if (numMatch) {
                    const num = parseInt(numMatch[1].replace(/\s/g, ''), 10);
                    if (Number.isFinite(num) && num >= 0) {
                        publicShowAmounts = true;
                        totalCurrentBalance = num;
                    }
                }
            }
        }
        let totalDebtsCount = null;
        const countMatch = content.match(/Долги участника[\s\S]{1,100}?\(\s*(?:<!-- -->)?\s*(?:",)?\s*(\d+)/i);
        if (countMatch) {
            totalDebtsCount = parseInt(countMatch[1], 10);
        } else {
            const articles = content.match(/<article\b[^>]*>|"article",/gi);
            if (articles) totalDebtsCount = articles.length;
        }
        if (progressPct === null && totalCurrentBalance === null && totalDebtsCount === null) {
            throw new Error('Не удалось найти данные профиля KYD. Проверьте ссылку.');
        }
        return {
            source: 'KYD',
            version: 1,
            currency: 'RUB',
            generatedAt: new Date().toISOString(),
            progressPct: progressPct ?? 0,
            totalDebtsCount: totalDebtsCount ?? 0,
            publicShowAmounts: !!publicShowAmounts,
            totalCurrentBalance: publicShowAmounts ? totalCurrentBalance : null,
            debtFreeDate
        };
    }
    async function fetchSnapshot(address, signal) {
        const { endpoint } = profileAddress(address);
        const response = await fetch(endpoint, { signal, credentials: 'omit', cache: 'no-store', redirect: 'follow', referrerPolicy: 'no-referrer' });
        if (response.status === 404) throw new Error('Профиль закрыт или не найден в KYD.');
        if (!response.ok) throw new Error(`KYD недоступен (код ${response.status}). Попробуйте позже.`);
        const text = await response.text();
        if (text.length > 500000) throw new Error('Слишком большой ответ KYD.');
        const parsed = parseProfile(text);
        return validateSnapshot(parsed);
    }
    root.KYDConnector = { profileAddress, parseProfile, validateSnapshot, fetchSnapshot };
    if (typeof module !== 'undefined') module.exports = root.KYDConnector;
})(globalThis);
