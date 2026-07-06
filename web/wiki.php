<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Вики · Votely</title>
    <link rel="icon" href="votely.svg" type="image/svg+xml">
    <link rel="stylesheet" href="styles/main.css?v=2">
</head>
<body data-content-type="wiki">
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

        <main class="creator">
            <section class="creator__panel wiki">
                <div class="creator__header">
                    <div>
                        <p class="creator__eyebrow">База знаний</p>
                        <h1 class="creator__title">Вики Votely</h1>
                    </div>
                </div>

                <div class="wiki__content">
                    <nav class="wiki__toc" aria-label="Содержание">
                        <h2 class="wiki__toc-title">Содержание</h2>
                        <ul class="wiki__toc-list">
                            <li><a class="wiki__toc-link" href="#about">О проекте</a></li>
                            <li><a class="wiki__toc-link" href="#polls">Опросы</a></li>
                            <li><a class="wiki__toc-link" href="#quizzes">Викторины</a></li>
                            <li><a class="wiki__toc-link" href="#create">Создание</a></li>
                            <li><a class="wiki__toc-link" href="#share">Поделиться</a></li>
                            <li><a class="wiki__toc-link" href="#results">Результаты</a></li>
                            <li><a class="wiki__toc-link" href="#faq">Частые вопросы</a></li>
                        </ul>
                    </nav>

                    <article class="wiki__article">
                        <section class="wiki__section" id="about">
                            <h2 class="wiki__section-title">О проекте</h2>
                            <p class="wiki__text">
                                Votely — сервис для создания онлайн-опросов и викторин. Здесь можно быстро
                                собрать мнение аудитории, провести проверку знаний или просто развлечь
                                друзей интерактивными вопросами.
                            </p>
                        </section>

                        <section class="wiki__section" id="polls">
                            <h2 class="wiki__section-title">Опросы</h2>
                            <p class="wiki__text">
                                Опрос — это вопрос с вариантами ответа. Участник выбирает один
                                или несколько вариантов, а сервис автоматически подсчитывает голоса и
                                показывает результаты в виде наглядной диаграммы.
                            </p>
                            <p class="wiki__text">
                                Опросы подходят для сбора обратной связи, голосования за идею, выбора
                                даты мероприятия и любых задач, где нужно узнать мнение группы людей.
                            </p>
                        </section>

                        <section class="wiki__section" id="quizzes">
                            <h2 class="wiki__section-title">Викторины</h2>
                            <p class="wiki__text">
                                Викторина — это вопрос с правильным ответом. В отличие от опроса,
                                здесь есть «правильно» и «неправильно»: при создании вы отмечаете верный
                                вариант для каждого вопроса.
                            </p>
                            <p class="wiki__text">
                                После прохождения викторины участник сразу видит, какие ответы были верными,
                                а сколько баллов набрал. Викторины удобно использовать для проверки знаний,
                                образовательных квизов и развлекательных игр.
                            </p>
                        </section>

                        <section class="wiki__section" id="create">
                            <h2 class="wiki__section-title">Создание</h2>
                            <ol class="wiki__list">
                                <li>Нажмите «Создать» в навигации и выберите «Создать опрос» или «Создать викторину».</li>
                                <li>Заполните заголовок и описание.</li>
                                <li>Добавьте вопросы и варианты ответов. Для викторины отметьте правильный вариант.</li>
                                <li>При необходимости настройте приватность и другие параметры.</li>
                                <li>Нажмите кнопку создания — вы получите ссылку для публикации.</li>
                            </ol>
                        </section>

                        <section class="wiki__section" id="share">
                            <h2 class="wiki__section-title">Поделиться</h2>
                            <p class="wiki__text">
                                После создания опроса или викторины вы получаете уникальную ссылку.
                                Скопируйте её и отправьте участникам любым удобным способом: в мессенджере,
                                на сайте, в соцсетях или по почте. Достаточно перейти по ссылке, чтобы
                                пройти опрос.
                            </p>
                        </section>

                        <section class="wiki__section" id="results">
                            <h2 class="wiki__section-title">Результаты</h2>
                            <p class="wiki__text">
                                Результаты доступны на странице статистики. Там можно посмотреть распределение
                                голосов по каждому варианту, общее число участников и другую аналитику.
                                Для викторин также виден процент правильных ответов.
                            </p>
                        </section>

                        <section class="wiki__section" id="faq">
                            <h2 class="wiki__section-title">Частые вопросы</h2>

                            <h3 class="wiki__question">Нужна ли регистрация?</h3>
                            <p class="wiki__text">
                                Для прохождения опросов и викторин регистрация нужна. Для создания и
                                управления своими опросами достаточно войти через Telegram.
                            </p>

                            <h3 class="wiki__question">Сколько вариантов ответов можно добавить?</h3>
                            <p class="wiki__text">
                                Жёсткого ограничения нет: добавляйте столько вариантов ответа,
                                сколько нужно для вашей задачи.
                            </p>

                            <h3 class="wiki__question">Можно ли изменить опрос после создания?</h3>
                            <p class="wiki__text">
                                Нет, нельзя.
                            </p>
                        </section>
                    </article>
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
            </div>
        </footer>
    </div>

    <script src="scripts/main.js"></script>
</body>
</html>
