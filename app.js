// Инициализация данных при запуске
let data = JSON.parse(localStorage.getItem('helperData')) || {
    calories: 0,
    water: 0,
    apiKey: ''
};

// Обновление интерфейса
function updateUI() {
    document.getElementById('cal-value').innerText = data.calories;
    document.getElementById('water-value').innerText = data.water;
    document.getElementById('api-key-input').value = data.apiKey;
}

// Навигация между экранами
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

// Сохранение ключа
function saveApiKey() {
    data.apiKey = document.getElementById('api-key-input').value.trim();
    saveData();
    alert("Ключ сохранен!");
    showPage('dashboard');
}

// Добавление воды
function addWater(amount) {
    data.water += amount;
    saveData();
    updateUI();
}

// Очистка данных
function clearData() {
    if (confirm("Точно удалить все данные?")) {
        data = { calories: 0, water: 0, apiKey: '' };
        saveData();
        updateUI();
    }
}

// Сохранение в LocalStorage
function saveData() {
    localStorage.setItem('helperData', JSON.stringify(data));
}

// Запрос к Gemini API
async function analyzeFood() {
    const text = document.getElementById('food-input').value.trim();
    if (!text) return alert("Введите описание еды");
    if (!data.apiKey) {
        alert("Сначала укажите Gemini API ключ в настройках!");
        showPage('settings');
        return;
    }

    const btn = document.getElementById('analyze-btn');
    const resultBox = document.getElementById('food-result');
    
    btn.innerText = "⏳ Думаю...";
    btn.disabled = true;
    resultBox.classList.add('hidden');

    const prompt = `Ты нутрициолог. Посчитай КБЖУ для: "${text}". Верни ТОЛЬКО валидный JSON (без markdown) в формате: {"name":"Название","cal":300,"p":15,"f":10,"c":40}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${data.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 }
            })
        });

        // Проверяем, не ответил ли сервер ошибкой (например, 400 Bad Request из-за неверного ключа)
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Ошибка API: ${errorData.error?.message || response.statusText}`);
        }

        const resData = await response.json();
        let aiText = resData.candidates[0].content.parts[0].text;
        
        // Очистка от мусора
        aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
        const meal = JSON.parse(aiText);

        data.calories += meal.cal;
        saveData();
        updateUI();

        resultBox.innerHTML = `
            <strong>${meal.name}</strong><br>
            🔥 ${meal.cal} ккал<br>
            Б: ${meal.p}г | Ж: ${meal.f}г | У: ${meal.c}г<br><br>
            <em>Калории добавлены в сводку!</em>
        `;
        resultBox.classList.remove('hidden');
        document.getElementById('food-input').value = '';

    } catch (error) {
        console.error(error);
        alert(`Системная ошибка: ${error.message}\n\nЕсли написано "Failed to fetch" — скорее всего нужен VPN или нет интернета. Также проверьте, что ключ скопирован без пробелов.`);
    } finally {
        btn.innerText = "✨ Рассчитать";
        btn.disabled = false;
    }
}

// Запуск
updateUI();
