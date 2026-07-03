<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Голосование · Votely</title>
    <link rel="icon" href="votely.svg" type="image/svg+xml">
    <link rel="stylesheet" href="styles/main.css?v=2">
    <meta name="robots" content="noindex, nofollow">
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
            <section class="creator__panel">
                <div class="creator__header">
                    <div>
                        <p class="creator__eyebrow">Голосование</p>
                        <h1 class="creator__title" id="vote-title">Загрузка...</h1>
                    </div>
                </div>

                <div id="vote-content" class="viewer__content">
                    <div class="viewer-empty">
                        <div class="viewer-empty-icon">⏳</div>
                        <p>Загрузка данных...</p>
                    </div>
                </div>

                <div id="share-section" class="share-section" hidden>
                    <div class="share-box">
                        <h3 class="share-title">📢 Поделиться опросом</h3>
                        <div class="share-url-box">
                            <input type="text" class="share-url-input" id="share-url" readonly>
                            <button class="share-copy-btn" id="copy-link-btn" type="button">
                                <span class="copy-icon">📋</span> Копировать
                            </button>
                        </div>
                        <p class="share-hint">Отправьте эту ссылку участникам для голосования</p>
                    </div>
                    
                    <div class="share-box" style="margin-top: 16px;">
                        <h3 class="share-title">
                            🔗 Именованные ссылки
                            </h3>
                        
                        <div class="tooltip-content" id="links-tooltip" hidden>
                            <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700;">Зачем нужны именованные ссылки?</p>
                            <p style="margin: 0 0 12px 0; font-size: 13px; color: #aeb0b4; line-height: 1.5;">
                                Создавайте ссылки с названиями для разных платформ, чтобы отслеживать источники голосов в статистике.
                            </p>
                            <p style="margin: 0; font-size: 13px; color: #aeb0b4; line-height: 1.5;">
                                <strong>Примеры:</strong> Telegram, VK, Email, Сайт, QR-код
                            </p>
                        </div>
                        
                        <div class="create-link-form">
                            <input type="text" id="link-name" class="field__control" placeholder="Название (например: Telegram)" style="flex: 1; min-width: 200px;">
                            <button class="primary-button" id="create-link-btn" type="button">
                                <span>+</span> Создать
                            </button>
                        </div>
                        
                        <div id="links-list" class="links-list" style="margin-top: 12px;"></div>
                    </div>
                    
                    <div class="share-box" style="margin-top: 16px; border-color: rgba(138, 92, 175, 0.3); background: linear-gradient(135deg, rgba(138, 92, 175, 0.1) 0%, rgba(138, 92, 175, 0.05) 100%);">
                        <h3 class="share-title">📊 Статистика</h3>
                        <div class="share-url-box">
                            <a href="#" class="share-copy-btn" id="stats-link-btn" style="text-decoration: none; justify-content: center;">
                                <span class="copy-icon">📈</span> Смотреть статистику
                            </a>
                        </div>
                        <p class="share-hint">Диаграммы по устройствам, ОС и источникам</p>
                    </div>
                </div>
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
                    </nav>

                    <div class="footer__contact">
                        <a class="footer__email" href="mailto:help@votely.local">help@votely.local</a>
                        <div class="footer__social-row" aria-label="Социальные сети">
                            <a class="footer__social" href="#" aria-label="Telegram">TG</a>
                        </div>
                    </div>
                </div>

                <p class="footer__bottom">© 2026 Votely</p>
            </div>
        </footer>
    </div>

    <script src="scripts/main.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            initGetPage();
        });
    </script>
</body>
</html>
