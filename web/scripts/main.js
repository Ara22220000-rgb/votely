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

// Theme Toggle
function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    const stored = localStorage.getItem('votely_theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const theme = stored || (prefersLight ? 'light' : 'dark');
    
    document.documentElement.setAttribute('data-theme', theme);
    updateToggleIcon(theme);
    
    if (toggle) {
        toggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('votely_theme', next);
            updateToggleIcon(next);
        });
    }
}

function updateToggleIcon(theme) {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.textContent = theme === 'light' ? '☀️' : '🌙';
        toggle.setAttribute('aria-label', theme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему');
    }
}

initTheme();

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
        credentials: 'same-origin',
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Ошибка запроса');
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
    const raw = user?.username || user?.first_name || 'Профиль';
    return String(raw).replace(/^@/, '').slice(0, 10);
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
    const name = user.username || user.first_name || '';
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

function initTelegramAuthUI() {
    if (document.body.dataset.telegramAuthDelegationBound === '1') return;
    document.body.dataset.telegramAuthDelegationBound = '1';
    console.log('[TelegramAuth] initTelegramAuthUI called');

    document.addEventListener('click', async (event) => {
        const btn = event.target.closest('[data-auth-action="login"]');
        if (!btn) return;
        console.log('[TelegramAuth] Login button clicked');
        event.preventDefault();
        try {
            console.log('[TelegramAuth] Fetching config...');
            const config = await apiJSON('/api/v1/auth/telegram/config');
            console.log('[TelegramAuth] Config response:', config);
            if (!config.enabled || !config.bot_username) {
                showToast('Telegram OAuth не настроен');
                return;
            }
            console.log('[TelegramAuth] Opening modal with bot_username:', config.bot_username);
            openTelegramAuthModal(config.bot_username);
        } catch (error) {
            console.error('[TelegramAuth] Error fetching config:', error);
            showToast(error.message);
        }
    });
}

// Включаем делегирование сразу, чтобы кнопка работала даже если renderAuthControls() не вызывался.
initTelegramAuthUI();

function initLogoutUI() {
    document.querySelectorAll('[data-auth-logout]').forEach((button) => {
        if (button.dataset.logoutBound === '1') return;
        button.dataset.logoutBound = '1';
        button.addEventListener('click', async () => {
            await apiJSON('/api/v1/auth/logout', { method: 'POST' });
            persistLastAuthUser(authState.user);
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
                        <a class="dropdown__item" href="my-polls.php" role="menuitem">Мои опросы</a>
                        <button class="dropdown__item auth-logout" type="button" role="menuitem" data-auth-logout>Выйти</button>
                    </div>
                </div>
            `;
        } else {
            root.innerHTML = `
                <div class="dropdown dropdown--right" data-dropdown>
                    <button class="dropdown__trigger auth-login-button" type="button" aria-haspopup="true" aria-expanded="false">
                        ${lastAuthAvatar()}
                        <span>Войти</span>
                    </button>
                    <div class="dropdown__menu auth-profile__menu" role="menu">
                        <button class="dropdown__item" type="button" role="menuitem" data-auth-action="login">Через Telegram</button>
                        <a class="dropdown__item" href="login.php" role="menuitem">Через почту</a>
                        <a class="dropdown__item" href="register.php" role="menuitem">Регистрация</a>
                    </div>
                </div>
            `;
        }
    });
    document.querySelectorAll('[data-auth-profile], .nav__right [data-dropdown]').forEach((dropdown) => {
        const trigger = dropdown.querySelector('.dropdown__trigger');
        trigger?.addEventListener('click', () => {
            const expanded = trigger.getAttribute('aria-expanded') === 'true';
            trigger.setAttribute('aria-expanded', String(!expanded));
            dropdown.classList.toggle('is-open', !expanded);
        });
    });
    initLogoutUI();
    initTelegramAuthUI();
}

function initAuthGuards() {
    document.addEventListener('click', async (event) => {
        const createLink = event.target.closest('a[href^="create.php"]');
        if (!createLink) return;
        const state = await authReady;
        if (!state.authenticated) {
            event.preventDefault();
            showToast('Войдите через Telegram, чтобы создать опрос.');
            openLoginFromConfig();
        }
    });
}

async function openLoginFromConfig() {
    const config = await apiJSON('/api/v1/auth/telegram/config');
    if (!config.enabled || !config.bot_username) {
        showToast('Telegram OAuth не настроен');
        return;
    }
    openTelegramAuthModal(config.bot_username);
}

function openTelegramAuthModal(botUsername) {
    console.log('[TelegramAuth] openTelegramAuthModal called with botUsername:', botUsername);
    document.querySelector('[data-auth-modal]')?.remove();
    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.dataset.authModal = '';
    modal.innerHTML = `
        <div class="auth-modal__panel" role="dialog" aria-modal="true" aria-labelledby="telegram-auth-title">
            <button class="auth-modal__close" type="button" aria-label="Закрыть">×</button>
            <h2 id="telegram-auth-title">Войти через Telegram</h2>
            <p>Подтвердите вход в окне Telegram.</p>
            <p class="auth-modal__status" data-auth-widget-status>Загружаем Telegram...</p>
            <div class="auth-modal__widget" data-telegram-widget></div>
        </div>
    `;
    modal.querySelector('.auth-modal__close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.remove();
    });
    document.body.append(modal);
    console.log('[TelegramAuth] Modal created and appended');

    window.onTelegramAuth = async (authData) => {
        console.log('[TelegramAuth] onTelegramAuth called with:', authData);
        if (!authData || !authData.hash) {
            console.error('[TelegramAuth] onTelegramAuth: missing hash');
            showToast('Не удалось получить данные Telegram', 'error');
            return;
        }
        try {
            console.log('[TelegramAuth] Sending POST to /api/v1/auth/telegram...');
            const payload = {
                id: authData.id,
                first_name: authData.first_name,
                auth_date: authData.auth_date,
                hash: authData.hash
            };
            if (authData.last_name) payload.last_name = authData.last_name;
            if (authData.username) payload.username = authData.username;
            if (authData.photo_url) payload.photo_url = authData.photo_url;
            const savedUser = await apiJSON('/api/v1/auth/telegram', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            console.log('[TelegramAuth] API response:', savedUser);
            persistLastAuthUser(savedUser);
            modal.remove();
            authState = { authenticated: true, user: savedUser, isAdmin: false };
            authReady = Promise.resolve(authState);
            renderAuthControls();
            showToast('Вход выполнен', 'success');
        } catch (error) {
            console.error('[TelegramAuth] API error:', error);
            showToast(error.message, 'error');
        }
    };

    renderTelegramLoginFrame(modal, botUsername);
    console.log('[TelegramAuth] renderTelegramLoginFrame called');
}

function renderTelegramLoginFrame(modal, botUsername) {
    console.log('[TelegramAuth] renderTelegramLoginFrame called with botUsername:', botUsername);

    const widget = modal.querySelector('[data-telegram-widget]');
    const status = modal.querySelector('[data-auth-widget-status]');

    if (!widget) {
        console.error('[TelegramAuth] widget container not found in modal');
        if (status) {
            status.textContent = 'Ошибка: не найден контейнер виджета Telegram. Обновите страницу.';
            status.classList.add('is-error');
        }
        return;
    }

    if (!status) {
        console.error('[TelegramAuth] status element not found in modal');
        return;
    }

    console.log('[TelegramAuth] widget and status found, creating iframe');
    const origin = window.location.origin || `${window.location.protocol}//${window.location.hostname}`;
    const iframe = document.createElement('iframe');
    const frameURL = new URL(`https://oauth.telegram.org/embed/${encodeURIComponent(botUsername)}`);
    frameURL.searchParams.set('origin', origin);
    frameURL.searchParams.set('return_to', window.location.href);
    frameURL.searchParams.set('size', 'large');
    frameURL.searchParams.set('userpic', 'false');
    frameURL.searchParams.set('request_access', 'write');

    iframe.id = 'telegram-login-' + botUsername.replace(/[^a-z0-9_]/gi, '-');
    iframe.src = frameURL.toString();
    iframe.width = '238';
    iframe.height = '40';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'no');
    iframe.style.overflow = 'hidden';
    iframe.style.colorScheme = 'light dark';
    iframe.style.border = 'none';
    iframe.style.background = 'transparent';

    function postToTelegram(event, data = {}) {
        iframe.contentWindow?.postMessage(JSON.stringify({ event, frame: iframe.id, ...data }), 'https://oauth.telegram.org');
    }

    let resolved = false;

    function handleTelegramMessage(event) {
        console.log('[TelegramAuth] Message received from origin:', event.origin, 'source:', event.source === iframe.contentWindow);
        if (event.source !== iframe.contentWindow) return;
        // Telegram embed widget can send from multiple origins
        if (event.origin !== 'https://oauth.telegram.org' &&
            event.origin !== 'https://oauth.telegram.com' &&
            event.origin !== 'https://telegram.org' &&
            event.origin !== '*') return;
        if (resolved) return;

        let data = {};
        try {
            data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch (e) {
            console.log('[TelegramAuth] Raw event.data:', event.data);
            return;
        }
        console.log('[TelegramAuth] Parsed Telegram event:', data);

        if (data.event === 'resize') {
            if (data.height) iframe.style.height = data.height + 'px';
            if (data.width) iframe.style.width = data.width + 'px';
        } else if (data.event === 'ready') {
            status.textContent = 'Нажмите кнопку "Log in with Telegram" в окне ниже.';
            status.classList.remove('is-error');
        } else if (data.event === 'get_coords') {
            postToTelegram('callback', { _cb: data._cb, value: frameCoords() });
        } else if (data.event === 'unauthorized') {
            resolved = true;
            status.textContent = 'Вы отменили вход в Telegram.';
            status.classList.add('is-error');
        } else if (data.event === 'auth_user') {
            // Telegram embed widget v1 sends:
            // { event: 'auth_user', auth_data: { id, first_name, last_name, username, photo_url, auth_date, hash } }
            let authData = null;
            if (data.auth_data && typeof data.auth_data === 'object') {
                authData = { ...data.auth_data };
                console.log('[TelegramAuth] auth_user: extracted from data.auth_data:', authData);
            } else if (data.value && typeof data.value === 'object' && data.value.auth_data) {
                authData = { ...data.value.auth_data };
                console.log('[TelegramAuth] auth_user: extracted from data.value.auth_data:', authData);
            } else {
                console.log('[TelegramAuth] auth_user: data structure:', JSON.stringify(data, null, 2));
            }

            if (authData && authData.hash && authData.id) {
                console.log('[TelegramAuth] auth_user: authData passed validation, resolving');
                resolved = true;
                window.removeEventListener('message', handleTelegramMessage);
                window.onTelegramAuth(authData);
            } else {
                console.log('[TelegramAuth] auth_user: authData validation failed', { authData, hasHash: !!authData?.hash, hasId: !!authData?.id });
                status.textContent = 'Некорректные данные от Telegram (нет hash или id). Проверьте консоль (F12).';
                status.classList.add('is-error');
                console.error('Telegram auth_user:', JSON.stringify(data, null, 2));
            }
        } else if (data.event === 'auth_result') {
            // Telegram embed widget v2 sends:
            // { event: 'auth_result', value: { auth_data: {...}, hash: '...' } }
            // or { event: 'auth_result', value: { id: ..., hash: '...', ... } }
            let authData = null;
            if (data.value && typeof data.value === 'object') {
                // Nested format: value.auth_data or value with fields directly
                if (data.value.auth_data && typeof data.value.auth_data === 'object') {
                    authData = { ...data.value.auth_data };
                    // hash can be at value level or inside auth_data
                    authData.hash = data.value.hash || data.value.auth_data.hash || '';
                } else if (data.value.hash) {
                    // Flat format inside value
                    authData = { ...data.value };
                }
            } else if (data.auth_data && typeof data.auth_data === 'object') {
                // Legacy format
                authData = { ...data.auth_data };
                authData.hash = data.hash || '';
            }

            if (authData && authData.hash && authData.id) {
                resolved = true;
                window.removeEventListener('message', handleTelegramMessage);
                window.onTelegramAuth(authData);
            } else {
                status.textContent = 'Некорректные данные от Telegram (нет hash или id). Проверьте консоль (F12).';
                status.classList.add('is-error');
                console.error('Telegram auth_result:', JSON.stringify(data, null, 2));
            }
        }
    }

    window.addEventListener('message', handleTelegramMessage);
    // Also log ALL messages for debugging (CORS will still block actual data)
    window.addEventListener('message', (e) => {
        if (e.source !== iframe.contentWindow) {
            // Silently ignore non-iframe messages
            return;
        }
        // Already handled by handleTelegramMessage, just log for debugging
        console.log('[TelegramAuth] ALL message event:', e.origin, e.data ? (typeof e.data === 'string' ? JSON.parse(e.data) : e.data) : '(no data)');
    }, { once: true });

    // Timeout: if no auth_result after 60s, show error
    window.setTimeout(() => {
        if (!resolved && modal.isConnected) {
            status.textContent = 'Вход не подтверждён. Нажмите "Log in with Telegram" в окне Telegram.';
            status.classList.remove('is-error');
        }
    }, 60000);

    // Show error if iframe hasn't become ready after a delay.
    // Don't use iframe.onload — it fires when the element is created,
    // not when the remote content from oauth.telegram.org finishes loading.
    window.setTimeout(() => {
        if (!resolved && modal.isConnected && status.textContent.trim() === 'Загружаем Telegram...') {
            status.textContent = 'Если кнопка Telegram не появилась, проверьте домен в BotFather и обновите страницу.';
            status.classList.add('is-error');
        }
    }, 5000);

    try {
        console.log('[TelegramAuth] Inserting iframe into widget');
        widget.replaceChildren(iframe);
        console.log('[TelegramAuth] Iframe inserted successfully, src:', iframe.src);
    } catch (err) {
        console.error('[TelegramAuth] Failed to insert iframe:', err);
        status.textContent = 'Ошибка вставки виджета: ' + err.message;
        status.classList.add('is-error');
    }
}

function initCreateForm(form) {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') === 'quiz' ? 'quiz' : 'poll';
    document.body.dataset.contentType = type;
    const pollFields = form.querySelectorAll('[data-poll-fields]');
    const quizFields = form.querySelector('[data-quiz-fields]');
    const optionsList = form.querySelector('[data-options-list]');
    const questionsList = form.querySelector('[data-questions-list]');
    const status = form.querySelector('[data-form-status]');

    document.querySelectorAll('[data-type-link]').forEach((link) => {
        link.classList.toggle('is-active', link.dataset.typeLink === type);
    });
    pollFields.forEach((section) => {
        section.hidden = type !== 'poll';
    });
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
        setStatus(status, '', '');
        try {
            const state = await authReady;
            if (!state.authenticated) {
                setStatus(status, 'Войдите через Telegram, чтобы создать.', 'error');
                await openLoginFromConfig();
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
        } finally {
            btn.disabled = false;
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

function addOption(list) {
    if (!list) return;
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
        <label class="field">
            <span class="field__label">Вопрос викторины</span>
            <input class="field__control" name="question" placeholder="Например: Какая планета самая большая?" required maxlength="500">
        </label>
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

function collectPollPayload(form) {
    return {
        title: form.elements.title.value,
        description: form.elements.description.value,
        options: Array.from(form.querySelectorAll('[name="option"]')).map((input) => input.value),
        visibility: form.elements.visibility?.value || 'public'
    };
}

function collectQuizPayload(form) {
    return {
        title: form.elements.title.value,
        description: form.elements.description.value,
        question: form.querySelector('[name="question"]').value,
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
    document.body.dataset.contentType = type;
    const list = root.querySelector('[data-list]');
    const title = root.querySelector('[data-browse-title]');
    if (title) title.textContent = type === 'quiz' ? 'Викторины' : 'Опросы';
    document.querySelectorAll('[data-type-link]').forEach((link) => {
        link.classList.toggle('is-active', link.dataset.typeLink === type);
    });
    try {
        const query = params.get('q') ? '?q=' + encodeURIComponent(params.get('q')) : '';
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
        const card = document.createElement('a');
        card.className = 'content-card';
        card.href = 'view.php?type=' + type + '&id=' + encodeURIComponent(item.id);
        card.innerHTML = `
            <h2>${escapeHtml(item.title)}</h2>
            <p>${escapeHtml(item.description || (type === 'quiz' ? 'Викторина' : 'Опрос'))}</p>
            <span>${type === 'quiz' ? 'Открыть викторину' : 'Открыть опрос'}</span>
        `;
        list.append(card);
    });
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
        const detailQuery = type === 'poll' && ownerKey ? '?owner_key=' + encodeURIComponent(ownerKey) : '';
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

    if (type === 'poll' && ownerKey) {
        renderOwnerStats(container, data, id, ownerKey);
    } else if (type === 'quiz') {
        renderQuizView(content, data);
    } else {
        renderPollView(content, data, id);
    }
}

async function renderOwnerStats(container, poll, id, ownerKey) {
    const stats = await apiJSON('/api/v1/polls/' + encodeURIComponent(id) + '/stats?owner_key=' + encodeURIComponent(ownerKey));
    await renderStatsBlock(container, poll, stats, id, ownerKey);
}

async function initStatsPage() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || '';
    const ownerKey = params.get('owner_key') || '';
    const title = document.querySelector('#stats-title');
    const content = document.querySelector('#stats-content');
    if (!id || !content) return;
    try {
        const pollQuery = ownerKey ? '?owner_key=' + encodeURIComponent(ownerKey) : '';
        const poll = await apiJSON('/api/v1/polls/' + encodeURIComponent(id) + pollQuery);
        const stats = await apiJSON('/api/v1/polls/' + encodeURIComponent(id) + '/stats?owner_key=' + encodeURIComponent(ownerKey));
        if (title) title.textContent = poll.title || 'Статистика';
        const holder = document.createElement('div');
        await renderStatsBlock(holder, poll, stats, id, ownerKey);
        content.replaceChildren(...holder.childNodes);
    } catch (error) {
        renderMessage(content, error.message, true);
    }
}

async function renderStatsBlock(container, poll, stats, pollID = '', ownerKey = '') {
    const header = document.createElement('div');
    header.className = 'stats-header';
    header.innerHTML = `
        <div>
            <p class="creator__eyebrow">Статистика владельца</p>
            <h1 class="viewer__title">${escapeHtml(poll.title)}</h1>
            <p class="viewer__description">${escapeHtml(poll.description || 'Опрос без описания')}</p>
        </div>
        <div class="metric-box"><span>${stats.total_votes || 0}</span><small>голосов</small></div>
    `;
    const chartSection = document.createElement('section');
    chartSection.className = 'stats-chart-section';
    const totalVotes = stats.total_votes || 0;
    const pieChart = document.createElement('div');
    pieChart.className = 'pie-chart-large';
    if (totalVotes > 0) {
        pieChart.append(buildPieSvg(stats.options || []));
    } else {
        pieChart.innerHTML = '<p class="stats-empty">Голосов пока нет</p>';
    }
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
    chartSection.append(pieChart, legend);
    const meta = document.createElement('div');
    meta.className = 'stats-meta';
    meta.append(
        metric('Статус', stats.poll?.is_closed ? 'Завершен' : 'Активен'),
        metric('Анонимность', stats.poll?.is_anonymous ? 'Включена' : 'Открытая'),
        metric('Доступ', stats.poll?.visibility === 'private' ? 'Приватный' : 'Публичный'),
        metric('Страны', stats.poll?.allowed_countries?.length ? stats.poll.allowed_countries.join(', ') : 'Все')
    );
    const analytics = buildAnalyticsSection(stats.analytics || {});
    const links = pollID ? await buildShareLinksSection(pollID, ownerKey, stats.analytics?.links || []) : null;
    container.replaceChildren(header, chartSection, meta, analytics);
    if (links) container.append(links);
}

function buildAnalyticsSection(analytics) {
    const section = document.createElement('section');
    section.className = 'stats-analytics';
    section.innerHTML = '<h2 class="stats-analytics__title">Аудитория</h2>';
    const grid = document.createElement('div');
    grid.className = 'stats-analytics__grid';
    grid.append(
        analyticsCard('Браузеры', analytics.browsers || []),
        analyticsCard('Устройства', analytics.devices || []),
        analyticsCard('ОС', analytics.os || []),
        analyticsCard('Страны', analytics.locations || []),
        analyticsCard('Источники', analytics.sources || [])
    );
    section.append(grid);
    return section;
}

function analyticsCard(title, items) {
    const card = document.createElement('article');
    card.className = 'analytics-card';
    card.innerHTML = `<h3 class="analytics-card__title">${escapeHtml(title)}</h3>`;
    const list = document.createElement('div');
    list.className = 'analytics-list';
    if (!items.length) {
        list.innerHTML = '<p class="stats-empty stats-empty--small">Нет данных</p>';
    } else {
        items.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'analytics-list__row';
            row.innerHTML = `<span class="analytics-list__name">${escapeHtml(item.name || 'Unknown')}</span><span class="analytics-list__count">${item.count || 0}</span>`;
            list.append(row);
        });
    }
    card.append(list);
    return card;
}

async function buildShareLinksSection(pollID, ownerKey, initialLinks) {
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

    async function loadLinks() {
        const data = await apiJSON('/api/v1/polls/' + encodeURIComponent(pollID) + '/links' + query);
        renderShareLinks(list, pollID, ownerKey, data.items || []);
    }

    renderShareLinks(list, pollID, ownerKey, initialLinks);
    button.addEventListener('click', async () => {
        const name = input.value.trim();
        if (!name) {
            showToast('Введите название ссылки');
            return;
        }
        button.disabled = true;
        try {
            await apiJSON('/api/v1/polls/' + encodeURIComponent(pollID) + '/links' + query, {
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

function renderShareLinks(list, pollID, ownerKey, links) {
    list.replaceChildren();
    if (!links.length) {
        renderMessage(list, 'Именных ссылок пока нет.', false);
        return;
    }
    links.forEach((link) => {
        const url = link.url || buildShareURL(pollID, link.slug);
        const row = document.createElement('article');
        row.className = 'link-item';
        row.innerHTML = `
            <div class="link-item__info">
                <strong class="link-item__name">${escapeHtml(link.name)}</strong>
                <span class="link-item__utm">${escapeHtml(url)}</span>
                <span class="link-item__utm">${link.visits || 0} переходов · ${link.votes || 0} голосов</span>
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
            await apiJSON('/api/v1/polls/' + encodeURIComponent(pollID) + '/links/' + encodeURIComponent(link.id) + query, { method: 'DELETE' });
            row.remove();
            showToast('Ссылка удалена', 'success');
        });
        list.append(row);
    });
}

function buildShareURL(pollID, slug) {
    const url = new URL('/view.php', window.location.origin);
    url.searchParams.set('type', 'poll');
    url.searchParams.set('id', pollID);
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
    const selectedOptionID = data.selected_option_id || '';
    const totalVotes = options.reduce((sum, option) => sum + (option.votes || 0), 0);
    options.forEach((option) => {
        const label = document.createElement('label');
        label.className = 'vote-option';
        const isSelected = option.id === selectedOptionID;
        label.classList.toggle('is-user-selected', isSelected);
        const percent = totalVotes ? Math.round(((option.votes || 0) / totalVotes) * 100) : 0;
        label.innerHTML = `
            <input type="radio" name="opt" value="${escapeHtml(option.id)}" ${isSelected ? 'checked' : ''} ${selectedOptionID ? 'disabled' : ''}>
            <span class="vote-option__body">
                <span class="vote-option__top">
                    <span class="vote-option__text">${escapeHtml(option.text)}</span>
                    <span class="vote-count">${isSelected ? 'Ваш выбор · ' : ''}${option.votes || 0} · ${percent}%</span>
                </span>
                <span class="vote-result-bar" aria-label="Заполнено ${percent}%">
                    <span class="vote-result-bar__fill" style="--target:${percent}%"></span>
                    <span class="vote-result-bar__label">${percent}%</span>
                </span>
            </span>
        `;
        list.append(label);
    });
    const btn = document.createElement('button');
    btn.className = 'primary-button';
    btn.textContent = selectedOptionID ? 'Голос учтен' : 'Голосовать';
    btn.disabled = !!selectedOptionID;
    if (!options.length) {
        renderMessage(list, 'Варианты ответов не найдены', true);
        btn.disabled = true;
    }
    form.append(list, btn);
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selected = form.querySelector('input:checked');
        if (!selected) {
            showToast('Выберите вариант');
            return;
        }
        if (selectedOptionID) return;
        btn.disabled = true;
        try {
            const state = await authReady;
            if (!state.authenticated) {
                await openLoginFromConfig();
                return;
            }
            const linkSlug = new URLSearchParams(window.location.search).get('link') || window.sessionStorage.getItem('votely_link_' + id) || '';
            const voteQuery = linkSlug ? '?link=' + encodeURIComponent(linkSlug) : '';
            const result = await apiJSON('/api/v1/polls/' + encodeURIComponent(id) + '/votes' + voteQuery, {
                method: 'POST',
                body: JSON.stringify({ option_id: selected.value })
            });
            renderPollView(container, result, id);
            animateVoteBars(container);
            showToast('Голос учтен', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            btn.disabled = false;
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
    container.innerHTML = `
        <div class="quiz-viewer">
            <div class="quiz-question-box"><h2>${escapeHtml(data.question)}</h2></div>
            <div class="answer-list"></div>
            <div class="vote-actions">
                <button class="primary-button" type="button">Проверить</button>
                <p class="status form-status" role="status"></p>
            </div>
        </div>
    `;
    const list = container.querySelector('.answer-list');
    (data.answers || []).forEach((answer) => {
        const label = document.createElement('label');
        label.className = 'vote-option';
        label.innerHTML = `
            <input type="radio" name="ans" value="${escapeHtml(answer.id)}">
            <span class="vote-option__body">
                <span class="vote-option__top">
                    <span class="vote-option__text">${escapeHtml(answer.text)}</span>
                    <span class="vote-count" hidden></span>
                </span>
                <span class="vote-result-bar"><span class="vote-result-bar__fill" style="--target:0%"></span><span class="vote-result-bar__label">0%</span></span>
            </span>
        `;
        list.append(label);
    });
    const button = container.querySelector('.primary-button');
    button.addEventListener('click', async () => {
        const selected = container.querySelector('input:checked');
        const status = container.querySelector('.status');
        if (!selected) {
            setStatus(status, 'Выберите вариант', 'error');
            return;
        }
        button.disabled = true;
        try {
            const state = await authReady;
            if (!state.authenticated) {
                await openLoginFromConfig();
                return;
            }
            const result = await apiJSON('/api/v1/quizzes/' + encodeURIComponent(data.id) + '/answers', {
                method: 'POST',
                body: JSON.stringify({ answer_id: selected.value })
            });
            renderQuizResult(container, data, result);
            showToast(result.is_correct ? 'Ответ сохранен: правильно' : 'Ответ сохранен', result.is_correct ? 'success' : 'error');
        } catch (error) {
            showToast(error.message, 'error');
            setStatus(status, error.message, 'error');
        } finally {
            button.disabled = false;
        }
    });
}

function renderQuizResult(container, data, result) {
    container.innerHTML = `
        <div class="quiz-viewer">
            <div class="quiz-question-box"><h2>${escapeHtml(data.question)}</h2></div>
            <div class="answer-list"></div>
            <div class="vote-actions">
                <p class="status form-status ${result.is_correct ? 'is-success' : 'is-error'}" role="status">${result.is_correct ? 'Правильно' : 'Ответ сохранен'}</p>
            </div>
        </div>
    `;
    const list = container.querySelector('.answer-list');
    (result.answers || []).forEach((answer) => {
        const label = document.createElement('div');
        const isSelected = answer.id === result.selected_answer_id;
        label.className = 'vote-option is-result';
        label.classList.toggle('is-correct', !!answer.is_correct);
        label.classList.toggle('is-error', isSelected && !answer.is_correct);
        label.innerHTML = `
            <span class="vote-option__marker"></span>
            <span class="vote-option__body">
                <span class="vote-option__top">
                    <span class="vote-option__text">${escapeHtml(answer.text)}</span>
                    <span class="vote-count">${answer.attempts || 0} · ${answer.percent || 0}%</span>
                </span>
                <span class="vote-result-bar">
                    <span class="vote-result-bar__fill" style="--target:${answer.percent || 0}%"></span>
                    <span class="vote-result-bar__label">${answer.percent || 0}%</span>
                </span>
            </span>
        `;
        list.append(label);
    });
    animateVoteBars(container);
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

    async function refreshSession() {
        const data = await apiJSON('/api/v1/admin/me');
        csrf = data.csrf || null;
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
        if (!state.authenticated) openLoginFromConfig();
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

document.addEventListener('DOMContentLoaded', () => {
    initToasts();
    checkAuthStatus();
    initAuthGuards();

    const createForm = document.querySelector('[data-create-form]');
    if (createForm) initCreateForm(createForm);

    const browseRoot = document.querySelector('[data-browse-root]');
    if (browseRoot) initBrowsePage(browseRoot);

    const detailRoot = document.querySelector('[data-detail-root]');
    if (detailRoot) initDetailPage(detailRoot);

    const adminRoot = document.querySelector('[data-admin-root]');
    if (adminRoot) initAdminPanel(adminRoot);
});
