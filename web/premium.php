<?php
// Обработка смены темы через URL параметр
if (isset($_GET['theme']) && $_GET['theme'] === 'toggle') {
    $currentTheme = $_COOKIE['votely_theme'] ?? '';
    $newTheme = ($currentTheme === 'light') ? 'dark' : 'light';
    setcookie('votely_theme', $newTheme, time() + (365 * 24 * 60 * 60), '/');
    header('Location: ' . $_SERVER['PHP_SELF'] . '?' . http_build_query(array_diff_key($_GET, ['theme' => ''])));
    exit;
}
$themeClass = '';
if (isset($_COOKIE['votely_theme'])) {
    $themeClass = ' data-theme="' . htmlspecialchars($_COOKIE['votely_theme'], ENT_QUOTES, 'UTF-8') . '"';
}
?>
<!DOCTYPE html>
<html lang="ru"<?php echo $themeClass; ?>>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Премиум · Votely</title>
    <link rel="icon" href="votely.svg" type="image/svg+xml">
    <link rel="stylesheet" href="styles/main.css?v=3">
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
                    <a class="nav-link" href="create.php?type=poll">Создать</a>
                    <a class="nav-link" href="browse.php?type=poll">Опросы</a>
                    <a class="nav-link" href="browse.php?type=quiz">Викторины</a>
                    <a class="nav-link is-active" href="premium.php">Премиум</a>
                </div>

                <div class="nav__right">
                    <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Переключить тему">🌙</button>
                    <button class="auth-login-button" type="button" data-auth-action="login">Войти</button>
                </div>
            </nav>
        </header>

        <main class="premium-page creator">
            <section class="creator__panel premium-panel">
                <section class="premium-hero">
                    <div class="premium-hero__content">
                        <h1 class="premium-hero__title">Votely Premium</h1>
                        <p class="premium-hero__subtitle">Расширенные возможности для ваших опросов</p>
                    </div>
                </section>

                <section class="premium-features">
                    <div class="premium-features__inner">
                        <h2 class="premium-section__title">Преимущества Premium</h2>
                        <div class="premium-features__grid">
                            <article class="premium-feature-card">
                                <div class="premium-feature-card__icon">📊</div>
                                <h3 class="premium-feature-card__title">Расширенная аналитика</h3>
                                <p class="premium-feature-card__desc">Детальная статистика по всем опросам: география, устройства, браузеры, источники трафика.</p>
                            </article>
                            <article class="premium-feature-card">
                                <div class="premium-feature-card__icon">🎨</div>
                                <h3 class="premium-feature-card__title">Кастомизация дизайна</h3>
                                <p class="premium-feature-card__desc">Персонализируйте внешний вид опросов: цвета, шрифты и фирменный стиль.</p>
                            </article>
                            <article class="premium-feature-card">
                                <div class="premium-feature-card__icon">🔗</div>
                                <h3 class="premium-feature-card__title">Именные ссылки</h3>
                                <p class="premium-feature-card__desc">Создавайте множество ссылок для разных источников и рекламных каналов.</p>
                            </article>
                        </div>
                    </div>
                </section>

                <section class="premium-pricing">
                    <div class="premium-pricing__inner">
                        <h2 class="premium-section__title">Тарифы</h2>
                        <div class="premium-pricing__grid">
                            <article class="pricing-card">
                                <h3 class="pricing-card__title">Бесплатный</h3>
                                <p class="pricing-card__price">0 ₽<span class="pricing-card__period">/мес</span></p>
                                <ul class="pricing-card__features">
                                    <li>✓ До 100 голосов в месяц</li>
                                    <li>✓ До 5 именных ссылок</li>
                                    <li>✓ До 10 опросов и викторин в месяц (суммарно)</li>
                                    <li>✓ Базовая статистика</li>
                                    <li class="pricing-card__feature--disabled">✗ Экспорт данных</li>
                                </ul>
                                <button class="pricing-card__btn secondary-button" type="button">Текущий план</button>
                            </article>

                            <article class="pricing-card pricing-card--featured">
                                <div class="pricing-card__badge">Скоро</div>
                                <h3 class="pricing-card__title">Премиум</h3>
                                <p class="pricing-card__price">99 ₽<span class="pricing-card__period">/мес</span></p>
                                <ul class="pricing-card__features">
                                    <li>✓ Безлимитные голоса</li>
                                    <li>✓ Безлимитные именные ссылки</li>
                                    <li>✓ Безлимитные опросы</li>
                                    <li>✓ Безлимитные викторины</li>
                                    <li>✓ Экспорт данных</li>
                                </ul>
                                <button class="pricing-card__btn primary-button" type="button" disabled>Оплата скоро</button>
                            </article>
                        </div>
                    </div>
                </section>
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
                            <a class="footer__link theme-toggle" href="?theme=toggle" aria-label="Переключить тему">🌙</a>
                            <a class="footer__social" href="https://t.me/votely_net" aria-label="Telegram">TG</a>
                        </div>
                    </div>
                </div>

                <p class="footer__bottom">© 2026 Votely</p>
                <p class="footer__bottom_right">Версия: 26.3</p>
            </div>
        </footer>
    </div>

    <script src="scripts/main.js"></script>
</body>
</html>
