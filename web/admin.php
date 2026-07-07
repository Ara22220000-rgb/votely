<?php
// Обработка смены темы через URL параметр
if (isset($_GET['theme']) && $_GET['theme'] === 'toggle') {
    $currentTheme = $_COOKIE['votely_theme'] ?? '';
    $newTheme = ($currentTheme === 'light') ? 'dark' : 'light';
    setcookie('votely_theme', $newTheme, time() + (365 * 24 * 60 * 60), '/');
    header('Location: ' . $_SERVER['PHP_SELF'] . '?' . http_build_query(array_diff_key($_GET, ['theme' => ''])));
    exit;
}
$adminTelegramUsers = [6725709823, 6357965364, 8415321014];
$hashSecret = getenv("HASH_SECRET") ?: "dev-secret-key-for-local-development-only";

function votelyAdminHash($secret, $value) {
    return hash_hmac("sha256", $value, $secret);
}

function votelyAdminToken($secret) {
    $cookie = $_COOKIE["votely_session"] ?? "";
    if (!preg_match('/^([a-f0-9]{64})\\.([a-f0-9]{64})$/i', $cookie, $matches)) {
        return null;
    }
    $expected = votelyAdminHash($secret, "cookie:" . $matches[1]);
    if (!hash_equals($expected, $matches[2])) {
        return null;
    }
    return $matches[1];
}

$token = votelyAdminToken($hashSecret);
$isAdmin = false;
if ($token !== null) {
    try {
        $dsn = sprintf(
            "pgsql:host=%s;port=%s;dbname=%s",
            getenv("PG_HOST") ?: "postgres",
            getenv("PG_PORT") ?: "5432",
            getenv("PG_DB") ?: "votely"
        );
        $pdo = new PDO($dsn, getenv("PG_USER") ?: "votely", getenv("PG_PASSWORD") ?: "votely", [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $stmt = $pdo->prepare("SELECT user_id FROM user_sessions WHERE token_hash = :token_hash AND expires_at > now()");
        $stmt->execute([":token_hash" => votelyAdminHash($hashSecret, "session:" . $token)]);
        $userId = (int)($stmt->fetchColumn() ?: 0);
        $isAdmin = in_array($userId, $adminTelegramUsers, true);
    } catch (Throwable $e) {
        $isAdmin = false;
    }
}
if (!$isAdmin) {
    header("Location: /index.php", true, 302);
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
    <title>Админ-панель · Votely</title>
    <link rel="icon" href="votely.svg" type="image/svg+xml">
    <link rel="stylesheet" href="styles/main.css?v=3">
</head>
<body data-content-type="home" class="admin-page"<?php echo $themeClass; ?>>
    <div class="page">
        <header class="site-header">
            <nav class="nav" aria-label="Основная навигация">
                <a class="brand" href="index.php" aria-label="Votely, главная">
                    <img class="brand__logo" src="votely.svg" alt="">
                    <span class="brand__name">Votely</span>
                </a>
                <div class="nav__middle">
                    <a class="nav-link" href="index.php">На сайт</a>
                    <span class="nav-link admin-accent-text">Панель управления</span>
                </div>
                <div class="nav__right">
                    <button class="nav-link" id="admin-logout">Выйти</button>
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

                    <div class="creator-form__section admin-section-gap">
                        <h2 class="creator-form__subtitle">SQL-консоль</h2>
                        <p class="creator-form__hint">Выполнение SQL-запросов напрямую к базе данных. SELECT-запросы показывают таблицу, остальные — количество затронутых строк.</p>
                    </div>
                    <div class="sql-console" data-sql-console>
                        <textarea class="sql-input" data-sql-input placeholder="SELECT * FROM polls LIMIT 10;" rows="6"></textarea>
                        <div class="sql-actions">
                            <button class="btn btn--primary" data-sql-run>Выполнить</button>
                            <button class="btn btn--secondary" data-sql-clear>Очистить</button>
                        </div>
                        <div class="sql-result" data-sql-result hidden></div>
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
    <script src="scripts/main.js"></script>
    <script>
    (function() {
        const csrf = document.querySelector('meta[name="csrf"]')?.content || '';
        const sqlInput = document.querySelector('[data-sql-input]');
        const sqlRun = document.querySelector('[data-sql-run]');
        const sqlClear = document.querySelector('[data-sql-clear]');
        const sqlResult = document.querySelector('[data-sql-result]');

        if (!sqlInput || !sqlRun) return;

        function showResult(html) {
            sqlResult.innerHTML = html;
            sqlResult.hidden = false;
        }

        function showError(msg) {
            showResult('<div class="sql-error">❌ ' + msg + '</div>');
        }

        sqlRun.addEventListener('click', async function() {
            const query = sqlInput.value.trim();
            if (!query) {
                showError('Введите SQL-запрос.');
                return;
            }

            sqlRun.disabled = true;
            sqlRun.textContent = '⏳ Выполняется...';
            showResult('<div class="sql-loading">⏳ Выполняется запрос...</div>');

            try {
                const res = await fetch('/api/v1/admin/sql', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrf
                    },
                    body: JSON.stringify({ query })
                });
                const data = await res.json();

                if (!res.ok) {
                    showError(data.message || 'Ошибка выполнения запроса.');
                    return;
                }

                if (data.rows !== undefined) {
                    if (data.rows.length === 0) {
                        showResult('<div class="sql-success">✅ Запрос выполнен. Строк: 0</div>');
                        return;
                    }

                    let html = '<div class="sql-success">✅ Запрос выполнен. Строк: ' + data.rows.length + '</div>';
                    html += '<div class="sql-table-wrapper"><table class="sql-table"><thead><tr>';
                    data.columns.forEach(col => { html += '<th>' + col + '</th>'; });
                    html += '</tr></thead><tbody>';
                    data.rows.forEach(row => {
                        html += '<tr>';
                        row.forEach(val => { html += '<td>' + (val !== null ? String(val) : '<em>null</em>') + '</td>'; });
                        html += '</tr>';
                    });
                    html += '</tbody></table></div>';
                    showResult(html);
                } else {
                    showResult('<div class="sql-success">✅ Запрос выполнен. Затронуто строк: ' + (data.affected_rows || 0) + '</div>');
                }
            } catch (err) {
                showError('Ошибка сети: ' + err.message);
            } finally {
                sqlRun.disabled = false;
                sqlRun.textContent = 'Выполнить';
            }
        });

        sqlClear.addEventListener('click', function() {
            sqlInput.value = '';
            sqlResult.hidden = true;
            sqlResult.innerHTML = '';
            sqlInput.focus();
        });

        sqlInput.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                sqlRun.click();
            }
        });
    })();
    </script>
</body>
</html>
