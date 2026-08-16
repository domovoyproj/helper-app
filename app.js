let data = JSON.parse(localStorage.getItem('helperData')) || {
    calories: 0,
    water: 0,
    steps: 0,
    mood: '—',
    shifts: {}, // Хранение смен: { "2026-08-17": "day" }
    apiKey: ''
};

function updateUI() {
    document.getElementById('cal-value').innerText = data.calories;
    document.getElementById('water-value').innerText = data.water;
    document.getElementById('steps-value').innerText = data.steps || 0;
    document.getElementById('current-mood').innerText = data.mood || '—';
    document.getElementById('api-key-input').value = data.apiKey;
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function saveData() { localStorage.setItem('helperData', JSON.stringify(data)); }
function saveApiKey() { data.apiKey = document.getElementById('api-key-input').value.trim(); saveData(); alert("Ключ сохранен!"); showPage('dashboard'); }
function addWater(amount) { data.water += amount; saveData(); updateUI(); }
function addSteps(amount) { data.steps = (data.steps || 0) + amount; saveData(); updateUI(); }
function setMood(emoji) { data.mood = emoji; saveData(); updateUI(); }
function clearData() { if (confirm("Точно удалить все данные?")) { data = { calories: 0, water: 0, steps: 0, mood: '—', shifts: {}, apiKey: data.apiKey }; saveData(); updateUI(); } }

// Предпросмотр картинки
function previewImage(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('image-preview');
    if (file) {
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
}

// Конвертация файла в Base64 для ИИ
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// ИИ запрос (Текст + Фото)
async function analyzeFood() {
    const text = document.getElementById('food-input').value.trim();
    const fileInput = document.getElementById('food-image');
    
    if (!text && fileInput.files.length === 0) return alert("Напишите текст или прикрепите фото");
    if (!data.apiKey) return alert("Укажите API ключ в настройках!");

    const btn = document.getElementById('analyze-btn');
    const resultBox = document.getElementById('food-result');
    btn.innerText = "⏳ Изучаю..."; btn.disabled = true; resultBox.classList.add('hidden');

    let promptParts = [{ text: `Ты нутрициолог. Посчитай КБЖУ. Если есть картинка, распознай еду на ней. Учитывай текст пользователя (если есть): "${text}". Верни ТОЛЬКО JSON в формате: {"name":"Название","cal":300,"p":15,"f":10,"c":40}` }];

    if (fileInput.files.length > 0) {
        const base64Image = await fileToBase64(fileInput.files[0]);
        promptParts.push({
            inline_data: { mime_type: fileInput.files[0].type, data: base64Image }
        });
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${data.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: promptParts }], generationConfig: { temperature: 0.1 } })
        });

        if (!response.ok) throw new Error("Ошибка API");
        const resData = await response.json();
        let aiText = resData.candidates[0].content.parts[0].text;
        
        aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
        const meal = JSON.parse(aiText);

        data.calories += meal.cal; saveData(); updateUI();

        resultBox.innerHTML = `<strong>${meal.name}</strong><br>🔥 ${meal.cal} ккал<br>Б: ${meal.p}г | Ж: ${meal.f}г | У: ${meal.c}г<br><br><em>Добавлено!</em>`;
        resultBox.classList.remove('hidden');
        document.getElementById('food-input').value = '';
        document.getElementById('food-image').value = '';
        document.getElementById('image-preview').style.display = 'none';

    } catch (error) {
        alert("Ошибка. Проверьте интернет или API ключ.");
    } finally {
        btn.innerText = "✨ Рассчитать"; btn.disabled = false;
    }
}

// Календарь смен
function renderCalendar() {
    const grid = document.getElementById('cal-grid');
    grid.innerHTML = '';
    
    const now = new Date();
    document.getElementById('month-name').innerText = now.toLocaleString('ru', { month: 'long', year: 'numeric' });
    
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    // Дни недели
    ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(d => {
        grid.innerHTML += `<div class="cal-day-name">${d}</div>`;
    });

    // Пустые ячейки для сдвига первого дня месяца
    let firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1; // Корректировка для понедельника
    for(let i=0; i<firstDay; i++) grid.innerHTML += `<div></div>`;

    // Генерация дней
    for(let i=1; i<=daysInMonth; i++) {
        let dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        let shiftStatus = data.shifts[dateStr] || 'none';
        
        let className = 'cal-day';
        let emoji = '';
        if (shiftStatus === 'day') { className += ' shift-day'; emoji = '☀️<br>'; }
        if (shiftStatus === 'night') { className += ' shift-night'; emoji = '🌙<br>'; }
        if (shiftStatus === 'off') { className += ' shift-off'; emoji = '🌴<br>'; }

        grid.innerHTML += `<div class="${className}" onclick="toggleShift('${dateStr}')">${emoji}${i}</div>`;
    }
}

function toggleShift(dateStr) {
    if (!data.shifts) data.shifts = {};
    const current = data.shifts[dateStr];
    
    if (!current || current === 'none') data.shifts[dateStr] = 'day';
    else if (current === 'day') data.shifts[dateStr] = 'night';
    else if (current === 'night') data.shifts[dateStr] = 'off';
    else if (current === 'off') delete data.shifts[dateStr];
    
    saveData();
    renderCalendar();
}

updateUI();
