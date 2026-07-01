<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Просмотр · Votely</title>
    <link rel="stylesheet" href="styles/main.css">
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
                    <a class="nav-link" href="browse.php?type=poll">Опросы</a>

                    <div class="dropdown" data-dropdown>
                        <button class="dropdown__trigger" type="button" aria-haspopup="true" aria-expanded="false">Создать</button>
                        <div class="dropdown__menu" role="menu">
                            <a class="dropdown__item" href="create.php?type=poll" role="menuitem">Создать опрос</a>
                            <a class="dropdown__item" href="create.php?type=quiz" role="menuitem">Создать викторину</a>
                        </div>
                    </div>
                </div>
                <div class="searchdiv">
                    <form class="search-form" action="browse.php" role="search" method="GET">
                        <input type="hidden" name="type" value="poll">
                        <input name="q" class="search" type="text" placeholder="Поиск" aria-label="Найти опрос" value="">
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
                    <div class="dropdown dropdown--right" data-dropdown>
                        <button class="dropdown__trigger" type="button" aria-haspopup="true" aria-expanded="false">Войти</button>
                        <div class="dropdown__menu" role="menu">
                            <a class="dropdown__item" href="#" role="menuitem">Регистрация</a>
                            <a class="dropdown__item" href="#" role="menuitem">Авторизация</a>
                        </div>
                    </div>
                </div>
            </nav>
        </header>

        <main class="creator" data-browse-root>
            <section class="creator__panel">
                <div class="creator__header">
                    <div>
                        <p class="creator__eyebrow">Просмотр</p>
                        <h1 class="creator__title" data-browse-title>
                            <span class="type-icon">📊</span>
                            <span class="type-text">Опросы</span>
                        </h1>
                    </div>
                    <div class="creator__switch" aria-label="Тип списка">
                        <a class="creator__switch-link" href="browse.php?type=poll" data-type-link="poll">
                            <span class="switch-icon">📊</span> Опросы
                        </a>
                        <a class="creator__switch-link" href="browse.php?type=quiz" data-type-link="quiz">
                            <span class="switch-icon">🧠</span> Викторины
                        </a>
                    </div>
                </div>
                <div class="browse-type-badge" data-type-badge>
                    <span class="badge-icon">📊</span>
                    <span class="badge-text">Показаны опросы</span>
                </div>
                <div class="cards-grid" data-list></div>
            </section>
        </main>
    </div>
    <script src="scripts/main.js"></script>
</body>
</html>
