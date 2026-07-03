<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Мои опросы · Votely</title>
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
                    <a class="nav-link" href="browse.php?type=poll">Все опросы</a>
                </div>
                <div class="searchdiv">
                    <form class="search-form" action="browse.php" role="search" method="GET">
                        <input type="hidden" name="type" value="poll">
                        <input name="q" class="search" type="text" placeholder="Поиск" aria-label="Найти опрос">
                        <button class="search-button" type="submit" aria-label="Найти">⌕</button>
                    </form>
                </div>
                <div class="nav__right">
                    <button class="auth-login-button" type="button" data-auth-action="login">Войти</button>
                </div>
            </nav>
        </header>

        <main class="creator" data-my-polls-root>
            <section class="creator__panel">
                <div class="creator__header">
                    <div>
                        <p class="creator__eyebrow">Профиль</p>
                        <h1 class="creator__title">Мои опросы</h1>
                    </div>
                    <a class="creator__switch-link creator__switch-link--solo" href="create.php?type=poll">Создать опрос</a>
                </div>
                <div class="cards-grid" data-list></div>
            </section>
        </main>
    </div>
    <script src="scripts/main.js"></script>
</body>
</html>
