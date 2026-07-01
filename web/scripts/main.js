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
    const text = await response.text();
    
    if (!text) {
        console.error('Пустой ответ от API:', url, 'Status:', response.status);
        throw new Error('Сервер не ответил. Попробуйте позже.');
    }
    
    // Проверяем, начинается ли ответ с '<' (HTML)
    if (text.trim().startsWith('<')) {
        console.error('API вернул HTML вместо JSON:', text.substring(0, 500));
        throw new Error('Сервер вернул некорректный ответ. Попробуйте позже.');
    }
    
    try {
        const data = JSON.parse(text);
        if (!response.ok) throw new Error(data.message || 'Ошибка запроса');
        return data;
    } catch (e) {
        console.error('Ошибка парсинга JSON:', e.message, 'Ответ:', text.substring(0, 200));
        throw new Error('Некорректный ответ сервера');
    }
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
    
    if (options.length === 0) {
        list.innerHTML = '<p class="form-status is-error">Варианты ответов не найдены</p>';
        const btn = document.createElement('button');
        btn.className = 'primary-button';
        btn.textContent = 'Голосовать';
        btn.disabled = true;
        form.append(list, btn);
        container.innerHTML = '';
        container.appendChild(form);
        return;
    }
    
    options.forEach(o => {
        const lbl = document.createElement('label');
        lbl.className = 'vote-option';
        lbl.innerHTML = '<input type="radio" name="opt" value="' + o.id + '"><span>' + o.text + '</span><span class="vote-count">' + (o.votes || 0) + '</span>';
        list.appendChild(lbl);
    });
    
    const btn = document.createElement('button');
    btn.className = 'primary-button';
    btn.textContent = 'Голосовать';
    
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
    container.innerHTML = '<p>' + (data.question || '') + '</p><div class="answer-list"></div><button class="primary-button">Проверить</button><p class="status"></p>';
    const list = container.querySelector('.answer-list');
    const answers = data.answers || [];
    answers.forEach((a, i) => {
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