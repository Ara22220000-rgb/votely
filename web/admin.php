<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Админ-панель · Votely</title>
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
                    <a class="nav-link" href="index.php">На сайт</a>
                    <span class="nav-link admin-green-text">Панель управления</span>
                </div>
                <div class="nav__right">
                    <button class="nav-link" type="button" data-admin-logout hidden>Выйти</button>
                </div>
            </nav>
        </header>

        <main class="creator" data-admin-root>
            <section class="creator__panel">
                <div class="creator__header">
                    <div>
                        <p class="creator__eyebrow">Администрирование</p>
                        <h1 class="creator__title">Панель управления</h1>
                    </div>
                </div>

                <div class="creator-form admin-login" data-admin-login>
                    <p class="form-status" data-admin-status role="status" aria-live="polite">Проверяем Telegram-доступ...</p>
                </div>

                <div class="admin-panel" data-admin-panel hidden>
                    <div class="admin-summary" data-admin-summary></div>

                    <div class="creator-form__section admin-section-gap">
                        <h2 class="creator-form__subtitle">Управление контентом</h2>
                        <p class="creator-form__hint">Доступ разрешен только указанным Telegram-аккаунтам. Удаление защищено серверной сессией и CSRF-токеном.</p>
                    </div>
                    <div class="creator__switch admin-switch-gap">
                        <button class="creator__switch-link is-active" type="button" data-admin-type="polls">Опросы</button>
                        <button class="creator__switch-link" type="button" data-admin-type="quizzes">Викторины</button>
                    </div>
                    <div class="stack admin-list-gap" data-admin-list></div>
                </div>
            </section>
        </main>
    </div>
    <script src="scripts/main.js"></script>
</body>
</html>
