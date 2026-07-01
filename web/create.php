<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Создать · Votely</title>
    <link rel="icon" href="votely.svg" type="image/svg+xml">
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

        <main class="creator">
            <section class="creator__panel" aria-labelledby="creator-title">
                <div class="creator__header">
                    <div>
                        <p class="creator__eyebrow">Votely Studio</p>
                        <h1 class="creator__title" id="creator-title">Создать опрос</h1>
                    </div>
                    <div class="creator__switch" aria-label="Тип формы">
                        <a class="creator__switch-link" href="create.php?type=poll" data-type-link="poll">Опрос</a>
                        <a class="creator__switch-link" href="create.php?type=quiz" data-type-link="quiz">Викторина</a>
                    </div>
                </div>

                <form class="creator-form" data-create-form>
                    <label class="field">
                        <span class="field__label">Название</span>
                        <input class="field__control" name="title" type="text" placeholder="Например: выбор даты встречи" maxlength="160" required>
                    </label>

                    <label class="field">
                        <span class="field__label">Описание</span>
                        <textarea class="field__control field__control--textarea" name="description" placeholder="Коротко поясните, о чем голосование" maxlength="1000"></textarea>
                    </label>

                    <div class="creator-form__section" data-poll-fields>
                        <div class="creator-form__section-head">
                            <h2 class="creator-form__subtitle">Варианты ответа</h2>
                            <button class="ghost-button" type="button" data-add-option>Добавить вариант ответа</button>
                        </div>
                        <div class="stack" data-options-list></div>
                    </div>

                    <div class="creator-form__section" data-quiz-fields hidden>
                        <div class="creator-form__section-head">
                            <h2 class="creator-form__subtitle">Викторина с одним вопросом</h2>
                            <button class="ghost-button" type="button" data-add-answer>Добавить вариант ответа</button>
                        </div>
                        <div class="stack stack--large" data-questions-list></div>
                    </div>

                    <div class="creator-form__actions">
                        <button class="primary-button" type="submit">Создать</button>
                        <p class="form-status" data-form-status role="status" aria-live="polite"></p>
                    </div>
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
</body>
</html>
