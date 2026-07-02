<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('output_buffering', 'Off');
@ini_set('zlib.output_compression', '0');

// Читаем тело запроса ДО любой обработки
$rawInput = file_get_contents("php://input");
$body = json_decode($rawInput, true);

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");

$dbHost = getenv("PG_HOST") ?: "postgres";
$dbPort = getenv("PG_PORT") ?: "5432";
$dbName = getenv("PG_DB") ?: "votely";
$dbUser = getenv("PG_USER") ?: "votely";
$dbPassword = getenv("PG_PASSWORD") ?: "votely";

$dsn = "pgsql:host=$dbHost;port=$dbPort;dbname=$dbName";

try {
    $pdo = new PDO($dsn, $dbUser, $dbPassword, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["code" => "db_error", "message" => "Ошибка подключения к базе данных"]);
    exit;
}

$method = $_SERVER["REQUEST_METHOD"];
$path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);

// Rate limiting
$ip = $_SERVER["REMOTE_ADDR"] ?? "unknown";
$rateFile = sys_get_temp_dir() . "/votely_rate_" . md5($ip);
$rateData = file_exists($rateFile) ? json_decode(file_get_contents($rateFile), true) : ["count" => 0, "reset" => time() + 60];
if (time() > $rateData["reset"]) {
    $rateData = ["count" => 0, "reset" => time() + 60];
}
$rateData["count"]++;
file_put_contents($rateFile, json_encode($rateData));
if ($rateData["count"] > 100 && strpos($path, "/api/") === 0) {
    http_response_code(429);
    echo json_encode(["code" => "rate_limited", "message" => "Слишком много запросов"]);
    exit;
}

// Session check
function getSessionUser($pdo) {
    $cookie = $_COOKIE["votely_session"] ?? "";
    if (!$cookie) return null;
    $parts = explode(".", $cookie);
    if (count($parts) !== 2) return null;
    $token = $parts[0];
    $sig = $parts[1];
    $expectedSig = hash_hmac("sha256", "session:" . $token, getenv("HASH_SECRET") ?: "dev-secret");
    if (!hash_equals($expectedSig, $sig)) return null;
    $tokenHash = hash("sha256", "session:" . $token);
    $stmt = $pdo->prepare("SELECT user_id FROM user_sessions WHERE token_hash = :t AND expires_at > NOW()");
    $stmt->execute([":t" => $tokenHash]);
    $row = $stmt->fetch();
    return $row ? $row["user_id"] : null;
}

switch (true) {
    case $method === "GET" && $path === "/api/v1/polls":
        listPolls($pdo);
        break;
    case $method === "GET" && preg_match("#^/api/v1/polls/([^/]+)$#", $path, $m):
        getPoll($pdo, $m[1]);
        break;
    case $method === "POST" && $path === "/api/v1/polls":
        createPoll($pdo);
        break;
    case $method === "POST" && preg_match("#^/api/v1/polls/([^/]+)/votes$#", $path, $m):
        votePoll($pdo, $m[1]);
        break;
    case $method === "GET" && $path === "/api/v1/quizzes":
        listQuizzes($pdo);
        break;
    case $method === "GET" && preg_match("#^/api/v1/quizzes/([^/]+)$#", $path, $m):
        getQuiz($pdo, $m[1]);
        break;
    case $method === "POST" && preg_match("#^/api/v1/quizzes/([^/]+)/attempt$#", $path, $m):
        submitQuizAttempt($pdo, $m[1]);
        break;
    case $method === "POST" && $path === "/api/v1/quizzes":
        createQuiz($pdo);
        break;
    case $method === "POST" && $path === "/api/v1/admin/sql":
        executeSQL($pdo);
        break;
    case $method === "DELETE" && preg_match("#^/api/v1/(polls|quizzes)/([^/]+)$#", $path, $m):
        deleteItem($pdo, $m[1], $m[2]);
        break;
    case $method === "GET" && preg_match("#^/api/v1/polls/([^/]+)/stats$#", $path, $m):
        pollStats($pdo, $m[1]);
        break;
    case $method === "GET" && preg_match("#^/api/v1/quizzes/([^/]+)/stats$#", $path, $m):
        quizStats($pdo, $m[1]);
        break;
    case $method === "GET" && preg_match("#^/api/v1/quizzes/([^/]+)/links$#", $path, $m):
        getQuizLinks($pdo, $m[1]);
        break;
    case $method === "POST" && preg_match("#^/api/v1/quizzes/([^/]+)/links$#", $path, $m):
        createQuizLink($pdo, $m[1]);
        break;
    case $method === "GET" && preg_match("#^/api/v1/quizzes/([^/]+)/links/([^/]+)$#", $path, $m):
        deleteQuizLink($pdo, $m[1], $m[2]);
        break;
    case $method === "GET" && preg_match("#^/api/v1/polls/([^/]+)/links$#", $path, $m):
        getPollLinks($pdo, $m[1]);
        break;
    case $method === "POST" && preg_match("#^/api/v1/polls/([^/]+)/links$#", $path, $m):
        createPollLink($pdo, $m[1]);
        break;
    case $method === "GET" && preg_match("#^/api/v1/polls/([^/]+)/links/([^/]+)$#", $path, $m):
        deletePollLink($pdo, $m[1], $m[2]);
        break;
    case $method === "POST" && $path === "/api/v1/auth/register":
        registerUser($pdo);
        break;
    case $method === "POST" && $path === "/api/v1/auth/login":
        loginUser($pdo);
        break;
    case $method === "POST" && $path === "/api/v1/auth/logout":
        logoutUser($pdo);
        break;
    case $method === "GET" && $path === "/api/v1/auth/me":
        authMe($pdo);
        break;
    case $method === "POST" && $path === "/api/v1/auth/telegram":
        telegramAuth($pdo);
        break;
    default:
        http_response_code(404);
        echo json_encode(["code" => "not_found", "message" => "Не найдено"]);
}

function listPolls($pdo) {
    $q = $_GET["q"] ?? "";
    if ($q) {
        $stmt = $pdo->prepare("SELECT id::text, title, description FROM polls WHERE title ILIKE :q OR description ILIKE :q ORDER BY created_at DESC");
        $stmt->execute([":q" => "%$q%"]);
    } else {
        $stmt = $pdo->query("SELECT id::text, title, description FROM polls ORDER BY created_at DESC");
    }
    echo json_encode(["items" => $stmt->fetchAll()]);
    exit;
}

function getPoll($pdo, $id, $return = false) {
    $stmt = $pdo->prepare("SELECT id::text, title, description FROM polls WHERE id = :id");
    $stmt->execute([":id" => $id]);
    $poll = $stmt->fetch();
    if (!$poll) { 
        if (!$return) { http_response_code(404); echo json_encode(["message" => "Not found"]); exit; }
        return null;
    }
    $stmt = $pdo->prepare("SELECT po.id::text, po.option_text as text, COUNT(pv.id)::int as votes FROM poll_options po LEFT JOIN poll_votes pv ON pv.option_id = po.id WHERE po.poll_id = :pid GROUP BY po.id, po.option_text, po.position ORDER BY po.position");
    $stmt->execute([":pid" => $id]);
    $poll["options"] = $stmt->fetchAll();
    if ($return) return $poll;
    echo json_encode($poll);
    exit;
}

function votePoll($pdo, $pollId) {
    global $body;
    
    if (!$body) {
        http_response_code(400);
        echo json_encode(["message" => "Empty body", "debug" => $body]);
        exit;
    }
    
    $oid = $body["option_id"] ?? "";
    if (!preg_match('#^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$#i', $oid)) { 
        http_response_code(400);
        echo json_encode(["message" => "Выберите вариант", "got" => $oid]);
        exit;
    }
    
    // Собираем метаданные
    $userAgent = $_SERVER["HTTP_USER_AGENT"] ?? "";
    $ip = $_SERVER["REMOTE_ADDR"] ?? "unknown";
    $referrer = $_SERVER["HTTP_REFERER"] ?? "";
    
    // UTM из body (от JavaScript) или URL
    $utmSource = $body["utm_source"] ?? ($_GET["utm_source"] ?? "");
    $utmMedium = $body["utm_medium"] ?? ($_GET["utm_medium"] ?? "");
    $shareLinkId = $body["share_link_id"] ?? ($_GET["share_link_id"] ?? null);
    
    // Валидируем share_link_id
    if ($shareLinkId && !preg_match('#^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$#i', $shareLinkId)) {
        $shareLinkId = null;
    }
    
    // Если JavaScript не определил, пробуем серверное определение по Referer заголовку
    if (!$utmSource && $referrer) {
        $referrerHost = parse_url($referrer, PHP_URL_HOST) ?? "";
        
        // Социальные сети и платформы
        if (stripos($referrerHost, 't.me') !== false || stripos($referrerHost, 'telegram.org') !== false || stripos($referrerHost, 'telegram.me') !== false) {
            $utmSource = 'telegram';
        } elseif (stripos($referrerHost, 'vk.com') !== false || stripos($referrerHost, 'vkontakte.ru') !== false) {
            $utmSource = 'vk';
        } elseif (stripos($referrerHost, 'ok.ru') !== false || stripos($referrerHost, 'odnoklassniki') !== false) {
            $utmSource = 'ok';
        } elseif (stripos($referrerHost, 'twitter.com') !== false || stripos($referrerHost, 'x.com') !== false) {
            $utmSource = 'twitter';
        } elseif (stripos($referrerHost, 'facebook.com') !== false || stripos($referrerHost, 'fb.com') !== false) {
            $utmSource = 'facebook';
        } elseif (stripos($referrerHost, 'instagram.com') !== false || stripos($referrerHost, 'instagr.am') !== false) {
            $utmSource = 'instagram';
        } elseif (stripos($referrerHost, 'tiktok.com') !== false) {
            $utmSource = 'tiktok';
        } elseif (stripos($referrerHost, 'youtube.com') !== false || stripos($referrerHost, 'youtu.be') !== false) {
            $utmSource = 'youtube';
        } elseif (stripos($referrerHost, 'reddit.com') !== false || stripos($referrerHost, 'redd.it') !== false) {
            $utmSource = 'reddit';
        } elseif (stripos($referrerHost, 'linkedin.com') !== false || stripos($referrerHost, 'lnkd.in') !== false) {
            $utmSource = 'linkedin';
        } elseif (stripos($referrerHost, 'pinterest.com') !== false || stripos($referrerHost, 'pin.it') !== false) {
            $utmSource = 'pinterest';
        } elseif (stripos($referrerHost, 'discord.com') !== false || stripos($referrerHost, 'discordapp') !== false) {
            $utmSource = 'discord';
        } elseif (stripos($referrerHost, 'whatsapp.com') !== false || stripos($referrerHost, 'wa.me') !== false) {
            $utmSource = 'whatsapp';
        } elseif (stripos($referrerHost, 'google.') !== false || stripos($referrerHost, 'g.co') !== false) {
            $utmSource = 'google';
        } elseif (stripos($referrerHost, 'yandex.') !== false || stripos($referrerHost, 'ya.ru') !== false) {
            $utmSource = 'yandex';
        } elseif (stripos($referrerHost, 'bing.com') !== false) {
            $utmSource = 'bing';
        } elseif (stripos($referrerHost, 'duckduckgo.com') !== false) {
            $utmSource = 'duckduckgo';
        } elseif (stripos($referrerHost, 'mail.ru') !== false) {
            $utmSource = 'mailru';
        } elseif ($referrerHost) {
            $utmSource = 'website';
        } else {
            $utmSource = 'direct';
        }
    } elseif (!$utmSource) {
        $utmSource = 'direct';
    }
    
    // Определяем тип устройства и ОС
    $deviceType = detectDeviceType($userAgent);
    $os = detectOS($userAgent);
    $browser = detectBrowser($userAgent);
    
    // Определяем страну по IP (через заголовки прокси или GeoIP)
    $ipCountry = detectCountry($ip);
    
    // Вставка голоса с метаданными
    try {
        $stmt = $pdo->prepare("
            INSERT INTO poll_votes (
                poll_id, 
                option_id, 
                user_agent, 
                ip_address, 
                ip_country,
                utm_source, 
                utm_medium,
                share_link_id,
                device_type,
                os_type,
                browser_type
            ) VALUES (
                :pid, :oid, :ua, :ip, :ic, :us, :um, :slid, :dt, :os, :br
            )
        ");
        $stmt->execute([
            ":pid" => $pollId,
            ":oid" => $oid,
            ":ua" => $userAgent,
            ":ip" => $ip,
            ":ic" => $ipCountry,
            ":us" => $utmSource,
            ":um" => $utmMedium,
            ":slid" => $shareLinkId,
            ":dt" => $deviceType,
            ":os" => $os,
            ":br" => $browser
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "DB error: " . $e->getMessage()]);
        exit;
    }
    
    $result = getPoll($pdo, $pollId, true);
    if (!$result) {
        http_response_code(404);
        echo json_encode(["message" => "Poll not found"]);
        exit;
    }
    echo json_encode($result);
    exit;
}
    
function detectDeviceType($ua) {
    // Сначала проверяем iPad (в iOS 13+ iPad притворяется Mac)
    if (stripos($ua, 'iPad') !== false) {
        return 'tablet';
    }
    // iPhone и другие телефоны
    if (stripos($ua, 'iPhone') !== false || stripos($ua, 'Mobile') !== false) {
        return 'mobile';
    }
    // Планшеты на Android
    if (stripos($ua, 'Tablet') !== false || stripos($ua, 'Android') !== false) {
        return 'tablet';
    }
    return 'desktop';
}

function detectBrowser($ua) {
    // Chrome (но не Edge, не Opera, не Samsung)
    if (stripos($ua, 'Chrome') !== false && stripos($ua, 'Edg') === false && stripos($ua, 'OPR') === false && stripos($ua, 'SamsungBrowser') === false) {
        return 'Chrome';
    }
    // Firefox
    if (stripos($ua, 'Firefox') !== false) {
        return 'Firefox';
    }
    // Safari (но не Chrome)
    if (stripos($ua, 'Safari') !== false && stripos($ua, 'Chrome') === false) {
        return 'Safari';
    }
    // Edge
    if (stripos($ua, 'Edg') !== false) {
        return 'Edge';
    }
    // Opera
    if (stripos($ua, 'OPR') !== false || stripos($ua, 'Opera') !== false) {
        return 'Opera';
    }
    // Samsung Internet
    if (stripos($ua, 'SamsungBrowser') !== false) {
        return 'Samsung Internet';
    }
    // Яндекс.Браузер
    if (stripos($ua, 'YaBrowser') !== false) {
        return 'Yandex';
    }
    return 'Other';
}
    
function detectOS($ua) {
    // iOS устройства (iPhone, iPad, iPod)
    if (stripos($ua, 'iPhone') !== false || stripos($ua, 'iPad') !== false || stripos($ua, 'iPod') !== false) {
        return 'iOS';
    }
    // iOS 13+ на iPad говорит "Macintosh", проверяем дополнительные признаки
    if (stripos($ua, 'Mac') !== false && (stripos($ua, 'Mobile') !== false || stripos($ua, 'Safari') !== false)) {
        // Проверяем, не настоящий ли это Mac
        if (stripos($ua, 'iOS') !== false) {
            return 'iOS';
        }
    }
    // Android
    if (stripos($ua, 'Android') !== false) {
        return 'Android';
    }
    // Windows
    if (stripos($ua, 'Windows') !== false) {
        return 'Windows';
    }
    // macOS (настоящий Mac)
    if (stripos($ua, 'Mac') !== false || stripos($ua, 'OS X') !== false) {
        return 'macOS';
    }
    // Linux
    if (stripos($ua, 'Linux') !== false) {
        return 'Linux';
    }
    return 'Other';
}
    
function detectCountry($ip) {
    // Сначала проверяем заголовки от прокси (Cloudflare, Vercel, Fly.io)
    if (!empty($_SERVER['HTTP_CF_IPCOUNTRY'])) {
        return strtoupper(trim($_SERVER['HTTP_CF_IPCOUNTRY']));
    }
    if (!empty($_SERVER['HTTP_X_VERCEL_IP_COUNTRY'])) {
        return strtoupper(trim($_SERVER['HTTP_X_VERCEL_IP_COUNTRY']));
    }
    if (!empty($_SERVER['HTTP_FLY_CLIENT_IP_COUNTRY'])) {
        return strtoupper(trim($_SERVER['HTTP_FLY_CLIENT_IP_COUNTRY']));
    }
    
    // Для локальных IP возвращаем пустую строку
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
        return '';
    }
    
    // Пытаемся определить через GeoIP базу (если установлена)
    if (function_exists('geoip_country_code_by_name')) {
        $code = @geoip_country_code_by_name($ip);
        if ($code) return strtoupper($code);
    }
    
    // Пытаемся через базу ip2location (если есть)
    $geoipFile = __DIR__ . '/data/ip2location-lite.bin';
    if (file_exists($geoipFile) && class_exists('IP2Location\\Database')) {
        try {
            $db = new IP2Location\Database($geoipFile, IP2Location\Database::FILE_MEMORY_CACHE);
            $result = $db->lookup($ip, IP2Location\Database::ALL);
            if (!empty($result['countryCode'])) {
                return strtoupper($result['countryCode']);
            }
        } catch (\Exception $e) {
            // Игнорируем ошибки GeoIP
        }
    }
    
    // Простая эвристика по диапазонам IP (очень примерно)
    // Это запасной вариант, если ничего не установлено
    $ipLong = ip2long($ip);
    if ($ipLong !== false) {
        // Примерные диапазоны для некоторых стран (для демонстрации)
        // В продакшене используйте полноценную GeoIP базу
        $ranges = [
            'RU' => [[1840000000, 1850000000], [2016000000, 2020000000]],
            'US' => [[1600000000, 1700000000], [3400000000, 3500000000]],
            'DE' => [[1400000000, 1450000000]],
            'CN' => [[1750000000, 1800000000]],
        ];
        foreach ($ranges as $country => $countryRanges) {
            foreach ($countryRanges as $range) {
                if ($ipLong >= $range[0] && $ipLong <= $range[1]) {
                    return $country;
                }
            }
        }
    }
    
    return '';
}
    
function submitQuizAttempt($pdo, $quizId) {
    global $body;
    
    if (!$body) {
        http_response_code(400);
        echo json_encode(["message" => "Empty body"]);
        exit;
    }
    
    $questionId = $body["question_id"] ?? "";
    $answerId = $body["answer_id"] ?? null;
    
    if (!preg_match('#^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$#i', $questionId)) {
        http_response_code(400);
        echo json_encode(["message" => "Неверный ID вопроса"]);
        exit;
    }
    
    // Собираем метаданные (аналогично votePoll)
    $userAgent = $_SERVER["HTTP_USER_AGENT"] ?? "";
    $ip = $_SERVER["REMOTE_ADDR"] ?? "unknown";
    $utmSource = $body["utm_source"] ?? ($_GET["utm_source"] ?? "");
    $utmMedium = $body["utm_medium"] ?? ($_GET["utm_medium"] ?? "");
    $shareLinkId = $body["share_link_id"] ?? ($_GET["share_link_id"] ?? null);
    
    // Определяем тип устройства и ОС
    $deviceType = detectDeviceType($userAgent);
    $os = detectOS($userAgent);
    $browser = detectBrowser($userAgent);
    $ipCountry = detectCountry($ip);
    
    // Проверяем правильность ответа
    $isCorrect = false;
    if ($answerId) {
        $stmt = $pdo->prepare("SELECT is_correct FROM quiz_answers WHERE id = :aid");
        $stmt->execute([":aid" => $answerId]);
        $row = $stmt->fetch();
        if ($row) {
            $isCorrect = (bool)$row['is_correct'];
        }
    }
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO quiz_attempts (
                quiz_id, 
                question_id, 
                answer_id,
                user_agent, 
                ip_address, 
                ip_country,
                utm_source, 
                utm_medium,
                device_type,
                os_type,
                browser_type,
                is_correct,
                share_link_id
            ) VALUES (
                :qid, :quesid, :aid, :ua, :ip, :ic, :us, :um, :dt, :os, :br, :corr, :slid
            )
        ");
        $stmt->execute([
            ":qid" => $quizId,
            ":quesid" => $questionId,
            ":aid" => $answerId,
            ":ua" => $userAgent,
            ":ip" => $ip,
            ":ic" => $ipCountry,
            ":us" => $utmSource,
            ":um" => $utmMedium,
            ":dt" => $deviceType,
            ":os" => $os,
            ":br" => $browser,
            ":corr" => $isCorrect ? "true" : "false",
            ":slid" => $shareLinkId
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "DB error: " . $e->getMessage()]);
        exit;
    }
    
    echo json_encode(["success" => true, "is_correct" => $isCorrect]);
    exit;
}

function createPoll($pdo) {
    global $body;
    if (empty($body['title'])) {
        http_response_code(400);
        echo json_encode(['message' => 'Title required']);
        exit;
    }
    
    // Получаем ID пользователя если авторизован
    $userId = getSessionUser($pdo);
    
    $pdo->beginTransaction();
    try {
        // Генерируем owner_key для доступа к статистике
        $ownerKey = bin2hex(random_bytes(32));
        $ownerKeyHash = hash('sha256', 'owner:' . $ownerKey);
        
        $stmt = $pdo->prepare("INSERT INTO polls (title, description, owner_key_hash, owner_user_id) VALUES (:t, :d, :okh, :uid) RETURNING id::text");
        $stmt->execute([":t" => $body["title"], ":d" => $body["description"] ?? "", ":okh" => $ownerKeyHash, ":uid" => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $id = $row['id'];

        if (!empty($body['options'])) {
            $stmt = $pdo->prepare("INSERT INTO poll_options (poll_id, option_text, position) VALUES (:pid, :txt, :pos)");
            foreach ($body['options'] as $i => $opt) {
                $stmt->execute([":pid" => $id, ":txt" => $opt, ":pos" => $i + 1]);
            }
        }
        $pdo->commit();
        // Возвращаем owner_key клиенту
        echo json_encode(["id" => $id, "owner_key" => $ownerKey]);
        exit;
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["message" => $e->getMessage()]);
        exit;
    }
}

function listQuizzes($pdo) {
    $q = $_GET["q"] ?? "";
    if ($q) {
        $stmt = $pdo->prepare("SELECT id::text, title, description FROM quizzes WHERE title ILIKE :q OR description ILIKE :q ORDER BY created_at DESC");
        $stmt->execute([":q" => "%$q%"]);
    } else {
        $stmt = $pdo->query("SELECT id::text, title, description FROM quizzes ORDER BY created_at DESC");
    }
    echo json_encode(["items" => $stmt->fetchAll()]);
    exit;
}

function getQuiz($pdo, $id) {
    $stmt = $pdo->prepare("SELECT q.id::text, q.title, q.description, qq.id as qid, qq.question_text FROM quizzes q JOIN quiz_questions qq ON qq.quiz_id = q.id WHERE q.id = :id LIMIT 1");
    $stmt->execute([":id" => $id]);
    $quiz = $stmt->fetch();
    if (!$quiz) { http_response_code(404); exit; }
    $stmt = $pdo->prepare("SELECT answer_text as text, is_correct::bool FROM quiz_answers WHERE question_id = :qid ORDER BY position");
    $stmt->execute([":qid" => $quiz["qid"]]);
    $quiz["answers"] = $stmt->fetchAll();
    $quiz["question"] = $quiz["question_text"];
    unset($quiz["qid"], $quiz["question_text"]);
    echo json_encode($quiz);
    exit;
}

function createQuiz($pdo) {
    global $body;
    if (empty($body['title']) || empty($body['question'])) {
        http_response_code(400);
        echo json_encode(['message' => 'Fields required']);
        exit;
    }
    
    // Получаем ID пользователя если авторизован
    $userId = getSessionUser($pdo);
    
    $pdo->beginTransaction();
    try {
        // Генерируем owner_key для доступа к статистике
        $ownerKey = bin2hex(random_bytes(32));
        $ownerKeyHash = hash('sha256', 'owner:' . $ownerKey);
        
        $stmt = $pdo->prepare("INSERT INTO quizzes (title, description, owner_key_hash, owner_user_id) VALUES (:t, :d, :okh, :uid) RETURNING id::text");
        $stmt->execute([":t" => $body["title"], ":d" => $body["description"] ?? "", ":okh" => $ownerKeyHash, ":uid" => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $qid = $row['id'];
    
        $stmt = $pdo->prepare("INSERT INTO quiz_questions (quiz_id, question_text, position) VALUES (:qid, :txt, 1) RETURNING id::text");
        $stmt->execute([":qid" => $qid, ":txt" => $body["question"]]);
        $qRow = $stmt->fetch(PDO::FETCH_ASSOC);
        $questionId = $qRow['id'];

        if (!empty($body['answers'])) {
            $stmt = $pdo->prepare("INSERT INTO quiz_answers (question_id, answer_text, is_correct, position) VALUES (:qid, :txt, :corr, :pos)");
            foreach ($body['answers'] as $i => $ans) {
                $stmt->execute([
                    ":qid" => $questionId, 
                    ":txt" => $ans["text"], 
                    ":corr" => ($ans["is_correct"] ? "true" : "false"), 
                    ":pos" => $i + 1
                ]);
            }
        }
        $pdo->commit();
        echo json_encode(["id" => $qid, "owner_key" => $ownerKey]);
        exit;
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["message" => $e->getMessage()]);
        exit;
    }
}
    
function deleteItem($pdo, $type, $id) {
    if (($_SERVER["HTTP_AUTHORIZATION"] ?? "") !== "admin123") { http_response_code(401); return; }
    $table = ($type === "polls") ? "polls" : "quizzes";
    $stmt = $pdo->prepare("DELETE FROM $table WHERE id = :id");
    $stmt->execute([":id" => $id]);
    echo json_encode(["success" => true]);
}

function pollStats($pdo, $pollId) {
    $ownerKey = $_GET["owner_key"] ?? "";
    
    // Проверяем доступ: либо owner_key, либо пользователь создал опрос
    $accessGranted = false;
    
    // Способ 1: owner_key
    if ($ownerKey) {
        $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
        $stmt = $pdo->prepare("SELECT id::text, owner_user_id FROM polls WHERE id = :pid AND owner_key_hash = :okh LIMIT 1");
        $stmt->execute([":pid" => $pollId, ":okh" => $ownerKeyHash]);
        $poll = $stmt->fetch();
        if ($poll) $accessGranted = true;
    }
    
    // Способ 2: авторизованный пользователь
    if (!$accessGranted) { 
        $userId = getSessionUser($pdo);
        if ($userId) {
            $stmt = $pdo->prepare("SELECT id::text, owner_user_id FROM polls WHERE id = :pid AND owner_user_id = :uid LIMIT 1");
            $stmt->execute([":pid" => $pollId, ":uid" => $userId]);
            $poll = $stmt->fetch();
            if ($poll) $accessGranted = true;
        }
    }
    
    if (!$accessGranted) {
        http_response_code(403); 
        echo json_encode(["message" => "Нет доступа к статистике. Только создатель опроса может просматривать статистику."]);
        exit;
    }
    
    $stmt = $pdo->prepare("SELECT id::text, title, description FROM polls WHERE id = :id");
    $stmt->execute([":id" => $pollId]);
    $poll = $stmt->fetch();
    
    $stmt = $pdo->prepare("SELECT po.id::text, po.option_text as text, COUNT(pv.id)::int as votes FROM poll_options po LEFT JOIN poll_votes pv ON pv.option_id = po.id WHERE po.poll_id = :pid GROUP BY po.id, po.option_text, po.position ORDER BY po.position");
    $stmt->execute([":pid" => $pollId]);
    $options = $stmt->fetchAll();
    $totalVotes = array_sum(array_column($options, 'votes'));
    $optionsWithPercent = array_map(function($opt) use ($totalVotes) {
        $percent = $totalVotes > 0 ? round($opt['votes'] / $totalVotes * 100) : 0;
        return ['id' => $opt['id'], 'text' => $opt['text'], 'votes' => (int)$opt['votes'], 'percent' => (int)$percent];
    }, $options);
    
    $analytics = [];
    
    // Browsers
    $stmt = $pdo->prepare("SELECT COALESCE(browser_type, 'Other') as name, COUNT(*) as count FROM poll_votes pv WHERE pv.poll_id = :pid GROUP BY name ORDER BY count DESC");
    $stmt->execute([":pid" => $pollId]);
    $browsers = $stmt->fetchAll();
    if ($browsers) $analytics['browsers'] = $browsers;
    
    // Operating Systems
    $stmt = $pdo->prepare("SELECT COALESCE(os_type, 'Unknown') as name, COUNT(*) as count FROM poll_votes pv WHERE pv.poll_id = :pid GROUP BY name ORDER BY count DESC");
    $stmt->execute([":pid" => $pollId]);
    $osList = $stmt->fetchAll();
    if ($osList) $analytics['os'] = $osList;
    
    // Devices
    $stmt = $pdo->prepare("SELECT COALESCE(device_type, 'unknown') as name, COUNT(*) as count FROM poll_votes pv WHERE pv.poll_id = :pid GROUP BY name ORDER BY count DESC");
    $stmt->execute([":pid" => $pollId]);
    $devices = $stmt->fetchAll();
    if ($devices) $analytics['devices'] = $devices;
    
    // Locations (Countries)
    $stmt = $pdo->prepare("SELECT COALESCE(NULLIF(ip_country, ''), 'Unknown') as name, COUNT(*) as count FROM poll_votes pv WHERE pv.poll_id = :pid GROUP BY name ORDER BY count DESC LIMIT 15");
    $stmt->execute([":pid" => $pollId]);
    $locations = $stmt->fetchAll();
    if ($locations) $analytics['locations'] = $locations;
    
    // Share Links Stats
    $stmt = $pdo->prepare("
        SELECT psl.name, COUNT(pv.id)::int as count
        FROM poll_share_links psl
        LEFT JOIN poll_votes pv ON pv.share_link_id = psl.id
        WHERE psl.poll_id = :pid
        GROUP BY psl.id, psl.name
        ORDER BY count DESC
    ");
    $stmt->execute([":pid" => $pollId]);
    $shareLinks = $stmt->fetchAll();
    if ($shareLinks) $analytics['share_links'] = $shareLinks;
    
    $result = [
        "poll" => $poll,
        "options" => $optionsWithPercent,
        "total_votes" => $totalVotes,
        "analytics" => $analytics
    ];
    
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

function quizStats($pdo, $quizId) {
    $ownerKey = $_GET["owner_key"] ?? "";
    
    // Проверяем доступ: либо owner_key, либо пользователь создал викторину
    $accessGranted = false;
    
    // Способ 1: owner_key
    if ($ownerKey) {
        $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
        $stmt = $pdo->prepare("SELECT id::text, owner_user_id FROM quizzes WHERE id = :pid AND owner_key_hash = :okh LIMIT 1");
        $stmt->execute([":pid" => $quizId, ":okh" => $ownerKeyHash]);
        $quiz = $stmt->fetch();
        if ($quiz) $accessGranted = true;
    }
    
    // Способ 2: авторизованный пользователь
    if (!$accessGranted) { 
        $userId = getSessionUser($pdo);
        if ($userId) {
            $stmt = $pdo->prepare("SELECT id::text, owner_user_id FROM quizzes WHERE id = :pid AND owner_user_id = :uid LIMIT 1");
            $stmt->execute([":pid" => $quizId, ":uid" => $userId]);
            $quiz = $stmt->fetch();
            if ($quiz) $accessGranted = true;
        }
    }
    
    if (!$accessGranted) {
        http_response_code(403); 
        echo json_encode(["message" => "Нет доступа к статистике. Только создатель викторины может просматривать статистику."]);
        exit;
    }
    
    $stmt = $pdo->prepare("SELECT id::text, title, description FROM quizzes WHERE id = :id");
    $stmt->execute([":id" => $quizId]);
    $quiz = $stmt->fetch();
    
    // Получаем вопросы и ответы
    $stmt = $pdo->prepare("SELECT qq.id::text as question_id, qq.question_text FROM quiz_questions qq WHERE qq.quiz_id = :qid ORDER BY qq.position");
    $stmt->execute([":qid" => $quizId]);
    $questions = $stmt->fetchAll();
    
    $quizStats = [];
    $totalAttempts = 0;
    
    foreach ($questions as $question) {
        $stmt = $pdo->prepare("
            SELECT qa.id::text, qa.answer_text, qa.is_correct::bool as is_correct, 
                   COUNT(qat.id)::int as attempts,
                   COUNT(CASE WHEN qat.is_correct = true THEN 1 END)::int as correct
            FROM quiz_answers qa
            LEFT JOIN quiz_attempts qat ON qat.answer_id = qa.id
            WHERE qa.question_id = :qid
            GROUP BY qa.id, qa.answer_text, qa.is_correct, qa.position
            ORDER BY qa.position
        ");
        $stmt->execute([":qid" => $question['question_id']]);
        $answers = $stmt->fetchAll();
        
        $questionStats = [
            'question_id' => $question['question_id'],
            'question_text' => $question['question_text'],
            'answers' => []
        ];
        
        foreach ($answers as $answer) {
            $attempts = (int)$answer['attempts'];
            $correct = (int)$answer['correct'];
            $percent = $attempts > 0 ? round($correct / $attempts * 100) : 0;
            
            $questionStats['answers'][] = [
                'id' => $answer['id'],
                'text' => $answer['answer_text'],
                'is_correct' => (bool)$answer['is_correct'],
                'attempts' => $attempts,
                'correct' => $correct,
                'percent' => $percent
            ];
            
            if ($answer['is_correct']) {
                $totalAttempts += $attempts;
            }
        }
        
        $quizStats[] = $questionStats;
    }
    
    // Analytics
    $analytics = [];
    
    // Browsers
    $stmt = $pdo->prepare("SELECT COALESCE(browser_type, 'Other') as name, COUNT(DISTINCT id)::int as count FROM quiz_attempts WHERE quiz_id = :qid GROUP BY name ORDER BY count DESC");
    $stmt->execute([":qid" => $quizId]);
    $browsers = $stmt->fetchAll();
    if ($browsers) $analytics['browsers'] = $browsers;
    
    // Operating Systems
    $stmt = $pdo->prepare("SELECT COALESCE(os_type, 'Unknown') as name, COUNT(DISTINCT id)::int as count FROM quiz_attempts WHERE quiz_id = :qid GROUP BY name ORDER BY count DESC");
    $stmt->execute([":qid" => $quizId]);
    $osList = $stmt->fetchAll();
    if ($osList) $analytics['os'] = $osList;
    
    // Devices
    $stmt = $pdo->prepare("SELECT COALESCE(device_type, 'unknown') as name, COUNT(DISTINCT id)::int as count FROM quiz_attempts WHERE quiz_id = :qid GROUP BY name ORDER BY count DESC");
    $stmt->execute([":qid" => $quizId]);
    $devices = $stmt->fetchAll();
    if ($devices) $analytics['devices'] = $devices;
    
    // Locations (Countries)
    $stmt = $pdo->prepare("SELECT COALESCE(NULLIF(ip_country, ''), 'Unknown') as name, COUNT(DISTINCT id)::int as count FROM quiz_attempts WHERE quiz_id = :qid GROUP BY name ORDER BY count DESC LIMIT 15");
    $stmt->execute([":qid" => $quizId]);
    $locations = $stmt->fetchAll();
    if ($locations) $analytics['locations'] = $locations;
    
    // Share Links
    $stmt = $pdo->prepare("
        SELECT COALESCE(qsl.name, 'direct') as name, COUNT(qat.id)::int as count 
        FROM quiz_attempts qat
        LEFT JOIN quiz_share_links qsl ON qat.share_link_id = qsl.id AND qsl.quiz_id = :qid
        WHERE qat.quiz_id = :qid
        GROUP BY qsl.name
        ORDER BY count DESC
    ");
    $stmt->execute([":qid" => $quizId]);
    $shareLinks = $stmt->fetchAll();
    if ($shareLinks) $analytics['share_links'] = $shareLinks;
    
    $result = [
        "quiz" => $quiz,
        "questions" => $quizStats,
        "total_attempts" => $totalAttempts,
        "analytics" => $analytics
    ];
    
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

function authMe($pdo) {
    $userId = getSessionUser($pdo);
    if (!$userId) {
        echo json_encode(["authenticated" => false]);
        return;
    }
    $stmt = $pdo->prepare("SELECT id::text, name, email FROM users WHERE id = :id LIMIT 1");
    $stmt->execute([":id" => $userId]);
    $user = $stmt->fetch();
    if (!$user) {
        echo json_encode(["authenticated" => false]);
        return;
    }
    echo json_encode(["authenticated" => true, "user" => $user]);
}
    
function telegramAuth($pdo) {
    global $body;
    $botToken = getenv("TELEGRAM_BOT_TOKEN") ?: "";
    if (!$botToken) {
        http_response_code(503);
        echo json_encode(["code" => "not_configured", "message" => "Telegram не настроен"]);
        return;
    }
    
    $hash = $body["hash"] ?? "";
    $authDate = (int)($body["auth_date"] ?? 0);
    if (time() - $authDate > 86400) {
        http_response_code(400);
        echo json_encode(["code" => "expired", "message" => "Данные устарели"]);
        return;
    }
    
    // Verify hash
    $checkData = [];
    foreach ($body as $key => $value) {
        if ($key !== "hash") $checkData[] = "$key=$value";
    }
    sort($checkData);
    $dataCheckString = implode("\n", $checkData);
    $secretKey = hash("sha256", $botToken, true);
    $expectedHash = hash_hmac("sha256", $dataCheckString, $secretKey);
    
    if (!hash_equals($expectedHash, $hash)) {
        http_response_code(400);
        echo json_encode(["code" => "invalid_hash", "message" => "Неверная подпись"]);
        return;
    }
    
    $userId = (int)($body["id"] ?? 0);
    if ($userId <= 0) {
        http_response_code(400);
        echo json_encode(["code" => "invalid_user", "message" => "Неверный ID"]);
        return;
    }
    
    // Save/update telegram user
    $stmt = $pdo->prepare("INSERT INTO telegram_users (id, username, first_name, last_name, photo_url, auth_date, updated_at) 
        VALUES (:id, :username, :first_name, :last_name, :photo_url, to_timestamp(:auth_date), NOW())
        ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, photo_url=EXCLUDED.photo_url, auth_date=to_timestamp(EXCLUDED.auth_date), updated_at=NOW()");
    $stmt->execute([
        ":id" => $userId,
        ":username" => $body["username"] ?? "",
        ":first_name" => $body["first_name"] ?? "",
        ":last_name" => $body["last_name"] ?? "",
        ":photo_url" => $body["photo_url"] ?? "",
        ":auth_date" => $authDate
    ]);
    
    // Get or create user in users table
    $email = "telegram_" . $userId . "@local";
    $stmt = $pdo->prepare("INSERT INTO users (telegram_id, name, email, password_hash, created_at) 
        VALUES (:tid, :name, :email, '', NOW())
        ON CONFLICT (telegram_id) DO UPDATE SET name = EXCLUDED.name
        RETURNING id::text");
    $stmt->execute([
        ":tid" => $userId,
        ":name" => $body["first_name"] ?? $body["username"] ?? "Telegram User",
        ":email" => $email
    ]);
    $userRow = $stmt->fetch();
    $userUuid = $userRow["id"];
    
    // Create session
    $token = bin2hex(random_bytes(32));
    $expiresAt = time() + (30 * 24 * 60 * 60); // 30 days
    $tokenHash = hash("sha256", "session:" . $token);
    $stmt = $pdo->prepare("INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (:uid, :th, to_timestamp(:exp))");
    $stmt->execute([":uid" => $userUuid, ":th" => $tokenHash, ":exp" => $expiresAt]);
    
    // Set cookie
    $sig = hash_hmac("sha256", "session:" . $token, getenv("HASH_SECRET") ?: "dev-secret");
    setcookie("votely_session", "$token.$sig", $expiresAt, "/", "", false, true);
    
    echo json_encode(["success" => true, "user" => ["id" => $userUuid, "username" => $body["username"] ?? ""]]);
}

function executeSQL($pdo) {
    if (($_SERVER["HTTP_AUTHORIZATION"] ?? "") !== "admin123") { http_response_code(401); return; }
    $query = trim($body["query"] ?? "");
    try {
        if (stripos($query, "SELECT") === 0) {
            $stmt = $pdo->query($query);
            $cols = [];
            for ($i = 0; $i < $stmt->columnCount(); $i++) { $cols[] = $stmt->getColumnMeta($i)["name"]; }
            echo json_encode(["columns" => $cols, "rows" => $stmt->fetchAll(PDO::FETCH_NUM)]);
        } else {
            echo json_encode(["affected_rows" => $pdo->exec($query)]);
        }
    } catch (Exception $e) { http_response_code(500); echo json_encode(["message" => $e->getMessage()]); }
}

function getPollLinks($pdo, $pollId) {
    $ownerKey = $_GET["owner_key"] ?? "";
    if (!$ownerKey) { 
        http_response_code(403); 
        echo json_encode(["message" => "Требуется ключ владельца"]); 
        exit;
    }
    $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
    $stmt = $pdo->prepare("SELECT id::text FROM polls WHERE id = :pid AND owner_key_hash = :okh LIMIT 1");
    $stmt->execute([":pid" => $pollId, ":okh" => $ownerKeyHash]);
    if (!$stmt->fetch()) { 
        http_response_code(403); 
        echo json_encode(["message" => "Нет доступа"]); 
        exit;
    }
    
    $stmt = $pdo->prepare("SELECT id::text, name, utm_source, utm_medium, created_at::text FROM poll_share_links WHERE poll_id = :pid ORDER BY created_at DESC");
    $stmt->execute([":pid" => $pollId]);
    echo json_encode(["items" => $stmt->fetchAll()]);
    exit;
}

function createPollLink($pdo, $pollId) {
    global $body;
    
    $ownerKey = $_GET["owner_key"] ?? "";
    if (!$ownerKey) { 
        http_response_code(403); 
        echo json_encode(["message" => "Требуется ключ владельца"]); 
        exit;
    }
    $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
    $stmt = $pdo->prepare("SELECT id::text FROM polls WHERE id = :pid AND owner_key_hash = :okh LIMIT 1");
    $stmt->execute([":pid" => $pollId, ":okh" => $ownerKeyHash]);
    if (!$stmt->fetch()) { 
        http_response_code(403); 
        echo json_encode(["message" => "Нет доступа"]); 
        exit;
    }
    
    $name = trim($body["name"] ?? "");
    if (empty($name)) {
        http_response_code(400);
        echo json_encode(["message" => "Укажите название ссылки"]);
        exit;
    }
    
    $utmSource = trim($body["utm_source"] ?? "");
    $utmMedium = trim($body["utm_medium"] ?? "shared");
    
    $stmt = $pdo->prepare("INSERT INTO poll_share_links (poll_id, name, utm_source, utm_medium) VALUES (:pid, :name, :us, :um) RETURNING id::text");
    $stmt->execute([":pid" => $pollId, ":name" => $name, ":us" => $utmSource, ":um" => $utmMedium]);
    $row = $stmt->fetch();
    
    echo json_encode(["id" => $row["id"], "name" => $name, "utm_source" => $utmSource, "utm_medium" => $utmMedium]);
    exit;
}

function deletePollLink($pdo, $pollId, $linkId) {
    $ownerKey = $_GET["owner_key"] ?? "";
    if (!$ownerKey) { 
        http_response_code(403); 
        echo json_encode(["message" => "Требуется ключ владельца"]); 
        exit;
    }
    $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
    $stmt = $pdo->prepare("SELECT id::text FROM polls WHERE id = :pid AND owner_key_hash = :okh LIMIT 1");
    $stmt->execute([":pid" => $pollId, ":okh" => $ownerKeyHash]);
    if (!$stmt->fetch()) { 
        http_response_code(403); 
        echo json_encode(["message" => "Нет доступа"]); 
        exit;
    }
    
    $stmt = $pdo->prepare("DELETE FROM poll_share_links WHERE id = :lid AND poll_id = :pid");
    $stmt->execute([":lid" => $linkId, ":pid" => $pollId]);
    
    echo json_encode(["success" => true]);
    exit;
}

function getQuizLinks($pdo, $quizId) {
    $ownerKey = $_GET["owner_key"] ?? "";
    if (!$ownerKey) { 
        http_response_code(403); 
        echo json_encode(["message" => "Требуется ключ владельца"]); 
        exit;
    }
    $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
    $stmt = $pdo->prepare("SELECT id::text FROM quizzes WHERE id = :pid AND owner_key_hash = :okh LIMIT 1");
    $stmt->execute([":pid" => $quizId, ":okh" => $ownerKeyHash]);
    if (!$stmt->fetch()) { 
        http_response_code(403); 
        echo json_encode(["message" => "Нет доступа"]); 
        exit;
    }
    
    $stmt = $pdo->prepare("SELECT id::text, name, utm_source, utm_medium, created_at::text FROM quiz_share_links WHERE quiz_id = :qid ORDER BY created_at DESC");
    $stmt->execute([":qid" => $quizId]);
    echo json_encode(["items" => $stmt->fetchAll()]);
    exit;
}

function createQuizLink($pdo, $quizId) {
    global $body;
    
    $ownerKey = $_GET["owner_key"] ?? "";
    if (!$ownerKey) { 
        http_response_code(403); 
        echo json_encode(["message" => "Требуется ключ владельца"]); 
        exit;
    }
    $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
    $stmt = $pdo->prepare("SELECT id::text FROM quizzes WHERE id = :pid AND owner_key_hash = :okh LIMIT 1");
    $stmt->execute([":pid" => $quizId, ":okh" => $ownerKeyHash]);
    if (!$stmt->fetch()) { 
        http_response_code(403); 
        echo json_encode(["message" => "Нет доступа"]); 
        exit;
    }
    
    $name = trim($body["name"] ?? "");
    if (empty($name)) {
        http_response_code(400);
        echo json_encode(["message" => "Укажите название ссылки"]);
        exit;
    }
    
    $utmSource = trim($body["utm_source"] ?? "");
    $utmMedium = trim($body["utm_medium"] ?? "shared");
    
    $stmt = $pdo->prepare("INSERT INTO quiz_share_links (quiz_id, name, utm_source, utm_medium) VALUES (:qid, :name, :us, :um) RETURNING id::text");
    $stmt->execute([":qid" => $quizId, ":name" => $name, ":us" => $utmSource, ":um" => $utmMedium]);
    $row = $stmt->fetch();
    
    echo json_encode(["id" => $row["id"], "name" => $name, "utm_source" => $utmSource, "utm_medium" => $utmMedium]);
    exit;
}

function deleteQuizLink($pdo, $quizId, $linkId) {
    $ownerKey = $_GET["owner_key"] ?? "";
    if (!$ownerKey) { 
        http_response_code(403); 
        echo json_encode(["message" => "Требуется ключ владельца"]); 
        exit;
    }
    $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
    $stmt = $pdo->prepare("SELECT id::text FROM quizzes WHERE id = :pid AND owner_key_hash = :okh LIMIT 1");
    $stmt->execute([":pid" => $quizId, ":okh" => $ownerKeyHash]);
    if (!$stmt->fetch()) { 
        http_response_code(403); 
        echo json_encode(["message" => "Нет доступа"]); 
        exit;
    }
    
    $stmt = $pdo->prepare("DELETE FROM quiz_share_links WHERE id = :lid AND quiz_id = :qid");
    $stmt->execute([":lid" => $linkId, ":qid" => $quizId]);
    
    echo json_encode(["success" => true]);
    exit;
}

function registerUser($pdo) {
    global $body;
    
    if ($body === null) {
        http_response_code(400);
        echo json_encode(["message" => "Пустое тело запроса"]);
        exit;
    }
    
    $email = trim($body["email"] ?? "");
    $password = $body["password"] ?? "";
    $name = trim($body["name"] ?? "");
    
    if (!$email || !$password || !$name) {
        http_response_code(400);
        echo json_encode(["message" => "Заполните все поля"]);
        exit;
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(["message" => "Неверный формат email"]);
        exit;
    }
    
    if (strlen($password) < 6) {
        http_response_code(400);
        echo json_encode(["message" => "Пароль должен быть не менее 6 символов"]);
        exit;
    }
    
    // Проверяем существующего пользователя
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
    $stmt->execute([":email" => strtolower($email)]);
    if ($stmt->fetch()) {
        http_response_code(400);
        echo json_encode(["message" => "Пользователь с таким email уже существует"]);
        exit;
    }
    
    // Хэшируем пароль
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    
    try {
        $stmt = $pdo->prepare("INSERT INTO users (email, password_hash, name) VALUES (:email, :ph, :name) RETURNING id::text, email, name");
        $stmt->execute([
            ":email" => strtolower($email),
            ":ph" => $passwordHash,
            ":name" => $name
        ]);
        $user = $stmt->fetch();
        
        // Создаём сессию
        $token = bin2hex(random_bytes(32));
        $expiresAt = time() + (30 * 24 * 60 * 60); // 30 дней
        $tokenHash = hash("sha256", "session:" . $token);
        $stmt = $pdo->prepare("INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (:uid, :th, to_timestamp(:exp))");
        $stmt->execute([":uid" => $user["id"], ":th" => $tokenHash, ":exp" => $expiresAt]);
    
        // Устанавливаем cookie
        $sig = hash_hmac("sha256", "session:" . $token, getenv("HASH_SECRET") ?: "dev-secret");
        setcookie("votely_session", "$token.$sig", $expiresAt, "/", "", false, true);
        
        echo json_encode(["success" => true, "user" => $user]);
        exit;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Ошибка регистрации: " . $e->getMessage()]);
        exit;
    }
}
    
function loginUser($pdo) {
    global $body;
    
    if ($body === null) {
        http_response_code(400);
        echo json_encode(["message" => "Пустое тело запроса"]);
        exit;
    }
    
    $email = trim($body["email"] ?? "");
    $password = $body["password"] ?? "";
    
    if (!$email || !$password) {
        http_response_code(400);
        echo json_encode(["message" => "Заполните все поля"]);
        exit;
    }
    
    // Ищем пользователя
    $stmt = $pdo->prepare("SELECT id::text, email, name, password_hash FROM users WHERE email = :email LIMIT 1");
    $stmt->execute([":email" => strtolower($email)]);
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($password, $user["password_hash"])) {
        http_response_code(401);
        echo json_encode(["message" => "Неверный email или пароль"]);
        exit;
    }
    
    // Создаём сессию
    $token = bin2hex(random_bytes(32));
    $expiresAt = time() + (30 * 24 * 60 * 60); // 30 дней
    $tokenHash = hash("sha256", "session:" . $token);
    $stmt = $pdo->prepare("INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (:uid, :th, to_timestamp(:exp))");
    $stmt->execute([":uid" => $user["id"], ":th" => $tokenHash, ":exp" => $expiresAt]);
    
    // Устанавливаем cookie
    $sig = hash_hmac("sha256", "session:" . $token, getenv("HASH_SECRET") ?: "dev-secret");
    setcookie("votely_session", "$token.$sig", $expiresAt, "/", "", false, true);
    
    // Возвращаем данные без пароля
    unset($user["password_hash"]);
    echo json_encode(["success" => true, "user" => $user]);
    exit;
}

function logoutUser($pdo) {
    // Получаем токен из cookie
    $cookie = $_COOKIE["votely_session"] ?? "";
    if ($cookie) {
        list($token) = explode(".", $cookie);
        $tokenHash = hash("sha256", "session:" . $token);
        $stmt = $pdo->prepare("DELETE FROM user_sessions WHERE token_hash = :token");
        $stmt->execute([":token" => $tokenHash]);
    }
    
    // Удаляем cookie
    setcookie("votely_session", "", time() - 3600, "/");
    
    echo json_encode(["success" => true]);
    exit;
}
?>