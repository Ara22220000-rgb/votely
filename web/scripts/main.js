
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
    const voteContent = document.getElementById('vote-content');
    const statsContent = document.getElementById('stats-content');

    if (createForm) initCreateForm(createForm);
    if (browseRoot) initBrowsePage(browseRoot);
    if (detailRoot) initDetailPage(detailRoot);
    if (voteContent) initGetPage();
    if (statsContent) initStatsPage();
});

function initCreateForm(form) {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') === 'quiz' ? 'quiz' : 'poll';
    const pollFields = form.querySelector('[data-poll-fields]');
    const quizFields = form.querySelector('[data-quiz-fields]');
    const optionsList = form.querySelector('[data-options-list]');
    const questionsList = form.querySelector('[data-questions-list]');
    const status = form.querySelector('[data-form-status]');
    const badgeEl = form.closest('.creator__panel')?.querySelector('[data-type-badge]');
    const switchLinks = document.querySelectorAll('.creator__switch-link');

    if (pollFields) pollFields.hidden = type !== 'poll';
    if (quizFields) quizFields.hidden = type !== 'quiz';

    // Обновляем активный переключатель
    switchLinks.forEach(link => {
        link.classList.remove('is-active');
        if (link.dataset.typeLink === type) {
            link.classList.add('is-active');
        }
    });
    
    // Обновляем заголовок и бейдж
    updateCreateTitle(badgeEl, type);

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
            const ownerKey = result.owner_key || '';
            if (id) {
                // Сохраняем owner_key в localStorage для будущего доступа
                if (ownerKey) {
                    localStorage.setItem('poll_owner_key_' + id, ownerKey);
                }
                // Перенаправляем на get.php с флагом создателя
                window.location.href = 'get.php?id=' + id + '&type=' + type + '&creator=1';
            }
        } catch (err) {
            setStatus(status, err.message, 'error');
        } finally { btn.disabled = false; }
    });
}

function updateCreateTitle(badgeEl, type) {
    const isQuiz = type === 'quiz';
    const icon = isQuiz ? '🧠' : '📊';
    const text = isQuiz ? 'Создание викторины' : 'Создание опроса';
    const titleEl = document.querySelector('#creator-title');
    
    if (titleEl) {
        titleEl.innerHTML = `<span class="type-icon">${icon}</span><span class="type-text">${isQuiz ? 'Создать викторину' : 'Создать опрос'}</span>`;
    }
    
    if (badgeEl) {
        badgeEl.innerHTML = `<span class="badge-icon">${icon}</span><span class="badge-text">${text}</span>`;
        badgeEl.className = 'creator-type-badge ' + (isQuiz ? 'is-quiz' : 'is-poll');
    }
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
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') === 'quiz' ? 'quiz' : 'poll';
    const query = params.get('q') || '';
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
    
    // Заполняем поле поиска
    const searchInput = document.querySelector('.search-form input[name="q"]');
    if (searchInput) {
        searchInput.value = query;
    }
    
    // Если есть поиск, показываем это в бейдже
    if (query) {
        updateSearchBadge(badgeEl, query, type);
    }
    
    try {
        // Исправляем множественное число: quiz -> quizzes, poll -> polls
        const plural = type === 'quiz' ? 'quizzes' : 'polls';
        const url = '/api/v1/' + plural + (query ? '?q=' + encodeURIComponent(query) : '');
        const data = await apiJSON(url);
        renderCards(list, data.items || [], type, query);
    } catch (e) {
        console.error('Ошибка загрузки:', e);
        list.textContent = e.message;
    }
}
    
function updateSearchBadge(badgeEl, query, type) {
    if (!badgeEl) return;
    const isQuiz = type === 'quiz';
    const icon = isQuiz ? '🧠' : '📊';
    badgeEl.innerHTML = `<span class="badge-icon">${icon}</span><span class="badge-text">Поиск: "${escapeHtml(query)}"</span>`;
    badgeEl.className = 'browse-type-badge is-search';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    
    // Обновляем форму поиска
    updateSearchForm(type);
}

function updateSearchForm(type) {
    const searchForm = document.querySelector('.search-form');
    const typeInput = searchForm?.querySelector('input[name="type"]');
    const searchInput = searchForm?.querySelector('input[name="q"]');
    
    if (typeInput) {
        typeInput.value = type;
    }
    
    if (searchInput) {
        searchInput.placeholder = type === 'quiz' ? 'Поиск викторин...' : 'Поиск опросов...';
    }
}

function renderCards(list, items, type, query = '') {
    if (!list) return;
    list.innerHTML = '';
    if (!items || !Array.isArray(items)) {
        list.textContent = 'Нет данных';
        return;
    }
    
    const isQuiz = type === 'quiz';
    const icon = isQuiz ? '🧠' : '📊';
    const typeLabel = isQuiz ? 'Викторина' : 'Опрос';
    
    if (items.length === 0) {
        list.innerHTML = `
            <div class="viewer-empty">
                <div class="viewer-empty-icon">🔍</div>
                <p>Ничего не найдено по запросу "${escapeHtml(query)}"</p>
            </div>
        `;
        return;
    }
    
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
    
    // Проверяем, голосовал ли этот пользователь (localStorage)
    const hasVoted = localStorage.getItem('voted_poll_' + id);
    
    if (hasVoted) {
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
                // Собираем UTM-метки из URL
                const params = new URLSearchParams(window.location.search);
                let utmSource = params.get('utm_source') || '';
                const utmMedium = params.get('utm_medium') || '';
                
                // Если нет utm_source, определяем по Referer заголовку
                if (!utmSource) {
                    const referrer = document.referrer || '';
                    
                    // Проверяем домен в Referer
                    if (referrer) {
                        try {
                            const refUrl = new URL(referrer);
                            const host = refUrl.hostname.toLowerCase();
                            
                            // Социальные сети и платформы
                            if (host.includes('t.me') || host.includes('telegram.org') || host.includes('telegram.me')) {
                                utmSource = 'telegram';
                            } else if (host.includes('vk.com') || host.includes('vkontakte.ru')) {
                                utmSource = 'vk';
                            } else if (host.includes('ok.ru') || host.includes('odnoklassniki')) {
                                utmSource = 'ok';
                            } else if (host.includes('twitter.com') || host.includes('x.com') || host.includes('twit')) {
                                utmSource = 'twitter';
                            } else if (host.includes('facebook.com') || host.includes('fb.com') || host.includes('m.facebook')) {
                                utmSource = 'facebook';
                            } else if (host.includes('instagram.com') || host.includes('instagr.am')) {
                                utmSource = 'instagram';
                            } else if (host.includes('tiktok.com') || host.includes('tiktokcdn')) {
                                utmSource = 'tiktok';
                            } else if (host.includes('youtube.com') || host.includes('youtu.be') || host.includes('youtube-nocookie')) {
                                utmSource = 'youtube';
                            } else if (host.includes('reddit.com') || host.includes('redd.it')) {
                                utmSource = 'reddit';
                            } else if (host.includes('linkedin.com') || host.includes('lnkd.in')) {
                                utmSource = 'linkedin';
                            } else if (host.includes('pinterest.com') || host.includes('pin.it')) {
                                utmSource = 'pinterest';
                            } else if (host.includes('snapchat.com') || host.includes('sc-snap')) {
                                utmSource = 'snapchat';
                            } else if (host.includes('discord.com') || host.includes('discordapp')) {
                                utmSource = 'discord';
                            } else if (host.includes('whatsapp.com') || host.includes('wa.me')) {
                                utmSource = 'whatsapp';
                            } else if (host.includes('google.') || host.includes('googleusercontent') || host.includes('g.co')) {
                                utmSource = 'google';
                            } else if (host.includes('yandex.') || host.includes('ya.ru')) {
                                utmSource = 'yandex';
                            } else if (host.includes('bing.com') || host.includes('msn.com')) {
                                utmSource = 'bing';
                            } else if (host.includes('duckduckgo.com')) {
                                utmSource = 'duckduckgo';
                            } else if (host.includes('mail.ru') || host.includes('mailru')) {
                                utmSource = 'mailru';
                            } else {
                                utmSource = 'website';
                            }
                        } catch (err) {
                            utmSource = 'direct';
                        }
                    } else {
                        utmSource = 'direct';
                    }
                }
                
                const res = await apiJSON('/api/v1/polls/' + id + '/votes' + window.location.search, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        option_id: sel.value,
                        utm_source: utmSource,
                        utm_medium: utmMedium
                    })
                });
                // Запоминаем, что пользователь проголосовал
                localStorage.setItem('voted_poll_' + id, sel.value);
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

// Инициализация страницы голосования по уникальной ссылке
function initGetPage() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const type = params.get('type') === 'quiz' ? 'quiz' : 'poll';
    const content = document.getElementById('vote-content');
    const titleEl = document.getElementById('vote-title');
    const shareSection = document.getElementById('share-section');
    const shareUrlInput = document.getElementById('share-url');
    const copyBtn = document.getElementById('copy-link-btn');
    
    if (!id) {
        content.innerHTML = `
            <div class="viewer-empty">
                <div class="viewer-empty-icon">❌</div>
                <p>Неверная ссылка</p>
                <p style="margin-top: 12px; font-size: 16px; color: #6b6e73;">
                    Проверьте URL или создайте новый опрос
                </p>
                <a href="create.php?type=${type}" class="primary-button" style="margin-top: 20px; display: inline-flex;">
                    Создать опрос
                </a>
            </div>
        `;
        if (titleEl) titleEl.textContent = 'Ошибка';
        return;
    }
    
    // Загружаем данные опроса/викторины
    loadVoteData(id, type, content, titleEl);
    
    // Показываем секцию поделиться только для создателя
    const isCreator = params.get('creator') === '1';
    const storedOwnerKey = localStorage.getItem('poll_owner_key_' + id);
    
    if (isCreator || storedOwnerKey) {
        const baseUrl = window.location.href.split('?')[0];
        const shareUrl = `${baseUrl}?id=${id}&type=${type}`;
        shareUrlInput.value = shareUrl;
        shareSection.hidden = false;
        
        // Используем сохранённый ключ или генерируем новый
        const ownerKey = storedOwnerKey || btoa('owner-' + id + '-secret').replace(/=/g, '');
        const statsUrl = `stats.php?id=${id}&key=${ownerKey}`;
        
        const statsBtn = document.getElementById('stats-link-btn');
        if (statsBtn) {
            statsBtn.href = statsUrl;
        }
        
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                shareUrlInput.select();
                document.execCommand('copy');
                copyBtn.innerHTML = '<span class="copy-icon">✅</span> Скопировано!';
                setTimeout(() => {
                    copyBtn.innerHTML = '<span class="copy-icon">📋</span> Копировать';
                }, 2000);
            });
        }
    }
}

async function loadVoteData(id, type, content, titleEl) {
    try {
        const plural = type === 'quiz' ? 'quizzes' : 'polls';
        const data = await apiJSON('/api/v1/' + plural + '/' + id);
        
        if (!data || !data.id) {
            throw new Error('Не найдено');
        }
        
        if (titleEl) {
            titleEl.innerHTML = `
                <span class="type-icon">${type === 'quiz' ? '🧠' : '📊'}</span>
                <span class="type-text">${data.title || 'Без названия'}</span>
            `;
        }
        
        if (type === 'quiz') {
            renderQuizView(content, data);
        } else {
            renderPollView(content, data, id);
        }
    } catch (e) {
        console.error('Ошибка загрузки:', e);
        content.innerHTML = `
            <div class="viewer-empty">
                <div class="viewer-empty-icon">❌</div>
                <p>Опрос не найден или удалён</p>
                <a href="create.php?type=${type}" class="primary-button" style="margin-top: 20px; display: inline-flex;">
                    Создать новый
                </a>
            </div>
        `;
        if (titleEl) titleEl.textContent = 'Не найдено';
    }
}

// Инициализация страницы статистики
function initStatsPage() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const ownerKey = params.get('key');
    const content = document.getElementById('stats-content');
    const titleEl = document.getElementById('stats-title');
    
    if (!id || !ownerKey) {
        content.innerHTML = `
            <div class="viewer-empty">
                <div class="viewer-empty-icon">❌</div>
                <p>Неверная ссылка</p>
                <p style="margin-top: 12px; font-size: 16px; color: #6b6e73;">
                    Проверьте URL или обратитесь к создателю опроса
                </p>
                <a href="create.php?type=poll" class="primary-button" style="margin-top: 20px; display: inline-flex;">
                    Создать опрос
                </a>
            </div>
        `;
        if (titleEl) titleEl.textContent = 'Ошибка';
        return;
    }
    
    loadStats(id, ownerKey, content, titleEl);
}

async function loadStats(id, ownerKey, content, titleEl) {
    try {
        const data = await apiJSON('/api/v1/polls/' + id + '/stats?owner_key=' + encodeURIComponent(ownerKey));
        
        if (!data || !data.poll) {
            throw new Error('Нет доступа');
        }
        
        const poll = data.poll;
        titleEl.innerHTML = `
            <span class="type-icon">📊</span>
            <span class="type-text">${escapeHtml(poll.title || 'Опрос')}</span>
        `;
        
        renderStats(content, data);
    } catch (e) {
        console.error('Ошибка загрузки статистики:', e);
        content.innerHTML = `
            <div class="viewer-empty">
                <div class="viewer-empty-icon">❌</div>
                <p>Нет доступа к статистике</p>
                <p style="margin-top: 12px; font-size: 16px; color: #6b6e73;">
                    ${escapeHtml(e.message)}
                </p>
            </div>
        `;
        if (titleEl) titleEl.textContent = 'Ошибка';
    }
}

function renderStats(content, data) {
    const { poll, options, total_votes, analytics } = data;
    
    let html = `
        <div class="stats-overview">
            <div class="metric-card metric-card--total">
                <div class="metric-card__icon">🗳️</div>
                <div class="metric-card__value">${total_votes.toLocaleString()}</div>
                <div class="metric-card__label">Всего голосов</div>
            </div>
        </div>
        
        <div class="stats-section">
            <h2 class="stats-section__title">📋 Результаты опроса</h2>
            <div class="poll-results">
    `;
    
    options.forEach(opt => {
        html += `
            <div class="result-option">
                <div class="result-bar" style="width: ${opt.percent}%"></div>
                <div class="result-content">
                    <span>${escapeHtml(opt.text)}</span>
                    <span class="result-votes">${opt.votes} гол.</span>
                    <span class="result-percent">${opt.percent}%</span>
                </div>
            </div>
        `;
    });
    
    html += `</div></div>`;
    
    // Analytics sections with Pie Charts
    if (analytics) {
        // Browsers
        if (analytics.browsers && analytics.browsers.length > 0) {
            html += renderPieChartSection('🌐 Браузеры', analytics.browsers, 'browser');
        }
        
        // OS
        if (analytics.os && analytics.os.length > 0) {
            html += renderPieChartSection('💻 Операционные системы', analytics.os, 'os');
        }
        
        // Devices
        if (analytics.devices && analytics.devices.length > 0) {
            html += renderPieChartSection('📱 Устройства', analytics.devices, 'device');
        }
        
        // Locations
        if (analytics.locations && analytics.locations.length > 0) {
            html += renderPieChartSection('🌍 География', analytics.locations, 'location');
        }
    }
        
    content.innerHTML = html;
}

function renderPieChartSection(title, items, type) {
    const total = items.reduce((sum, item) => sum + parseInt(item.count), 0);
    const colors = ['#5caf70', '#8a5caf', '#5c9caf', '#cf5caf', '#cfa55c', '#5ccf8a', '#cf5c8a', '#5ccfdd'];
    
    // Генерируем SVG pie chart
    let svgPaths = '';
    let cumulativePercent = 0;
    
    items.forEach((item, index) => {
        const count = parseInt(item.count);
        const percent = total > 0 ? (count / total * 100) : 0;
        const startPercent = cumulativePercent;
        cumulativePercent += percent;
        
        const startAngle = (startPercent / 100) * 360;
        const endAngle = (cumulativePercent / 100) * 360;
        
        svgPaths += createPieSlice(startAngle, endAngle, colors[index % colors.length], index);
    });
    
    let html = `
        <div class="stats-section">
            <h2 class="stats-section__title">${title}</h2>
            <div class="pie-chart-container">
                <div class="pie-chart-wrapper">
                    <svg class="pie-chart-svg" viewBox="0 0 100 100">
                        ${svgPaths}
                    </svg>
                    <div class="pie-chart-center">
                        <div class="pie-chart-center__total">${total}</div>
                        <div class="pie-chart-center__label">голосов</div>
                    </div>
                </div>
                <div class="pie-legend">
    `;
    
    items.forEach((item, index) => {
        const count = parseInt(item.count);
        const percent = total > 0 ? Math.round(count / total * 100) : 0;
        const icon = getItemIcon(item.name, type);
        
        html += `
            <div class="pie-legend-item">
                <div class="pie-legend-color" style="background: ${colors[index % colors.length]}"></div>
                <span class="pie-legend-icon">${icon}</span>
                <div class="pie-legend-content">
                    <div class="pie-legend-name">${escapeHtml(item.name)}</div>
                    <div class="pie-legend-stats">
                        <span class="pie-legend-count">${count.toLocaleString()}</span>
                        <span class="pie-legend-percent">${percent}%</span>
                    </div>
                    <div class="pie-legend-bar">
                        <div class="pie-legend-bar-fill" style="width: ${percent}%; background: ${colors[index % colors.length]}"></div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div></div></div>`;
    return html;
}

function createPieSlice(startAngle, endAngle, color, index) {
    // Обработка случая 100% (полный круг)
    if (endAngle - startAngle >= 359.99) {
        // Рисуем полный круг
        return `<circle cx="50" cy="50" r="40" fill="${color}" stroke="#1a1c1e" stroke-width="1"/>`;
    }
    
    const x1 = 50 + 40 * Math.cos(Math.PI * startAngle / 180);
    const y1 = 50 + 40 * Math.sin(Math.PI * startAngle / 180);
    const x2 = 50 + 40 * Math.cos(Math.PI * endAngle / 180);
    const y2 = 50 + 40 * Math.sin(Math.PI * endAngle / 180);
    
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    
    return `<path d="M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${color}" stroke="#1a1c1e" stroke-width="1"/>`;
}

function getItemIcon(name, type) {
    if (type === 'browser') {
        const icons = { 
            'Chrome': '🌐', 
            'Firefox': '🦊', 
            'Safari': '🧭', 
            'Edge': '🌀', 
            'Opera': '🔴',
            'Samsung Internet': '📱',
            'Yandex': '🔴',
            'Other': '❓'
        };
        return icons[name] || '🌐';
    }
    
    if (type === 'os') {
        const icons = { 'Windows': '🪟', 'macOS': '🍎', 'Linux': '🐧', 'Android': '🤖', 'iOS': '📱', 'Other': '❓' };
        return icons[name] || '💻';
    }
    
    if (type === 'device') {
        const icons = { 'desktop': '🖥️', 'mobile': '📱', 'tablet': '📟', 'unknown': '❓' };
        return icons[name.toLowerCase()] || '🖥️';
    }
    
    if (type === 'location') {
        const countryIcons = {
            'RU': '🇷🇺', 'US': '🇺🇸', 'GB': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷',
            'ES': '🇪🇸', 'IT': '🇮🇹', 'CN': '🇨🇳', 'JP': '🇯🇵', 'KR': '🇰🇷',
            'IN': '🇮🇳', 'BR': '🇧🇷', 'CA': '🇨🇦', 'AU': '🇦🇺', 'UA': '🇺🇦',
            'BY': '🇧🇾', 'KZ': '🇰🇿', 'UZ': '🇺🇿', 'TR': '🇹🇷', 'PL': '🇵🇱'
        };
        const code = name.toUpperCase().trim();
        if (countryIcons[code]) return countryIcons[code];
        if (code.length === 2) return '🌍';
        return '🌐';
    }
    
    return '📊';
}

// Копирование ссылки для get.php
function copyShareUrl(source) {
    const shareUrlInput = document.getElementById('share-url');
    if (!shareUrlInput) return;
    
    const baseUrl = shareUrlInput.value.split('?')[0];
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const type = params.get('type') || 'poll';
    
    const shareUrl = `${baseUrl}?id=${id}&type=${type}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
        const btn = event.target.closest('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Скопировано!';
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 2000);
    }).catch(() => {
        showToast('Не удалось скопировать', 'error');
    });
}
