'use strict';

const helperIcons = {
    home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
    wallet: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8h18m-5 5h5m-5 3h2"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m7 12 3 3 7-7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    settings: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
    drop: '<path d="M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>'
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${helperIcons[name] || helperIcons.grid}</svg>`; }
const helperRoutes = [['dashboard-page', 'Сегодня', 'home'], ['budget-page', 'Финансы', 'wallet'], ['planner-page', 'Задачи', 'check'], ['calendar-page', 'Смены', 'calendar'], ['misc-page', 'Ещё', 'grid']];
let kydRequest = null;
let kydRequestVersion = 0;

function setupExperience() {
    document.body.insertAdjacentHTML('afterbegin', `<aside id="helper-sidebar" hidden><a class="helper-brand" href="#" onclick="showSection('dashboard-page');return false"><span class="brand-mark">h<span>·</span></span>helper<span class="brand-caption">Личный помощник</span></a><p class="nav-caption">МОЁ ПРОСТРАНСТВО</p><nav aria-label="Основная навигация">${helperRoutes.map(([id, label, glyph]) => `<button data-route="${id}" onclick="showSection('${id}')">${icon(glyph)}<span>${label}</span></button>`).join('')}</nav><div class="sidebar-bottom"><button data-route="settings-page" onclick="showSection('settings-page')">${icon('settings')}Настройки</button><button onclick="lockVault()">${icon('lock')}Заблокировать</button><span class="local-note"><i></i> Данные на этом устройстве</span></div></aside><nav id="helper-dock" aria-label="Основная навигация" hidden>${helperRoutes.map(([id, label, glyph]) => `<button data-route="${id}" onclick="showSection('${id}')">${icon(glyph)}<span>${label}</span></button>`).join('')}</nav>`);
    const dashboard = document.getElementById('dashboard-page');
    dashboard.firstElementChild.classList.add('legacy-header');
    dashboard.insertAdjacentHTML('afterbegin', `<header class="day-heading"><div><span class="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</span><h1>Всё важное.<br><span>В одном месте.</span></h1><p id="helper-greeting">Немного внимания себе — каждый день.</p></div><button class="round-button" aria-label="Настройки" onclick="showSection('settings-page')">${icon('settings')}</button></header><div class="overview-strip"><button onclick="showSection('planner-page')"><span>МОЙ ФОКУС</span><strong id="overview-tasks">0 задач</strong><small>На ближайшее время ${icon('arrow')}</small></button><button onclick="showSection('budget-page')"><span>БАЛАНС МЕСЯЦА</span><strong id="overview-money">0 ₽</strong><small>Доходы минус расходы ${icon('arrow')}</small></button><button onclick="showSection('calendar-page')"><span>СЕГОДНЯ</span><strong id="overview-shift">Без смены</strong><small>Мой рабочий график ${icon('arrow')}</small></button></div><section class="quick-capture" aria-label="Быстрая запись"><button class="capture-primary" onclick="showSection('food-page')">${icon('plus')}Записать еду</button><button onclick="quickWater()">${icon('drop')}250 мл воды</button><button onclick="addCustomSteps()">${icon('plus')}Шаги</button><button onclick="addWeightEntry()">${icon('plus')}Вес</button></section>`);
    const cards = [...dashboard.children].filter(n => n.classList.contains('card') && !n.classList.contains('legacy-header'));
    const grid = document.createElement('div'); grid.className = 'dashboard-grid'; dashboard.append(grid);
    for (const card of cards) {
        const title = card.querySelector('h2')?.textContent || '';
        if (title.includes('Инструменты')) { card.remove(); continue; }
        if (title.includes('Резервное')) {
            card.id = 'backup-card';
            const detail = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Резервные копии и перенос данных'; detail.append(summary);
            card.querySelector('h2').remove(); while (card.firstChild) detail.append(card.firstChild); card.append(detail);
        }
        if (title.includes('Прогресс')) { card.classList.add('wellbeing-card'); card.querySelector('h2').textContent = 'Самочувствие и привычки'; }
        if (title.includes('История')) card.classList.add('history-card');
        grid.append(card);
    }
    grid.insertAdjacentHTML('beforeend', `<section class="card kyd-card"><div class="section-top"><span class="eyebrow">ПОДКЛЮЧЁННЫЙ СЕРВИС</span><span class="source-badge">KYD ↗</span></div><h2>Долги под контролем</h2><div id="kyd-dashboard-summary"></div><button class="text-button" onclick="showSection('settings-page');document.getElementById('kyd-settings').scrollIntoView({behavior:'smooth'})">Настроить подключение ${icon('arrow')}</button></section>`);
    document.getElementById('settings-page').insertAdjacentHTML('afterbegin', `<section class="card" id="kyd-settings"><div class="section-top"><span class="eyebrow">ИНТЕГРАЦИИ</span><span class="source-badge">KYD</span></div><h2>Сводка из KYD</h2><p class="helper-description">Helper показывает прогресс. Долги, платежи и план остаются в KYD.</p><label for="kyd-profile-url">Ссылка на публичный профиль KYD</label><input type="url" id="kyd-profile-url" placeholder="https://ваш-kyd.ru/p/имя" autocomplete="off"><p class="helper-hint">В KYD должен быть включён публичный профиль и установлен API Helper. Скрытые суммы не передаются. Токены и пароль KYD не нужны.</p><div class="quick-grid"><button class="btn" id="kyd-connect" onclick="connectKYD()">Подключить / обновить</button><button class="btn btn-secondary" onclick="disconnectKYD()">Отключить</button></div><p id="kyd-status" role="status" aria-live="polite"></p><div id="kyd-settings-summary"></div><details><summary>Загрузить сводку из файла</summary><p class="helper-hint">JSON со сводкой API KYD. Файл не включает список долгов и не изменяет локальный бюджет.</p><label for="kyd-import">Файл сводки KYD</label><input id="kyd-import" type="file" accept="application/json,.json" onchange="importKYDSnapshot(event)"></details></section>`);
    document.getElementById('misc-page').insertAdjacentHTML('afterbegin', `<section class="card"><span class="eyebrow">ИНСТРУМЕНТЫ</span><h2>Всё остальное — под рукой</h2><div class="quick-grid" style="margin-top:18px"><button class="btn btn-secondary" onclick="showSection('export-page')">Отчёты CSV</button><button class="btn btn-secondary" onclick="showSection('profile-page')">Мои нормы</button><button class="btn btn-secondary" onclick="showSection('settings-page')">Настройки</button><button class="btn btn-secondary" onclick="lockVault()">Заблокировать</button></div></section>`);
    const auth = document.querySelector('#auth-page .card');
    auth.firstElementChild.outerHTML = '<div class="auth-brand brand-mark">h<span>·</span></div>';
    auth.querySelector('h2').textContent = 'Меньше суеты. Больше жизни.';
    auth.querySelector('.subtitle').textContent = 'Привычки, финансы и планы — ваше личное пространство.';
    const isNew = !localStorage.getItem('encMasterData');
    const input = document.getElementById('master-password'); input.setAttribute('aria-label', isNew ? 'Придумайте мастер-пароль' : 'Мастер-пароль'); input.autocomplete = isNew ? 'new-password' : 'current-password';
    input.placeholder = isNew ? 'Придумайте мастер-пароль' : 'Мастер-пароль';
    auth.querySelector('button[onclick="unlockVault()"]').textContent = isNew ? 'Создать моё пространство →' : 'Открыть моё пространство →';
    const note = document.createElement('p'); note.className = 'helper-hint'; note.textContent = 'Запомните мастер-пароль: он шифрует данные, восстановить его нельзя. Регистрация не нужна.'; input.closest('.input-with-action').after(note);
    auth.querySelector('button[onclick="resetVault()"]').classList.add('reset-link');
    document.getElementById('toast-box').setAttribute('role', 'status');
    document.querySelectorAll('input:not([aria-label]), textarea:not([aria-label]), select:not([aria-label])').forEach(field => { if (field.placeholder && !field.labels?.length) field.setAttribute('aria-label', field.placeholder); });
    renderExperience();
}

function renderExperience(pageId) {
    if (!document.getElementById('helper-sidebar')) return;
    const page = pageId || document.querySelector('.page.active')?.id;
    const unlocked = !!masterKey;
    document.body.classList.toggle('is-unlocked', unlocked);
    document.getElementById('helper-sidebar').hidden = !unlocked;
    document.getElementById('helper-dock').hidden = !unlocked;
    document.querySelectorAll('[data-route]').forEach(btn => {
        const active = btn.dataset.route === page || (page === 'food-page' && btn.dataset.route === 'dashboard-page');
        btn.classList.toggle('is-active', active); if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
    });
    if (!unlocked) return;
    const count = (data.tasks || []).filter(t => !t.done).length;
    document.getElementById('overview-tasks').textContent = count ? `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'задача' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'задачи' : 'задач'}` : 'Всё спокойно';
    const month = getFormattedDate(new Date()).slice(0, 7);
    const balance = (data.budget?.transactions || []).filter(t => t.date?.startsWith(month)).reduce((sum, t) => sum + (t.type === 'income' ? 1 : -1) * Number(t.amount || 0), 0);
    document.getElementById('overview-money').textContent = formatHelperMoney(balance);
    document.getElementById('overview-shift').textContent = ({ day: 'Дневная смена', night: 'Ночная смена', off: 'Выходной' })[data.shifts?.[getFormattedDate(new Date())]] || 'Без смены';
    document.getElementById('helper-greeting').textContent = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · В своём ритме';
    if (page === 'settings-page') document.getElementById('kyd-profile-url').value = data.kyd?.profileUrl || '';
    renderKYD();
}
function formatHelperMoney(value) { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value); }

function quickWater() {
    if (!masterKey) return;
    const d = getTodayData(); d.water += 250; d.waterList.push(250); saveEncrypted(); updateUI();
    showToast(`Добавлено 250 мл · ${currentDateStr === getFormattedDate(new Date()) ? 'сегодня' : currentDateStr}`);
}

function renderKYD() {
    const link = data.kyd;
    let html = '<p class="helper-description">Ваш прогресс по долгам — рядом с повседневными делами.</p><div class="empty-note">Подключите KYD или загрузите сводку. Данные появятся здесь.</div>';
    if (link?.snapshot) {
        try {
            const s = KYDConnector.validateSnapshot(link.snapshot);
            const age = Date.now() - Date.parse(link.fetchedAt || s.generatedAt);
            const date = s.debtFreeDate ? new Date(s.debtFreeDate + 'T12:00:00').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : 'Пока нет прогноза';
            html = `<div class="kyd-progress-label"><strong>${s.progressPct}%</strong><span>долга погашено</span></div><div class="progress-track" role="progressbar" aria-label="Прогресс KYD" aria-valuenow="${s.progressPct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${s.progressPct}%;background:var(--success)"></div></div><div class="kyd-facts"><div><span>Осталось</span><strong>${s.publicShowAmounts ? formatHelperMoney(s.totalCurrentBalance) : 'Сумма скрыта'}</strong></div><div><span>Прогноз KYD</span><strong>${date}</strong></div></div><p class="helper-hint">${link.mode === 'file' ? 'Из файла' : 'Снимок KYD'} · ${new Date(link.fetchedAt || s.generatedAt).toLocaleString('ru-RU')}${age > 86400000 ? ' · Данные стоит обновить' : ''}</p>`;
            if (link.profileUrl) {
                const safe = KYDConnector.profileAddress(link.profileUrl).profile;
                html += `<div class="quick-grid"><button class="btn btn-secondary" onclick="refreshKYD()">Обновить</button><a class="btn btn-secondary" href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">Открыть KYD ↗</a></div>`;
            }
        } catch { html = '<p class="helper-description">Сводка повреждена. Загрузите её заново в настройках.</p>'; }
    }
    for (const id of ['kyd-dashboard-summary', 'kyd-settings-summary']) document.getElementById(id).innerHTML = html;
}

function cancelKYDRequest() { kydRequestVersion++; if (kydRequest) kydRequest.abort(); kydRequest = null; const btn = document.getElementById('kyd-connect'); if (btn) { btn.disabled = false; btn.textContent = 'Подключить / обновить'; } }
async function connectKYD(address) {
    if (!masterKey) return;
    const status = document.getElementById('kyd-status');
    let url;
    try { url = KYDConnector.profileAddress(address || document.getElementById('kyd-profile-url').value.trim()).profile; }
    catch (e) { status.textContent = e.message; return; }
    cancelKYDRequest();
    const version = kydRequestVersion; const vaultData = data;
    const controller = new AbortController(); kydRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    const button = document.getElementById('kyd-connect'); button.disabled = true; button.textContent = 'Получаем сводку…'; status.textContent = 'Подключаемся к KYD…';
    try {
        const snapshot = await KYDConnector.fetchSnapshot(url, controller.signal);
        if (!masterKey || data !== vaultData || version !== kydRequestVersion) return;
        data.kyd = { profileUrl: url, snapshot, fetchedAt: new Date().toISOString(), mode: 'live' };
        saveEncrypted(); renderKYD(); status.textContent = 'Сводка обновлена. Локальные долги Helper не изменены.'; showToast('Сводка KYD обновлена');
    } catch (e) {
        if (version !== kydRequestVersion || !masterKey || data !== vaultData) return;
        // Never keep displaying amounts after a failed privacy refresh.
        if (data.kyd?.profileUrl === url) { data.kyd.snapshot = null; saveEncrypted(); renderKYD(); }
        status.textContent = e.name === 'AbortError' ? 'KYD не ответил за 12 секунд. Попробуйте ещё раз.' : (e instanceof TypeError ? 'Нет соединения с KYD. Проверьте адрес, сеть и установку API.' : e.message);
        showToast('Не удалось обновить KYD. Подробности в настройках.');
    } finally {
        clearTimeout(timeout);
        if (version === kydRequestVersion) { kydRequest = null; button.disabled = false; button.textContent = 'Подключить / обновить'; }
    }
}
function refreshKYD() { if (data.kyd?.profileUrl) connectKYD(data.kyd.profileUrl); }
function disconnectKYD() { cancelKYDRequest(); delete data.kyd; saveEncrypted(); document.getElementById('kyd-profile-url').value = ''; document.getElementById('kyd-status').textContent = 'Подключение и сохранённая сводка удалены.'; renderKYD(); }
async function importKYDSnapshot(event) {
    const file = event.target.files[0]; if (!file || !masterKey) return;
    const vaultData = data; cancelKYDRequest(); const version = kydRequestVersion;
    try {
        if (file.size > 50000) throw new Error('Файл сводки должен быть меньше 50 КБ.');
        const snapshot = KYDConnector.validateSnapshot(JSON.parse(await file.text()));
        if (!masterKey || data !== vaultData || version !== kydRequestVersion) return;
        data.kyd = { snapshot, fetchedAt: snapshot.generatedAt, mode: 'file' }; saveEncrypted(); renderExperience('settings-page'); document.getElementById('kyd-status').textContent = 'Сводка загружена из файла. Автообновление недоступно.';
    } catch (e) { if (masterKey && data === vaultData) document.getElementById('kyd-status').textContent = e instanceof SyntaxError ? 'Файл не содержит корректный JSON.' : e.message; }
    finally { event.target.value = ''; }
}

setupExperience();
