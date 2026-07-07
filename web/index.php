<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Votely</title>
    <link rel="icon" href="votely.svg" type="image/svg+xml">
    <link rel="stylesheet" href="styles/main.css?v=2">
</head>
<body data-content-type="home">
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
                        <button class="dropdown__trigger" type="button" aria-haspopup="true" aria-expanded="false">
                            Создать
                        </button>
                        <div class="dropdown__menu" role="menu">
                            <a class="dropdown__item" href="create.php?type=poll" role="menuitem">Создать опрос</a>
                            <a class="dropdown__item" href="create.php?type=quiz" role="menuitem">Создать викторину</a>
                        </div>
                    </div>
                    <a class="nav-link" href="browse.php?type=poll">Опросы</a>
                    <a class="nav-link" href="browse.php?type=quiz">Викторины</a>
                </div>
                <div class="searchdiv">
                    <form class="search-form" action="browse.php" role="search">
                        <input name="q" class="search" type="text" placeholder="Поиск" aria-label="Найти опрос">
                        <button class="search-button" type="submit" aria-label="Найти">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">

  <defs>
    <!-- мягкий холодный градиент -->
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#b9c7d6"/>
    </linearGradient>

    <!-- лёгкое свечение -->
    <filter id="glow">
      <feGaussianBlur stdDeviation="0.4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

  </defs>

  <!-- круг (линза) -->
  <circle cx="10.5" cy="10.5" r="6.2"
          stroke="url(#g)"
          stroke-width="1.6"
          fill="none"
          filter="url(#glow)"/>

  <!-- внутренний блик -->
  <circle cx="8.2" cy="8.2" r="2.8"
          fill="rgba(255,255,255,0.18)"/>

  <!-- ручка -->
  <path d="M15.2 15.2 L20 20"
        stroke="url(#g)"
        stroke-width="2"
        stroke-linecap="round"/>

</svg>
                        </button>
                    </form>
                </div>

                <div class="nav__right">
                    <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Переключить тему">🌙</button>
                    <div class="dropdown dropdown--right" data-dropdown>
                        <button class="dropdown__trigger" type="button" aria-haspopup="true" aria-expanded="false">
                            Войти
                        </button>
                        <div class="dropdown__menu" role="menu">
                            <button class="dropdown__item" type="button" role="menuitem" data-auth-action="login">Через Telegram</button>
                        </div>
                    </div>
                </div>
            </nav>
        </header>

        <main class="hero">
            <section class="hero__content" aria-labelledby="hero-title">
                <img class="hero__logo" src="votely.svg" alt="">
                <h1 class="hero__title" id="hero-title">Место, где можно быстро устроить голосование.</h1>

                <div class="hero__actions">
                    <div class="dropdown create-cta" data-dropdown>
                        <button class="dropdown__trigger" type="button" aria-haspopup="true" aria-expanded="false">
                            Создать
                        </button>
                        <div class="dropdown__menu" role="menu">
                            <a class="dropdown__item" href="create.php?type=poll" role="menuitem">Создать опрос</a>
                            <a class="dropdown__item" href="create.php?type=quiz" role="menuitem">Создать викторину</a>
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
                <div class="footer__theme-toggle" id="footer-theme-toggle" title="Переключить тему">🌙</div>
            </div>
        </footer>
    </div>

    <script src="scripts/main.js"></script>
</body>
</html>
