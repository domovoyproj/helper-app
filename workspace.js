'use strict';

// Presentation and interaction helpers. The existing encrypted data schema is unchanged.
const workspacePages = {
    'more-page': ['Разделы', ''],
    'dashboard-page': ['Сегодня', 'Ваш день, в одном месте.'],
    'planner-page': ['Задачи', 'Освободите голову. Запишите главное.'],
    'health-page': ['Здоровье', 'Небольшие шаги заботы о себе.'],
    'food-page': ['Питание', 'Запишите приём пищи по описанию или фотографии.'],
    'budget-page': ['Финансы', 'Понятная картина ваших денег.'],
    'calendar-page': ['Рабочие смены', 'Планируйте время и будущий доход.'],
    'misc-page': ['Инструменты', 'Полезные вещи для повседневной жизни.'],
    'vault-page': ['Личный сейф', 'Пароли и коды доступа под вашим контролем.'],
    'add-vault-page': ['Запись в сейфе', 'Всё необходимое для безопасного входа.'],
    'export-page': ['Отчёты', 'Ваша история в удобном формате.'],
    'profile-page': ['Личные цели', 'Настройте ориентиры под свой ритм.'],
    'settings-page': ['Настройки', 'Оформление, подключения и резервные копии.']
};
let taskFilter = 'active';
let taskQuery = '';

function workspaceHeader(id) {
    const [title] = workspacePages[id];
    const parent = id === 'food-page' || id === 'profile-page' ? ['health-page','Здоровье'] : id === 'add-vault-page' ? ['vault-page','Личный сейф'] : null;
    return `<header class="page-heading"><div>${parent ? `<button class="parent-link" onclick="showSection('${parent[0]}')">‹ ${parent[1]}</button>` : ''}<h1 tabindex="-1">${title}</h1></div><div class="heading-actions">${id === 'dashboard-page' ? '<span class="today-chip" id="helper-greeting"></span>' : ''}<button class="icon-button mobile-search" aria-label="Поиск" onclick="openCommandPalette()">${icon('search')}</button></div></header>`;
}

function mountWorkspace() {
    document.getElementById('more-page').insertAdjacentHTML('beforeend', `<nav class="section-menu" aria-label="Все разделы">${[...helperRoutes,['food-page','Питание','food'],['profile-page','Цели здоровья','activity'],['export-page','Отчёты','chart'],['settings-page','Настройки','settings']].map(([id,label,glyph]) => `<button onclick="showSection('${id}')">${icon(glyph)}<span>${label}</span>${icon('arrow')}</button>`).join('')}<button onclick="lockVault()">${icon('lock')}<span>Заблокировать</span></button></nav>`);
    document.body.insertAdjacentHTML('beforeend', `<dialog id="metric-dialog" class="metric-dialog" aria-labelledby="metric-title"><form id="metric-form" onsubmit="saveMetricDialog(event)"><div class="section-top"><h2 id="metric-title">Вода</h2><button type="button" class="icon-button" aria-label="Закрыть" onclick="document.getElementById('metric-dialog').close()">${icon('close')}</button></div><p id="metric-date" class="helper-hint"></p><label id="metric-label" for="metric-amount">Количество, мл</label><input id="metric-amount" type="number" min="1" step="1" inputmode="numeric" required oninput="updateMetricPresets()"><div id="metric-presets" class="metric-presets" role="group" aria-label="Быстрый выбор количества"></div><p id="metric-error" class="food-status is-error" role="status"></p><button type="submit" class="btn">Добавить</button></form></dialog>`);
    for (const id of Object.keys(workspacePages)) {
        const page = document.getElementById(id);
        if (page) page.insertAdjacentHTML('afterbegin', workspaceHeader(id));
    }
    document.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); });
    document.getElementById('planner-page').querySelector('.card').insertAdjacentHTML('afterbegin', `
        <div class="section-top"><h2>Мой список</h2><span class="count-badge" id="task-count">0</span></div>
        <div class="task-toolbar"><div class="segmented-control" aria-label="Фильтр задач">
        <button data-task-filter="active" onclick="setTaskFilter('active')">В работе</button><button data-task-filter="done" onclick="setTaskFilter('done')">Готово</button><button data-task-filter="all" onclick="setTaskFilter('all')">Все</button></div>
        <input id="task-search" type="search" placeholder="Найти задачу" aria-label="Найти задачу" oninput="taskQuery=this.value;renderPlanner()"></div>`);
    document.querySelectorAll('.page > .btn').forEach(button => {
        if (/^Назад/.test(button.textContent.trim())) button.classList.add('back-link');
    });
    document.querySelectorAll('button').forEach(button => {
        if (!button.hasAttribute('type')) button.type = 'button';
        if (!button.getAttribute('aria-label') && button.title) button.setAttribute('aria-label', button.title);
    });
    document.querySelectorAll('.date-navigator button').forEach(button => {
        const previous = button.getAttribute('onclick')?.includes('-1');
        button.textContent = previous ? '‹' : '›';
        button.setAttribute('aria-label', previous ? 'Предыдущий период' : 'Следующий период');
    });
    document.querySelectorAll('.input-action-btn').forEach(button => { button.innerHTML = icon('eye'); });
    document.querySelector('#add-vault-page button[onclick="showSection(\'misc-page\')"]')?.setAttribute('onclick', "showSection('vault-page')");
}

function getWorkspaceSummary(source, date) {
    const month = date.slice(0, 7);
    const transactions = (source.budget?.transactions || []).filter(t => t.date?.startsWith(month));
    const income = transactions.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount || 0), 0);
    const expense = transactions.filter(t => t.type !== 'income').reduce((s,t) => s + Number(t.amount || 0), 0);
    const activeTasks = (source.tasks || []).map((task, index) => ({...task, index})).filter(t => !t.done);
    return { income, expense, balance: income - expense, activeTasks, day: source.days?.[date] || {}, shift: source.shifts?.[date] || '' };
}

function renderWorkspace() {
    const today = getFormattedDate(new Date());
    const summary = getWorkspaceSummary(data, today);
    document.getElementById('helper-greeting').textContent = new Date().toLocaleDateString('ru-RU', {day:'numeric',month:'long',weekday:'short'});
    document.getElementById('focus-count').textContent = summary.activeTasks.length;
    document.getElementById('focus-list').innerHTML = summary.activeTasks.length ? summary.activeTasks.slice(0,4).map(t => `<label class="focus-task"><input type="checkbox" onchange="toggleWorkspaceTask(${t.index})"><span>${escapeHtml(t.text)}</span></label>`).join('') : '<p class="empty-state">Нет задач</p>';
    document.getElementById('finance-income').textContent = formatHelperMoney(summary.income);
    document.getElementById('finance-expense').textContent = formatHelperMoney(summary.expense);
    document.getElementById('finance-month').textContent = new Date().toLocaleDateString('ru-RU',{month:'long'});
    const profile = data.profile || {};
    const metrics = [['water',summary.day.water || 0,profile.targetWater || 2500,'мл'],['steps',summary.day.steps || 0,profile.targetSteps || 10000,'шагов'],['cal',summary.day.calories || 0,profile.targetCal || 2200,'ккал']];
    for (const [key,value,target,unit] of metrics) {
        document.getElementById(`daily-${key}`).textContent = new Intl.NumberFormat('ru-RU').format(value);
        document.getElementById(`daily-${key}-goal`).textContent = `из ${new Intl.NumberFormat('ru-RU').format(target)} ${unit}`;
        const percent = Math.min(100, Math.max(0, value / target * 100));
        const progress = document.getElementById(`daily-${key}-bar`);
        progress.style.width = `${percent}%`;
        progress.parentElement.setAttribute('aria-valuenow', Math.round(percent));
    }
    const week = [];
    for (let offset = 0; offset < 7; offset++) {
        const day = new Date(); day.setDate(day.getDate() + offset);
        const value = data.shifts?.[getFormattedDate(day)];
        week.push(`<button class="week-day ${offset === 0 ? 'is-today' : ''}" onclick="showSection('calendar-page')" aria-label="${day.toLocaleDateString('ru-RU')} — ${({day:'Дневная смена',night:'Ночная смена',off:'Выходной'})[value] || 'Без смены'}"><span>${day.toLocaleDateString('ru-RU',{weekday:'short'})}</span><strong>${day.getDate()}</strong><i class="shift-dot ${value || 'none'}"></i></button>`);
    }
    document.getElementById('week-strip').innerHTML = week.join('');
    document.getElementById('shift-description').textContent = ({day:'Дневная смена',night:'Ночная смена',off:'Выходной'})[summary.shift] || 'На сегодня смена не задана';
    document.getElementById('task-nav-count').textContent = summary.activeTasks.length || '';
}

function addFocusTask(event) {
    event.preventDefault();
    const input = document.getElementById('focus-input');
    const text = input.value.trim();
    if (createTask(text)) { input.value = ''; renderWorkspace(); showToast('Задача добавлена'); }
}
function toggleWorkspaceTask(index) { toggleTask(index); showToast('Задача выполнена'); }
function setTaskFilter(filter) { taskFilter = filter; renderPlanner(); }
function selectWorkspaceTasks(tasks, filter, query) {
    return tasks.map((task,index) => ({...task,index})).filter(t => (filter === 'all' || (filter === 'done' ? t.done : !t.done)) && t.text.toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU')));
}
function renderTaskWorkspace() {
    const tasks = data.tasks || [];
    const filtered = selectWorkspaceTasks(tasks, taskFilter, taskQuery);
    document.getElementById('task-count').textContent = `${tasks.filter(t=>!t.done).length} в работе`;
    document.querySelectorAll('[data-task-filter]').forEach(button => {
        button.classList.toggle('is-selected',button.dataset.taskFilter === taskFilter);
        button.setAttribute('aria-pressed',button.dataset.taskFilter === taskFilter ? 'true' : 'false');
    });
    document.getElementById('tasks-list').innerHTML = filtered.length ? filtered.map(t => `<div class="list-item ${t.done ? 'done' : ''}"><label class="task-content"><input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask(${t.index})"><span>${escapeHtml(t.text)}</span></label><button class="del-btn" aria-label="Удалить задачу ${escapeHtml(t.text)}" onclick="deleteTask(${t.index})">${icon('close')}</button></div>`).join('') : `<div class="empty-state"><span class="empty-symbol">${icon('check')}</span><h3>${taskQuery ? 'Ничего не найдено' : taskFilter === 'done' ? 'Всё ещё впереди' : 'Здесь пока спокойно'}</h3><p>${taskQuery ? 'Попробуйте другое слово.' : taskFilter === 'done' ? 'Выполненные задачи появятся здесь.' : 'Запишите дело, которое хотите сделать.'}</p></div>`;
}

function openTodayHealth(action) {
    currentDateStr = getFormattedDate(new Date());
    showSection(action === 'food' ? 'food-page' : 'health-page');
    if (action === 'steps') openDailyMetric('steps');
    if (action === 'weight') addWeightEntry();
}

let metricEntry = null;
function openDailyMetric(metric, today = false) {
    if (!masterKey || !['water','steps'].includes(metric)) return;
    if (today) currentDateStr = getFormattedDate(new Date());
    metricEntry = {metric,date:currentDateStr,session:data,key:masterKey};
    const water = metric === 'water';
    document.getElementById('metric-title').textContent = water ? 'Добавить воду' : 'Добавить шаги';
    document.getElementById('metric-label').textContent = water ? 'Количество, мл' : 'Количество шагов';
    document.getElementById('metric-date').textContent = 'Запись за ' + currentDateStr.split('-').reverse().join('.');
    const input = document.getElementById('metric-amount'); input.value = water ? 250 : 1000;
    document.getElementById('metric-error').textContent = '';
    document.getElementById('metric-presets').innerHTML = (water ? [150,250,500] : [1000,3000,5000]).map(value => `<button type="button" data-metric-value="${value}" onclick="document.getElementById('metric-amount').value=${value};updateMetricPresets()">${value}${water ? ' мл' : ''}</button>`).join('');
    updateMetricPresets(); document.getElementById('metric-dialog').showModal(); input.focus(); input.select();
}
function updateMetricPresets() {
    const value = document.getElementById('metric-amount').value;
    document.querySelectorAll('[data-metric-value]').forEach(button => button.setAttribute('aria-pressed',button.dataset.metricValue === value ? 'true' : 'false'));
}
function saveMetricDialog(event) {
    event.preventDefault();
    if (!metricEntry || metricEntry.session !== data || metricEntry.key !== masterKey || !masterKey) return;
    const input = document.getElementById('metric-amount');
    if (!input.reportValidity()) return;
    try {
        if (!recordDailyMetric(metricEntry.metric,input.value,metricEntry.date)) return;
        showToast(metricEntry.metric === 'water' ? `Добавлено ${input.value} мл воды` : `Добавлено ${input.value} шагов`);
        metricEntry = null; document.getElementById('metric-dialog').close();
    } catch { document.getElementById('metric-error').textContent = 'Не удалось сохранить. Проверьте свободное место на устройстве.'; }
}
