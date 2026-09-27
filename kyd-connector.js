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
        return { profile: `${url.origin}/p/${match[1]}`, endpoint: `${url.origin}/api/public/helper/${match[1]}` };
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
    async function fetchSnapshot(address, signal) {
        const { endpoint } = profileAddress(address);
        const response = await fetch(endpoint, { signal, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' });
        if (response.status === 404) throw new Error('Профиль закрыт, не найден или API ещё не установлен в KYD.');
        if (!response.ok) throw new Error(`KYD недоступен (код ${response.status}). Попробуйте позже.`);
        const text = await response.text();
        if (text.length > 50000) throw new Error('Слишком большой ответ KYD.');
        let json;
        try { json = JSON.parse(text); } catch { throw new Error('KYD вернул не сводку. Проверьте установку API.'); }
        return validateSnapshot(json);
    }
    root.KYDConnector = { profileAddress, validateSnapshot, fetchSnapshot };
    if (typeof module !== 'undefined') module.exports = root.KYDConnector;
})(globalThis);
