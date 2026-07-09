document.querySelectorAll('[data-dropdown]').forEach((dropdown) => {
    const trigger = dropdown.querySelector('.dropdown__trigger');
    const setExpanded = (expanded) => trigger?.setAttribute('aria-expanded', String(expanded));
    dropdown.addEventListener('mouseenter', () => setExpanded(true));
    dropdown.addEventListener('mouseleave', () => setExpanded(false));
    trigger?.addEventListener('click', () => {
        const expanded = trigger.getAttribute('aria-expanded') === 'true';
        setExpanded(!expanded);
        dropdown.classList.toggle('is-open', !expanded);
    });
});

let authState = { authenticated: false, user: null };
let authReady = Promise.resolve(authState);

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
    window.setTimeout(() => toast.classList.add('is-leaving'), 3600);
    window.setTimeout(() => toast.remove(), 4200);
}

async function apiJSON(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'include',
        mode: 'cors',
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        }
    });
    
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Ошибка запроса (' + response.status + ')');
    }
    
    // Для ответов 204 No Content
    if (response.status === 204) {
        return {};
    }
    
    const data = await response.json().catch(() => ({}));
    return data;
}

function setStatus(el, msg, kind) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'form-status ' + (kind ? 'is-' + kind : '');
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function userDisplayName(user) {
    // Для email-пользователей first_name — это часть email до @
    // (устанавливается бэкендом в GetOrCreateEmailUser).
    // Для Telegram-пользователей — это имя из Telegram.
    return user?.first_name || user?.username || 'Пользователь';
}





function userAvatar(user) {
    const initial = userDisplayName(user).slice(0, 1).toUpperCase() || 'U';
    const photo = user?.photo_url || localStorage.getItem('votely:last-avatar') || '';
    if (photo) {
        return `<img class="auth-profile__avatar" src="${escapeHtml(photo)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="auth-profile__avatar auth-profile__avatar--fallback" hidden>${escapeHtml(initial)}</span>`;
    }
    return `<span class="auth-profile__avatar auth-profile__avatar--fallback">${escapeHtml(initial)}</span>`;
}

function persistLastAuthUser(user) {
    if (!user) return;
    const photo = user.photo_url || '';
    // В проекте нет входа через Telegram: запоминаем только имя/почту (first_name).
    const name = user.first_name || '';
    if (photo) localStorage.setItem('votely:last-avatar', photo);
    if (name) localStorage.setItem('votely:last-name', name);
}


function lastAuthAvatar() {
    const photo = localStorage.getItem('votely:last-avatar') || '';
    const name = localStorage.getItem('votely:last-name') || '';
    if (photo) {
        return `<img class="auth-login-button__avatar" src="${escapeHtml(photo)}" alt="">`;
    }
    if (name) {
        return `<span class="auth-login-button__avatar auth-profile__avatar--fallback">${escapeHtml(name.slice(0, 1).toUpperCase())}</span>`;
    }
    return '';
}

function initEmailAuthUI() {
    // Email auth UI
    const loginBtn = document.querySelector('[data-auth-action="login"]');
    if (!loginBtn) return;

    // Create modal once
    if (!document.querySelector('[data-email-auth-modal]')) {
        const modal = document.createElement('div');
        modal.className = 'email-auth-modal';
        modal.dataset.emailAuthModal = '';
        modal.hidden = true;
        modal.innerHTML = `
            <div class="email-auth-modal__overlay" data-email-auth-close></div>
            <div class="email-auth-modal__panel" role="dialog" aria-modal="true">
                <div class="email-auth-modal__header">
                    <h2>Вход по почте</h2>
                    <button type="button" class="email-auth-modal__x" data-email-auth-close aria-label="Закрыть">×</button>
                </div>

                <div class="email-auth-modal__body">
                    <div class="email-step" data-email-step="request">
                        <label>Введите email</label>
                        <input class="field__control" type="email" name="email" placeholder="name@example.com" autocomplete="email">
                        <p class="form-status form-status--muted" data-email-status></p>
                        <button class="primary-button" type="button" data-email-request>Получить код</button>
                    </div>

                    <div class="email-step" data-email-step="verify" hidden>
                        <label>Введите 6-значный код</label>
                        <input class="field__control" inputmode="numeric" pattern="\\d{6}" type="text" name="code" placeholder="000000" maxlength="6" autocomplete="one-time-code">
                        <p class="form-status form-status--muted" data-email-status></p>
                        <div class="stack" style="gap:10px">
                            <button class="primary-button" type="button" data-email-verify>Войти</button>
                            <button class="secondary-button" type="button" data-email-resend>Запросить код снова</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.append(modal);

        // Close
        modal.querySelectorAll('[data-email-auth-close]').forEach((btn) => {
            btn.addEventListener('click', () => {
                modal.hidden = true;
                if (resendTimer) { clearInterval(resendTimer); resendTimer = null; }
                if (resendBtn) { resendBtn.disabled = false; resendBtn.textContent = 'Запросить код снова'; }
            });
        });
    }

    const modal = document.querySelector('[data-email-auth-modal]');
    const emailInput = modal.querySelector('input[name="email"]');
    const codeInput = modal.querySelector('input[name="code"]');
    const statusEls = modal.querySelectorAll('[data-email-status]');

    let lastEmail = '';
    let resendTimer = null;

    function setStatus(msg, kind) {
        statusEls.forEach((el) => {
            el.textContent = msg || '';
            el.className = 'form-status form-status--muted ' + (kind ? 'is-' + kind : '');
        });
    }

    function setStep(step) {
        modal.querySelectorAll('[data-email-step]').forEach((el) => {
            el.hidden = el.dataset.emailStep !== step;
        });
    }

    loginBtn.addEventListener('click', () => {
        console.log('[email-auth] login button clicked');
        lastEmail = '';
        if (emailInput) emailInput.value = '';
        if (codeInput) codeInput.value = '';
        setStatus('', '');
        setStep('request');
        if (resendTimer) { clearInterval(resendTimer); resendTimer = null; }
        if (resendBtn) { resendBtn.disabled = false; resendBtn.textContent = 'Запросить код снова'; }
        modal.hidden = false;
        emailInput?.focus();
    });


    const requestBtn = modal.querySelector('[data-email-request]');
    const resendBtn = modal.querySelector('[data-email-resend]');
    const verifyBtn = modal.querySelector('[data-email-verify]');

    function startResendTimer() {
        if (resendTimer) clearInterval(resendTimer);
        if (!resendBtn) return;

        let seconds = 60;
        resendBtn.disabled = true;
        resendBtn.textContent = `Отправить код можно через ${seconds}с`;

        resendTimer = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                clearInterval(resendTimer);
                resendBtn.disabled = false;
                resendBtn.textContent = 'Запросить код снова';
            } else {
                resendBtn.textContent = `Отправить код можно через ${seconds}с`;
            }
        }, 1000);
    }

    async function requestCode() {
        const email = (emailInput?.value || '').trim();
        lastEmail = email;
        if (!email) {
            setStatus('Введите email', 'error');
            return;
        }
        setStatus('Отправка...', '');
        requestBtn && (requestBtn.disabled = true);
        resendBtn && (resendBtn.disabled = true);
        try {
            await apiJSON('/api/v1/auth/email/request', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
            setStatus('Код отправлен на почту', 'success');
            setStep('verify');
            verifyBtn && (verifyBtn.disabled = false);
            codeInput?.focus();
            startResendTimer();
        } catch (err) {
            setStatus(err.message || 'Ошибка', 'error');
            resendBtn && (resendBtn.disabled = false);
            if (resendTimer) { clearInterval(resendTimer); resendTimer = null; }
            if (resendBtn) resendBtn.textContent = 'Запросить код снова';
        } finally {
            requestBtn && (requestBtn.disabled = false);
        }
    }

    async function verifyCode() {
        const code = (codeInput?.value || '').trim();
        if (!code) {
            setStatus('Введите код', 'error');
            return;
        }
        setStatus('Проверка...', '');
        verifyBtn && (verifyBtn.disabled = true);
        try {
            await apiJSON('/api/v1/auth/email/verify', {
                method: 'POST',
                body: JSON.stringify({ email: lastEmail, code })
            });
            // После успешного логина обновим состояние
            await checkAuthStatus();
            modal.hidden = true;
            showToast('Вы вошли', 'success');
        } catch (err) {
            setStatus(err.message || 'Ошибка', 'error');
        } finally {
            verifyBtn && (verifyBtn.disabled = false);
        }
    }

    requestBtn?.addEventListener('click', requestCode);
    resendBtn?.addEventListener('click', requestCode);
    verifyBtn?.addEventListener('click', verifyCode);
}

// Keep function call for compatibility.
// initEmailAuthUI() is now called inside renderAuthControls() to avoid duplicate event listeners.


function initLogoutUI() {
    document.querySelectorAll('[data-auth-logout]').forEach((button) => {
        if (button.dataset.logoutBound === '1') return;
        button.dataset.logoutBound = '1';
        button.addEventListener('click', async () => {
            await apiJSON('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
            localStorage.removeItem('votely:last-avatar');
            localStorage.removeItem('votely:last-name');
            authState = { authenticated: false, user: null, isAdmin: false };
            authReady = Promise.resolve(authState);
            renderAuthControls();
            showToast('Вы вышли', 'success');
        });
    });
}

function renderAuthControls() {
    document.querySelectorAll('.nav__right').forEach((root) => {
        if (authState.authenticated) {
            root.innerHTML = `
                <div class="auth-profile dropdown dropdown--right is-auth" data-auth-profile>
                    <button class="auth-profile__trigger dropdown__trigger" type="button" aria-haspopup="true" aria-expanded="false">
                        ${userAvatar(authState.user)}
                        <span>${escapeHtml(userDisplayName(authState.user))}</span>
                    </button>
                    <div class="dropdown__menu auth-profile__menu" role="menu">
                        ${authState.isAdmin ? '<a class="dropdown__item" href="admin.php" role="menuitem">Админ панель</a>' : ''}
                        <a class="dropdown__item" href="my-polls.php?type=poll" role="menuitem">Мои опросы</a>
                        <a class="dropdown__item" href="my-polls.php?type=quiz" role="menuitem">Мои викторины</a>
                        <button class="dropdown__item auth-logout" type="button" role="menuitem" data-auth-logout>Выйти</button>
                    </div>
                </div>
            `;
        } else {
            root.innerHTML = `
                <button class="auth-login-button" type="button" data-auth-action="login">
                    ${lastAuthAvatar()}
                    <span>Войти</span>
                </button>
            `;
        }
        
        document.querySelectorAll('[data-auth-profile], .nav__right [data-dropdown]').forEach((dropdown) => {
            const trigger = dropdown.querySelector('.dropdown__trigger');
            trigger?.addEventListener('click', () => {
                const expanded = trigger.getAttribute('aria-expanded') === 'true';
                trigger.setAttribute('aria-expanded', String(!expanded));
                dropdown.classList.toggle('is-open', !expanded);
            });
        });
        initLogoutUI();
        initEmailAuthUI();
    });
}

function initAuthGuards() {
    document.addEventListener('click', async (event) => {
        const createLink = event.target.closest('a[href^="create.php"]');
        if (!createLink) return;
        const state = await authReady;
        if (!state.authenticated) {
            event.preventDefault();
            showToast('Войдите, чтобы создать опрос.');
            // Keep previous behavior hook, but email modal is disabled.
            // Telegram auth UI should be used instead.
        }
    });
}


function openEmailAuthModal() {
    // Email auth modal is disabled.
    showToast('Вход по почте недоступен в текущей версии.', 'error');
}

function initCreateForm(form) {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') === 'quiz' ? 'quiz' : 'poll';
    document.body.dataset.contentType = type;
    const pollFields = form.querySelectorAll('[data-poll-fields]');
    const quizFields = form.querySelectorAll('[data-quiz-fields]');
    const optionsList = form.querySelector('[data-options-list]');
    const questionsList = form.querySelector('[data-questions-list]');
    const status = form.querySelector('[data-form-status]');

    document.querySelectorAll('[data-type-link]').forEach((link) => {
        link.classList.toggle('is-active', link.dataset.typeLink === type);
    });
    pollFields.forEach((section) => {
        section.hidden = type !== 'poll';
    });
    quizFields.forEach((section) => {
        section.hidden = type !== 'quiz';
    });
    const titleEl = document.querySelector('#creator-title');
    if (titleEl) titleEl.textContent = type === 'quiz' ? 'Создать викторину' : 'Создать опрос';

    addDefaultRows(type, optionsList, questionsList);
    form.querySelector('[data-add-option]')?.addEventListener('click', () => addOption(optionsList));
    form.querySelector('[data-add-answer]')?.addEventListener('click', () => {
        const answers = form.querySelector('[data-answers]');
        if (!answers) return;
        if (answers.querySelectorAll('.answer-row').length >= MAX_OPTIONS) {
            showToast('Максимум ' + MAX_OPTIONS + ' вариантов ответа', 'error');
            return;
        }
        const allowMultiple = form.querySelector('[name="allow_multiple"]')?.checked || false;
        const row = createAnswerRow(false);
        // Устанавливаем правильный тип input
        const checkInput = row.querySelector('.correct-check');
        if (checkInput) {
            checkInput.type = allowMultiple ? 'checkbox' : 'radio';
            // Для radio - имя группы должно быть одинаковым
            checkInput.name = 'correct_answer';
        }
        answers.append(row);
    });
    form.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove]')) e.target.closest('[data-row]')?.remove();
    });
    
    // Инициализация переключателей при загрузке
    form.querySelectorAll('input[name="allow_multiple"]').forEach((input) => {
        const event = new Event('change');
        input.dispatchEvent(event);
    });
    
    // Для викторины: устанавливаем правильный тип input для ответов
    if (type === 'quiz') {
        const allowMultiple = form.querySelector('[data-quiz-fields]:not([hidden]) [name="allow_multiple"]')?.checked || false;
        toggleAnswerInputType(form, allowMultiple);
    }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        const originalText = btn.textContent;
        setStatus(status, '', '');
        try {
            const state = await authReady;
            if (!state.authenticated) {
                setStatus(status, 'Войдите, чтобы создать.', 'error');
                return;
            }
            const result = await apiJSON(type === 'quiz' ? '/api/v1/quizzes' : '/api/v1/polls', {
                method: 'POST',
                body: JSON.stringify(type === 'quiz' ? collectQuizPayload(form) : collectPollPayload(form))
            });
            const owner = result.owner_key ? '&owner_key=' + encodeURIComponent(result.owner_key) : '';
            window.location.href = 'view.php?type=' + type + '&id=' + encodeURIComponent(result.id) + owner;
        } catch (err) {
            setStatus(status, err.message, 'error');
            // Блокируем кнопку на 120 секунд при ошибке
            let seconds = 120;
            btn.textContent = `Подождите ${seconds}с`;
            const timer = setInterval(() => {
                seconds--;
                if (seconds <= 0) {
                    clearInterval(timer);
                    btn.disabled = false;
                    btn.textContent = originalText;
                } else {
                    btn.textContent = `Подождите ${seconds}с`;
                }
            }, 1000);
        } finally {
            if (!btn.disabled) {
                btn.disabled = false;
            }
        }
    });
}

function addDefaultRows(type, optionsList, questionsList) {
    if (type === 'quiz') {
        if (questionsList && !questionsList.children.length) addSingleQuizQuestion(questionsList);
    } else if (optionsList && !optionsList.children.length) {
        addOption(optionsList);
        addOption(optionsList);
    }
}

const MAX_OPTIONS = 15;

function addOption(list) {
    if (!list) return;
    if (list.querySelectorAll('[data-row="option"]').length >= MAX_OPTIONS) {
        showToast('Максимум ' + MAX_OPTIONS + ' вариантов ответа', 'error');
        return;
    }
    const row = document.createElement('div');
    row.className = 'option-row';
    row.dataset.row = 'option';
    row.innerHTML = '<input class="field__control" name="option" placeholder="Вариант ответа" required maxlength="300"><button class="icon-button" type="button" data-remove aria-label="Удалить">×</button>';
    list.appendChild(row);
}

function addSingleQuizQuestion(list) {
    const sec = document.createElement('section');
    sec.className = 'quiz-question';
    sec.dataset.row = 'question';
    sec.innerHTML = `
        <div class="creator-form__section-head">
            <h3 class="creator-form__subtitle">Варианты ответов</h3>
            <p class="creator-form__hint">Отметьте правильный вариант</p>
        </div>
        <div class="quiz-question__answers stack" data-answers></div>
    `;
    const answers = sec.querySelector('[data-answers]');
    answers.append(createAnswerRow(true), createAnswerRow(false));
    list.appendChild(sec);
}



function createAnswerRow(checked) {
    const row = document.createElement('div');
    row.className = 'answer-row';
    row.dataset.row = 'answer';
    row.innerHTML = `
        <input class="correct-check" type="checkbox" ${checked ? 'checked' : ''} title="Это правильный ответ">
        <input class="field__control" name="answer" placeholder="Вариант ответа" required maxlength="300">
        <button class="icon-button" type="button" data-remove aria-label="Удалить">×</button>
    `;
    return row;
}

function toggleAnswerInputType(form, allowMultiple) {
    // Переключаем тип input для правильных ответов
    form.querySelectorAll('.correct-check').forEach((input) => {
        const isChecked = input.checked;
        input.type = allowMultiple ? 'checkbox' : 'radio';
        input.name = allowMultiple ? '' : 'correct_answer';
        // Для radio нужно убедиться, что только один выбран
        if (!allowMultiple && isChecked) {
            form.querySelectorAll('.correct-check').forEach((chk) => {
                if (chk !== input) chk.checked = false;
            });
        }
    });
    // Для radio: обработчик change для снятия других отметок
    if (!allowMultiple) {
        form.querySelectorAll('.correct-check[type="radio"]').forEach((radio) => {
            radio.addEventListener('change', () => {
                form.querySelectorAll('.correct-check[type="radio"]').forEach((other) => {
                    if (other !== radio) other.checked = false;
                });
            });
        });
    }
}

function collectPollPayload(form) {
    return {
        title: form.elements.title.value,
        description: form.elements.description.value,
        options: Array.from(form.querySelectorAll('[name="option"]')).map((input) => input.value),
        visibility: form.querySelector('[data-poll-fields]:not([hidden]) [name="is_public"]')?.checked ? 'public' : 'private',
        allow_multiple: form.querySelector('[data-poll-fields]:not([hidden]) [name="allow_multiple"]')?.checked || false
    };
}

function collectQuizPayload(form) {
    return {
        title: form.elements.title.value,
        description: form.elements.description.value,
        question: form.elements.title.value,
        visibility: form.querySelector('[data-quiz-fields]:not([hidden]) [name="is_public"]')?.checked ? 'public' : 'private',
        allow_multiple: form.querySelector('[data-quiz-fields]:not([hidden]) [name="allow_multiple"]')?.checked || false,
        answers: Array.from(form.querySelectorAll('.answer-row')).map((row) => ({
            text: row.querySelector('[name="answer"]').value,
            is_correct: row.querySelector('.correct-check').checked
        }))
    };
}


function apiCollection(type) {
    return type === 'quiz' ? 'quizzes' : 'polls';
}

async function initBrowsePage(root) {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') === 'quiz' ? 'quiz' : 'poll';
    const searchQuery = params.get('q') || '';
    document.body.dataset.contentType = type;
    const list = root.querySelector('[data-list]');
    const title = root.querySelector('[data-browse-title]');
    if (title) title.textContent = type === 'quiz' ? 'Викторины' : 'Опросы';
    document.querySelectorAll('[data-type-link]').forEach((link) => {
        link.classList.toggle('is-active', link.dataset.typeLink === type);
    });
    
    // Восстанавливаем поисковый запрос в поле поиска
    const searchInput = document.querySelector('.search-form .search');
    if (searchInput && searchQuery) {
        searchInput.value = searchQuery;
    }
    
    try {
        const query = searchQuery ? '?q=' + encodeURIComponent(searchQuery) : '';
        const data = await apiJSON('/api/v1/' + apiCollection(type) + query);
        renderCards(list, data.items || [], type);
    } catch (e) {
        renderMessage(list, e.message, true);
    }
}

function renderCards(list, items, type) {
    list.replaceChildren();
    if (!items.length) {
        renderMessage(list, 'Пока ничего нет.', false);
        return;
    }
    items.forEach((item) => {
        const card = buildContentCard(item, type, !!item.is_owner);
        list.append(card);
    });
}

function buildContentCard(item, type, isOwner) {
    const card = document.createElement('a');
    card.className = 'content-card';
    card.href = 'view.php?type=' + type + '&id=' + encodeURIComponent(item.id);

    const votesLabel = (item.total_votes != null && item.total_votes > 0)
        ? `${item.total_votes} ${pluralVotes(item.total_votes)}`
        : 'Нет голосов';
    
    card.innerHTML = `
        ${isOwner ? `<button class="content-card__delete" type="button" title="Удалить" data-delete="${escapeHtml(item.id)}">✕</button>` : ''}
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.description || (type === 'quiz' ? 'Викторина' : 'Опрос'))}</p>
        <div class="content-card__footer">
            <span class="content-card__action">${type === 'quiz' ? 'Открыть викторину' : 'Открыть опрос'}</span>
            <small class="content-card__votes">${escapeHtml(votesLabel)}</small>
        </div>
    `;
    
    if (isOwner) {
        const deleteBtn = card.querySelector('[data-delete]');
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = deleteBtn.dataset.delete;
            if (!window.confirm('Удалить ' + (type === 'quiz' ? 'викторину' : 'опрос') + '? Это действие нельзя отменить.')) {
                return;
            }
            try {
                await apiJSON('/api/v1/' + apiCollection(type) + '/' + encodeURIComponent(id), { method: 'DELETE' });
                card.remove();
                showToast(type === 'quiz' ? 'Викторина удалена' : 'Опрос удалён', 'success');
                if (list.querySelectorAll('.content-card').length === 0) {
                    renderMessage(list, type === 'quiz' ? 'У вас пока нет викторин. Создайте первую!' : 'У вас пока нет опросов. Создайте первый!', false);
                }
            } catch (error) {
                showToast(error.message || 'Не удалось удалить', 'error');
            }
        });
    }
    
    return card;
}



async function initMyPollsPage(root) {
    const list = root.querySelector('[data-list]');
    const title = root.querySelector('[data-my-polls-title]');
    if (!list) return;
    
    // Ждём авторизацию перед загрузкой
    await authReady;
    
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') === 'quiz' ? 'quiz' : 'poll';
    const searchQuery = params.get('q') || '';
    document.body.dataset.contentType = type;
    
    if (title) title.textContent = type === 'quiz' ? 'Мои викторины' : 'Мои опросы';
    
    document.querySelectorAll('[data-type-link]').forEach((link) => {
        link.classList.toggle('is-active', link.dataset.typeLink === type);
    });
    
    // Восстанавливаем поисковый запрос в поле поиска
    const searchInput = document.querySelector('.search-form .search');
    if (searchInput && searchQuery) {
        searchInput.value = searchQuery;
    }
    
    try {
        const state = await authReady;
        if (!state.authenticated) {
            renderMessage(list, 'Войдите в аккаунт, чтобы увидеть свои опросы.', false);
            return;
        }
        const query = searchQuery ? '?q=' + encodeURIComponent(searchQuery) : '';
        const data = await apiJSON('/api/v1/me/' + (type === 'quiz' ? 'quizzes' : 'polls') + query);
        renderMyPolls(list, data.items || [], type);
    } catch (e) {
        renderMessage(list, e.message, true);
    }
}

function renderMyPolls(list, items, type = 'poll') {
    list.replaceChildren();
    if (!items.length) {
        renderMessage(list, type === 'quiz' ? 'У вас пока нет викторин. Создайте первую!' : 'У вас пока нет опросов. Создайте первый!', false);
        return;
    }
    items.forEach((item) => {
        const card = buildContentCard(item, type, true);
        list.append(card);
    });
}


function pluralVotes(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'голос';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'голоса';
    return 'голосов';
}

async function initDetailPage(root) {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') === 'quiz' ? 'quiz' : 'poll';
    document.body.dataset.contentType = type;
    const id = params.get('id') || '';
    const ownerKey = params.get('owner_key') || '';
    const linkSlug = params.get('link') || '';
    const container = root.querySelector('[data-detail]');
    try {
        const detailQuery = ownerKey ? '?owner_key=' + encodeURIComponent(ownerKey) : '';
        const data = await apiJSON('/api/v1/' + apiCollection(type) + '/' + encodeURIComponent(id) + detailQuery);
        if (type === 'poll' && linkSlug) {
            window.sessionStorage.setItem('votely_link_' + id, linkSlug);
        }
        renderDetail(container, data, type, id, ownerKey);
        if (type === 'poll') recordPollVisit(id, ownerKey, linkSlug);
    } catch (error) {
        renderMessage(container, error.message, true);
    }
}

function recordPollVisit(id, ownerKey, linkSlug) {
    const params = new URLSearchParams();
    if (ownerKey) params.set('owner_key', ownerKey);
    if (linkSlug) {
        params.set('link', linkSlug);
        params.set('utm_source', linkSlug);
        params.set('utm_medium', 'named');
    }
    const query = params.toString() ? '?' + params.toString() : '';
    apiJSON('/api/v1/polls/' + encodeURIComponent(id) + '/visits' + query, { method: 'POST' }).catch(() => {});
}

function renderDetail(container, data, type, id, ownerKey = '') {
    container.replaceChildren();
    const title = document.createElement('h1');
    title.className = 'viewer__title';
    title.textContent = data.title;
    const desc = document.createElement('p');
    desc.className = 'viewer__description';
    desc.textContent = data.description || '';
    const content = document.createElement('div');
    content.className = 'viewer__content';
    container.append(title, desc, content);

    if (type === 'quiz') {
        renderQuizView(content, data);
    } else {
        renderPollView(content, data, id);
    }

    // Показываем ссылку на статистику только владельцу
    if (data.is_owner) {
        const statsLink = document.createElement('a');
        statsLink.className = 'primary-button';
        const statsUrl = 'stats.php?type=' + type + '&id=' + encodeURIComponent(id) + (ownerKey ? '&owner_key=' + encodeURIComponent(ownerKey) : '');
        statsLink.href = statsUrl;
        statsLink.textContent = 'Посмотреть статистику';
        statsLink.style.marginTop = '24px';
        statsLink.style.display = 'inline-flex';
        statsLink.style.alignItems = 'center';
        statsLink.style.justifyContent = 'center';
        container.append(statsLink);
    }
}

async function renderOwnerStats(container, poll, id, ownerKey) {
    const statsQuery = ownerKey ? '?owner_key=' + encodeURIComponent(ownerKey) : '';
    const stats = await apiJSON('/api/v1/polls/' + encodeURIComponent(id) + '/stats' + statsQuery);
    await renderStatsBlock(container, poll, stats, id, ownerKey);
}

async function initStatsPage() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') === 'quiz' ? 'quiz' : 'poll';
    document.body.setAttribute('data-content-type', type);
    const id = params.get('id') || '';
    const ownerKey = params.get('owner_key') || '';
    const title = document.querySelector('#stats-title');
    const content = document.querySelector('#stats-content');
    if (!id || !content) return;
    try {
        if (type === 'quiz') {
            await initQuizStatsPage(id, ownerKey, title, content);
            return;
        }
        const pollQuery = ownerKey ? '?owner_key=' + encodeURIComponent(ownerKey) : '';
        const poll = await apiJSON('/api/v1/polls/' + encodeURIComponent(id) + pollQuery);
        const statsQuery = ownerKey ? '?owner_key=' + encodeURIComponent(ownerKey) : '';
        const stats = await apiJSON('/api/v1/polls/' + encodeURIComponent(id) + '/stats' + statsQuery);
        if (title) title.textContent = poll.title || 'Статистика';
        const holder = document.createElement('div');
        await renderStatsBlock(holder, poll, stats, id, ownerKey);
        content.replaceChildren(...holder.childNodes);
    } catch (error) {
        renderMessage(content, error.message, true);
    }
}

async function initQuizStatsPage(id, ownerKey, title, content) {
    const ownerQuery = ownerKey ? '?owner_key=' + encodeURIComponent(ownerKey) : '';
    const quiz = await apiJSON('/api/v1/quizzes/' + encodeURIComponent(id) + ownerQuery);
    const stats = await apiJSON('/api/v1/quizzes/' + encodeURIComponent(id) + '/stats' + ownerQuery);
    if (title) title.textContent = quiz.title || 'Статистика';
    const holder = document.createElement('div');
    await renderQuizStatsBlock(holder, quiz, stats, id, ownerKey);
    content.replaceChildren(...holder.childNodes);
}

async function renderQuizStatsBlock(container, quiz, stats, quizID = '', ownerKey = '') {
    const statsTitle = document.getElementById('stats-title');
    const statsDesc = document.getElementById('stats-description');
    if (statsTitle) statsTitle.textContent = quiz.title || 'Статистика';
    if (statsDesc) statsDesc.textContent = quiz.description || '';
    
    const chartSection = document.createElement('section');
    chartSection.className = 'stats-chart-section';
    const totalAttempts = stats.total_attempts || 0;
    
    // Большая кольцевая диаграмма
    const pieChartWrap = document.createElement('div');
    pieChartWrap.className = 'donut-chart-container';
    if (totalAttempts > 0) {
        pieChartWrap.append(buildDonutChart(stats.answers || []));
    } else {
        pieChartWrap.innerHTML = '<p class="stats-empty">Ответов пока нет</p>';
    }
    
    // Подписи к данным под диаграммой
    const dataLabels = document.createElement('div');
    dataLabels.className = 'donut-data-labels';
    (stats.answers || []).forEach((answer, index) => {
        const color = chartColor(index);
        const percent = answer.percent || 0;
        const item = document.createElement('div');
        item.className = 'donut-data-item';
        item.style.setProperty('--swatch-color', color);
        item.innerHTML = `
            <span class="donut-data-swatch" style="background:${color}"></span>
            <div style="display:grid;gap:6px;min-width:0;">
                <span class="donut-data-text">${escapeHtml(answer.text)}</span>
                <div class="donut-data-progress">
                    <div class="donut-data-progress-bar" style="width:${percent}%; background:${color}; box-shadow:0 0 8px ${color}"></div>
                </div>
            </div>
            <span class="donut-data-percent">${percent}%</span>
            <span class="donut-data-votes">${answer.votes} ${pluralVotes(answer.votes)}</span>
        `;
        dataLabels.append(item);
    });
    
    chartSection.append(pieChartWrap, dataLabels);
    const meta = document.createElement('div');
    meta.className = 'stats-meta';
    meta.append(
        metric('Тип', 'Викторина'),
        metric('Доступ', stats.quiz?.visibility === 'private' ? 'Приватная' : 'Публичная'),
        metric('Режим', stats.quiz?.allow_multiple ? 'Несколько ответов' : 'Один ответ'),
        metric('Ответов', String(totalAttempts))
    );
    const analytics = buildAnalyticsSection(stats.analytics || {}, 'quiz');
    const links = quizID ? await buildShareLinksSection(quizID, ownerKey, stats.analytics?.links || [], 'quiz') : null;
    container.replaceChildren(chartSection, meta, analytics);
    if (links) container.append(links);
}

async function renderStatsBlock(container, poll, stats, pollID = '', ownerKey = '') {
    // Обновляем заголовок и описание в шапке
    const statsTitle = document.getElementById('stats-title');
    const statsDesc = document.getElementById('stats-description');
    if (statsTitle) statsTitle.textContent = poll.title || 'Статистика';
    if (statsDesc) statsDesc.textContent = poll.description || '';
    
    // Показываем кнопку создания ссылки если владелец
    const createLinkBtn = document.getElementById('create-link-btn');
    if (createLinkBtn && pollID) {
        createLinkBtn.hidden = false;
        createLinkBtn.onclick = () => {
            const modal = document.getElementById('create-link-modal');
            if (modal) modal.hidden = false;
        };
        
        // Обработчики модального окна
        const cancelBtn = document.getElementById('cancel-link-btn');
        const confirmBtn = document.getElementById('confirm-link-btn');
        const linkInput = document.getElementById('link-name-input');
        
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                const modal = document.getElementById('create-link-modal');
                if (modal) modal.hidden = true;
                if (linkInput) linkInput.value = '';
            };
        }
        
        if (confirmBtn && linkInput) {
            confirmBtn.onclick = async () => {
                const name = linkInput.value.trim();
                if (!name) {
                    showToast('Введите название ссылки');
                    return;
                }
                confirmBtn.disabled = true;
                try {
                    const query = ownerKey ? '?owner_key=' + encodeURIComponent(ownerKey) : '';
                    await apiJSON('/api/v1/polls/' + encodeURIComponent(pollID) + '/links' + query, {
                        method: 'POST',
                        body: JSON.stringify({ name })
                    });
                    const modal = document.getElementById('create-link-modal');
                    if (modal) modal.hidden = true;
                    linkInput.value = '';
                    showToast('Ссылка создана', 'success');
                    // Перезагружаем страницу для обновления списка ссылок
                    setTimeout(() => window.location.reload(), 1000);
                } catch (error) {
                    showToast(error.message, 'error');
                } finally {
                    confirmBtn.disabled = false;
                }
            };
        }
        
        // Закрытие по клику на overlay
        const overlay = document.querySelector('.create-link-modal__overlay');
        if (overlay) {
            overlay.onclick = () => {
                const modal = document.getElementById('create-link-modal');
                if (modal) modal.hidden = true;
                if (linkInput) linkInput.value = '';
            };
        }
    }
    
    const chartSection = document.createElement('section');
    chartSection.className = 'stats-chart-section';
    const totalVotes = stats.total_votes || 0;
    
    // Большая кольцевая диаграмма
    const pieChartWrap = document.createElement('div');
    pieChartWrap.className = 'donut-chart-container';
    if (totalVotes > 0) {
        pieChartWrap.append(buildDonutChart(stats.options || []));
    } else {
        pieChartWrap.innerHTML = '<p class="stats-empty">Голосов пока нет</p>';
    }
    
    // Подписи к данным под диаграммой
    const dataLabels = document.createElement('div');
    dataLabels.className = 'donut-data-labels';
    (stats.options || []).forEach((option, index) => {
        const color = chartColor(index);
        const percent = option.percent || 0;
        const item = document.createElement('div');
        item.className = 'donut-data-item';
        item.style.setProperty('--swatch-color', color);
        item.innerHTML = `
            <span class="donut-data-swatch" style="background:${color}"></span>
            <div style="display:grid;gap:6px;min-width:0;">
                <span class="donut-data-text">${escapeHtml(option.text)}</span>
                <div class="donut-data-progress">
                    <div class="donut-data-progress-bar" style="width:${percent}%; background:${color}; box-shadow:0 0 8px ${color}"></div>
                </div>
            </div>
            <span class="donut-data-percent">${percent}%</span>
            <span class="donut-data-votes">${option.votes} голосов</span>
        `;
        dataLabels.append(item);
    });
    
    chartSection.append(pieChartWrap, dataLabels);
    const meta = document.createElement('div');
    meta.className = 'stats-meta';
    meta.append(
        metric('Тип', 'Опрос'),
        metric('Доступ', stats.poll?.visibility === 'private' ? 'Приватный' : 'Публичный'),
        metric('Режим', stats.poll?.allow_multiple ? 'Несколько вариантов' : 'Один вариант')
    );
    const analytics = buildAnalyticsSection(stats.analytics || {});
    const links = pollID ? await buildShareLinksSection(pollID, ownerKey, stats.analytics?.links || [], 'poll') : null;
    container.replaceChildren(chartSection, meta, analytics);
    if (links) container.append(links);
}

function buildAnalyticsSection(analytics, type = 'poll') {
    const section = document.createElement('section');
    section.className = 'stats-analytics';
    section.innerHTML = '<h2 class="stats-analytics__title">Аудитория</h2>';
    const grid = document.createElement('div');
    grid.className = 'stats-analytics__grid';
    
    // Нормализуем данные именных ссылок для карточки "Источники"
    const linksData = (analytics.links || []).map(link => ({
        name: link.name || link.slug || 'Unknown',
        count: link.visits || 0
    }));
    
    grid.append(
        analyticsCard('Браузеры', analytics.browsers || []),
        analyticsCard('Устройства', analytics.devices || []),
        analyticsCard('ОС', analytics.os || []),
        analyticsCard('Страны', analytics.locations || []),
        analyticsCard('Источники', linksData)
    );
    section.append(grid);
    return section;
}

function analyticsCard(title, items) {
    const card = document.createElement('article');
    card.className = 'analytics-card';
    card.innerHTML = `<h3 class="analytics-card__title">${escapeHtml(title)}</h3>`;
    if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'stats-empty stats-empty--small';
        empty.textContent = 'Нет данных';
        card.append(empty);
        return card;
    }
    const body = document.createElement('div');
    body.className = 'analytics-card__body';

    // Та же структура, что у первой диаграммы
    const chartSection = document.createElement('div');
    chartSection.className = 'stats-chart-section';

    const pieChartWrap = document.createElement('div');
    pieChartWrap.className = 'donut-chart-container';
    const chartOptions = items.map((item) => ({ text: item.name, votes: item.count || 0 }));
    pieChartWrap.append(buildDonutChart(chartOptions));

    const dataLabels = document.createElement('div');
    dataLabels.className = 'donut-data-labels';

    const total = items.reduce((sum, item) => sum + (item.count || 0), 0);

    items.forEach((item, index) => {
        const color = chartColor(index);
        const count = item.count || 0;
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;

        const row = document.createElement('div');
        row.className = 'donut-data-item';
        row.style.setProperty('--swatch-color', color);
        row.innerHTML = `
            <span class="donut-data-swatch" style="background:${color}"></span>
            <div style="display:grid;gap:6px;min-width:0;">
                <span class="donut-data-text">${escapeHtml(item.name || 'Unknown')}</span>
                <div class="donut-data-progress">
                    <div class="donut-data-progress-bar" style="width:${percent}%; background:${color}; box-shadow:0 0 8px ${color}"></div>
                </div>
            </div>
            <span class="donut-data-percent">${percent}%</span>
            <span class="donut-data-votes">${count} голосов</span>
        `;
        dataLabels.append(row);
    });

    chartSection.append(pieChartWrap, dataLabels);
    body.append(chartSection);
    card.append(body);
    return card;
}

async function buildShareLinksSection(itemID, ownerKey, initialLinks, type = 'poll') {
    const section = document.createElement('section');
    section.className = 'share-links-panel';
    section.innerHTML = `
        <div class="creator-form__section-head">
            <h2 class="creator-form__subtitle">Именные ссылки</h2>
        </div>
        <div class="create-link-form">
            <input class="field__control" name="share_link_name" maxlength="80" placeholder="Название ссылки">
            <button class="primary-button" type="button">Создать</button>
        </div>
        <div class="links-list"></div>
    `;
    const list = section.querySelector('.links-list');
    const input = section.querySelector('input');
    const button = section.querySelector('button');
    const query = ownerKey ? '?owner_key=' + encodeURIComponent(ownerKey) : '';
    const basePath = '/api/v1/' + (type === 'quiz' ? 'quizzes' : 'polls') + '/' + encodeURIComponent(itemID) + '/links';

    async function loadLinks() {
        const data = await apiJSON(basePath + query);
        renderShareLinks(list, itemID, ownerKey, data.items || [], type);
    }

    renderShareLinks(list, itemID, ownerKey, initialLinks, type);
    button.addEventListener('click', async () => {
        const name = input.value.trim();
        if (!name) {
            showToast('Введите название ссылки');
            return;
        }
        button.disabled = true;
        try {
            await apiJSON(basePath + query, {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            input.value = '';
            await loadLinks();
            showToast('Ссылка создана', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            button.disabled = false;
        }
    });
    return section;
}

function renderShareLinks(list, itemID, ownerKey, links, type = 'poll') {
    list.replaceChildren();
    if (!links.length) {
        renderMessage(list, 'Именных ссылок пока нет.', false);
        return;
    }
    const basePath = '/api/v1/' + (type === 'quiz' ? 'quizzes' : 'polls') + '/' + encodeURIComponent(itemID) + '/links';
    links.forEach((link) => {
        const url = link.url || buildShareURL(itemID, link.slug, type);
        const row = document.createElement('article');
        row.className = 'link-item';
        const labelVotes = type === 'quiz' ? 'ответов' : 'голосов';
        row.innerHTML = `
            <div class="link-item__info">
                <strong class="link-item__name">${escapeHtml(link.name)}</strong>
                <span class="link-item__utm">${escapeHtml(url)}</span>
                <span class="link-item__utm">${link.visits || 0} переходов · ${link.votes || 0} ${labelVotes}</span>
            </div>
            <div class="link-item__actions">
                <button class="link-item__btn link-item__btn--copy" type="button">Копировать</button>
                <button class="link-item__btn link-item__btn--delete" type="button">Удалить</button>
            </div>
        `;
        row.querySelector('.link-item__btn--copy').addEventListener('click', async () => {
            await navigator.clipboard?.writeText(url);
            showToast('Ссылка скопирована', 'success');
        });
        row.querySelector('.link-item__btn--delete').addEventListener('click', async () => {
            if (!window.confirm('Удалить ссылку?')) return;
            const query = ownerKey ? '?owner_key=' + encodeURIComponent(ownerKey) : '';
            await apiJSON(basePath + '/' + encodeURIComponent(link.id) + query, { method: 'DELETE' });
            row.remove();
            showToast('Ссылка удалена', 'success');
        });
        list.append(row);
    });
}
    
function buildShareURL(itemID, slug, type = 'poll') {
    const url = new URL('/view.php', window.location.origin);
    url.searchParams.set('type', type);
    url.searchParams.set('id', itemID);
    url.searchParams.set('link', slug);
    url.searchParams.set('utm_source', slug);
    url.searchParams.set('utm_medium', 'named');
    return url.toString();
}

function renderPollView(container, data, id) {
    const form = document.createElement('form');
    form.className = 'vote-form';
    const list = document.createElement('div');
    list.className = 'answer-list';
    const options = data.options || [];
    const allowMultiple = data.allow_multiple || false;
    const selectedOptionIDs = data.selected_option_ids || [];
    const selectedOptionID = data.selected_option_id || '';
    const hasAnswered = allowMultiple ? selectedOptionIDs.length > 0 : !!selectedOptionID;
    const totalVotes = options.reduce((sum, option) => sum + (option.votes || 0), 0);
    options.forEach((option, index) => {
        const label = document.createElement('label');
        label.className = 'vote-option';
        const isSelected = allowMultiple ? selectedOptionIDs.includes(option.id) : option.id === selectedOptionID;
        label.classList.toggle('is-user-selected', isSelected);
        const percent = totalVotes ? Math.round(((option.votes || 0) / totalVotes) * 100) : 0;
        const color = chartColor(index);
        const inputType = allowMultiple ? 'checkbox' : 'radio';
        const inputName = allowMultiple ? 'opt[]' : 'opt';
        const inputChecked = isSelected ? 'checked' : '';
        const inputDisabled = hasAnswered ? 'disabled' : '';
        label.innerHTML = `
            <input type="${inputType}" name="${inputName}" value="${escapeHtml(option.id)}" ${inputChecked} ${inputDisabled}>
            <span class="vote-option__body">
                <span class="vote-option__top">
                    <span class="vote-option__text">${escapeHtml(option.text)}</span>
                    <span class="vote-count">${isSelected ? 'Ваш выбор · ' : ''}${option.votes || 0} · ${percent}%</span>
                </span>
                <span class="vote-result-bar" aria-label="Заполнено ${percent}%">
                    <span class="vote-result-bar__fill" style="--target:${percent}%; --bar-color:${color}; --bar-color-neon:${color}80"></span>
                    <span class="vote-result-bar__label">${percent}%</span>
                </span>
            </span>
        `;
        list.append(label);
    });
    const btn = document.createElement('button');
    btn.className = 'primary-button';
    btn.textContent = hasAnswered ? 'Голос учтен' : 'Голосовать';
    btn.disabled = hasAnswered;
    if (!options.length) {
        renderMessage(list, 'Варианты ответов не найдены', true);
        btn.disabled = true;
    }
    form.append(list, btn);
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selected = allowMultiple 
            ? Array.from(form.querySelectorAll('input:checked')).map((input) => input.value)
            : form.querySelector('input:checked')?.value;
        if (!selected || (Array.isArray(selected) && selected.length === 0)) {
            showToast('Выберите вариант');
            return;
        }
        if (hasAnswered) return;
        btn.disabled = true;
        btn.textContent = 'Отправка...';
        try {
            const linkSlug = new URLSearchParams(window.location.search).get('link') || window.sessionStorage.getItem('votely_link_' + id) || '';
            const voteQuery = linkSlug ? '?link=' + encodeURIComponent(linkSlug) : '';
            const payload = Array.isArray(selected) 
                ? { option_ids: selected }
                : { option_id: selected };
            const result = await apiJSON('/api/v1/polls/' + encodeURIComponent(id) + '/votes' + voteQuery, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            renderPollView(container, result, id);
            animateVoteBars(container);
            showToast('Голос учтен', 'success');
        } catch (error) {
            console.error('Vote error:', error);
            showToast(error.message || 'Не удалось отправить голос. Проверьте соединение.', 'error');
            btn.textContent = hasAnswered ? 'Голос учтен' : 'Голосовать';
        } finally {
            if (!hasAnswered) {
                btn.disabled = false;
            }
        }
    });
    container.replaceChildren(form);
    animateVoteBars(container);
}

function animateVoteBars(container) {
    window.requestAnimationFrame(() => {
        container.querySelectorAll('.vote-result-bar__fill').forEach((fill) => {
            fill.style.width = fill.style.getPropertyValue('--target') || '0%';
        });
    });
}

function renderQuizView(container, data) {
    const selectedAnswerID = data.selected_answer_id || '';
    const hasAnswered = !!selectedAnswerID;
    const allowMultiple = data.allow_multiple || false;
    
    container.innerHTML = `
        <div class="quiz-viewer">
            <div class="quiz-question-box"><h2>${escapeHtml(data.question)}</h2></div>
            <div class="answer-list"></div>
            <div class="vote-actions">
                <button class="primary-button" type="button" ${hasAnswered ? 'disabled' : ''}>${hasAnswered ? 'Ответ сохранён' : 'Проверить'}</button>
                <p class="status form-status" role="status"></p>
            </div>
        </div>
    `;
    const list = container.querySelector('.answer-list');
    (data.answers || []).forEach((answer, index) => {
        const label = document.createElement('label');
        label.className = 'vote-option';
        const isSelected = answer.id === selectedAnswerID;
        label.classList.toggle('is-user-selected', isSelected);
        const color = chartColor(index);
        const inputType = allowMultiple ? 'checkbox' : 'radio';
        const inputName = allowMultiple ? 'ans[]' : 'ans';
        label.innerHTML = `
            <input type="${inputType}" name="${inputName}" value="${escapeHtml(answer.id)}" ${isSelected ? 'checked' : ''} ${hasAnswered ? 'disabled' : ''}>
            <span class="vote-option__body">
                <span class="vote-option__top">
                    <span class="vote-option__text">${escapeHtml(answer.text)}</span>
                    <span class="vote-count" hidden></span>
                </span>
                <span class="vote-result-bar"><span class="vote-result-bar__fill" style="--target:0%; --bar-color:${color}; --bar-color-neon:${color}80"></span><span class="vote-result-bar__label">0%</span></span>
            </span>
        `;
        list.append(label);
    });
    
    if (hasAnswered) {
        // Показываем результат если пользователь уже ответил
        renderQuizResult(container, data, {
            answers: data.answers,
            selected_answer_id: selectedAnswerID,
            is_correct: data.answers.find(a => a.id === selectedAnswerID)?.is_correct || false
        });
        return;
    }
    
    const button = container.querySelector('.primary-button');
    button.addEventListener('click', async () => {
        const selected = allowMultiple
            ? Array.from(container.querySelectorAll('input:checked')).map((input) => input.value)
            : container.querySelector('input:checked');
        const status = container.querySelector('.status');
        if (!selected || (Array.isArray(selected) && selected.length === 0)) {
            setStatus(status, 'Выберите вариант', 'error');
            return;
        }
        button.disabled = true;
        try {
            const state = await authReady;
            if (!state.authenticated) {
                // Telegram auth should be used instead.
                return;
            }
            const payload = allowMultiple
                ? { answer_ids: selected }
                : { answer_id: selected.value };
            const result = await apiJSON('/api/v1/quizzes/' + encodeURIComponent(data.id) + '/answers', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            renderQuizResult(container, data, result);
            showToast(result.is_correct ? 'Ответ сохранен: правильно' : 'Ответ сохранен', result.is_correct ? 'success' : 'error');
            
            // Запускаем конфетти при правильном ответе
            if (result.is_correct && window.confetti) {
                window.confetti.start();
            }
        } catch (error) {
            showToast(error.message, 'error');
            setStatus(status, error.message, 'error');
        } finally {
            button.disabled = false;
        }
    });
}

function renderQuizResult(container, data, result) {
    const list = container.querySelector('.answer-list');
    const status = container.querySelector('.status');
    const button = container.querySelector('.primary-button');
    
    // Обновляем статус
    if (status) {
        status.className = 'status form-status ' + (result.is_correct ? 'is-success' : 'is-error');
        status.textContent = result.is_correct ? 'Правильно' : 'Ответ сохранён';
        status.setAttribute('role', 'status');
    }
    
    // Обновляем кнопку
    if (button) {
        button.disabled = true;
        button.textContent = 'Ответ сохранён';
    }
    
    // Обновляем варианты ответов
    list.replaceChildren();
    (result.answers || []).forEach((answer, index) => {
        const label = document.createElement('div');
        const isSelected = answer.id === result.selected_answer_id;
        label.className = 'vote-option is-result';
        label.classList.toggle('is-correct', !!answer.is_correct);
        label.classList.toggle('is-error', isSelected && !answer.is_correct);
        label.classList.toggle('is-user-selected', isSelected);
        const color = chartColor(index);
        label.innerHTML = `
            <span class="vote-option__marker"></span>
            <span class="vote-option__body">
                <span class="vote-option__top">
                    <span class="vote-option__text">${escapeHtml(answer.text)}</span>
                    <span class="vote-count">${answer.attempts || 0} · ${answer.percent || 0}%</span>
                </span>
                <span class="vote-result-bar">
                    <span class="vote-result-bar__fill" style="--target:${answer.percent || 0}%; --bar-color:${color}; --bar-color-neon:${color}80"></span>
                    <span class="vote-result-bar__label">${answer.percent || 0}%</span>
                </span>
            </span>
        `;
        list.append(label);
    });
    animateVoteBars(container);
}

function buildDonutChart(options) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 280 280');
    svg.classList.add('donut-chart-svg');
    const total = options.reduce((sum, option) => sum + (option.votes || 0), 0);
    
    // Нет голосов — показываем серое кольцо
    if (!total) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '140');
        circle.setAttribute('cy', '140');
        circle.setAttribute('r', '100');
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#2d2e31');
        circle.setAttribute('stroke-width', '40');
        svg.append(circle);
        return svg;
    }
    
    // Кольцевая диаграмма с сегментами
    const circumference = 2 * Math.PI * 100;
    let offset = 0;
    
    options.forEach((option, index) => {
        const votes = option.votes || 0;
        if (votes === 0) return;
        
        const percent = votes / total;
        const segmentLength = circumference * percent;
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '140');
        circle.setAttribute('cy', '140');
        circle.setAttribute('r', '100');
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', chartColor(index));
        circle.setAttribute('stroke-width', '40');
        circle.setAttribute('stroke-dasharray', `${segmentLength} ${circumference - segmentLength}`);
        circle.setAttribute('stroke-dashoffset', -offset);
        circle.setAttribute('data-percent', (percent * 100).toFixed(1));
        circle.setAttribute('data-text', option.text);
        svg.append(circle);
        
        offset += segmentLength;
    });
    
    // Текст с общим количеством в центре
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '140');
    text.setAttribute('y', '135');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('font-size', '42');
    text.setAttribute('font-weight', '800');
    text.textContent = total;
    svg.append(text);
    
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '140');
    label.setAttribute('y', '165');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#8d8d8f');
    label.setAttribute('font-size', '16');
    label.setAttribute('font-weight', '600');
    label.textContent = 'голосов';
    svg.append(label);
    
    return svg;
}

function buildPieSvg(options) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 280 280');
    svg.classList.add('pie-svg');
    const total = options.reduce((sum, option) => sum + (option.votes || 0), 0);
    
    // Нет голосов — показываем серое кольцо
    if (!total) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '140');
        circle.setAttribute('cy', '140');
        circle.setAttribute('r', '100');
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#2d2e31');
        circle.setAttribute('stroke-width', '40');
        svg.append(circle);
        return svg;
    }
    
    // Кольцевая диаграмма с сегментами
    const circumference = 2 * Math.PI * 100;
    let offset = 0;
    
    options.forEach((option, index) => {
        const votes = option.votes || 0;
        if (votes === 0) return;
        
        const percent = votes / total;
        const segmentLength = circumference * percent;
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '140');
        circle.setAttribute('cy', '140');
        circle.setAttribute('r', '100');
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', chartColor(index));
        circle.setAttribute('stroke-width', '40');
        circle.setAttribute('stroke-dasharray', `${segmentLength} ${circumference - segmentLength}`);
        circle.setAttribute('stroke-dashoffset', -offset);
        circle.setAttribute('data-percent', (percent * 100).toFixed(1));
        circle.setAttribute('data-text', option.text);
        svg.append(circle);
        
        offset += segmentLength;
    });
    
    // Текст с общим количеством в центре
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '140');
    text.setAttribute('y', '135');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('font-size', '42');
    text.setAttribute('font-weight', '800');
    text.textContent = total;
    svg.append(text);
    
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '140');
    label.setAttribute('y', '165');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#8d8d8f');
    label.setAttribute('font-size', '16');
    label.setAttribute('font-weight', '600');
    label.textContent = 'голосов';
    svg.append(label);
    
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
    const colors = [
        '#10b981', // зелёный
        '#3b82f6', // синий
        '#f59e0b', // янтарный
        '#ef4444', // красный
        '#8b5cf6', // фиолетовый
        '#ec4899', // розовый
        '#06b6d4', // циан
        '#f97316', // оранжевый
        '#84cc16', // лайм
        '#14b8a6', // тиловый
        '#a855f7', // пурпурный
        '#22d3ee', // голубой неон
        '#ffffff', // белый
        '#9ca3af', // серый
        '#fde047'  // жёлтый неон
    ];
    return colors[index % colors.length];
}

function metric(label, value) {
    const item = document.createElement('div');
    item.className = 'metric-box metric-box--small';
    item.innerHTML = `<small>${escapeHtml(label)}</small><span>${escapeHtml(value)}</span>`;
    return item;
}

function renderMessage(container, message, isError) {
    container.replaceChildren();
    const p = document.createElement('p');
    p.className = 'form-status ' + (isError ? 'is-error' : '');
    p.textContent = message;
    container.append(p);
}

async function initAdminPanel(root) {
    let csrf = null;
    let currentType = 'polls';
    const loginBox = root.querySelector('[data-admin-login]');
    const panel = root.querySelector('[data-admin-panel]');
    const status = root.querySelector('[data-admin-status]');
    const list = root.querySelector('[data-admin-list]');
    const summary = root.querySelector('[data-admin-summary]');
    const logout = document.querySelector('[data-admin-logout]');
    const sqlConsole = root.querySelector('[data-sql-console]');

    async function refreshSession() {
        const data = await apiJSON('/api/v1/admin/me');
        csrf = data.csrf || null;
        // Делаем CSRF доступным для inline-скрипта SQL-консоли
        if (sqlConsole && csrf) {
            sqlConsole.dataset.csrf = csrf;
        }
        loginBox.hidden = data.authenticated;
        panel.hidden = !data.authenticated;
        if (logout) logout.hidden = !data.authenticated;
        if (data.authenticated) {
            setStatus(status, '', '');
            await loadAdmin();
            return;
        }
        setStatus(status, 'Админ-панель доступна только разрешенным Telegram-аккаунтам.', 'error');
        const state = await authReady;
        if (!state.authenticated) {
            // Telegram auth should be used instead.
        }
    }

    async function loadAdmin() {
        const summaryData = await apiJSON('/api/v1/admin/summary');
        summary.replaceChildren(
            metric('Опросы', summaryData.polls),
            metric('Викторины', summaryData.quizzes),
            metric('Голоса', summaryData.votes),
            metric('Пользователи', summaryData.users)
        );
        const data = await apiJSON('/api/v1/admin/items?type=' + currentType);
        renderAdminItems(list, data.items || [], currentType, csrf, loadAdmin);
    }

    root.querySelectorAll('[data-admin-type]').forEach((button) => {
        button.addEventListener('click', async () => {
            currentType = button.dataset.adminType;
            root.querySelectorAll('[data-admin-type]').forEach((item) => item.classList.toggle('is-active', item === button));
            await loadAdmin();
        });
    });

    logout?.addEventListener('click', async () => {
        await apiJSON('/api/v1/auth/logout', { method: 'POST' });
        window.location.href = 'index.php';
    });

    try {
        await refreshSession();
    } catch (error) {
        setStatus(status, error.message, 'error');
    }
}

function renderAdminItems(list, items, type, csrf, reload) {
    list.replaceChildren();
    if (!items.length) {
        renderMessage(list, 'Список пуст.', false);
        return;
    }
    items.forEach((item) => {
        const row = document.createElement('article');
        row.className = 'admin-row';
        row.innerHTML = `
            <div class="admin-row-info">
                <h3 class="admin-row-title">${escapeHtml(item.title)}</h3>
                <p class="admin-row-id">${escapeHtml(item.id)}</p>
            </div>
            <button class="admin-row-btn" type="button">Удалить</button>
        `;
        row.querySelector('button').addEventListener('click', async () => {
            if (!window.confirm('Удалить запись?')) return;
            await apiJSON('/api/v1/admin/' + type + '/' + encodeURIComponent(item.id), {
                method: 'DELETE',
                headers: { 'X-CSRF-Token': csrf || '' }
            });
            showToast('Запись удалена', 'success');
            await reload();
        });
        list.append(row);
    });
}

async function checkAuthStatus() {
    try {
        const data = await apiJSON('/api/v1/auth/me');
        if (data.authenticated && data.user) {
            authState = { authenticated: true, user: data.user, isAdmin: !!data.is_admin };
        } else {
            authState = { authenticated: false, user: null, isAdmin: false };
        }
    } catch {
        authState = { authenticated: false, user: null, isAdmin: false };
    }
    authReady = Promise.resolve(authState);
    renderAuthControls();
    return authState;
}

// Инициализация страницы голосования (get.php)
async function initGetPage() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || '';
    const ownerKey = params.get('owner_key') || '';
    const linkSlug = params.get('link') || '';
    
    const titleEl = document.getElementById('vote-title');
    const contentEl = document.getElementById('vote-content');
    const shareSection = document.getElementById('share-section');
    const shareUrlInput = document.getElementById('share-url');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const linkNameInput = document.getElementById('link-name');
    const createLinkBtn = document.getElementById('create-link-btn');
    const linksList = document.getElementById('links-list');
    const statsLinkBtn = document.getElementById('stats-link-btn');
    
    if (!id || !contentEl) {
        if (contentEl) {
            contentEl.innerHTML = '<div class="viewer-empty"><div class="viewer-empty-icon">❌</div><p>Неверный ID опроса</p></div>';
        }
        return;
    }
    
    try {
        const detailQuery = ownerKey ? '?owner_key=' + encodeURIComponent(ownerKey) : '';
        const data = await apiJSON('/api/v1/polls/' + encodeURIComponent(id) + detailQuery);
        
        if (titleEl) titleEl.textContent = data.title || 'Голосование';
        
        if (linkSlug) {
            window.sessionStorage.setItem('votely_link_' + id, linkSlug);
        }
        
        // Рендерим форму голосования
        renderPollView(contentEl, data, id);
        
        // Записываем посещение
        recordPollVisit(id, ownerKey, linkSlug);
        
        // Показываем секцию sharing только владельцу
        if (data.is_owner && shareSection) {
            shareSection.hidden = false;
            
            // Устанавливаем URL для копирования
            const currentUrl = window.location.href;
            if (shareUrlInput) shareUrlInput.value = currentUrl;
            
            // Кнопка копирования ссылки
            if (copyLinkBtn) {
                copyLinkBtn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(currentUrl);
                        showToast('Ссылка скопирована', 'success');
                    } catch {
                        showToast('Не удалось скопировать', 'error');
                    }
                });
            }
            
            // Ссылка на статистику
            if (statsLinkBtn) {
                const statsUrl = 'stats.php?id=' + encodeURIComponent(id) + (ownerKey ? '&owner_key=' + encodeURIComponent(ownerKey) : '');
                statsLinkBtn.href = statsUrl;
            }
            
            // Создание именованных ссылок
            if (createLinkBtn && linkNameInput && linksList) {
                createLinkBtn.addEventListener('click', async () => {
                    const name = linkNameInput.value.trim();
                    if (!name) {
                        showToast('Введите название ссылки');
                        return;
                    }
                    createLinkBtn.disabled = true;
                    try {
                        const query = ownerKey ? '?owner_key=' + encodeURIComponent(ownerKey) : '';
                        await apiJSON('/api/v1/polls/' + encodeURIComponent(id) + '/links' + query, {
                            method: 'POST',
                            body: JSON.stringify({ name })
                        });
                        linkNameInput.value = '';
                        await loadLinks();
                        showToast('Ссылка создана', 'success');
                    } catch (error) {
                        showToast(error.message, 'error');
                    } finally {
                        createLinkBtn.disabled = false;
                    }
                });
                
                // Загрузка списка ссылок
                async function loadLinks() {
                    try {
                        const query = ownerKey ? '?owner_key=' + encodeURIComponent(ownerKey) : '';
                        const linksData = await apiJSON('/api/v1/polls/' + encodeURIComponent(id) + '/links' + query);
                        renderShareLinks(linksList, id, ownerKey, linksData.items || []);
                    } catch {
                        linksList.innerHTML = '<p class="stats-empty">Не удалось загрузить ссылки</p>';
                    }
                }
                
                loadLinks();
            }
        }
    } catch (error) {
        if (contentEl) {
            contentEl.innerHTML = '<div class="viewer-empty"><div class="viewer-empty-icon">❌</div><p>' + escapeHtml(error.message) + '</p></div>';
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initToasts();
    await checkAuthStatus();
    initAuthGuards();

    // Инициализация видео фона на главной
    const video = document.querySelector('.hero-video');
    if (video) {
        // Принудительно запускаем видео сразу
        video.muted = true;
        video.play().catch(e => {
            console.log('[Video] autoplay blocked:', e);
            video.muted = false;
            video.play().catch(e2 => console.log('[Video] still blocked:', e2));
        });
        
        // Логирование для отладки
        video.addEventListener('playing', () => console.log('[Video] ✓ playing (looping)'));
        video.addEventListener('waiting', () => console.log('[Video] waiting/buffering'));
        video.addEventListener('error', (e) => console.log('[Video] error:', video.error));
    }
        
    const createForm = document.querySelector('[data-create-form]');
    if (createForm) initCreateForm(createForm);

    const browseRoot = document.querySelector('[data-browse-root]');
    if (browseRoot) initBrowsePage(browseRoot);

    const myPollsRoot = document.querySelector('[data-my-polls-root]');
    if (myPollsRoot) initMyPollsPage(myPollsRoot);

    const detailRoot = document.querySelector('[data-detail-root]');
    if (detailRoot) initDetailPage(detailRoot);

    const adminRoot = document.querySelector('[data-admin-root]');
    if (adminRoot) initAdminPanel(adminRoot);
});
