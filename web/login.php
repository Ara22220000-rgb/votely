<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Вход · Votely</title>
    <link rel="icon" href="votely.svg" type="image/svg+xml">
    <link rel="stylesheet" href="styles/main.css?v=2">
</head>
<body>
    <div class="page">
        <header class="site-header">
            <nav class="nav" aria-label="Основная навигация">
                <a class="brand" href="index.php" aria-label="Votely, главная">
                    <img class="brand__logo" src="votely.svg" alt="">
                    <span class="brand__name">Votely</span>
                </a>

                <div class="nav__middle">
                    <a class="nav-link" href="index.php">Главная</a>
                    <div class="dropdown" data-dropdown>
                        <button class="dropdown__trigger" type="button" aria-haspopup="true" aria-expanded="false">Создать</button>
                        <div class="dropdown__menu" role="menu">
                            <a class="dropdown__item" href="create.php?type=poll" role="menuitem">Создать опрос</a>
                            <a class="dropdown__item" href="create.php?type=quiz" role="menuitem">Создать викторину</a>
                        </div>
                    </div>
                    <a class="nav-link" href="browse.php?type=poll">Опросы</a>
                </div>
                <div class="searchdiv">
                    <form class="search-form" action="browse.php" role="search" method="GET">
                        <input type="hidden" name="type" value="poll">
                        <input name="q" class="search" type="text" placeholder="Поиск" aria-label="Найти опрос" value="">
                        <button class="search-button" type="submit" aria-label="Найти">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#b9c7d6"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="0.4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <circle cx="10.5" cy="10.5" r="6.2"
          stroke="url(#g)"
          stroke-width="1.6"
          fill="none"
          filter="url(#glow)"/>
  <circle cx="8.2" cy="8.2" r="2.8"
          fill="rgba(255,255,255,0.18)"/>
  <path d="M15.2 15.2 L20 20"
        stroke="url(#g)"
        stroke-width="2"
        stroke-linecap="round"/>
</svg>
                        </button>
                    </form>
                </div>

                <div class="nav__right">
                    <div class="dropdown dropdown--right" data-dropdown>
                        <button class="dropdown__trigger" type="button" aria-haspopup="true" aria-expanded="false">Войти</button>
                        <div class="dropdown__menu" role="menu">
                            <button class="dropdown__item" type="button" role="menuitem" data-auth-action="login">Через Telegram</button>
                            <a class="dropdown__item" href="login.php" role="menuitem">Через почту</a>
                            <a class="dropdown__item" href="register.php" role="menuitem">Регистрация</a>
                        </div>
                    </div>
                </div>
            </nav>
        </header>

        <main class="creator">
            <section class="creator__panel" style="max-width: 450px; margin: 0 auto;">
                <div class="creator__header">
                    <p class="creator__eyebrow">Авторизация</p>
                    <h1 class="creator__title">Вход в аккаунт</h1>
                </div>

                <form id="login-form" class="creator-form" style="margin-top: 24px;">
                    <div class="field" style="margin-bottom: 20px;">
                        <label class="field__label" for="email">Email</label>
                        <input type="email" id="email" name="email" class="field__control" placeholder="your@email.com" required>
                    </div>

                    <div class="field" style="margin-bottom: 20px;">
                        <label class="field__label" for="password">Пароль</label>
                        <input type="password" id="password" name="password" class="field__control" placeholder="••••••••" required minlength="6">
                    </div>

                    <button type="submit" class="primary-button" style="width: 100%; justify-content: center; margin-bottom: 16px;">
                        Войти
                    </button>

                    <p class="auth-switch-text" style="text-align: center; color: #6b6e73; font-size: 15px;">
                        Нет аккаунта? <a href="register.php" style="color: var(--green); text-decoration: none; font-weight: 700;">Зарегистрироваться</a>
                    </p>
                </form>
            </section>
        </main>

        <footer class="site-footer">
            <div class="footer__inner">
                <div class="footer__top">
                    <div class="footer__brand">
                        <a class="footer__logo" href="index.php" aria-label="Votely, главная">
                            <img class="footer__logo-img" src="votely.svg" alt="">
                            <span>Votely</span>
                        </a>
                        <p class="footer__description">Быстрые онлайн-опросы и викторины без лишней сложности.</p>
                    </div>

                    <nav class="footer__links" aria-label="Ссылки в подвале">
                        <a class="footer__link" href="index.php">Главная</a>
                        <a class="footer__link" href="create.php?type=poll">Создать опрос</a>
                        <a class="footer__link" href="browse.php?type=poll">Опросы</a>
                        <a class="footer__link" href="create.php?type=quiz">Создать викторину</a>
                        <a class="footer__link" href="browse.php?type=quiz">Викторины</a>
                        <a class="footer__link" href="wiki.php">Вики</a>
                    </nav>

                    <div class="footer__contact">
                        <a class="footer__email" href="mailto:help@votely.local">help@votely.local</a>
                        <div class="footer__social-row" aria-label="Социальные сети">
                            <a class="footer__social" href="https://t.me/votely_net" aria-label="Telegram">TG</a>
                        </div>
                    </div>
                </div>

                <p class="footer__bottom">© 2026 Votely</p>
            </div>
        </footer>
    </div>

    <script src="scripts/main.js"></script>
    <script>
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = e.target.querySelector('button[type="submit"]');
            
            btn.disabled = true;
            btn.textContent = 'Вход...';
            
            try {
                const res = await fetch('/api/v1/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                
                if (!res.ok) throw new Error(data.message || 'Ошибка входа');
                
                // Сохраняем данные пользователя
                localStorage.setItem('votely_user', JSON.stringify(data.user));
                
                // Перенаправляем на главную или туда, откуда пришли
                const redirect = new URLSearchParams(window.location.search).get('redirect') || 'index.php';
                window.location.href = redirect;
            } catch (err) {
                alert(err.message);
                btn.disabled = false;
                btn.textContent = 'Войти';
            }
        });
    </script>
</body>
</html>
