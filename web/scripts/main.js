
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
        throw e;
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
    const titleEl = root.querySelector('[data-browse-title]');
    const badgeEl = root.querySelector('[data-type-badge]');
    const switchLinks = root.querySelectorAll('.creator__switch-link');
    
    if (!list) {
        console.error('Не найден элемент [data-list]');
        return;
    }
    
    // Обновляем активный переключатель
    switchLinks.forEach(link => {
        link.classList.remove('is-active');
        if (link.dataset.typeLink === type) {
            link.classList.add('is-active');
        }
    });
    
    // Обновляем заголовок и бейдж
    updateBrowseTitle(titleEl, badgeEl, type);
    
    try {
        // Исправляем множественное число: quiz -> quizzes, poll -> polls
        const plural = type === 'quiz' ? 'quizzes' : 'polls';
        const data = await apiJSON('/api/v1/' + plural);
        renderCards(list, data.items || [], type);
    } catch (e) {
        console.error('Ошибка загрузки:', e);
        list.textContent = e.message;
    }
}

function updateBrowseTitle(titleEl, badgeEl, type) {
    const isQuiz = type === 'quiz';
    const icon = isQuiz ? '🧠' : '📊';
    const text = isQuiz ? 'Викторины' : 'Опросы';
    const badgeText = isQuiz ? 'Показаны викторины' : 'Показаны опросы';
    
    if (titleEl) {
        titleEl.innerHTML = `<span class="type-icon">${icon}</span><span class="type-text">${text}</span>`;
    }
    
    if (badgeEl) {
        badgeEl.innerHTML = `<span class="badge-icon">${icon}</span><span class="badge-text">${badgeText}</span>`;
        badgeEl.className = 'browse-type-badge ' + (isQuiz ? 'is-quiz' : 'is-poll');
    }
}

function renderCards(list, items, type) {
    if (!list) return;
    list.innerHTML = '';
    if (!items || !Array.isArray(items)) {
        list.textContent = 'Нет данных';
        return;
    }
    
    const isQuiz = type === 'quiz';
    const icon = isQuiz ? '🧠' : '📊';
    const typeLabel = isQuiz ? 'Викторина' : 'Опрос';
    
    items.forEach(item => {
        const a = document.createElement('a');
        a.className = 'content-card';
        a.href = 'view.php?type=' + type + '&id=' + item.id;
        a.dataset.type = type;
        a.innerHTML = `
            <div class="card-type-badge">${icon} ${typeLabel}</div>
            <h2>${item.title || ''}</h2>
            <p>${item.description || ''}</p>
        `;
        list.appendChild(a);
    });
}
    
async function initDetailPage(root) {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const id = params.get('id');
    const container = root.querySelector('[data-detail]');
    if (!type || !id) {
        container.textContent = 'Не указан тип или ID';
        return;
    }
    try {
        // Исправляем множественное число: quiz -> quizzes, poll -> polls
        const plural = type === 'quiz' ? 'quizzes' : 'polls';
        const url = '/api/v1/' + plural + '/' + id;
        const data = await apiJSON(url);
        renderDetail(container, data, type, id);
    } catch (e) {
        console.error('initDetailPage error:', e);
        container.textContent = e.message;
    }
}
    
function renderDetail(container, data, type, id) {
    console.log('renderDetail:', { data, type, id });
    if (!data) {
        container.textContent = 'Нет данных';
        return;
    }
    container.innerHTML = `
        <h1 class="viewer__title">${data.title || ''}</h1>
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
    const options = data.options || [];
    
    if (options.length === 0) {
        container.innerHTML = '<div class="viewer-empty"><div class="viewer-empty-icon">📊</div><p>Варианты ответов не найдены</p></div>';
        return;
    }
    
    // Проверяем, есть ли уже голоса (значит показываем результаты)
    const hasVotes = options.some(o => (o.votes || 0) > 0);
    
    if (hasVotes) {
        // Показываем результаты
        const totalVotes = options.reduce((sum, o) => sum + (o.votes || 0), 0);
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'poll-results';
        
        options.forEach(o => {
            const votes = o.votes || 0;
            const percent = totalVotes > 0 ? Math.round(votes / totalVotes * 100) : 0;
            
            const optionDiv = document.createElement('div');
            optionDiv.className = 'result-option';
            optionDiv.innerHTML = `
                <div class="result-bar" style="width: ${percent}%"></div>
                <div class="result-content">
                    <span>${o.text}</span>
                    <span class="result-votes">${votes} гол.</span>
                    <span class="result-percent">${percent}%</span>
                </div>
            `;
            resultsDiv.appendChild(optionDiv);
        });
        
        container.innerHTML = '';
        container.appendChild(resultsDiv);
    } else {
        // Показываем форму для голосования
        const form = document.createElement('form');
        form.className = 'poll-view';
        
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'poll-options';
        
        options.forEach(o => {
            const lbl = document.createElement('label');
            lbl.className = 'poll-option';
            lbl.innerHTML = `
                <input type="radio" name="opt" value="${o.id}">
                <span>${o.text}</span>
            `;
            optionsDiv.appendChild(lbl);
        });
        
        const btn = document.createElement('button');
        btn.className = 'poll-vote-btn';
        btn.type = 'submit';
        btn.textContent = 'Голосовать';
        
        form.append(optionsDiv, btn);
        
        form.onsubmit = async (e) => {
            e.preventDefault();
            const sel = form.querySelector('input:checked');
            if (!sel) {
                showToast('Выберите вариант ответа', 'error');
                return;
            }
            btn.disabled = true;
            btn.textContent = 'Отправка...';
            try {
                const res = await apiJSON('/api/v1/polls/' + id + '/votes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ option_id: sel.value })
                });
                renderPollView(container, res, id);
            } catch (err) {
                showToast(err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Голосовать';
            }
        };
        
        container.innerHTML = '';
        container.appendChild(form);
    }
}

function renderQuizView(container, data) {
    const quizDiv = document.createElement('div');
    quizDiv.className = 'quiz-view';
    
    // Вопрос
    const questionDiv = document.createElement('div');
    questionDiv.className = 'quiz-question-text';
    questionDiv.textContent = data.question || 'Вопрос викторины';
    
    // Ответы
    const answersDiv = document.createElement('div');
    answersDiv.className = 'quiz-answers';
    const answers = data.answers || [];
    
    answers.forEach((a, i) => {
        const lbl = document.createElement('label');
        lbl.className = 'quiz-answer-option';
        lbl.dataset.correct = a.is_correct;
        lbl.innerHTML = `
            <input type="radio" name="ans" value="${i}">
            <span>${a.text}</span>
        `;
        answersDiv.appendChild(lbl);
    });
    
    // Кнопка
    const btn = document.createElement('button');
    btn.className = 'primary-button';
    btn.textContent = 'Проверить';
    btn.style.marginTop = '12px';
    
    // Feedback
    const feedback = document.createElement('div');
    feedback.className = 'quiz-feedback';
    feedback.style.display = 'none';
    
    quizDiv.append(questionDiv, answersDiv, btn, feedback);
    
    btn.onclick = () => {
        const sel = quizDiv.querySelector('input:checked');
        if (!sel) {
            showToast('Выберите вариант ответа', 'error');
            return;
        }
        
        const selectedLabel = sel.closest('.quiz-answer-option');
        const isCorrect = selectedLabel.dataset.correct === 'true';
        
        // Показываем результат
        feedback.style.display = 'block';
        feedback.className = 'quiz-feedback ' + (isCorrect ? 'quiz-feedback--correct' : 'quiz-feedback--wrong');
        feedback.textContent = isCorrect ? '✅ Верно!' : '❌ Неверно';
        
        // Подсвечиваем варианты
        quizDiv.querySelectorAll('.quiz-answer-option').forEach(l => {
            const input = l.querySelector('input');
            input.disabled = true;
            
            if (l.dataset.correct === 'true') {
                l.classList.add('is-correct');
            }
            if (l === selectedLabel && !isCorrect) {
                l.classList.add('is-wrong');
            }
        });
        
        btn.disabled = true;
        btn.textContent = 'Готово';
    };
    
    container.innerHTML = '';
    container.appendChild(quizDiv);
}