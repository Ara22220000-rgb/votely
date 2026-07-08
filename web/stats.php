<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Статистика · Votely</title>
    <link rel="icon" href="votely.svg" type="image/svg+xml">
    <link rel="stylesheet" href="styles/main.css?v=4">
    <meta name="robots" content="noindex, nofollow">
</head>
<body data-content-type="stats">
    <div class="page">
        <div class="hero-bg"></div>
        <div class="hero-video-container">
            <video class="hero-video" autoplay muted loop playsinline preload="auto">
                <source src="images/fon.mp4" type="video/mp4">
            </video>
            <div class="hero-video-overlay"></div>
        </div>
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
                    <a class="nav-link" href="browse.php?type=quiz">Викторины</a>
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
                    <button class="auth-login-button" type="button" data-auth-action="login">Войти</button>
                </div>
            </nav>
        </header>

        <main class="creator">
            <section class="creator__panel">
                <div class="creator__header">
                    <div>
                        <p class="creator__eyebrow">Аналитика</p>
                        <h1 class="creator__title" id="stats-title">Загрузка...</h1>
                        <p class="creator__subtitle" id="stats-description"></p>
                    </div>
                    <div class="creator__actions">
                        <a href="javascript:history.back()" class="ghost-button" style="padding-top: 10px;">← Назад</a>
                    </div>
                </div>

                <div id="stats-content" class="stats-content">
                    <div class="viewer-empty">
                        <div class="viewer-empty-icon">⏳</div>
                        <p>Загрузка статистики...</p>
                    </div>
                </div>

                <div class="create-link-modal" id="create-link-modal" hidden>
                    <div class="create-link-modal__overlay"></div>
                    <div class="create-link-modal__panel">
                        <h2 class="create-link-modal__title">Создать именную ссылку</h2>
                        <p class="create-link-modal__desc">Придумайте название для ссылки, чтобы отслеживать переходы из разных источников.</p>
                        <div class="field">
                            <span class="field__label">Название ссылки</span>
                            <input class="field__control" type="text" id="link-name-input" maxlength="80" placeholder="Например: telegram-ads">
                        </div>
                        <div class="create-link-modal__actions">
                            <button class="ghost-button" type="button" id="cancel-link-btn">Отмена</button>
                            <button class="primary-button" type="button" id="confirm-link-btn">Создать</button>
                        </div>
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
                        <a class="footer__link" href="browse.php?type=quiz">Викторины</a>
                        <a class="footer__link" href="premium.php">Премиум</a>
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
                <p class="footer__bottom_right">Версия: 26.3</p>
            </div>
        </footer>
    </div>

    <script src="scripts/main.js?v=<?php echo time(); ?>"></script>
    <script src="scripts/smoke-grenade.js"></script>
    <script src="scripts/glass-shatter.js"></script>
    <script src="scripts/flash-drive-explosion.js"></script>
    <script src="scripts/confetti.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            initToasts();
            checkAuthStatus();
            initStatsPage();
        });
    </script>
</body>
</html>
