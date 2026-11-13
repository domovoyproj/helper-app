'use strict';

// Presentation and interaction helpers. The existing encrypted data schema is unchanged.
const workspacePages = {
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
    const [title, subtitle] = workspacePages[id];
    return `<header class="page-heading"><div><p class="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</p><h1 tabindex="-1">${title}<span class="heading-dot">.</span></h1><p class="page-description">${subtitle}</p></div>${id === 'dashboard-page' ? '<span class="today-chip" id="helper-greeting"></span>' : ''}</header>`;
}

function mountWorkspace() {
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
    document.getElementById('overview-tasks').textContent = summary.activeTasks.length;
    document.getElementById('overview-money').textContent = formatHelperMoney(summary.balance);
    document.getElementById('overview-shift').textContent = ({day:'Дневная',night:'Ночная',off:'Выходной'})[summary.shift] || 'Не запланирована';
    document.getElementById('overview-task-note').textContent = summary.activeTasks.length ? 'ждут вашего внимания' : 'можно выдохнуть';
    document.getElementById('helper-greeting').textContent = new Date().toLocaleDateString('ru-RU', {day:'numeric',month:'long',weekday:'short'});
    document.getElementById('focus-count').textContent = summary.activeTasks.length;
    document.getElementById('focus-list').innerHTML = summary.activeTasks.length ? summary.activeTasks.slice(0,4).map(t => `<label class="focus-task"><input type="checkbox" onchange="toggleWorkspaceTask(${t.index})"><span>${escapeHtml(t.text)}</span><span class="task-tag">В работе</span></label>`).join('') : `<div class="empty-state"><span class="empty-symbol">${icon('check')}</span><h3>Место для главного</h3><p>Добавьте первое дело. Всё начинается<br>с одного небольшого шага.</p></div>`;
    document.getElementById('finance-income').textContent = formatHelperMoney(summary.income);
    document.getElementById('finance-expense').textContent = formatHelperMoney(summary.expense);
    const total = summary.income + summary.expense;
    document.getElementById('finance-bar').style.width = total ? `${summary.income / total * 100}%` : '0%';
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
    document.getElementById('shift-description').textContent = ({day:'Сегодня дневная смена. Хорошего рабочего дня!',night:'Сегодня ночная смена. Оставьте время на отдых.',off:'Сегодня выходной. Время для себя.'})[summary.shift] || 'На сегодня смена не задана. Добавьте её в календарь.';
    document.getElementById('task-nav-count').textContent = summary.activeTasks.length || '';
}

function addFocusTask(event) {
    event.preventDefault();
    const input = document.getElementById('focus-input');
    const text = input.value.trim();
    if (createTask(text)) { input.value = ''; renderWorkspace(); showToast('Задача добавлена'); }
}
function toggleWorkspaceTask(index) { toggleTask(index); renderWorkspace(); showToast('Готово. Ещё один шаг вперёд'); }
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

function todayWater() {
    currentDateStr = getFormattedDate(new Date());
    quickWater();
}

function openTodayHealth(action) {
    currentDateStr = getFormattedDate(new Date());
    showSection(action === 'food' ? 'food-page' : 'health-page');
    if (action === 'steps') promptDailyMetric('steps');
    if (action === 'weight') addWeightEntry();
}
