let data = {
            days: {}, shifts: {}, tasks: [], debts: [], vault: [], uploads: [],
            budget: { transactions: [], monthlyLimit: 0 },
            geminiApiKey: '', githubToken: '', githubRepo: '', publicRepo: '',
            salaryRates: { day: 0, night: 0 },
            profile: {
                gender: 'male', age: 25, height: 175, weight: 70, activity: 1.55, goal: 'maintain',
                targetCal: 2200, targetWater: 2500, targetSteps: 10000, targetWeight: 0
            }
        };

        let masterKey = "";
        let currentDateStr = getFormattedDate(new Date());
        let calCurrentDate = new Date();
        let budgetCurrentDate = new Date(); // Текущий выбранный месяц для бюджета
        let currentTikTokCleanUrl = "";
        let currentTikTokBlob = null;
        let editingVaultIndex = null;
        let visibleVaultPasswords = {}; // Хранит видимость паролей по индексам
        
        // Переменные состояния для бюджета
        let activeBudgetTxType = 'expense'; // 'expense' | 'income'
        let selectedBudgetCategory = { name: 'Еда и продукты', icon: '🍔' };
        let activeBudgetFilterTab = 'all'; // 'all' | 'expense' | 'income'
        let selectedBudgetCalDate = null; // Выбранный день в календаре бюджета (YYYY-MM-DD)

        const EXPENSE_CATEGORIES = [
            { name: 'Еда и продукты', icon: '🍔' },
            { name: 'Транспорт & Авто', icon: '🚗' },
            { name: 'Жилье & ЖКХ', icon: '🏠' },
            { name: 'Покупки & Одежда', icon: '🛍️' },
            { name: 'Развлечения & Отдых', icon: '🎮' },
            { name: 'Здоровье & Аптека', icon: '💊' },
            { name: 'Кафе & Рестораны', icon: '☕' },
            { name: 'Учеба & Книги', icon: '📚' },
            { name: 'Связь & Интернет', icon: '📱' },
            { name: 'Подписки & Сервисы', icon: '💳' },
            { name: 'Подарки & Семья', icon: '🎁' },
            { name: 'Другое / Прочее', icon: '📦' }
        ];

        const INCOME_CATEGORIES = [
            { name: 'Зарплата', icon: '💼' },
            { name: 'Аванс', icon: '💵' },
            { name: 'Подработка / Фриланс', icon: '⚡' },
            { name: 'Инвестиции & Вклады', icon: '📈' },
            { name: 'Подарок / Перевод', icon: '🎁' },
            { name: 'Возврат долга', icon: '🤝' },
            { name: 'Продажа вещей', icon: '🏷️' },
            { name: 'Другой доход', icon: '💰' }
        ];

        // --- Утилиты безопасности и интерфейса ---
        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function showToast(msg) {
            const toast = document.getElementById('toast-box');
            const msgEl = document.getElementById('toast-msg');
            if (!toast || !msgEl) return;
            msgEl.innerText = msg;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 2200);
        }

        function toggleInputVisibility(inputId, btn) {
            const input = document.getElementById(inputId);
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                btn.innerText = '🙈';
            } else {
                input.type = 'password';
                btn.innerText = '👁️';
            }
        }

        // Встроенный TOTP (2FA)
        function base32ToHex(base32) {
            const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
            let bits = "", hex = "";
            let cleaned = (base32 || '').replace(/=+$/, '').toUpperCase().replace(/\s+/g, '');
            for (let i = 0; i < cleaned.length; i++) {
                let val = base32chars.indexOf(cleaned.charAt(i));
                if (val === -1) continue;
                bits += val.toString(2).padStart(5, '0');
            }
            for (let i = 0; i + 4 <= bits.length; i += 4) {
                let chunk = bits.substr(i, 4);
                hex += parseInt(chunk, 2).toString(16);
            }
            return hex;
        }

        function generateTOTP(secret) {
            if (!secret) return null;
            try {
                let keyHex = base32ToHex(secret);
                if (!keyHex) return null;
                let epoch = Math.floor(Date.now() / 1000);
                let timeHex = Math.floor(epoch / 30).toString(16).padStart(16, '0');
                let key = CryptoJS.enc.Hex.parse(keyHex);
                let msg = CryptoJS.enc.Hex.parse(timeHex);
                let hmac = CryptoJS.HmacSHA1(msg, key).toString(CryptoJS.enc.Hex);
                let offset = parseInt(hmac.slice(-1), 16);
                let truncatedHash = parseInt(hmac.substr(offset * 2, 8), 16) & 0x7fffffff;
                return (truncatedHash % 1000000).toString().padStart(6, '0');
            } catch(e) { return null; }
        }

        function getFormattedDate(date) {
            let year = date.getFullYear();
            let month = String(date.getMonth() + 1).padStart(2, '0');
            let day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function getTodayData() {
            if (!data.days[currentDateStr]) {
                data.days[currentDateStr] = { calories: 0, water: 0, steps: 0, mood: '—', meals: [], waterList: [], stepsList: [], moodList: [], weightList: [] };
            }
            let d = data.days[currentDateStr];
            if (!d.meals) d.meals = [];
            if (!d.waterList) d.waterList = [];
            if (!d.stepsList) d.stepsList = [];
            if (!d.weightList) d.weightList = [];
            if (!d.moodList) {
                d.moodList = [];
                if (d.mood && d.mood !== '—') d.moodList.push({ emoji: d.mood, time: '--:--' });
            }
            return d;
        }

        function showSection(pageId) {
            if (!masterKey && pageId !== 'auth-page') return;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const targetPage = document.getElementById(pageId);
            if (targetPage) targetPage.classList.add('active');
            
            if (pageId === 'dashboard-page') updateUI();
            if (pageId === 'profile-page') loadProfileInputs();
            if (pageId === 'planner-page') renderPlanner();
            if (pageId === 'calendar-page') renderCalendar();
            if (pageId === 'budget-page') renderBudget();
            if (pageId === 'export-page') {
                document.getElementById('export-end-date').value = getFormattedDate(new Date());
                let d = new Date(); d.setDate(d.getDate() - 7);
                document.getElementById('export-start-date').value = getFormattedDate(d);
            }
            if (pageId === 'misc-page') {
                renderVault();
                renderUploads();
                if (!document.getElementById('gen-result-text') || !document.getElementById('gen-result-text').innerText || document.getElementById('gen-result-text').innerText === '—') {
                    generateRandomPassword();
                }
            }
            if (typeof renderExperience === 'function') renderExperience(pageId);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function unlockVault() {
            const pwd = document.getElementById('master-password').value;
            if(!pwd) return alert("Введите мастер-пароль");

            const encrypted = localStorage.getItem('encMasterData');
            if (!encrypted) {
                masterKey = pwd;
                if(!data.budget) data.budget = { transactions: [], monthlyLimit: 0 };
                saveEncrypted();
                document.getElementById('master-password').value = "";
                showSection('dashboard-page');
                return;
            }

            try {
                const bytes = CryptoJS.AES.decrypt(encrypted, pwd);
                const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
                if (!decryptedStr) throw new Error("Неверный ключ");
                
                data = JSON.parse(decryptedStr);
                // Миграция структуры данных
                if(!data.salaryRates) data.salaryRates = { day: 0, night: 0 };
                if(!data.days) data.days = {};
                if(!data.shifts) data.shifts = {};
                if(!data.tasks) data.tasks = [];
                if(!data.debts) data.debts = [];
                if(!data.vault) data.vault = [];
                if(!data.uploads) data.uploads = [];
                if(!data.budget) data.budget = { transactions: [], monthlyLimit: 0 };
                if(!data.budget.transactions) data.budget.transactions = [];
                if(data.budget.monthlyLimit === undefined) data.budget.monthlyLimit = 0;
                if(!data.profile) data.profile = { gender: 'male', age: 25, height: 175, weight: 70, activity: 1.55, goal: 'maintain', targetCal: 2200, targetWater: 2500, targetSteps: 10000, targetWeight: 0 };
                if(data.profile.targetWeight === undefined) data.profile.targetWeight = 0;

                masterKey = pwd;
                document.getElementById('master-password').value = "";
                showSection('dashboard-page');
            } catch (e) {
                alert("Неверный мастер-пароль!");
            }
        }

        function lockVault() {
            if (typeof cancelKYDRequest === 'function') cancelKYDRequest();
            masterKey = "";
            data = { 
                days: {}, shifts: {}, tasks: [], debts: [], vault: [], uploads: [], 
                budget: { transactions: [], monthlyLimit: 0 },
                geminiApiKey: '', githubToken: '', githubRepo: '', publicRepo: '', 
                salaryRates: { day: 0, night: 0 }, profile: {} 
            };
            visibleVaultPasswords = {};
            document.querySelectorAll('input:not([type=checkbox]):not([type=radio]), textarea').forEach(input => { input.value = ''; });
            for (const id of ['vault-list', 'uploads-list', 'kyd-dashboard-summary', 'kyd-settings-summary', 'kyd-status']) { const node = document.getElementById(id); if (node) node.replaceChildren(); }
            showSection('auth-page');
        }

        function resetVault() {
            if(confirm("Внимание! Все локальные данные будут стерты безвозвратно. Продолжить?")) {
                localStorage.removeItem('encMasterData');
                location.reload();
            }
        }

        function saveEncrypted() {
            if(!masterKey) return;
            const encryptedStr = CryptoJS.AES.encrypt(JSON.stringify(data), masterKey).toString();
            localStorage.setItem('encMasterData', encryptedStr);
        }

        function loadProfileInputs() {
            let p = data.profile || {};
            document.getElementById('prof-gender').value = p.gender || 'male';
            document.getElementById('prof-goal').value = p.goal || 'maintain';
            document.getElementById('prof-age').value = p.age || '';
            document.getElementById('prof-height').value = p.height || '';
            document.getElementById('prof-weight').value = p.weight || '';
            document.getElementById('prof-activity').value = p.activity || '1.55';
            document.getElementById('prof-target-weight').value = p.targetWeight || '';
        }

        function calculateAndSaveProfile() {
            let gender = document.getElementById('prof-gender').value;
            let goal = document.getElementById('prof-goal').value;
            let age = parseFloat(document.getElementById('prof-age').value) || 25;
            let height = parseFloat(document.getElementById('prof-height').value) || 175;
            let weight = parseFloat(document.getElementById('prof-weight').value) || 70;
            let activity = parseFloat(document.getElementById('prof-activity').value) || 1.55;

            let bmr = (10 * weight) + (6.25 * height) - (5 * age);
            bmr = (gender === 'male') ? bmr + 5 : bmr - 161;

            let tdee = bmr * activity;
            if (goal === 'lose') tdee *= 0.85;
            if (goal === 'gain') tdee *= 1.15;

            let targetCal = Math.round(tdee);
            let targetWater = Math.round(weight * 35);
            let targetSteps = 10000;

            let targetWeight = parseFloat(document.getElementById('prof-target-weight').value) || 0;
            data.profile = { gender, goal, age, height, weight, activity, targetCal, targetWater, targetSteps, targetWeight };
            saveEncrypted();
            alert(`Нормы рассчитаны!\n🔥 Калории: ${targetCal} ккал\n💧 Вода: ${targetWater} мл`);
            showSection('dashboard-page');
        }

        // --- Кэш DOM-элементов (оптимизация: getElementById вызывается один раз на id) ---
        const EL = {};
        function el(id) { return EL[id] || (EL[id] = document.getElementById(id)); }

        // --- ОТСЛЕЖИВАНИЕ ВЕСА ---
        // Собирает по одной (последней) точке веса на каждый день, отсортированной по дате.
        function getWeightSeries() {
            const out = [];
            Object.keys(data.days || {}).sort().forEach(dateStr => {
                const wl = data.days[dateStr] && data.days[dateStr].weightList;
                if (wl && wl.length) out.push({ date: dateStr, v: Number(wl[wl.length - 1].v) });
            });
            return out;
        }

        function addWeightEntry() {
            let d = getTodayData();
            let last = d.weightList.length ? d.weightList[d.weightList.length - 1].v : (data.profile && data.profile.weight) || '';
            let raw = prompt("Вес (кг):", last ? String(last) : "70");
            if (raw === null) return;
            raw = raw.replace(',', '.').trim();
            let val = parseFloat(raw);
            if (isNaN(val) || val <= 0 || val > 500) return alert("Введите корректный вес (кг).");
            val = Math.round(val * 10) / 10;
            let now = new Date();
            let timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            d.weightList.push({ v: val, time: timeStr });
            // Актуальный вес пользователя => профиль (влияет на расчёт норм КБЖУ)
            if (data.profile) data.profile.weight = val;
            saveEncrypted();
            updateUI();
            showToast(`Вес записан: ${val} кг`);
        }

        function deleteWeightEntry(idx) {
            let d = getTodayData();
            if (!d.weightList || !d.weightList[idx]) return;
            d.weightList.splice(idx, 1);
            // Синхронизируем профиль с самым свежим оставшимся замером
            let series = getWeightSeries();
            if (series.length && data.profile) data.profile.weight = series[series.length - 1].v;
            saveEncrypted();
            updateUI();
        }

        function buildSparkline(points) {
            if (points.length < 2) return '';
            const vals = points.map(p => p.v);
            const min = Math.min(...vals), max = Math.max(...vals);
            const range = (max - min) || 1;
            const W = 100, H = 40, pad = 4;
            const n = points.length;
            const coords = points.map((p, i) => {
                const x = n === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (n - 1);
                const y = pad + (1 - (p.v - min) / range) * (H - 2 * pad);
                return { x: +x.toFixed(2), y: +y.toFixed(2) };
            });
            const poly = coords.map(c => `${c.x},${c.y}`).join(' ');
            const dots = coords.map((c, i) =>
                `<circle class="${i === coords.length - 1 ? 'spark-last' : ''}" cx="${c.x}" cy="${c.y}" r="${i === coords.length - 1 ? 2.6 : 1.6}" />`
            ).join('');
            return `<svg class="weight-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${poly}" />${dots}</svg>`;
        }

        function renderWeight() {
            const series = getWeightSeries();
            const curEl = el('weight-current');
            const deltaEl = el('weight-delta');
            const badgeEl = el('weight-trend-badge');
            const goalWrap = el('weight-goal-wrap');
            const sparkWrap = el('weight-spark-wrap');
            if (!curEl) return;

            // Вес на выбранную дату: последний замер на эту дату или ближайший предыдущий (перенос)
            let idxForDate = -1;
            for (let i = 0; i < series.length; i++) { if (series[i].date <= currentDateStr) idxForDate = i; else break; }

            if (idxForDate === -1) {
                curEl.innerText = '—';
                deltaEl.innerText = 'Нет замеров';
                badgeEl.innerText = '—';
                badgeEl.style.color = 'var(--text-muted)';
                badgeEl.style.background = 'rgba(255,255,255,0.06)';
                badgeEl.style.borderColor = 'var(--border)';
                goalWrap.style.display = 'none';
                sparkWrap.innerHTML = '';
                return;
            }

            const cur = series[idxForDate];
            const carried = cur.date !== currentDateStr;
            curEl.innerText = `${cur.v} кг`;

            if (idxForDate > 0) {
                const prev = series[idxForDate - 1];
                const diff = Math.round((cur.v - prev.v) * 10) / 10;
                const arrow = diff < 0 ? '▼' : (diff > 0 ? '▲' : '▬');
                const color = diff < 0 ? '#34d399' : (diff > 0 ? '#fb7185' : 'var(--text-muted)');
                deltaEl.innerHTML = `<span style="color:${color};">${arrow} ${diff > 0 ? '+' : ''}${diff} кг</span>` + (carried ? ' <span style="color:var(--text-dim);">(перенос)</span>' : '');
                badgeEl.innerText = `${arrow} ${Math.abs(diff)} кг`;
                badgeEl.style.color = color;
                badgeEl.style.background = diff < 0 ? 'rgba(16,185,129,0.15)' : (diff > 0 ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.06)');
                badgeEl.style.borderColor = diff < 0 ? 'rgba(16,185,129,0.3)' : (diff > 0 ? 'rgba(244,63,94,0.3)' : 'var(--border)');
            } else {
                deltaEl.innerHTML = 'Первый замер' + (carried ? ' <span style="color:var(--text-dim);">(перенос)</span>' : '');
                badgeEl.innerText = 'Старт';
                badgeEl.style.color = 'var(--text-muted)';
                badgeEl.style.background = 'rgba(255,255,255,0.06)';
                badgeEl.style.borderColor = 'var(--border)';
            }

            // Прогресс к целевому весу
            const target = (data.profile && data.profile.targetWeight) || 0;
            if (target > 0 && series.length) {
                const start = series[0].v;
                const goalText = el('weight-goal-text');
                const goalBar = el('weight-goal-progress');
                let pct;
                if (Math.abs(start - target) < 0.05) pct = 100;
                else pct = Math.max(0, Math.min(100, Math.round(((start - cur.v) / (start - target)) * 100)));
                goalText.innerText = `${cur.v} → ${target} кг (${pct}%)`;
                goalBar.style.width = `${pct}%`;
                goalWrap.style.display = 'block';
            } else {
                goalWrap.style.display = 'none';
            }

            sparkWrap.innerHTML = buildSparkline(series.slice(-12));
        }

        function updateUI() {
            let dayData = getTodayData();
            let prof = data.profile || { targetCal: 2200, targetWater: 2500, targetSteps: 10000 };

            let cal = dayData.calories || 0;
            let water = dayData.water || 0;
            let steps = dayData.steps || 0;

            el('cal-text').innerText = `${cal} / ${prof.targetCal} ккал`;
            el('water-text').innerText = `${water} / ${prof.targetWater} мл`;
            el('steps-text').innerText = `${steps} / ${prof.targetSteps}`;

            el('cal-progress').style.width = `${Math.min(100, Math.round((cal / prof.targetCal) * 100))}%`;
            el('water-progress').style.width = `${Math.min(100, Math.round((water / prof.targetWater) * 100))}%`;
            el('steps-progress').style.width = `${Math.min(100, Math.round((steps / prof.targetSteps) * 100))}%`;

            // Расчет баланса полезной и вредной еды
            let meals = dayData.meals || [];
            let healthyCal = 0, unhealthyCal = 0;
            let healthyCount = 0, unhealthyCount = 0;

            meals.forEach(m => {
                let calVal = Number(m.cal) || 0;
                let isHealthy = (m.health_type === 'healthy' || (!m.health_type && (m.health_score || 7) >= 6));
                if (isHealthy) {
                    healthyCal += calVal;
                    healthyCount++;
                } else {
                    unhealthyCal += calVal;
                    unhealthyCount++;
                }
            });

            let totalFoodCal = healthyCal + unhealthyCal;
            let healthyPct = totalFoodCal > 0 ? Math.round((healthyCal / totalFoodCal) * 100) : (meals.length > 0 ? Math.round((healthyCount / meals.length) * 100) : 0);
            let unhealthyPct = totalFoodCal > 0 ? (100 - healthyPct) : (meals.length > 0 ? (100 - healthyPct) : 0);

            const elBarH = el('diet-bar-healthy');
            const elBarU = el('diet-bar-unhealthy');
            const elPctH = el('diet-pct-healthy');
            const elPctU = el('diet-pct-unhealthy');
            const elCalH = el('diet-cal-healthy');
            const elCalU = el('diet-cal-unhealthy');
            const elBadge = el('diet-status-badge');

            if (elBarH && elBarU) {
                if (meals.length === 0) {
                    elBarH.style.width = '0%';
                    elBarU.style.width = '0%';
                    if (elPctH) elPctH.innerText = '0%';
                    if (elPctU) elPctU.innerText = '0%';
                    if (elCalH) elCalH.innerText = '0 ккал (0 блюд)';
                    if (elCalU) elCalU.innerText = '0 ккал (0 блюд)';
                    if (elBadge) {
                        elBadge.innerText = 'Нет записей';
                        elBadge.style.color = 'var(--text-muted)';
                        elBadge.style.background = 'rgba(255, 255, 255, 0.05)';
                        elBadge.style.borderColor = 'var(--border)';
                    }
                } else {
                    elBarH.style.width = `${healthyPct}%`;
                    elBarU.style.width = `${unhealthyPct}%`;
                    if (elPctH) elPctH.innerText = `${healthyPct}%`;
                    if (elPctU) elPctU.innerText = `${unhealthyPct}%`;
                    if (elCalH) elCalH.innerText = `${healthyCal} ккал (${healthyCount} шт)`;
                    if (elCalU) elCalU.innerText = `${unhealthyCal} ккал (${unhealthyCount} шт)`;

                    if (elBadge) {
                        if (healthyPct >= 75) {
                            elBadge.innerText = '🟢 Чистый рацион';
                            elBadge.style.color = '#34d399';
                            elBadge.style.background = 'rgba(16, 185, 129, 0.15)';
                            elBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                        } else if (healthyPct >= 45) {
                            elBadge.innerText = '🟡 Умеренный баланс';
                            elBadge.style.color = '#fbbf24';
                            elBadge.style.background = 'rgba(245, 158, 11, 0.15)';
                            elBadge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                        } else {
                            elBadge.innerText = '🔴 Преобладает джанк';
                            elBadge.style.color = '#fb7185';
                            elBadge.style.background = 'rgba(244, 63, 94, 0.15)';
                            elBadge.style.borderColor = 'rgba(244, 63, 94, 0.3)';
                        }
                    }
                }
            }

            if (dayData.moodList && dayData.moodList.length > 0) {
                el('current-mood').innerText = dayData.moodList.map(m => m.emoji).join(' ➔ ');
            } else {
                el('current-mood').innerText = '—';
            }

            const lastEmoji = (dayData.moodList && dayData.moodList.length > 0) ? dayData.moodList[dayData.moodList.length - 1].emoji : null;
            document.querySelectorAll('.mood-btn').forEach(btn => {
                if (lastEmoji && btn.innerText.trim() === lastEmoji) {
                    btn.style.borderColor = 'var(--accent)';
                    btn.style.background = 'rgba(59, 130, 246, 0.25)';
                } else {
                    btn.style.borderColor = 'var(--border)';
                    btn.style.background = 'rgba(255, 255, 255, 0.03)';
                }
            });

            // Настройки
            if (el('api-key-input')) el('api-key-input').value = data.geminiApiKey || '';
            if (el('gh-token-input')) el('gh-token-input').value = data.githubToken || '';
            if (el('gh-repo-input')) el('gh-repo-input').value = data.githubRepo || '';
            if (el('gh-public-repo-input')) el('gh-public-repo-input').value = data.publicRepo || '';

            let todayStr = getFormattedDate(new Date());
            let displayLabel = "Сегодня";
            if (currentDateStr !== todayStr) {
                let p = currentDateStr.split('-');
                displayLabel = `${p[2]}.${p[1]}.${p[0]}`;
            }
            el('date-display').innerText = displayLabel;

            renderWeight();
            renderDailyHistory();
            if (typeof renderExperience === 'function') renderExperience();
        }

        function changeDate(offset) {
            let [y, m, d] = currentDateStr.split('-').map(Number);
            let dt = new Date(y, m - 1, d);
            dt.setDate(dt.getDate() + offset);
            currentDateStr = getFormattedDate(dt);
            updateUI();
        }

        function addMoodEntry(emoji) {
            let d = getTodayData();
            let now = new Date();
            let timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            d.moodList.push({ emoji: emoji, time: timeStr });
            d.mood = d.moodList.map(m => m.emoji).join(' ➔ ');
            saveEncrypted(); updateUI();
        }

        function deleteMoodEntry(idx) {
            let d = getTodayData();
            d.moodList.splice(idx, 1);
            d.mood = d.moodList.length ? d.moodList.map(m => m.emoji).join(' ➔ ') : '—';
            saveEncrypted(); updateUI();
        }

        function renderDailyHistory() {
            let dData = getTodayData();
            let container = document.getElementById('daily-history-list');
            if (!container) return;
            let html = '';

            (dData.moodList || []).forEach((m, idx) => {
                html += `<div class="list-item">
                    <div style="flex:1;">
                        <span style="font-size:16px; margin-right:4px;">${escapeHtml(m.emoji)}</span> <strong>Настроение</strong><br>
                        <span style="font-size:12px; color:var(--text-muted);">Время: ${escapeHtml(m.time)}</span>
                    </div>
                    <button class="del-btn" onclick="deleteMoodEntry(${idx})">✕</button>
                </div>`;
            });

            (dData.meals || []).forEach((m, idx) => {
                let isHealthy = (m.health_type === 'healthy' || (!m.health_type && (m.health_score || 7) >= 6));
                let badgeClass = isHealthy ? 'healthy' : 'unhealthy';
                let icon = isHealthy ? '🥗' : '🍔';
                let scoreText = m.health_score ? ` (${m.health_score}/10)` : '';
                let badgeLabel = isHealthy ? `🟢 Полезная${scoreText}` : `🔴 Вредная${scoreText}`;
                let commentHtml = m.health_comment ? `<div style="font-size:11px; color:var(--text-muted); margin-top:3px; font-style:italic;">💬 ${escapeHtml(m.health_comment)}</div>` : '';
                let macrosHtml = (m.p || m.f || m.c) ? `<span style="font-size:11px; color:var(--text-muted); margin-left:6px;">(Б:${m.p || 0} • Ж:${m.f || 0} • У:${m.c || 0})</span>` : '';

                html += `<div class="list-item" style="align-items:flex-start;">
                    <div style="flex:1;">
                        <div style="font-size:14px;">${icon} <strong>${escapeHtml(m.name)}</strong></div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                            <strong style="color:var(--text-main);">${escapeHtml(m.cal)} ккал</strong> ${macrosHtml}
                        </div>
                        ${commentHtml}
                        <div>
                            <span class="health-badge ${badgeClass}" onclick="toggleMealHealth(${idx})" title="Нажмите, чтобы переключить категорию">${badgeLabel} ⇄</span>
                        </div>
                    </div>
                    <button class="del-btn" onclick="deleteMeal(${idx})">✕</button>
                </div>`;
            });
            (dData.waterList || []).forEach((w, idx) => {
                html += `<div class="list-item"><div style="flex:1;">💧 <strong>Вода</strong><br><span style="font-size:12px; color:var(--text-muted);">${escapeHtml(w)} мл</span></div><button class="del-btn" onclick="deleteWater(${idx})">✕</button></div>`;
            });
            (dData.stepsList || []).forEach((s, idx) => {
                html += `<div class="list-item"><div style="flex:1;">👟 <strong>Шаги</strong><br><span style="font-size:12px; color:var(--text-muted);">${escapeHtml(s)}</span></div><button class="del-btn" onclick="deleteSteps(${idx})">✕</button></div>`;
            });
            (dData.weightList || []).forEach((w, idx) => {
                html += `<div class="list-item"><div style="flex:1;">⚖️ <strong>Вес</strong><br><span style="font-size:12px; color:var(--text-muted);">${escapeHtml(w.v)} кг${w.time ? ' • ' + escapeHtml(w.time) : ''}</span></div><button class="del-btn" onclick="deleteWeightEntry(${idx})">✕</button></div>`;
            });

            if(html === '') container.innerHTML = '<p style="color:var(--text-muted); text-align:center; font-size:13px; padding: 10px 0;">Записей за этот день нет</p>';
            else container.innerHTML = html;
        }

        function toggleMealHealth(idx) {
            let d = getTodayData();
            if (!d.meals || !d.meals[idx]) return;
            let m = d.meals[idx];
            let isCurrentlyHealthy = (m.health_type === 'healthy' || (!m.health_type && (m.health_score || 7) >= 6));
            m.health_type = isCurrentlyHealthy ? 'unhealthy' : 'healthy';
            m.health_score = isCurrentlyHealthy ? 3 : 8;
            saveEncrypted();
            updateUI();
            showToast(isCurrentlyHealthy ? 'Отмечено как вредная еда' : 'Отмечено как полезная еда');
        }

        function deleteMeal(idx) { let d = getTodayData(); d.calories = Math.max(0, d.calories - d.meals[idx].cal); d.meals.splice(idx, 1); saveEncrypted(); updateUI(); }
        function deleteWater(idx) { let d = getTodayData(); d.water = Math.max(0, d.water - d.waterList[idx]); d.waterList.splice(idx, 1); saveEncrypted(); updateUI(); }
        function deleteSteps(idx) { let d = getTodayData(); d.steps = Math.max(0, d.steps - d.stepsList[idx]); d.stepsList.splice(idx, 1); saveEncrypted(); updateUI(); }

        function addCustomWater() { let amt = prompt("Количество воды (мл):", "250"); if (amt && !isNaN(amt) && parseInt(amt) > 0) { let val = parseInt(amt); let d = getTodayData(); d.water += val; d.waterList.push(val); saveEncrypted(); updateUI(); } }
        function addCustomSteps() { let amt = prompt("Количество шагов:", "1000"); if (amt && !isNaN(amt) && parseInt(amt) > 0) { let val = parseInt(amt); let d = getTodayData(); d.steps += val; d.stepsList.push(val); saveEncrypted(); updateUI(); } }

        function saveSettings() {
            data.geminiApiKey = document.getElementById('api-key-input').value.trim();
            data.githubToken = document.getElementById('gh-token-input').value.trim();
            data.githubRepo = document.getElementById('gh-repo-input').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
            data.publicRepo = document.getElementById('gh-public-repo-input').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
            saveEncrypted(); 
            alert("Настройки сохранены!"); 
            showSection('dashboard-page');
        }

        function changeCalMonth(offset) {
            calCurrentDate.setMonth(calCurrentDate.getMonth() + offset);
            renderCalendar();
        }

        function renderCalendar() {
            const grid = document.getElementById('cal-grid'); 
            grid.innerHTML = ''; 
            const year = calCurrentDate.getFullYear();
            const month = calCurrentDate.getMonth();
            
            document.getElementById('month-name').innerText = calCurrentDate.toLocaleString('ru', { month: 'long', year: 'numeric' });
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(d => grid.innerHTML += `<div class="cal-day-name">${d}</div>`);
            let firstDay = new Date(year, month, 1).getDay(); 
            firstDay = firstDay === 0 ? 6 : firstDay - 1; 
            for(let i=0; i<firstDay; i++) grid.innerHTML += `<div></div>`;
            
            for(let i=1; i<=daysInMonth; i++) {
                let dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
                let shift = data.shifts[dateStr] || 'none';
                let cls = 'cal-day', emoji = '';
                if (shift === 'day') { cls += ' shift-day'; emoji = '☀️ '; }
                if (shift === 'night') { cls += ' shift-night'; emoji = '🌙 '; }
                if (shift === 'off') { cls += ' shift-off'; emoji = '🌴 '; }
                grid.innerHTML += `<div class="${cls}" onclick="toggleShift('${dateStr}')">${emoji ? emoji + '<br>' : ''}${i}</div>`;
            }

            if(!document.getElementById('template-start-date').value) document.getElementById('template-start-date').value = getFormattedDate(new Date());
            if(data.salaryRates) { document.getElementById('rate-day').value = data.salaryRates.day || ''; document.getElementById('rate-night').value = data.salaryRates.night || ''; }
            calculateSalary();
        }

        function calculateSalary() {
            let rDay = parseFloat(document.getElementById('rate-day').value) || 0;
            let rNight = parseFloat(document.getElementById('rate-night').value) || 0;
            data.salaryRates = { day: rDay, night: rNight };
            saveEncrypted();

            let countDays = 0, countNights = 0;
            const year = calCurrentDate.getFullYear();
            const month = calCurrentDate.getMonth();

            for (let dateStr in data.shifts) {
                let [y, m, d] = dateStr.split('-').map(Number);
                if (y === year && (m - 1) === month) {
                    if (data.shifts[dateStr] === 'day') countDays++;
                    if (data.shifts[dateStr] === 'night') countNights++;
                }
            }
            let total = (countDays * rDay) + (countNights * rNight);
            document.getElementById('count-days').innerText = countDays;
            document.getElementById('count-nights').innerText = countNights;
            document.getElementById('total-salary').innerText = `Итого: ${total.toLocaleString('ru-RU')} ₽`;
        }

        function toggleShift(dateStr) { 
            let cur = data.shifts[dateStr]; 
            if (!cur || cur === 'none') data.shifts[dateStr] = 'day'; 
            else if (cur === 'day') data.shifts[dateStr] = 'night'; 
            else if (cur === 'night') data.shifts[dateStr] = 'off'; 
            else if (cur === 'off') delete data.shifts[dateStr]; 
            saveEncrypted(); renderCalendar(); 
        }

        function applyShiftTemplate() {
            let sDate = document.getElementById('template-start-date').value; 
            if (!sDate) return alert("Выберите дату начала!");
            let pattern = [document.getElementById('t-1').value, document.getElementById('t-2').value, document.getElementById('t-3').value, document.getElementById('t-4').value].filter(s => s !== 'none');
            if (!pattern.length) return alert("Шаблон пуст! Выберите смены.");
            
            let [y, m, d] = sDate.split('-').map(Number); 
            let dt = new Date(y, m - 1, d);
            let startMonth = dt.getMonth();
            let applied = 0;
            while (dt.getMonth() === startMonth) {
                data.shifts[getFormattedDate(dt)] = pattern[applied % pattern.length];
                dt.setDate(dt.getDate() + 1);
                applied++;
            }
            saveEncrypted(); renderCalendar(); alert(`Шаблон применён до конца месяца (${applied} дн.)!`);
        }

        function renderPlanner() {
            const tList = document.getElementById('tasks-list');
            tList.innerHTML = (data.tasks || []).map((t, i) => `<div class="list-item ${t.done ? 'done' : ''}"><div class="task-content" onclick="toggleTask(${i})"><input type="checkbox" ${t.done ? 'checked' : ''} onclick="event.stopPropagation(); toggleTask(${i});"><span>${escapeHtml(t.text)}</span></div><button class="del-btn" onclick="deleteTask(${i})">✕</button></div>`).join('') || '<p style="color:var(--text-muted); text-align:center; padding:10px 0; font-size:13px;">Активных задач нет</p>';
        }

        function addTask() { 
            const inp = document.getElementById('task-input'); 
            if (inp.value.trim()) { data.tasks.push({ text: inp.value.trim(), done: false }); inp.value = ''; saveEncrypted(); renderPlanner(); } 
        }
        function toggleTask(i) { data.tasks[i].done = !data.tasks[i].done; saveEncrypted(); renderPlanner(); }
        function deleteTask(i) { data.tasks.splice(i, 1); saveEncrypted(); renderPlanner(); }
        
        // --- ДОЛГИ / ВЗАИМОРАСЧЁТЫ (раздел «Бюджет») ---
        let activeDebtType = 'owed'; // 'owed' = мне должны | 'owe' = я должен

        function setDebtType(type) {
            activeDebtType = type;
            const bOwed = el('btn-debt-owed'), bOwe = el('btn-debt-owe');
            if (!bOwed || !bOwe) return;
            bOwed.className = type === 'owed' ? 'segmented-btn active-income' : 'segmented-btn';
            bOwe.className = type === 'owe' ? 'segmented-btn active-expense' : 'segmented-btn';
        }

        function addDebt() {
            const whoEl = el('debt-who'), amtEl = el('debt-amount');
            const who = whoEl.value.trim();
            let val = parseFloat((amtEl.value || '').replace(',', '.'));
            if (!who || isNaN(val) || val <= 0) return alert("Укажите имя и положительную сумму.");
            val = Math.round(val);
            data.debts.push({ who, amount: activeDebtType === 'owed' ? val : -val });
            whoEl.value = ''; amtEl.value = '';
            saveEncrypted(); renderDebts();
        }

        function deleteDebt(i) { data.debts.splice(i, 1); saveEncrypted(); renderDebts(); }

        function renderDebts() {
            const list = el('debts-list');
            if (!list) return;
            const debts = data.debts || [];
            let owed = 0, owe = 0;
            debts.forEach(d => { if (d.amount >= 0) owed += d.amount; else owe += Math.abs(d.amount); });
            const net = owed - owe;
            if (el('debts-total-owed')) el('debts-total-owed').innerText = `+ ${owed.toLocaleString('ru-RU')} ₽`;
            if (el('debts-total-owe')) el('debts-total-owe').innerText = `- ${owe.toLocaleString('ru-RU')} ₽`;
            const badge = el('debts-net-badge');
            if (badge) {
                const good = net > 0, bad = net < 0;
                badge.innerText = `${net >= 0 ? '+' : '−'} ${Math.abs(net).toLocaleString('ru-RU')} ₽`;
                badge.style.color = good ? '#34d399' : (bad ? '#fb7185' : 'var(--text-muted)');
                badge.style.background = good ? 'rgba(16,185,129,0.15)' : (bad ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.06)');
                badge.style.borderColor = good ? 'rgba(16,185,129,0.3)' : (bad ? 'rgba(244,63,94,0.3)' : 'var(--border)');
            }
            list.innerHTML = debts.map((d, i) => {
                const pos = d.amount >= 0;
                return `<div class="list-item"><div class="task-content"><span>${pos ? '🟢' : '🔴'} ${escapeHtml(d.who)}</span><span class="${pos ? 'debt-positive' : 'debt-negative'}">${pos ? '+' : '−'}${Math.abs(d.amount).toLocaleString('ru-RU')} ₽</span></div><button class="del-btn" onclick="deleteDebt(${i})">✕</button></div>`;
            }).join('') || '<p style="color:var(--text-muted); text-align:center; padding:10px 0; font-size:13px;">Записей о долгах нет</p>';
        }

        function previewImage(e) { 
            const f = e.target.files[0], prev = document.getElementById('image-preview'); 
            if (f) { prev.src = URL.createObjectURL(f); prev.style.display = 'block'; } else { prev.style.display = 'none'; } 
        }

        function fileToBase64(file) { 
            return new Promise((res, rej) => { 
                const r = new FileReader(); r.readAsDataURL(file); r.onload = () => res(r.result.split(',')[1]); r.onerror = err => rej(err); 
            }); 
        }

        async function analyzeFood() {
            const txt = document.getElementById('food-input').value.trim(); 
            const fInput = document.getElementById('food-image');
            if (!txt && !fInput.files.length) return alert("Введите описание еды или прикрепите фото!");
            if (!data.geminiApiKey) { alert("Укажите API ключ в Настройках!"); showSection('settings-page'); return; }

            const btn = document.getElementById('analyze-btn'), resBox = document.getElementById('food-result');
            btn.innerText = "⏳ Анализ..."; btn.disabled = true; resBox.classList.add('hidden');

            let parts = [{ text: `Ты профессиональный нутрициолог и диетолог. Проанализируй блюдо по описанию и/или фото.
Определи:
1. "name": Название блюда
2. "cal": Калорийность (ккал, целое число)
3. "p": Белки (граммы, число)
4. "f": Жиры (граммы, число)
5. "c": Углеводы (граммы, число)
6. "health_type": Категория полезности: "healthy" (полезная/цельная/здоровая еда: овощи, крупы, фрукты, рыба, птица, яйца, творог, чистые супы) или "unhealthy" (вредная/джанк-фуд: фастфуд, сладости, чипсы, газировка, фритюр, продукты с избытком сахара и трансжиров).
7. "health_score": Оценка пользы от 1 до 10 (10 - идеально полезно, 1 - ультра-джанк).
8. "health_comment": Краткий вердикт (3-7 слов, например "Качественный белок и клетчатка" или "Избыток сахара и трансжиров").

Описание: "${txt}".
Верни ТОЛЬКО валидный JSON:
{"name":"Омлет со шпинатом","cal":280,"p":20,"f":16,"c":4,"health_type":"healthy","health_score":9,"health_comment":"Богато белком и микроэлементами"}` }];
            if (fInput.files.length) {
                try {
                    let b64 = await fileToBase64(fInput.files[0]);
                    parts.push({ inline_data: { mime_type: fInput.files[0].type || "image/jpeg", data: b64 } });
                } catch(e) { alert("Ошибка чтения фото"); btn.innerText = "✨ Рассчитать и зафиксировать"; btn.disabled = false; return; }
            }

            const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.0-flash-lite", "gemini-2.5-pro", "gemini-1.5-pro", "gemini-3.0-flash", "gemini-3.5-flash"];
            let lastError = null, successfulData = null;

            for (let modelName of modelsToTry) {
                try {
                    let resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${data.geminiApiKey}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1 } })
                    });
                    let j = await resp.json(); 
                    if (resp.ok && j.candidates && j.candidates.length) { successfulData = j; break; } else { lastError = j.error?.message || `HTTP ${resp.status}`; }
                } catch(err) { lastError = err.message; }
            }

            if (!successfulData) {
                alert("Ошибка ИИ: " + (lastError || "Не удалось получить ответ"));
                btn.innerText = "✨ Рассчитать и зафиксировать"; btn.disabled = false; return;
            }

            try {
                let rawAiTxt = successfulData.candidates?.[0]?.content?.parts?.[0]?.text || "";
                let jsonMatch = rawAiTxt.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("Формат ответа не распознан");
                
                let meal = JSON.parse(jsonMatch[0]);
                meal.cal = Number(meal.cal) || 0;
                meal.p = Number(meal.p) || 0;
                meal.f = Number(meal.f) || 0;
                meal.c = Number(meal.c) || 0;
                meal.name = meal.name || "Прием пищи";
                meal.health_type = (meal.health_type === "unhealthy" || (meal.health_score && meal.health_score < 6)) ? "unhealthy" : "healthy";
                meal.health_score = Number(meal.health_score) || (meal.health_type === "healthy" ? 8 : 3);
                meal.health_comment = meal.health_comment || (meal.health_type === "healthy" ? "Полезная сбалансированная еда" : "Высокая калорийность / джанк");

                let dData = getTodayData();
                dData.calories += meal.cal;
                dData.meals.push({
                    name: meal.name,
                    cal: meal.cal,
                    p: meal.p,
                    f: meal.f,
                    c: meal.c,
                    health_type: meal.health_type,
                    health_score: meal.health_score,
                    health_comment: meal.health_comment
                });
                saveEncrypted();
                updateUI();

                let isH = meal.health_type === 'healthy';
                let badgeText = isH ? `🟢 Полезная еда (${meal.health_score}/10)` : `🔴 Вредная еда / Читмил (${meal.health_score}/10)`;
                let badgeStyle = isH ? 'background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.3);' : 'background:rgba(244,63,94,0.15); color:#fb7185; border:1px solid rgba(244,63,94,0.3);';

                resBox.innerHTML = `
                    <div style="font-size:15px; font-weight:700;">${escapeHtml(meal.name)}</div>
                    <div style="margin-top:4px; font-size:13px;">🔥 <strong>${meal.cal} ккал</strong> | Б: ${meal.p}г • Ж: ${meal.f}г • У: ${meal.c}г</div>
                    <div style="margin-top:6px;">
                        <span style="display:inline-block; font-size:11px; font-weight:600; padding:3px 9px; border-radius:6px; ${badgeStyle}">${badgeText}</span>
                    </div>
                    ${meal.health_comment ? `<div style="font-size:12px; color:var(--text-muted); margin-top:5px; font-style:italic;">💬 ${escapeHtml(meal.health_comment)}</div>` : ''}
                    <div style="margin-top:8px; font-size:12px; color:#60a5fa;">✓ Добавлено за ${escapeHtml(document.getElementById('date-display').innerText)}!</div>
                `;
                resBox.classList.remove('hidden');
                document.getElementById('food-input').value = '';
                fInput.value = '';
                document.getElementById('image-preview').style.display = 'none';
            } catch(e) { alert("Ошибка: " + e.message); } finally { btn.innerText = "✨ Рассчитать и зафиксировать"; btn.disabled = false; }
        }

        // --- БЮДЖЕТ & ФИНАНСЫ (ФУНКЦИИ) ---
        function formatCompactBudget(num) {
            if (!num || isNaN(num)) return '0';
            if (num < 1000) return String(Math.round(num));
            if (num < 10000) return (num / 1000).toFixed(1).replace('.0', '') + 'k';
            if (num < 1000000) return Math.round(num / 1000) + 'k';
            return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
        }

        function renderBudgetCategoryChips() {
            const container = document.getElementById('category-chips-container');
            if (!container) return;
            const list = activeBudgetTxType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
            
            // Если выбранная категория не из текущего списка, переключить на первую
            if (!list.some(c => c.name === selectedBudgetCategory.name)) {
                selectedBudgetCategory = { ...list[0] };
            }

            container.innerHTML = list.map(cat => {
                const isSelected = cat.name === selectedBudgetCategory.name;
                return `
                    <div class="cat-chip ${isSelected ? 'selected' : ''}" onclick="selectBudgetCategory('${escapeHtml(cat.name)}', '${escapeHtml(cat.icon)}')">
                        <span class="cat-icon">${cat.icon}</span>
                        <span class="cat-label">${escapeHtml(cat.name)}</span>
                    </div>
                `;
            }).join('');
        }

        function selectBudgetCategory(name, icon) {
            selectedBudgetCategory = { name, icon };
            renderBudgetCategoryChips();
        }

        function setBudgetTxType(type) {
            activeBudgetTxType = type;
            const btnExp = document.getElementById('btn-tx-expense');
            const btnInc = document.getElementById('btn-tx-income');
            if (type === 'expense') {
                btnExp.className = 'segmented-btn active-expense';
                btnInc.className = 'segmented-btn';
                selectedBudgetCategory = { ...EXPENSE_CATEGORIES[0] };
            } else {
                btnExp.className = 'segmented-btn';
                btnInc.className = 'segmented-btn active-income';
                selectedBudgetCategory = { ...INCOME_CATEGORIES[0] };
            }
            renderBudgetCategoryChips();
        }

        function quickAddBudgetAmount(val) {
            const inp = document.getElementById('tx-amount');
            if (!inp) return;
            let current = parseFloat(inp.value) || 0;
            inp.value = Math.max(0, current + val);
        }

        function changeBudgetMonth(offset) {
            budgetCurrentDate.setMonth(budgetCurrentDate.getMonth() + offset);
            selectedBudgetCalDate = null;
            renderBudget();
        }

        function setBudgetFilterTab(tab) {
            activeBudgetFilterTab = tab;
            ['all', 'expense', 'income'].forEach(t => {
                const el = document.getElementById(`filter-tx-${t}`);
                if (el) {
                    el.className = (t === tab) ? 'segmented-btn active-tab' : 'segmented-btn';
                }
            });
            renderBudgetTransactionsList();
        }

        function resetBudgetCalDateFilter() {
            selectedBudgetCalDate = null;
            renderBudget();
            showToast("Показаны все операции за месяц");
        }

        function onBudgetCalDayClick(dateStr) {
            if (selectedBudgetCalDate === dateStr) {
                selectedBudgetCalDate = null;
                showToast("Показаны все операции за месяц");
            } else {
                selectedBudgetCalDate = dateStr;
                const txDateInp = document.getElementById('tx-date');
                if (txDateInp) txDateInp.value = dateStr;
                const [y, m, d] = dateStr.split('-');
                showToast(`Выбран день: ${d}.${m}.${y}`);
            }
            renderBudget();
        }

        function toggleBudgetLimitForm() {
            const form = document.getElementById('budget-limit-form');
            if (!form) return;
            form.classList.toggle('hidden');
            if (!form.classList.contains('hidden')) {
                const current = (data.budget && data.budget.monthlyLimit) || 0;
                document.getElementById('budget-limit-input').value = current || '';
                document.getElementById('budget-limit-input').focus();
            }
        }

        function saveBudgetMonthlyLimit() {
            const val = parseFloat(document.getElementById('budget-limit-input').value) || 0;
            if (!data.budget) data.budget = { transactions: [], monthlyLimit: 0 };
            data.budget.monthlyLimit = Math.max(0, val);
            saveEncrypted();
            toggleBudgetLimitForm();
            renderBudget();
            showToast(val > 0 ? `Месячный лимит установлен: ${val.toLocaleString('ru-RU')} ₽` : 'Лимит отключен');
        }

        function addBudgetTransaction() {
            const amountInp = document.getElementById('tx-amount');
            const noteInp = document.getElementById('tx-note');
            const dateInp = document.getElementById('tx-date');

            const amount = parseFloat(amountInp.value);
            if (!amount || isNaN(amount) || amount <= 0) {
                alert("Укажите корректную сумму операции!");
                amountInp.focus();
                return;
            }

            const dateVal = dateInp.value || getFormattedDate(new Date());
            const note = (noteInp.value || '').trim();

            if (!data.budget) data.budget = { transactions: [], monthlyLimit: 0 };
            if (!data.budget.transactions) data.budget.transactions = [];

            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            const tx = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                type: activeBudgetTxType,
                amount: Math.round(amount),
                category: selectedBudgetCategory.name,
                categoryIcon: selectedBudgetCategory.icon,
                note: note,
                date: dateVal,
                time: timeStr
            };

            data.budget.transactions.unshift(tx);
            saveEncrypted();

            amountInp.value = '';
            noteInp.value = '';
            renderBudget();
            showToast(tx.type === 'income' ? `+ ${tx.amount} ₽ доход добавлен` : `- ${tx.amount} ₽ расход записан`);
        }

        function deleteBudgetTransaction(id) {
            if (!data.budget || !data.budget.transactions) return;
            const idx = data.budget.transactions.findIndex(t => t.id === id);
            if (idx === -1) return;
            
            const tx = data.budget.transactions[idx];
            if (confirm(`Удалить операцию "${tx.categoryIcon} ${tx.category}" на сумму ${tx.amount} ₽?`)) {
                data.budget.transactions.splice(idx, 1);
                saveEncrypted();
                renderBudget();
                showToast("Операция удалена");
            }
        }

        function renderBudgetCalendar() {
            const grid = document.getElementById('budget-cal-grid');
            if (!grid) return;
            grid.innerHTML = '';

            const year = budgetCurrentDate.getFullYear();
            const month = budgetCurrentDate.getMonth(); // 0-indexed
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            // Заголовки дней недели
            const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
            dayNames.forEach((d, idx) => {
                const isWeekend = idx >= 5;
                grid.innerHTML += `<div class="bcal-day-name ${isWeekend ? 'weekend' : ''}">${d}</div>`;
            });

            // Отступ для первого дня месяца (0 = Пн, 6 = Вс)
            let firstDay = new Date(year, month, 1).getDay();
            firstDay = firstDay === 0 ? 6 : firstDay - 1;
            for (let i = 0; i < firstDay; i++) {
                grid.innerHTML += `<div class="bcal-empty-slot"></div>`;
            }

            const todayStr = getFormattedDate(new Date());
            const txs = (data.budget && data.budget.transactions) ? data.budget.transactions : [];

            // Группировка транзакций по дням
            const dayDataMap = {};
            let totalDaysWithExp = 0;
            let totalDaysWithInc = 0;

            txs.forEach(t => {
                if (!t.date) return;
                const [ty, tm] = t.date.split('-').map(Number);
                if (ty === year && (tm - 1) === month) {
                    if (!dayDataMap[t.date]) {
                        dayDataMap[t.date] = { income: 0, expense: 0, count: 0 };
                    }
                    const amt = Number(t.amount) || 0;
                    if (t.type === 'income') {
                        dayDataMap[t.date].income += amt;
                    } else {
                        dayDataMap[t.date].expense += amt;
                    }
                    dayDataMap[t.date].count++;
                }
            });

            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const dayInfo = dayDataMap[dateStr] || { income: 0, expense: 0, count: 0 };
                const hasInc = dayInfo.income > 0;
                const hasExp = dayInfo.expense > 0;
                const isToday = (dateStr === todayStr);
                const isSelected = (selectedBudgetCalDate === dateStr);

                if (hasExp) totalDaysWithExp++;
                if (hasInc) totalDaysWithInc++;

                let cls = 'bcal-day';
                if (isSelected) cls += ' bcal-selected';
                else if (isToday) cls += ' bcal-today';

                if (hasInc && hasExp) cls += ' bcal-has-both';
                else if (hasInc) cls += ' bcal-has-income';
                else if (hasExp) cls += ' bcal-has-expense';

                let indicatorsHtml = '';
                if (hasInc && hasExp) {
                    indicatorsHtml = `
                        <div class="bcal-indicators">
                            <span class="bcal-tag inc" title="Доход: +${dayInfo.income.toLocaleString('ru-RU')} ₽">+ ${formatCompactBudget(dayInfo.income)}</span>
                            <span class="bcal-tag exp" title="Расход: -${dayInfo.expense.toLocaleString('ru-RU')} ₽">- ${formatCompactBudget(dayInfo.expense)}</span>
                        </div>
                    `;
                } else if (hasInc) {
                    indicatorsHtml = `
                        <div class="bcal-indicators">
                            <span class="bcal-tag inc" title="Доход: +${dayInfo.income.toLocaleString('ru-RU')} ₽">+ ${formatCompactBudget(dayInfo.income)}</span>
                        </div>
                    `;
                } else if (hasExp) {
                    indicatorsHtml = `
                        <div class="bcal-indicators">
                            <span class="bcal-tag exp" title="Расход: -${dayInfo.expense.toLocaleString('ru-RU')} ₽">- ${formatCompactBudget(dayInfo.expense)}</span>
                        </div>
                    `;
                } else {
                    indicatorsHtml = `<div class="bcal-indicators empty"></div>`;
                }

                grid.innerHTML += `
                    <div class="${cls}" onclick="onBudgetCalDayClick('${dateStr}')" title="${dateStr}: ${hasExp ? 'Расход: ' + dayInfo.expense.toLocaleString('ru-RU') + ' ₽. ' : ''}${hasInc ? 'Доход: ' + dayInfo.income.toLocaleString('ru-RU') + ' ₽.' : ''}">
                        <div class="bcal-day-header">
                            <span class="bcal-num">${i}</span>
                            ${isToday ? '<span class="bcal-today-dot" title="Сегодня">●</span>' : ''}
                        </div>
                        ${indicatorsHtml}
                    </div>
                `;
            }

            const calActiveBadge = document.getElementById('budget-cal-active-badge');
            if (calActiveBadge) {
                if (selectedBudgetCalDate) {
                    const [y, m, d] = selectedBudgetCalDate.split('-');
                    calActiveBadge.innerHTML = `📅 ${d}.${m}.${y} ✕`;
                    calActiveBadge.style.display = 'inline-block';
                } else {
                    calActiveBadge.style.display = 'none';
                }
            }

            const statsHint = document.getElementById('budget-cal-stats-hint');
            if (statsHint) {
                statsHint.innerText = `${totalDaysWithExp} дн. с тратами • ${totalDaysWithInc} с доходом`;
            }
        }

        function renderBudget() {
            if (!data.budget) data.budget = { transactions: [], monthlyLimit: 0 };
            if (!data.budget.transactions) data.budget.transactions = [];

            // Инициализация поля даты в форме, если пусто
            const txDateInp = document.getElementById('tx-date');
            if (txDateInp && !txDateInp.value) {
                txDateInp.value = getFormattedDate(new Date());
            }

            // Обновление чипов категорий
            renderBudgetCategoryChips();

            const txs = data.budget.transactions;
            const year = budgetCurrentDate.getFullYear();
            const month = budgetCurrentDate.getMonth(); // 0-indexed

            const monthName = budgetCurrentDate.toLocaleString('ru', { month: 'long', year: 'numeric' });
            const monthNameCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            const monthDisplay = document.getElementById('budget-month-display');
            if (monthDisplay) monthDisplay.innerText = monthNameCapitalized;

            // 1. Доходы и расходы за выбранный месяц
            let monthIncome = 0;
            let monthExpense = 0;
            const categorySums = {}; // Распределение расходов по категориям

            txs.forEach(t => {
                if (!t.date) return;
                const [ty, tm] = t.date.split('-').map(Number);
                if (ty === year && (tm - 1) === month) {
                    const amt = Number(t.amount) || 0;
                    if (t.type === 'income') {
                        monthIncome += amt;
                    } else {
                        monthExpense += amt;
                        const catKey = t.category || 'Прочее';
                        const catIcon = t.categoryIcon || '📦';
                        if (!categorySums[catKey]) {
                            categorySums[catKey] = { sum: 0, icon: catIcon };
                        }
                        categorySums[catKey].sum += amt;
                    }
                }
            });

            // 2. Баланс за выбранный месяц (Доходы минус Расходы за этот месяц)
            const monthNet = monthIncome - monthExpense;
            const monthBalanceEl = document.getElementById('budget-month-balance');
            const balanceLabelEl = document.getElementById('budget-balance-label');
            if (balanceLabelEl) {
                balanceLabelEl.innerText = `💎 Баланс за ${monthNameCapitalized}`;
            }
            if (monthBalanceEl) {
                if (monthNet > 0) {
                    monthBalanceEl.innerText = `+ ${monthNet.toLocaleString('ru-RU')} ₽`;
                    monthBalanceEl.style.color = '#34d399';
                } else if (monthNet < 0) {
                    monthBalanceEl.innerText = `- ${Math.abs(monthNet).toLocaleString('ru-RU')} ₽`;
                    monthBalanceEl.style.color = '#fb7185';
                } else {
                    monthBalanceEl.innerText = `0 ₽`;
                    monthBalanceEl.style.color = '#ffffff';
                }
            }

            // 3. Общий баланс за все время (под карточкой)
            let totalIncomeAll = 0;
            let totalExpenseAll = 0;
            txs.forEach(t => {
                const amt = Number(t.amount) || 0;
                if (t.type === 'income') totalIncomeAll += amt;
                else totalExpenseAll += amt;
            });
            const totalNetAll = totalIncomeAll - totalExpenseAll;
            const allTimeValEl = document.getElementById('budget-all-time-val');
            if (allTimeValEl) {
                const sign = totalNetAll > 0 ? '+ ' : (totalNetAll < 0 ? '- ' : '');
                allTimeValEl.innerText = `${sign}${Math.abs(totalNetAll).toLocaleString('ru-RU')} ₽`;
                allTimeValEl.style.color = totalNetAll > 0 ? '#34d399' : (totalNetAll < 0 ? '#fb7185' : 'var(--text-main)');
            }

            const monthIncomeEl = document.getElementById('budget-month-income');
            const monthExpenseEl = document.getElementById('budget-month-expense');
            if (monthIncomeEl) monthIncomeEl.innerText = `+ ${monthIncome.toLocaleString('ru-RU')} ₽`;
            if (monthExpenseEl) monthExpenseEl.innerText = `- ${monthExpense.toLocaleString('ru-RU')} ₽`;

            // 4. Лимит расходов на месяц
            const limit = Number(data.budget.monthlyLimit) || 0;
            const limitWrapper = document.getElementById('budget-limit-wrapper');
            if (limitWrapper) {
                if (limit > 0) {
                    limitWrapper.style.display = 'block';
                    const pct = Math.min(100, Math.round((monthExpense / limit) * 100));
                    const remaining = limit - monthExpense;
                    
                    document.getElementById('budget-limit-text').innerText = `${monthExpense.toLocaleString('ru-RU')} / ${limit.toLocaleString('ru-RU')} ₽ (${pct}%)`;
                    
                    const bar = document.getElementById('budget-limit-bar');
                    bar.style.width = `${pct}%`;
                    if (pct >= 100) {
                        bar.style.background = 'linear-gradient(90deg, #f43f5e, #e11d48)';
                    } else if (pct >= 80) {
                        bar.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
                    } else {
                        bar.style.background = 'linear-gradient(90deg, #10b981, #3b82f6)';
                    }

                    const remEl = document.getElementById('budget-limit-remaining');
                    if (remaining >= 0) {
                        remEl.innerText = `Осталось потратить: ${remaining.toLocaleString('ru-RU')} ₽`;
                        remEl.style.color = 'var(--text-muted)';
                    } else {
                        remEl.innerText = `⚠️ Лимит превышен на ${Math.abs(remaining).toLocaleString('ru-RU')} ₽!`;
                        remEl.style.color = '#fb7185';
                    }
                } else {
                    limitWrapper.style.display = 'none';
                }
            }

            // 5. Рендер финансового календаря
            renderBudgetCalendar();

            // 6. Аналитика расходов по категориям
            const catContainer = document.getElementById('budget-category-breakdown');
            const catTotalHeader = document.getElementById('budget-cat-total');
            if (catTotalHeader) catTotalHeader.innerText = `${monthExpense.toLocaleString('ru-RU')} ₽`;

            if (catContainer) {
                const catEntries = Object.entries(categorySums).sort((a, b) => b[1].sum - a[1].sum);
                if (catEntries.length === 0) {
                    catContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:12px 0; font-size:13px;">Расходов в этом месяце нет</p>';
                } else {
                    catContainer.innerHTML = catEntries.map(([catName, info]) => {
                        const pct = monthExpense > 0 ? Math.round((info.sum / monthExpense) * 100) : 0;
                        return `
                            <div class="cat-stat-row">
                                <span style="font-size:18px;">${escapeHtml(info.icon)}</span>
                                <div style="flex:1; min-width:0;">
                                    <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                                        <strong style="font-size:13px; color:var(--text-main);">${escapeHtml(catName)}</strong>
                                        <span style="font-weight:700; color:var(--text-main); font-variant-numeric:tabular-nums;">${info.sum.toLocaleString('ru-RU')} ₽ <span style="color:var(--text-muted); font-size:11px; font-weight:normal;">(${pct}%)</span></span>
                                    </div>
                                    <div class="progress-track" style="height:4px;">
                                        <div class="progress-fill" style="width:${pct}%; background:linear-gradient(90deg, #3b82f6, #8b5cf6);"></div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }

            // 7. Рендер списка операций
            renderBudgetTransactionsList();
            renderDebts();
        }

        function renderBudgetTransactionsList() {
            const listEl = document.getElementById('budget-transactions-list');
            const badgeEl = document.getElementById('tx-count-badge');
            const filterTagEl = document.getElementById('tx-date-filter-tag');
            if (!listEl) return;

            const q = (document.getElementById('tx-search-input')?.value || '').toLowerCase().trim();
            const txs = data.budget.transactions || [];
            const year = budgetCurrentDate.getFullYear();
            const month = budgetCurrentDate.getMonth();

            const filtered = txs.filter(t => {
                // Фильтр по месяцу
                if (t.date) {
                    const [ty, tm] = t.date.split('-').map(Number);
                    if (ty !== year || (tm - 1) !== month) return false;
                }
                // Фильтр по выбранному дню из календаря
                if (selectedBudgetCalDate && t.date !== selectedBudgetCalDate) {
                    return false;
                }
                // Фильтр по табу (Все / Расходы / Доходы)
                if (activeBudgetFilterTab === 'expense' && t.type !== 'expense') return false;
                if (activeBudgetFilterTab === 'income' && t.type !== 'income') return false;
                // Поиск по ключевому слову
                if (q) {
                    const str = `${t.category} ${t.note} ${t.amount}`.toLowerCase();
                    if (!str.includes(q)) return false;
                }
                return true;
            });

            if (badgeEl) badgeEl.innerText = `${filtered.length} шт`;

            if (filterTagEl) {
                if (selectedBudgetCalDate) {
                    const [y, m, d] = selectedBudgetCalDate.split('-');
                    filterTagEl.innerHTML = `📅 ${d}.${m}.${y} ✕`;
                    filterTagEl.style.display = 'inline-block';
                } else {
                    filterTagEl.style.display = 'none';
                }
            }

            if (filtered.length === 0) {
                if (selectedBudgetCalDate) {
                    const [y, m, d] = selectedBudgetCalDate.split('-');
                    listEl.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:14px 0; font-size:13px;">Операций за ${d}.${m}.${y} не найдено<br><button class="btn btn-secondary" style="width:auto; margin-top:8px; font-size:12px; padding:6px 12px;" onclick="resetBudgetCalDateFilter()">Показать все за месяц</button></div>`;
                } else {
                    listEl.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:14px 0; font-size:13px;">Операций не найдено</p>';
                }
                return;
            }

            listEl.innerHTML = filtered.map(t => {
                const isInc = t.type === 'income';
                const sign = isInc ? '+' : '-';
                const amtClass = isInc ? 'income' : 'expense';
                const iconBoxClass = isInc ? 'income' : 'expense';
                const noteHtml = t.note ? `<div style="font-size:12px; color:var(--text-muted); margin-top:2px; word-break:break-word;">${escapeHtml(t.note)}</div>` : '';
                
                let dateDisplay = t.date || '';
                if (dateDisplay) {
                    const [y, m, d] = dateDisplay.split('-');
                    dateDisplay = `${d}.${m}.${y}`;
                }

                return `
                    <div class="tx-item">
                        <div class="tx-icon-box ${iconBoxClass}">
                            <span>${escapeHtml(t.categoryIcon || (isInc ? '💵' : '📦'))}</span>
                        </div>
                        <div class="tx-info">
                            <div class="tx-title">${escapeHtml(t.category || 'Операция')}</div>
                            ${noteHtml}
                            <div class="tx-sub">📅 ${escapeHtml(dateDisplay)} ${t.time ? '• ' + escapeHtml(t.time) : ''}</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                            <div class="tx-amount ${amtClass}">${sign} ${Number(t.amount).toLocaleString('ru-RU')} ₽</div>
                            <button class="del-btn" onclick="deleteBudgetTransaction('${escapeHtml(t.id)}')" title="Удалить">✕</button>
                        </div>
                    </div>
                `;
            }).join('');
        }


        // --- ХРАНИЛИЩЕ ПАРОЛЕЙ И 2FA ---
        function renderVault() {
            const q = (document.getElementById('search-box')?.value || '').toLowerCase().trim(); 
            const container = document.getElementById('vault-list'); 
            if (!container) return;

            const vaultItems = data.vault || [];
            const filtered = vaultItems.map((item, originalIndex) => ({ item, originalIndex }))
                .filter(({ item }) => (item.name || '').toLowerCase().includes(q) || (item.user || '').toLowerCase().includes(q));

            if (!filtered.length) { 
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:12px 0; font-size:13px;">Сохраненных записей нет</p>'; 
                return; 
            }

            container.innerHTML = filtered.map(({ item, originalIndex }) => {
                const isVisible = !!visibleVaultPasswords[originalIndex];
                const displayPwd = isVisible ? escapeHtml(item.pwd) : '••••••••••••';
                const pwdClass = isVisible ? 'vault-pwd-text' : 'vault-pwd-text masked';
                const eyeIcon = isVisible ? '🙈 Скрыть' : '👁️ Показать';
                const eyeClass = isVisible ? 'icon-btn-sm active' : 'icon-btn-sm';

                let codeHtml = "";
                if (item.secret) {
                    let token = generateTOTP(item.secret);
                    if (token) {
                        codeHtml = `<span class="code-badge" onclick="copyTOTP(${originalIndex})" title="Нажмите, чтобы скопировать 2FA код">🔑 ${token}</span>`;
                    } else {
                        codeHtml = `<span style="color:var(--danger); font-size:11px;">2FA Err</span>`;
                    }
                }

                return `
                <div class="vault-card">
                    <div class="vault-card-top">
                        <div style="min-width:0; flex:1;">
                            <div class="vault-service-name">${escapeHtml(item.name)}</div>
                            <div class="vault-username" onclick="copyVaultUser(${originalIndex})" title="Нажмите, чтобы скопировать логин">
                                <span>👤 ${escapeHtml(item.user || '—')}</span>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                            ${codeHtml}
                            <button class="icon-btn-sm" onclick="editVaultItem(${originalIndex})" title="Редактировать">✏️</button>
                            <button class="del-btn" onclick="deleteVaultItem(${originalIndex})" title="Удалить">✕</button>
                        </div>
                    </div>
                    
                    <div class="vault-pwd-row">
                        <div class="${pwdClass}" id="vault-pwd-val-${originalIndex}">${displayPwd}</div>
                        <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                            <button class="${eyeClass}" onclick="toggleVaultPasswordVisibility(${originalIndex})" title="Показать/скрыть пароль">${eyeIcon}</button>
                            <button class="icon-btn-sm" onclick="copyVaultPassword(${originalIndex})" title="Скопировать пароль">📋</button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        function toggleVaultPasswordVisibility(idx) {
            visibleVaultPasswords[idx] = !visibleVaultPasswords[idx];
            renderVault();
        }

        function copyVaultPassword(idx) {
            const item = data.vault[idx];
            if (!item || !item.pwd) return;
            copyText(item.pwd, "Пароль скопирован!");
        }

        function copyVaultUser(idx) {
            const item = data.vault[idx];
            if (!item || !item.user) return;
            copyText(item.user, "Логин скопирован!");
        }

        function copyTOTP(idx) {
            const item = data.vault[idx];
            if (!item || !item.secret) return;
            const token = generateTOTP(item.secret);
            if (token) copyText(token, "2FA код скопирован!");
        }

        function copyText(txt, successMsg) {
            if (!txt) return;
            if (navigator.clipboard && window.isSecureContext) { 
                navigator.clipboard.writeText(txt).then(() => showToast(successMsg || "Скопировано!")).catch(() => fallbackCopy(txt, successMsg)); 
            } else { 
                fallbackCopy(txt, successMsg); 
            }
        }

        function fallbackCopy(text, successMsg) {
            const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.left = "-9999px";
            document.body.appendChild(ta); ta.focus(); ta.select();
            try { 
                document.execCommand('copy'); 
                showToast(successMsg || "Скопировано!"); 
            } catch(e) { 
                prompt("Скопируйте:", text); 
            }
            document.body.removeChild(ta);
        }

        function deleteVaultItem(idx) { 
            const item = data.vault[idx];
            if (!item) return;
            if (confirm(`Удалить запись "${item.name}"?`)) { 
                data.vault.splice(idx, 1); 
                delete visibleVaultPasswords[idx];
                saveEncrypted(); 
                renderVault(); 
                showToast("Запись удалена");
            } 
        }

        function openAddVaultModal() {
            editingVaultIndex = null;
            document.getElementById('vault-modal-title').innerText = "🔐 Новая запись";
            document.getElementById('save-vault-btn').innerText = "Сохранить запись";
            document.getElementById('add-name').value = '';
            document.getElementById('add-user').value = '';
            document.getElementById('add-pwd').value = '';
            document.getElementById('add-secret').value = '';
            document.getElementById('form-pwd-strength').style.display = 'none';
            showSection('add-vault-page');
        }

        function editVaultItem(idx) {
            const item = data.vault[idx];
            if (!item) return;
            editingVaultIndex = idx;
            document.getElementById('vault-modal-title').innerText = "✏️ Редактирование записи";
            document.getElementById('save-vault-btn').innerText = "Обновить запись";
            document.getElementById('add-name').value = item.name || '';
            document.getElementById('add-user').value = item.user || '';
            document.getElementById('add-pwd').value = item.pwd || '';
            document.getElementById('add-secret').value = item.secret || '';
            checkFormPasswordStrength();
            showSection('add-vault-page');
        }

        function saveNewCredential() {
            const name = document.getElementById('add-name').value.trim(); 
            const user = document.getElementById('add-user').value.trim(); 
            const pwd = document.getElementById('add-pwd').value; 
            const secret = document.getElementById('add-secret').value.trim();
            
            if (!name || !pwd) return alert("Заполните название сервиса и пароль!");
            
            if (editingVaultIndex !== null && data.vault[editingVaultIndex]) {
                data.vault[editingVaultIndex] = { name, user, pwd, secret };
                showToast("Запись обновлена!");
            } else {
                if (!data.vault) data.vault = [];
                data.vault.push({ name, user, pwd, secret });
                showToast("Запись сохранена!");
            }
            
            saveEncrypted();
            document.getElementById('add-name').value = ''; 
            document.getElementById('add-user').value = ''; 
            document.getElementById('add-pwd').value = ''; 
            document.getElementById('add-secret').value = ''; 
            editingVaultIndex = null;
            showSection('misc-page');
        }

        // --- ГЕНЕРАТОР ПАРОЛЕЙ ---
        function togglePasswordGenerator() {
            const widget = document.getElementById('generator-widget-box');
            if (!widget) return;
            widget.classList.toggle('hidden');
            if (!widget.classList.contains('hidden')) {
                generateRandomPassword();
            }
        }

        function onGenLengthChange() {
            const len = document.getElementById('gen-len-slider').value;
            document.getElementById('gen-length-display').innerText = `${len} символов`;
            generateRandomPassword();
        }

        function generateRandomPassword() {
            const len = parseInt(document.getElementById('gen-len-slider')?.value || 16);
            const useUpper = document.getElementById('gen-opt-upper')?.checked ?? true;
            const useLower = document.getElementById('gen-opt-lower')?.checked ?? true;
            const useNumbers = document.getElementById('gen-opt-numbers')?.checked ?? true;
            const useSymbols = document.getElementById('gen-opt-symbols')?.checked ?? true;

            const uppers = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const lowers = "abcdefghijklmnopqrstuvwxyz";
            const nums = "0123456789";
            const syms = "!@#$%^&*()_+-=[]{}|;:,.<>?";

            let chars = "";
            let requiredChars = [];

            if (useUpper) { chars += uppers; requiredChars.push(uppers[Math.floor(Math.random() * uppers.length)]); }
            if (useLower) { chars += lowers; requiredChars.push(lowers[Math.floor(Math.random() * lowers.length)]); }
            if (useNumbers) { chars += nums; requiredChars.push(nums[Math.floor(Math.random() * nums.length)]); }
            if (useSymbols) { chars += syms; requiredChars.push(syms[Math.floor(Math.random() * syms.length)]); }

            if (!chars) chars = lowers + nums;

            let result = [...requiredChars];
            for (let i = result.length; i < len; i++) {
                result.push(chars[Math.floor(Math.random() * chars.length)]);
            }

            // Перемешивание (Fisher-Yates)
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }

            const finalPwd = result.join('');
            const resEl = document.getElementById('gen-result-text');
            if (resEl) resEl.innerText = finalPwd;

            updateStrengthBar(finalPwd, 'gen-strength-fill');
            return finalPwd;
        }

        function copyGeneratedPassword() {
            const pwd = document.getElementById('gen-result-text')?.innerText;
            if (pwd && pwd !== '—') {
                copyText(pwd, "Сгенерированный пароль скопирован!");
            }
        }

        function useGeneratedForNewVault() {
            const pwd = document.getElementById('gen-result-text')?.innerText;
            if (pwd && pwd !== '—') {
                openAddVaultModal();
                document.getElementById('add-pwd').value = pwd;
                checkFormPasswordStrength();
            }
        }

        function generatePasswordForForm() {
            const uppers = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const lowers = "abcdefghijklmnopqrstuvwxyz";
            const nums = "0123456789";
            const syms = "!@#$%^&*";
            const all = uppers + lowers + nums + syms;
            let pwd = [
                uppers[Math.floor(Math.random() * uppers.length)],
                lowers[Math.floor(Math.random() * lowers.length)],
                nums[Math.floor(Math.random() * nums.length)],
                syms[Math.floor(Math.random() * syms.length)]
            ];
            for(let i=4; i<16; i++) {
                pwd.push(all[Math.floor(Math.random() * all.length)]);
            }
            for (let i = pwd.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
            }
            const res = pwd.join('');
            document.getElementById('add-pwd').value = res;
            checkFormPasswordStrength();
            showToast("Надежный пароль сгенерирован!");
        }

        function checkFormPasswordStrength() {
            const pwd = document.getElementById('add-pwd').value;
            const container = document.getElementById('form-pwd-strength');
            if (!container) return;
            if (!pwd) {
                container.style.display = 'none';
                return;
            }
            container.style.display = 'block';
            updateStrengthBar(pwd, 'form-pwd-strength-bar');
        }

        function updateStrengthBar(pwd, barId) {
            const bar = document.getElementById(barId);
            if (!bar) return;
            let score = 0;
            if (pwd.length >= 8) score += 25;
            if (pwd.length >= 14) score += 25;
            if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 20;
            if (/[0-9]/.test(pwd)) score += 15;
            if (/[^A-Za-z0-9]/.test(pwd)) score += 15;

            bar.style.width = `${Math.min(100, score)}%`;
            if (score < 40) {
                bar.style.backgroundColor = 'var(--danger)';
            } else if (score < 75) {
                bar.style.backgroundColor = '#f59e0b';
            } else {
                bar.style.backgroundColor = 'var(--success)';
            }
        }

        // Таймер для TOTP
        setInterval(() => {
            if (document.getElementById('misc-page').classList.contains('active')) {
                let secLeft = 30 - (Math.floor(Date.now() / 1000) % 30);
                const timerEl = document.getElementById('totp-timer');
                if (timerEl) timerEl.innerText = `TOTP: ${secLeft}s`;
                if (secLeft === 30 || secLeft === 1) renderVault();
            }
        }, 1000);

        // --- ЛОКАЛЬНЫЙ ЭКСПОРТ И ИМПОРТ БЭКАПА (ФАЙЛ) ---
        function exportBackupFile() {
            const encStr = localStorage.getItem('encMasterData');
            if (!encStr) return alert("Нет данных для экспорта!");
            const blob = new Blob([encStr], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `helper_backup_${getFormattedDate(new Date())}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("Файл бэкапа сохранен!");
        }

        function importBackupFile(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                const encStr = e.target.result.trim();
                try {
                    const bytes = CryptoJS.AES.decrypt(encStr, masterKey);
                    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
                    if (!decryptedStr) throw new Error("Неверный мастер-пароль");
                    
                    data = JSON.parse(decryptedStr);
                    if (!data.budget) data.budget = { transactions: [], monthlyLimit: 0 };
                    localStorage.setItem('encMasterData', encStr);
                    updateUI();
                    renderVault();
                    alert("Данные успешно импортированы из файла!");
                } catch(err) {
                    alert("Ошибка импорта! Файл поврежден или зашифрован другим паролем.");
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        }

        function importBackupFileFromAuth(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                const encStr = e.target.result.trim();
                localStorage.setItem('encMasterData', encStr);
                alert("Бэкап загружен! Теперь введите мастер-пароль для входа.");
            };
            reader.readAsText(file);
            event.target.value = '';
        }

        // CSV Экспорт
        function exportDataPeriod(period) {
            let today = new Date(); let endStr = getFormattedDate(today); let startStr = "2020-01-01";
            if (period === 7) { let dt = new Date(); dt.setDate(dt.getDate() - 7); startStr = getFormattedDate(dt); } 
            else if (period === 30) { let dt = new Date(); dt.setDate(dt.getDate() - 30); startStr = getFormattedDate(dt); }
            generateAndDownloadCSV(startStr, endStr);
        }

        function exportCustomPeriod() {
            let sDate = document.getElementById('export-start-date').value; let eDate = document.getElementById('export-end-date').value;
            if (!sDate || !eDate) return alert("Укажите обе даты!");
            if (sDate > eDate) { let tmp = sDate; sDate = eDate; eDate = tmp; }
            generateAndDownloadCSV(sDate, eDate);
        }

        function generateAndDownloadCSV(startStr, endStr) {
            let rows = [["Дата", "Статус смены", "Калории (ккал)", "Вода (мл)", "Шаги", "Вес (кг)", "Настроение (Таймлайн)", "Приемы пищи", "Бюджет (Операции)"]];
            let [sy, sm, sd] = startStr.split('-').map(Number); let [ey, em, ed] = endStr.split('-').map(Number);
            let cur = new Date(sy, sm - 1, sd); let end = new Date(ey, em - 1, ed);

            const txs = (data.budget && data.budget.transactions) ? data.budget.transactions : [];

            while (cur <= end) {
                let dStr = getFormattedDate(cur);
                let dData = data.days[dStr] || { calories: 0, water: 0, steps: 0, moodList: [], meals: [], weightList: [] };
                let shift = data.shifts[dStr] || 'none';
                let shiftLabel = shift === 'day' ? "Дневная смена" : (shift === 'night' ? "Ночная смена" : "Выходной");
                let moodTimeline = (dData.moodList && dData.moodList.length) ? dData.moodList.map(m => `[${m.time}] ${m.emoji}`).join(' | ') : (dData.mood || "-");
                let mealsStr = (dData.meals && dData.meals.length) ? dData.meals.map(m => {
                    let tag = (m.health_type === 'healthy' || (!m.health_type && (m.health_score || 7) >= 6)) ? 'Полезное' : 'Вредное';
                    return `${m.name} [${tag}, ${m.cal}ккал]`;
                }).join('; ') : "-";

                // Операции бюджета за этот день
                let dayTxs = txs.filter(t => t.date === dStr);
                let txStr = dayTxs.length ? dayTxs.map(t => `${t.type === 'income' ? '+' : '-'}${t.amount}₽ (${t.category}${t.note ? ': ' + t.note : ''})`).join('; ') : "-";

                let weightStr = (dData.weightList && dData.weightList.length) ? dData.weightList[dData.weightList.length - 1].v : "-";
                rows.push([dStr, shiftLabel, dData.calories || 0, dData.water || 0, dData.steps || 0, weightStr, moodTimeline, mealsStr, txStr]);
                cur.setDate(cur.getDate() + 1);
            }

            let csvContent = "\uFEFF" + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
            let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            let link = document.createElement("a"); link.href = URL.createObjectURL(blob);
            link.setAttribute("download", `helper_report_${startStr}_to_${endStr}.csv`);
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        }

        // --- ФАЙЛООБМЕННИК ---
        function renderUploads() {
            const container = document.getElementById('uploads-list');
            if (!container) return;
            if (!data.uploads || !data.uploads.length) {
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:10px 0; font-size:13px;">Загруженных файлов нет</p>';
                return;
            }
            container.innerHTML = data.uploads.map((f, idx) => `
                <div class="list-item">
                    <div style="min-width:0; flex:1;">
                        <strong style="word-break:break-all; font-size:13px;">${escapeHtml(f.name)}</strong><br>
                        <span style="font-size:11px; color:var(--text-muted);">${escapeHtml(f.date)}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                        <button class="btn btn-secondary" style="width:auto; padding:6px 10px; font-size:12px; margin:0;" onclick="copyUploadLink(${idx})">Ссылка</button>
                        <button class="del-btn" onclick="deleteUpload(${idx})">✕</button>
                    </div>
                </div>
            `).join('');
        }

        function copyUploadLink(idx) {
            const f = data.uploads[idx];
            if (!f) return;
            copyText(f.shortUrl || f.url, "Ссылка на файл скопирована!");
        }

        async function uploadPublicFile(btn) {
            if (!data.githubToken || !data.publicRepo) {
                alert("Пожалуйста, укажите токен и путь к публичному репозиторию в Настройках!");
                showSection('settings-page'); return;
            }
            const fileInput = document.getElementById('public-file-upload');
            if (!fileInput.files.length) return alert("Выберите файл для загрузки!");
            
            const file = fileInput.files[0];
            if (file.size > 15 * 1024 * 1024) return alert("Файл слишком большой (максимум 15 МБ)."); 

            btn.disabled = true; 
            const origText = btn.innerText;
            btn.innerText = "⏳ Подготовка файла...";

            try {
                const b64 = await fileToBase64(file);
                const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const path = `uploads/${Date.now()}_${safeName}`;
                
                btn.innerText = "☁️ Загрузка на GitHub...";
                const putRes = await fetch(`https://api.github.com/repos/${data.publicRepo}/contents/${path}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${data.githubToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: `Upload file via Helper: ${safeName}`, content: b64 })
                });

                if (!putRes.ok) {
                    const err = await putRes.json();
                    throw new Error(err.message || "Ошибка загрузки на GitHub.");
                }

                const resJson = await putRes.json();
                const rawUrl = resJson.content.download_url;
                const sha = resJson.content.sha;

                btn.innerText = "🔗 Генерация короткой ссылки...";
                let shortUrl = rawUrl;
                try {
                    const shortRes = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(rawUrl)}`);
                    if (shortRes.ok) { shortUrl = await shortRes.text(); }
                } catch (e) {
                    console.log("Сокращение ссылки не удалось", e);
                }

                if (!data.uploads) data.uploads = [];
                data.uploads.unshift({ name: file.name, path: path, url: rawUrl, shortUrl: shortUrl, sha: sha, date: getFormattedDate(new Date()) });
                
                saveEncrypted();
                renderUploads();
                alert(`Файл успешно загружен!\nКороткая ссылка: ${shortUrl}`);
                fileInput.value = '';
            } catch (e) {
                alert("Произошла ошибка: " + e.message);
            } finally {
                btn.disabled = false;
                btn.innerText = origText;
            }
        }

        async function deleteUpload(idx) {
            const fileInfo = data.uploads[idx];
            if (!confirm(`Вы действительно хотите безвозвратно удалить файл "${fileInfo.name}" из репозитория?`)) return;
            
            try {
                const delRes = await fetch(`https://api.github.com/repos/${data.publicRepo}/contents/${fileInfo.path}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `token ${data.githubToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: `Delete file via Helper: ${fileInfo.name}`, sha: fileInfo.sha })
                });

                if (!delRes.ok && delRes.status !== 404) {
                    const err = await delRes.json();
                    throw new Error(err.message || "Не удалось удалить файл с GitHub.");
                }

                data.uploads.splice(idx, 1);
                saveEncrypted();
                renderUploads();
                showToast("Файл удален");
            } catch (e) {
                if (confirm(`Ошибка удаления с GitHub: ${e.message}\nУдалить только запись из локального списка?`)) {
                    data.uploads.splice(idx, 1);
                    saveEncrypted();
                    renderUploads();
                }
            }
        }

        // --- TIKTOK ЗАГРУЗЧИК ---
        async function downloadTikTokVideo(btn) {
            const input = document.getElementById('tiktok-url-input'); const url = input.value.trim();
            const resultBox = document.getElementById('tiktok-result'); const videoEl = document.getElementById('tiktok-video-preview');
            const titleEl = document.getElementById('tiktok-title');
            if (!url) return alert("Вставьте ссылку на видео TikTok!");

            const origText = btn.innerText; btn.innerText = "⏳ Поиск..."; btn.disabled = true; resultBox.classList.add('hidden'); currentTikTokBlob = null;
            try {
                const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
                const res = await response.json();
                if (res.code === 0 && res.data) {
                    const videoData = res.data; currentTikTokCleanUrl = videoData.play || videoData.wmplay;
                    const vResp = await fetch(currentTikTokCleanUrl); currentTikTokBlob = await vResp.blob();
                    videoEl.src = URL.createObjectURL(currentTikTokBlob); titleEl.innerText = videoData.title || "TikTok Video"; resultBox.classList.remove('hidden');
                } else { alert("Не удалось найти видео. Проверьте ссылку."); }
            } catch (err) { alert("Ошибка: " + err.message); } finally { btn.innerText = origText; btn.disabled = false; }
        }

        async function saveToGallery(btn) {
            if (!currentTikTokBlob && !currentTikTokCleanUrl) return alert("Сначала найдите видео!");
            const origText = btn.innerText; btn.innerText = "⏳ Сохранение..."; btn.disabled = true;
            try {
                let blob = currentTikTokBlob;
                if (!blob) { const resp = await fetch(currentTikTokCleanUrl); blob = await resp.blob(); }
                const file = new File([blob], `tiktok_${Date.now()}.mp4`, { type: 'video/mp4' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: 'TikTok Video', text: 'Сохранить видео' });
                } else {
                    const blobUrl = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = blobUrl; a.download = `tiktok_${Date.now()}.mp4`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                }
            } catch (err) { if (err.name !== 'AbortError') window.open(currentTikTokCleanUrl, '_blank'); } finally { btn.innerText = origText; btn.disabled = false; }
        }

        // --- GITHUB СИНХРОНИЗАЦИЯ БЭКАПОВ ---
        async function syncToGitHub(btn) {
            if (!data.githubToken || !data.githubRepo) { alert("Укажите GitHub токен и приватный репозиторий бэкапов в Настройках!"); showSection('settings-page'); return; }
            let origTxt = btn.innerText; btn.innerText = "⏳ Отправка...";
            try {
                let encStr = localStorage.getItem('encMasterData');
                if(!encStr) throw new Error("Нет данных для синхронизации");
                let path = "encrypted_helper_backup.json"; let sha = "";
                let getRes = await fetch(`https://api.github.com/repos/${data.githubRepo}/contents/${path}`, { headers: { 'Authorization': `token ${data.githubToken}`, 'Accept': 'application/vnd.github.v3+json' } });
                if (getRes.ok) sha = (await getRes.json()).sha;

                let body = { message: `Backup update ${getFormattedDate(new Date())}`, content: btoa(unescape(encodeURIComponent(encStr))) };
                if (sha) body.sha = sha;

                let putRes = await fetch(`https://api.github.com/repos/${data.githubRepo}/contents/${path}`, {
                    method: 'PUT', headers: { 'Authorization': `token ${data.githubToken}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' }, body: JSON.stringify(body)
                });
                if (putRes.ok) alert("Бэкап успешно отправлен на GitHub!"); else alert("Ошибка GitHub: " + ((await putRes.json()).message || putRes.statusText));
            } catch(e) { alert("Ошибка синхронизации: " + e.message); } finally { btn.innerText = origTxt; }
        }

        async function importFromGitHub(btn) {
            if (!data.githubToken || !data.githubRepo) { alert("Укажите GitHub токен и приватный репозиторий в Настройках!"); showSection('settings-page'); return; }
            if (!confirm("Внимание! Локальные данные будут перезаписаны версией с GitHub. Продолжить?")) return;
            let origTxt = btn.innerText; btn.innerText = "⏳ Загрузка...";
            try {
                let getRes = await fetch(`https://api.github.com/repos/${data.githubRepo}/contents/encrypted_helper_backup.json`, { headers: { 'Authorization': `token ${data.githubToken}`, 'Accept': 'application/vnd.github.v3+json' } });
                if (getRes.ok) {
                    let json = await getRes.json();
                    let rawBase64 = (json.content || '').replace(/\s+/g, '');
                    let encStr = decodeURIComponent(escape(atob(rawBase64)));
                    try {
                        const bytes = CryptoJS.AES.decrypt(encStr, masterKey); const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
                        if (!decryptedStr) throw new Error();
                        localStorage.setItem('encMasterData', encStr); data = JSON.parse(decryptedStr);
                        if (!data.budget) data.budget = { transactions: [], monthlyLimit: 0 };
                        alert("Данные успешно восстановлены!"); updateUI(); renderVault();
                    } catch(e) { alert("Ошибка! Скачанный бэкап зашифрован другим мастер-паролем."); }
                } else { alert("Файл бэкапа не найден в репозитории."); }
            } catch(e) { alert("Ошибка сети: " + e.message); } finally { btn.innerText = origTxt; }
        }

        async function restoreFromGitHubAuth() {
            const token = prompt("Введите GitHub Personal Access Token:"); if (!token) return;
            let repo = prompt("Введите приватный репозиторий бэкапов (например: username/helper-backup):"); if (!repo) return;
            repo = repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').trim();
            try {
                let getRes = await fetch(`https://api.github.com/repos/${repo}/contents/encrypted_helper_backup.json`, { headers: { 'Authorization': `token ${token.trim()}`, 'Accept': 'application/vnd.github.v3+json' } });
                if (getRes.ok) {
                    let json = await getRes.json();
                    let rawBase64 = (json.content || '').replace(/\s+/g, '');
                    let encStr = decodeURIComponent(escape(atob(rawBase64)));
                    localStorage.setItem('encMasterData', encStr);
                    alert("Бэкап загружен! Введите мастер-пароль для расшифровки.");
                } else { alert("Бэкап не найден. Проверьте репозиторий и токен."); }
            } catch(e) { alert("Ошибка соединения: " + e.message); }
        }

        // --- Service Worker (офлайн-режим PWA) ---
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err));
            });
        }
