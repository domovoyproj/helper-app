'use strict';

const helperIcons = {
    expense: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M8 12h8"/>',
    income: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M8 12h8m-4-4v8"/>',
    moon: '<path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
    wallet: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8h18m-5 5h5m-5 3h2"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m7 12 3 3 7-7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    settings: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
    drop: '<path d="M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    food: '<path d="M5 3v7m4-7v7M3 3v5a4 4 0 0 0 8 0V3M7 12v9M20 3c-5 2-5 10 0 10V3Zm0 10v8"/>',
    chart: '<path d="M4 4v16h17M9 15v-4m5 4V7m5 8V4"/>',
    logout: '<path d="M10 4H4v16h6m4-13 5 5-5 5m-5-5h10"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>'
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${helperIcons[name] || helperIcons.grid}</svg>`; }
const helperRoutes = [['dashboard-page','Сегодня','home'],['planner-page','Задачи','check'],['health-page','Здоровье','activity'],['budget-page','Финансы','wallet'],['calendar-page','Смены','calendar'],['vault-page','Личный сейф','lock'],['misc-page','Инструменты','grid']];

const appearanceDefaults = { theme: 'system', density: 'comfortable' };
const commandItems = [
    ['dashboard-page', 'Сегодня', 'Сводка дня и быстрые действия'],
    ['health-page', 'Здоровье', 'Вода, шаги, вес и история'],
    ['vault-page', 'Личный сейф', 'Пароли и коды 2FA'],
    ['food-page', 'Питание', 'Записать еду или распознать фото'],
    ['budget-page', 'Финансы', 'Бюджет, операции и долги'],
    ['planner-page', 'Задачи', 'Список дел'],
    ['calendar-page', 'Смены', 'График и расчёт зарплаты'],
    ['misc-page', 'Инструменты', 'Файлы, видео и полезные действия'],
    ['profile-page', 'Мои нормы', 'Калории, вода и целевой вес'],
    ['export-page', 'Отчёты', 'Экспорт CSV'],
    ['settings-page', 'Настройки', 'Вид, интеграции и синхронизация']
];

function setupExperience() {
    applyAppearance();
    const navButton = ([id,label,glyph]) => `<button data-route="${id}" onclick="showSection('${id}')">${icon(glyph)}<span>${label}</span>${id === 'planner-page' ? '<small id="task-nav-count"></small>' : ''}</button>`;
    document.body.insertAdjacentHTML('afterbegin', `<a class="skip-link" href="#dashboard-page">К содержимому</a><aside id="helper-sidebar" hidden><a class="helper-brand" href="#" onclick="showSection('dashboard-page');return false"><span class="brand-mark">h<span>·</span></span>helper</a><button class="sidebar-search" onclick="openCommandPalette()">${icon('search')}<span>Быстрый поиск</span></button><nav aria-label="Основная навигация">${helperRoutes.slice(0,5).map(navButton).join('')}</nav><nav aria-label="Личные инструменты">${helperRoutes.slice(5).map(navButton).join('')}${navButton(['export-page','Отчёты','chart'])}</nav><div class="sidebar-bottom">${navButton(['settings-page','Настройки','settings'])}<button onclick="lockVault()">${icon('logout')}<span>Заблокировать</span></button><span class="local-note" id="connection-status"><i></i><span>Данные на этом устройстве</span></span></div></aside><nav id="helper-dock" hidden aria-label="Мобильная навигация">${[helperRoutes[0],helperRoutes[1],helperRoutes[2],helperRoutes[3],['more-page','Разделы','grid']].map(([id,label,glyph])=>`<button data-route="${id}" onclick="showSection('${id}')">${icon(glyph)}<span>${label}</span></button>`).join('')}</nav><div id="command-palette" class="command-palette" hidden role="dialog" aria-modal="true" aria-labelledby="command-title" onclick="if(event.target===this)closeCommandPalette()"><div class="command-panel"><div class="command-search">${icon('search')}<input id="command-input" type="search" placeholder="Найти раздел…" autocomplete="off" aria-labelledby="command-title"><button class="icon-button" aria-label="Закрыть поиск" onclick="closeCommandPalette()">${icon('close')}</button></div><h2 id="command-title" class="sr-only">Быстрый поиск</h2><div id="command-results" class="command-results"></div></div></div>`);
    document.getElementById('settings-page').insertAdjacentHTML('afterbegin', `<section class="card appearance-card"><h2>Оформление</h2><span class="setting-label">Тема</span><div class="segmented-control" role="group" aria-label="Тема"><button data-theme-choice="system" onclick="setAppearance('theme','system')">Система</button><button data-theme-choice="dark" onclick="setAppearance('theme','dark')">Тёмная</button><button data-theme-choice="light" onclick="setAppearance('theme','light')">Светлая</button></div><button class="btn btn-secondary install-button" id="helper-install" hidden onclick="installHelper()">Установить Helper на устройство</button></section>`);

    const auth = document.querySelector('#auth-page .card');
    auth.classList.add('auth-form');
    auth.firstElementChild.outerHTML = '<div class="auth-wordmark"><span class="brand-mark">h<span>·</span></span>helper</div>';
    auth.querySelector('h2').textContent = 'Вход';
    auth.querySelector('.subtitle').remove();
    const isNew = !localStorage.getItem('encMasterData');
    const input = document.getElementById('master-password');
    input.setAttribute('aria-label',isNew ? 'Придумайте мастер-пароль' : 'Мастер-пароль');
    input.autocomplete = isNew ? 'new-password' : 'current-password';
    input.placeholder = isNew ? 'Придумайте мастер-пароль' : 'Мастер-пароль';
    auth.querySelector('button[onclick="unlockVault()"]').textContent = isNew ? 'Создать пространство →' : 'Открыть пространство →';
    const note = document.createElement('p'); note.className = 'helper-hint'; note.textContent = 'Запомните мастер-пароль. Он шифрует данные, восстановить его нельзя.'; input.closest('.input-with-action').after(note);
    auth.querySelector('button[onclick="resetVault()"]').classList.add('reset-link');
    mountWorkspace();
    setupMobileViewport();
    document.getElementById('toast-box').setAttribute('role','status');
    document.querySelectorAll('input:not([aria-label]),textarea:not([aria-label]),select:not([aria-label])').forEach(field=>{if(field.placeholder && !field.labels?.length)field.setAttribute('aria-label',field.placeholder);});
    setupCommandPalette(); updateConnectionStatus();
    window.addEventListener('online',updateConnectionStatus); window.addEventListener('offline',updateConnectionStatus);
    if(typeof updateInstallButton === 'function')updateInstallButton();
    applyAppearance();
    renderExperience();
}
function getAppearance() {
    try { return { ...appearanceDefaults, ...JSON.parse(localStorage.getItem('helperAppearance') || '{}') }; }
    catch { return { ...appearanceDefaults }; }
}

function applyAppearance() {
    const appearance = getAppearance();
    const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const theme = appearance.theme === 'system' ? (systemDark ? 'dark' : 'light') : appearance.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = appearance.theme;
    document.body.classList.toggle('density-compact', appearance.density === 'compact');
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === 'light' ? '#f6f5f1' : '#191a1c';
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
        button.classList.toggle('is-selected', button.dataset.themeChoice === appearance.theme);
        button.setAttribute('aria-pressed',String(button.dataset.themeChoice === appearance.theme));
    });
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
        button.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
        button.setAttribute('aria-label',theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
        button.title = button.getAttribute('aria-label');
    });
    document.querySelectorAll('[data-density-choice]').forEach(button => button.classList.toggle('is-selected', button.dataset.densityChoice === appearance.density));
}

function setAppearance(key, value) {
    const appearance = getAppearance();
    appearance[key] = value;
    localStorage.setItem('helperAppearance', JSON.stringify(appearance));
    applyAppearance();
}

function toggleTheme() {
    setAppearance('theme',document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

function setupMobileViewport() {
    const viewport = window.visualViewport;
    const update = () => {
        const height = viewport?.height || window.innerHeight;
        document.documentElement.style.setProperty('--visible-height',`${height}px`);
        const editing = document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]),textarea,select');
        document.body.classList.toggle('keyboard-open',!!editing && window.innerHeight - height > 120);
    };
    viewport?.addEventListener('resize',update);
    window.addEventListener('resize',update);
    document.addEventListener('focusin',update);
    document.addEventListener('focusout',() => requestAnimationFrame(update));
    update();
}

function updateConnectionStatus() {
    const status = document.getElementById('connection-status');
    if (!status) return;
    const online = navigator.onLine;
    status.hidden = online;
    status.classList.toggle('is-offline', !online);
    status.querySelector('span').textContent = online ? 'Данные на этом устройстве' : 'Офлайн · локальные функции доступны';
}

function renderCommandItems(query = '') {
    const results = document.getElementById('command-results');
    if (!results) return;
    const needle = query.trim().toLocaleLowerCase('ru-RU');
    const matches = commandItems.filter(([, label, hint]) => `${label} ${hint}`.toLocaleLowerCase('ru-RU').includes(needle));
    results.innerHTML = matches.length ? matches.map(([id, label, hint], index) => `<button data-command-route="${id}" class="${index === 0 ? 'is-current' : ''}" onclick="runCommand('${id}')"><strong>${label}</strong><span>${hint}</span><kbd>→</kbd></button>`).join('') : '<p class="command-empty">Ничего не найдено</p>';
}

function setupCommandPalette() {
    const input = document.getElementById('command-input');
    input.addEventListener('input', () => renderCommandItems(input.value));
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') document.querySelector('#command-results .is-current')?.click();
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const buttons = [...document.querySelectorAll('#command-results button')];
            if (!buttons.length) return;
            const current = buttons.findIndex(button => button.classList.contains('is-current'));
            const next = (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
            buttons.forEach((button,index) => button.classList.toggle('is-current',index === next));
            buttons[next].scrollIntoView({block:'nearest'});
        }
    });
    document.addEventListener('keydown', event => {
        const editing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
        if (masterKey && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openCommandPalette(); }
        else if (masterKey && event.key === '/' && !editing) { event.preventDefault(); openCommandPalette(); }
        else if (event.key === 'Escape') closeCommandPalette();
        if (event.key === 'Tab' && !document.getElementById('command-palette').hidden) {
            const controls = [...document.querySelectorAll('#command-palette input,#command-palette button')];
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (getAppearance().theme === 'system') applyAppearance(); });
}

let commandReturnFocus = null;
function openCommandPalette() {
    if (!masterKey) return;
    const palette = document.getElementById('command-palette');
    commandReturnFocus = document.activeElement;
    const input = document.getElementById('command-input');
    palette.hidden = false;
    document.body.classList.add('has-dialog');
    input.value = '';
    renderCommandItems();
    requestAnimationFrame(() => input.focus());
}

function closeCommandPalette() {
    const palette = document.getElementById('command-palette');
    if (!palette || palette.hidden) return;
    palette.hidden = true;
    document.body.classList.remove('has-dialog');
    if (masterKey) commandReturnFocus?.focus();
}

function runCommand(pageId) {
    closeCommandPalette();
    showSection(pageId);
}

function renderExperience(pageId) {
    if (!document.getElementById('helper-sidebar')) return;
    const page = pageId || document.querySelector('.page.active')?.id;
    const unlocked = !!masterKey;
    document.body.classList.toggle('is-unlocked',unlocked);
    for(const id of ['helper-sidebar','helper-dock'])document.getElementById(id).hidden = !unlocked;
    document.querySelectorAll('[data-route]').forEach(button=>{
        const route = page === 'food-page' || page === 'profile-page' ? 'health-page' : page === 'add-vault-page' ? 'vault-page' : page;
        const inDock = button.closest('#helper-dock');
        const active = button.dataset.route === route || (inDock && button.dataset.route === 'more-page' && !['dashboard-page','planner-page','health-page','budget-page'].includes(route));
        button.classList.toggle('is-active',active);
        if(active)button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    });
    if(!unlocked){
        closeCommandPalette();
        const existing = !!localStorage.getItem('encMasterData');
        const input = document.getElementById('master-password');
        input.placeholder = existing ? 'Мастер-пароль' : 'Придумайте мастер-пароль';
        input.autocomplete = existing ? 'current-password' : 'new-password';
        document.querySelector('[onclick="unlockVault()"]').textContent = existing ? 'Открыть пространство →' : 'Создать пространство →';
        return;
    }
    renderWorkspace();

}


setupExperience();
