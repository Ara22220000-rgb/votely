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
                </div>
                <div></div>
                <input class="search" type="text" placeholder="Поиск" aria-label="Найти опрос">
                <div class="nav__right">
                    <a class="nav-link" href="create.php?type=poll">Создать</a>
                </div>
            </nav>
        </header>

        <main class="creator" data-detail-root>
            <section class="creator__panel viewer" data-detail></section>
        </main>
    </div>
    <script src="scripts/main.js"></script>
</body>
</html>
