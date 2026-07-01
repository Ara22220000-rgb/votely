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
                    <form class="search-form" action="browse.php" role="search">
                        <input name="q" class="search" type="text" placeholder="Поиск" aria-label="Найти опрос">
                        <button class="search-button" type="submit" aria-label="Найти">
                            <svg class="search-button__icon" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M10.8 4.4a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8ZM2.8 10.8a8 8 0 0 1 14.1 5.2l3.7 3.7a1.1 1.1 0 0 1-1.6 1.6l-3.7-3.7A8 8 0 0 1 2.8 10.8Z"/>
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
                        <h1 class="creator__title" data-browse-title>Опросы</h1>
                    </div>
                    <div class="creator__switch" aria-label="Тип списка">
                        <a class="creator__switch-link" href="browse.php?type=poll" data-type-link="poll">Опросы</a>
                        <a class="creator__switch-link" href="browse.php?type=quiz" data-type-link="quiz">Викторины</a>
                    </div>
                </div>
                <div class="cards-grid" data-list></div>
            </section>
        </main>
    </div>
    <script src="scripts/main.js"></script>
</body>
</html>
