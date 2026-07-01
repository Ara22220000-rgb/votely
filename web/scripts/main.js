document.querySelectorAll('[data-dropdown]').forEach((dropdown) => {
    const trigger = dropdown.querySelector('.dropdown__trigger');
    const setExpanded = (expanded) => { trigger?.setAttribute('aria-expanded', String(expanded)); };
    dropdown.addEventListener('mouseenter', () => setExpanded(true));
    dropdown.addEventListener('mouseleave', () => setExpanded(false));
});

function initToasts() {
    if (document.querySelector('[data-toast-root]')) return;
    const root = document.createElement('div');
    root.className = 'toast-root';
    root.dataset.toastRoot = '';
    document.body.append(root);
}

function showToast(message, kind = 'error') {
    const root = document.querySelector('[data-toast-root]');
    if (!root) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast--' + kind;
    toast.textContent = message;
    root.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
}

async function apiJSON(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Ошибка запроса');
    return data;
}

function setStatus(el, msg, kind) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'form-status ' + (kind ? 'is-' + kind : '');
}

document.addEventListener('DOMContentLoaded', () => {
    initToasts();
    const createForm = document.querySelector('[data-create-form]');
    const browseRoot = document.querySelector('[data-browse-root]');
    const detailRoot = document.querySelector('[data-detail-root]');

    if (createForm) initCreateForm(createForm);
    if (browseRoot) initBrowsePage(browseRoot);
    if (detailRoot) initDetailPage(detailRoot);
});

<<<<<<< HEAD
=======
async function initAdminPanel() {
    if (!sessionStorage.getItem('admin_pass')) {
        window.location.href = 'index.php';
        return;
    }
    loadAdminData('poll');
}

// Check auth status on page load
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/v1/auth/me');
        const data = await response.json();
        const authTrigger = document.getElementById('auth-trigger');
        if (authTrigger && data.authenticated) {
            authTrigger.textContent = data.user.username || data.user.first_name || 'Профиль';
        }
    } catch (e) {
        // Ignore auth check errors
    }
}

// Initialize auth check
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuthStatus);
} else {
    checkAuthStatus();
}

>>>>>>> 0a626c65f1b8fde26287197a9752a2aa76a2115a
function initCreateForm(form) {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') === 'quiz' ? 'quiz' : 'poll';
    const pollFields = form.querySelector('[data-poll-fields]');
    const quizFields = form.querySelector('[data-quiz-fields]');
    const optionsList = form.querySelector('[data-options-list]');
    const questionsList = form.querySelector('[data-questions-list]');
    const status = form.querySelector('[data-form-status]');

    if (pollFields) pollFields.hidden = type !== 'poll';
    if (quizFields) quizFields.hidden = type !== 'quiz';

    const titleEl = document.querySelector('#creator-title');
    if (titleEl) titleEl.textContent = type === 'quiz' ? 'Создать викторину' : 'Создать опрос';

    addDefaultRows(type, optionsList, questionsList);

    form.querySelector('[data-add-option]')?.addEventListener('click', () => addOption(optionsList));
    form.querySelector('[data-add-answer]')?.addEventListener('click', () => {
        const answers = form.querySelector('[data-answers]');
        if (answers) answers.append(createAnswerRow(false));
    });

    form.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove]')) e.target.closest('[data-row]')?.remove();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        try {
            const result = await apiJSON(type === 'quiz' ? '/api/v1/quizzes' : '/api/v1/polls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(type === 'quiz' ? collectQuizPayload(form) : collectPollPayload(form))
            });
            const id = result.id;
            if (id) window.location.href = 'view.php?type=' + type + '&id=' + id;
        } catch (err) {
            setStatus(status, err.message, 'error');
        } finally { btn.disabled = false; }
    });
}

function addDefaultRows(type, optionsList, questionsList) {
    if (type === 'quiz') {
        if (questionsList) addSingleQuizQuestion(questionsList);
    } else if (optionsList) {
        addOption(optionsList);
        addOption(optionsList);
    }
}

function addOption(list) {
    const row = document.createElement('div');
    row.className = 'option-row';
    row.dataset.row = 'option';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.marginBottom = '8px';
    row.innerHTML = '<input class="field__control" name="option" placeholder="Вариант ответа" required style="flex:1"><button class="icon-button" type="button" data-remove style="flex:none">×</button>';
    list.appendChild(row);
}

function addSingleQuizQuestion(list) {
    const sec = document.createElement('section');
    sec.className = 'quiz-question';
    sec.dataset.row = 'question';
    sec.innerHTML = `
        <label class="field">
            <span class="field__label">Вопрос викторины</span>
            <input class="field__control" name="question" placeholder="Например: Какая планета самая большая?" required>
        </label>
        <div class="creator-form__section-head" style="margin-top:20px">
            <h3 class="creator-form__subtitle">Варианты ответов</h3>
            <p style="font-size:12px; color:var(--text-muted)">Отметьте галочкой правильный вариант</p>
        </div>
        <div class="quiz-question__answers stack" data-answers></div>
    `;
    const answers = sec.querySelector('[data-answers]');
    answers.appendChild(createAnswerRow(true));
    answers.appendChild(createAnswerRow(false));
    list.appendChild(sec);
}

function createAnswerRow(checked) {
    const row = document.createElement('div');
    row.className = 'answer-row';
    row.dataset.row = 'answer';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';
    row.style.marginBottom = '8px';
    row.innerHTML = `
        <input class="correct-check" type="checkbox" ${checked ? 'checked' : ''} title="Это правильный ответ">
        <input class="field__control" name="answer" placeholder="Вариант ответа" required style="flex:1">
        <button class="icon-button" type="button" data-remove>×</button>
    `;
    return row;
}

function renderQuizView(container, data) {
    container.innerHTML = `
        <div class="quiz-viewer">
            <div class="quiz-question-box" style="background: var(--bg-secondary); padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 1px solid var(--border-color);">
                <h2 style="margin:0; font-size: 1.25rem;">${data.question}</h2>
            </div>
            <div class="answer-list stack" style="gap: 12px;"></div>
            <div class="vote-actions" style="margin-top: 24px; display: flex; align-items: center; gap: 16px;">
                <button class="primary-button">Проверить ответ</button>
                <p class="status form-status" style="margin:0"></p>
            </div>
        </div>
    `;
    
    const list = container.querySelector('.answer-list');
    data.answers.forEach((a, i) => {
        const lbl = document.createElement('label');
        lbl.className = 'vote-option';
        lbl.dataset.correct = a.is_correct;
        lbl.style.cursor = 'pointer';
        lbl.innerHTML = `
            <input type="radio" name="ans" value="${i}">
            <span class="vote-option__text">${a.text}</span>
        `;
        list.appendChild(lbl);
    });

    container.querySelector('.primary-button').onclick = () => {
        const sel = container.querySelector('input:checked');
        if (!sel) {
            const status = container.querySelector('.status');
            status.textContent = 'Выберите вариант!';
            status.className = 'status form-status is-error';
            return;
        }
        
        const selectedLabel = sel.closest('.vote-option');
        const isCorrect = selectedLabel.dataset.correct === 'true';
        const status = container.querySelector('.status');
        
        container.querySelectorAll('.vote-option').forEach(l => {
            l.classList.remove('is-correct', 'is-error');
            if (l.dataset.correct === 'true') {
                l.style.borderColor = 'var(--accent-color)';
                l.style.background = 'rgba(0, 255, 148, 0.05)';
            }
        });

        if (isCorrect) {
            status.textContent = 'Правильно!';
            status.className = 'status form-status is-success';
            selectedLabel.style.borderColor = 'var(--accent-color)';
        } else {
            status.textContent = 'Неправильно, попробуйте еще раз.';
            status.className = 'status form-status is-error';
            selectedLabel.style.borderColor = '#ff4b4b';
            selectedLabel.style.background = 'rgba(255, 75, 75, 0.05)';
        }
    };
}


function addSingleQuizQuestion(list) {
    const sec = document.createElement('section');
    sec.className = 'quiz-question';
    sec.dataset.row = 'question';
    sec.innerHTML = '<label class="field"><span class="field__label">Вопрос</span><input class="field__control" name="question" required></label><div class="quiz-question__answers" data-answers></div>';
    const answers = sec.querySelector('[data-answers]');
    answers.appendChild(createAnswerRow(true));
    answers.appendChild(createAnswerRow(false));
    list.appendChild(sec);
}

function createAnswerRow(checked) {
    const row = document.createElement('div');
    row.className = 'answer-row';
    row.dataset.row = 'answer';
    row.innerHTML = '<input class="correct-check" type="checkbox" ' + (checked ? 'checked' : '') + '><input class="field__control" name="answer" placeholder="Вариант" required><button class="icon-button" type="button" data-remove>×</button>';
    return row;
}

function collectPollPayload(form) {
    return {
        title: form.elements.title.value,
        description: form.elements.description.value,
        options: Array.from(form.querySelectorAll('[name="option"]')).map(i => i.value)
    };
}

function collectQuizPayload(form) {
    return {
        title: form.elements.title.value,
        description: form.elements.description.value,
        question: form.querySelector('[name="question"]').value,
        answers: Array.from(form.querySelectorAll('.answer-row')).map(r => ({
            text: r.querySelector('[name="answer"]').value,
            is_correct: r.querySelector('.correct-check').checked
        }))
    };
}

async function initBrowsePage(root) {
    const type = new URLSearchParams(window.location.search).get('type') === 'quiz' ? 'quiz' : 'poll';
    const list = root.querySelector('[data-list]');
    try {
        const data = await apiJSON('/api/v1/' + type + 's');
        renderCards(list, data.items || [], type);
    } catch (e) { list.textContent = e.message; }
}

function renderCards(list, items, type) {
    list.innerHTML = '';
    items.forEach(item => {
        const a = document.createElement('a');
        a.className = 'content-card';
        a.href = 'view.php?type=' + type + '&id=' + item.id;
        a.innerHTML = '<h2>' + item.title + '</h2><p>' + (item.description || '') + '</p>';
        list.appendChild(a);
    });
}

async function initDetailPage(root) {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const id = params.get('id');
    const container = root.querySelector('[data-detail]');
    try {
<<<<<<< HEAD
        const data = await apiJSON('/api/v1/' + type + 's/' + id);
        renderDetail(container, data, type, id);
    } catch (e) { container.textContent = e.message; }
}

function renderDetail(container, data, type, id) {
    container.innerHTML = `
        <h1 class="viewer__title">${data.title}</h1>
        <p class="viewer__description">${data.description || ''}</p>
        <div class="viewer__content"></div>
    `;
    const content = container.querySelector('.viewer__content');
=======
        const data = await apiJSON(type === 'quiz' ? `/api/v1/quizzes/${encodeURIComponent(id)}` : `/api/v1/polls/${encodeURIComponent(id)}`);
        renderDetail(container, data, type, id, ownerKey);
    } catch (error) {
        showToast(error.message, 'error');
        renderMessage(container, error.message, true);
    }
}

async function renderOwnerStats(container, poll, id, ownerKey) {
    const stats = await apiJSON(`/api/v1/polls/${encodeURIComponent(id)}/stats?owner_key=${encodeURIComponent(ownerKey)}`);
    container.replaceChildren();
    
    const header = document.createElement('div');
    header.className = 'stats-header';
    const titleBlock = document.createElement('div');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'creator__eyebrow';
    eyebrow.textContent = 'Статистика владельца';
    const title = document.createElement('h1');
    title.className = 'viewer__title';
    title.textContent = poll.title;
    const desc = document.createElement('p');
    desc.className = 'viewer__description';
    desc.textContent = poll.description || 'Опрос без описания';
    titleBlock.append(eyebrow, title, desc);
    const total = document.createElement('div');
    total.className = 'metric-box';
    total.innerHTML = `<span>${stats.total_votes || 0}</span><small>голосов</small>`;
    header.append(titleBlock, total);

    const chartSection = document.createElement('section');
    chartSection.className = 'stats-chart-section';
    
    const pieChart = document.createElement('div');
    pieChart.className = 'pie-chart-large';
    pieChart.setAttribute('role', 'img');
    pieChart.setAttribute('aria-label', 'Распределение голосов');
    pieChart.append(buildPieSvg(stats.options || []));
    const pieTooltip = document.createElement('div');
    pieTooltip.className = 'chart-tooltip';
    pieTooltip.textContent = 'Наведите на сегмент';
    pieChart.append(pieTooltip);
    chartSection.append(pieChart);

    const legend = document.createElement('div');
    legend.className = 'stats-legend';
    (stats.options || []).forEach((option, index) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-item__header">
                <span class="legend-swatch" style="background:${chartColor(index)}"></span>
                <span class="legend-text">${escapeHtml(option.text)}</span>
            </div>
            <div class="legend-item__stats">
                <strong>${option.votes}</strong>
                <span class="legend-percent">${option.percent}%</span>
            </div>
            <div class="legend-bar"><div class="legend-bar__fill" style="width:${option.percent}%"></div></div>
        `;
        legend.append(item);
    });
    chartSection.append(legend);
    container.append(header, chartSection);

    if (stats.analytics) {
        const analyticsSection = document.createElement('section');
        analyticsSection.className = 'stats-analytics';
        const analyticsTitle = document.createElement('h2');
        analyticsTitle.className = 'stats-analytics__title';
        analyticsTitle.textContent = 'Аналитика';
        analyticsSection.append(analyticsTitle);
        
        const analyticsGrid = document.createElement('div');
        analyticsGrid.className = 'stats-analytics__grid';
        
        if (stats.analytics.countries) {
            analyticsGrid.append(buildAnalyticsCard('Страны', stats.analytics.countries));
        }
        if (stats.analytics.devices) {
            analyticsGrid.append(buildAnalyticsCard('Устройства', stats.analytics.devices));
        }
        if (stats.analytics.browsers) {
            analyticsGrid.append(buildAnalyticsCard('Браузеры', stats.analytics.browsers));
        }
        if (stats.analytics.sources) {
            analyticsGrid.append(buildAnalyticsCard('Источники', stats.analytics.sources));
        }
        
        analyticsSection.append(analyticsGrid);
        container.append(analyticsSection);
    }

    const meta = document.createElement('div');
    meta.className = 'stats-meta';
    meta.append(
        metric('Статус', poll.is_closed ? 'Завершен' : 'Активен'),
        metric('Анонимность', poll.is_anonymous ? 'Включена' : 'Открытая'),
        metric('Страны', (poll.allowed_countries || []).length ? (poll.allowed_countries || []).join(', ') : 'Все')
    );
    container.append(meta);
}

function buildAnalyticsCard(title, items) {
    const card = document.createElement('div');
    card.className = 'analytics-card';
    const cardTitle = document.createElement('h3');
    cardTitle.className = 'analytics-card__title';
    cardTitle.textContent = title;
    card.append(cardTitle);
    
    const list = document.createElement('div');
    list.className = 'analytics-list';
    const total = items.reduce((sum, item) => sum + item.count, 0);
    items.slice(0, 5).forEach((item, index) => {
        const percent = total > 0 ? Math.round(item.count / total * 100) : 0;
        const row = document.createElement('div');
        row.className = 'analytics-list__row';
        row.innerHTML = `
            <span class="analytics-list__name">${escapeHtml(item.name)}</span>
            <span class="analytics-list__count">${item.count} · ${percent}%</span>
        `;
        list.append(row);
    });
    card.append(list);
    return card;
}

function buildPieSvg(options) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.classList.add('pie-svg');
    const total = options.reduce((sum, option) => sum + (option.votes || 0), 0);
    if (!total) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '60');
        circle.setAttribute('cy', '60');
        circle.setAttribute('r', '48');
        circle.setAttribute('fill', '#2d2e31');
        svg.append(circle);
        return svg;
    }
    let current = -90;
    options.forEach((option, index) => {
        const start = current;
        const end = start + ((option.votes || 0) / total) * 360;
        current = end;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', piePath(60, 60, 48, start, end));
        path.setAttribute('fill', chartColor(index));
        svg.append(path);
    });
    return svg;
}

function piePath(cx, cy, r, startAngle, endAngle) {
    const start = polar(cx, cy, r, endAngle);
    const end = polar(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function polar(cx, cy, r, angle) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function chartColor(index) {
    return ['#5caf70', '#8d8d8f', '#d7d9dc', '#3a3b3d', '#92d2a2', '#bfc1c5'][index % 6];
}

function metric(label, value) {
    const item = document.createElement('div');
    item.className = 'metric-box metric-box--small';
    item.innerHTML = `<small>${escapeHtml(label)}</small><span>${escapeHtml(value)}</span>`;
    return item;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function renderCards(list, items, type) {
    list.replaceChildren();
    if (items.length === 0) {
        renderMessage(list, 'Пока ничего нет.', false);
        return;
    }
    items.forEach((item) => {
        const card = document.createElement('a');
        card.className = 'content-card';
        card.href = 'view.php?type=' + type + '&id=' + encodeURIComponent(item.id);
        const title = document.createElement('h2');
        title.textContent = item.title;
        const desc = document.createElement('p');
        desc.textContent = item.description || (type === 'quiz' ? 'Викторина' : 'Опрос');
        const meta = document.createElement('span');
        meta.textContent = type === 'quiz' ? 'Открыть викторину' : 'Открыть опрос';
        card.append(title, desc, meta);
        list.append(card);
    });
}

function renderDetail(container, data, type, id, ownerKey = '') {
    container.replaceChildren();
    const title = document.createElement('h1');
    title.className = 'viewer__title';
    title.textContent = data.title;
    const desc = document.createElement('p');
    desc.className = 'viewer__description';
    desc.textContent = data.description || '';
    container.append(title, desc);

    if (type === 'poll' && ownerKey) {
        renderOwnerStats(container, data, id, ownerKey);
        return;
    }

>>>>>>> 0a626c65f1b8fde26287197a9752a2aa76a2115a
    if (type === 'quiz') {
        renderQuizView(content, data);
    } else {
        renderPollView(content, data, id);
    }
}

function renderPollView(container, data, id) {
    const form = document.createElement('form');
    form.className = 'vote-form';
    const list = document.createElement('div');
    list.className = 'answer-list';
    
    const options = data.options || [];
    options.forEach(o => {
        const lbl = document.createElement('label');
        lbl.className = 'vote-option';
        lbl.innerHTML = '<input type="radio" name="opt" value="' + o.id + '"><span>' + o.text + '</span><span class="vote-count">' + (o.votes || 0) + '</span>';
        list.appendChild(lbl);
    });
    
    const btn = document.createElement('button');
    btn.className = 'primary-button';
    btn.textContent = 'Голосовать';
    if (options.length === 0) {
        list.innerHTML = '<p class="form-status is-error">Варианты ответов не найдены</p>';
        btn.disabled = true;
    }
    
    form.append(list, btn);
    form.onsubmit = async (e) => {
        e.preventDefault();
        const sel = form.querySelector('input:checked');
        if (!sel) return;
        const res = await apiJSON('/api/v1/polls/' + id + '/votes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ option_id: sel.value })
        });
        renderPollView(container, res, id);
    };
    container.innerHTML = '';
    container.appendChild(form);
}

function renderQuizView(container, data) {
    container.innerHTML = '<p>' + data.question + '</p><div class="answer-list"></div><button class="primary-button">Проверить</button><p class="status"></p>';
    const list = container.querySelector('.answer-list');
    data.answers.forEach((a, i) => {
        const lbl = document.createElement('label');
        lbl.className = 'vote-option';
        lbl.dataset.correct = a.is_correct;
        lbl.innerHTML = '<input type="radio" name="ans" value="' + i + '"><span>' + a.text + '</span>';
        list.appendChild(lbl);
    });
    container.querySelector('button').onclick = () => {
        const sel = container.querySelector('input:checked');
        if (!sel) return;
        const correct = sel.closest('label').dataset.correct === 'true';
        container.querySelector('.status').textContent = correct ? 'Верно!' : 'Неверно';
        container.querySelectorAll('label').forEach(l => {
            if (l.dataset.correct === 'true') l.style.color = 'green';
        });
    };
}