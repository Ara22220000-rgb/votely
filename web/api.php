<?php
error_reporting(0);
ini_set('display_errors', 0);
header("Content-Type: application/json; charset=utf-8");
header("X-Content-Type-Options: nosniff");
header("Referrer-Policy: same-origin");
header("Permissions-Policy: camera=(), microphone=(), geolocation=()");

$dbHost = getenv("PG_HOST") ?: "postgres";
$dbPort = getenv("PG_PORT") ?: "5432";
$dbName = getenv("PG_DB") ?: "votely";
$dbUser = getenv("PG_USER") ?: "votely";
$dbPassword = getenv("PG_PASSWORD") ?: "votely";
$hashSecret = getenv("HASH_SECRET") ?: "dev-secret";

try {
    $pdo = new PDO("pgsql:host=$dbHost;port=$dbPort;dbname=$dbName", $dbUser, $dbPassword, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    jsonError(500, "db_error", "Ошибка подключения к базе данных");
}

$method = $_SERVER["REQUEST_METHOD"];
$path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
$body = json_decode(file_get_contents("php://input"), true);
if (!is_array($body)) $body = [];
$ip = $_SERVER["REMOTE_ADDR"] ?? "unknown";

rateLimit($ip, $path);

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
    case $method === "GET" && preg_match("#^/api/v1/polls/([^/]+)/stats$#", $path, $m):
        pollStats($pdo, $m[1]);
        break;
    case $method === "GET" && $path === "/api/v1/quizzes":
        listQuizzes($pdo);
        break;
    case $method === "GET" && preg_match("#^/api/v1/quizzes/([^/]+)$#", $path, $m):
        getQuiz($pdo, $m[1]);
        break;
    case $method === "POST" && $path === "/api/v1/quizzes":
        createQuiz($pdo);
        break;
    case $method === "GET" && $path === "/api/v1/auth/me":
        authMe($pdo);
        break;
    case $method === "GET" && $path === "/api/v1/auth/telegram/config":
        telegramConfig();
        break;
    case $method === "POST" && $path === "/api/v1/auth/telegram":
        telegramAuth($pdo);
        break;
    case $method === "GET" && $path === "/api/v1/admin/me":
        adminMe();
        break;
    case $method === "GET" && $path === "/api/v1/admin/summary":
        requireAdmin();
        adminSummary($pdo);
        break;
    case $method === "GET" && $path === "/api/v1/admin/items":
        requireAdmin();
        adminItems($pdo);
        break;
    case $method === "DELETE" && preg_match("#^/api/v1/admin/(polls|quizzes)/([^/]+)$#", $path, $m):
        requireAdminCsrf();
        deleteItem($pdo, $m[1], $m[2]);
        break;
    default:
        jsonError(404, "not_found", "Не найдено");
}

function jsonError($status, $code, $message) {
    http_response_code($status);
    echo json_encode(["code" => $code, "message" => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function rateLimit($ip, $path) {
    if (strpos($path, "/api/") !== 0) return;
    $limit = 160;
    $rateFile = sys_get_temp_dir() . "/votely_rate_" . md5($ip . ":" . $path);
    $rateData = file_exists($rateFile) ? json_decode(file_get_contents($rateFile), true) : null;
    if (!is_array($rateData) || time() > ($rateData["reset"] ?? 0)) {
        $rateData = ["count" => 0, "reset" => time() + 60];
    }
    $rateData["count"]++;
    file_put_contents($rateFile, json_encode($rateData), LOCK_EX);
    if ($rateData["count"] > $limit) {
        jsonError(429, "rate_limited", "Слишком много запросов");
    }
}

function isUuid($value) {
    return is_string($value) && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value);
}

function cleanText($value, $max) {
    $value = trim((string)$value);
    if (strlen($value) > $max) $value = substr($value, 0, $max);
    return $value;
}

function getSessionUser($pdo) {
    $cookie = $_COOKIE["votely_session"] ?? "";
    if (!$cookie) return null;
    $parts = explode(".", $cookie);
    if (count($parts) !== 2) return null;
    [$token, $sig] = $parts;
    $expectedSig = hash_hmac("sha256", "session:" . $token, getenv("HASH_SECRET") ?: "dev-secret");
    if (!hash_equals($expectedSig, $sig)) return null;
    $tokenHash = hash("sha256", "session-token:" . $token);
    $stmt = $pdo->prepare("SELECT user_id FROM user_sessions WHERE token_hash = :t AND expires_at > NOW()");
    $stmt->execute([":t" => $tokenHash]);
    $row = $stmt->fetch();
    return $row ? (int)$row["user_id"] : null;
}

function listPolls($pdo) {
    $q = cleanText($_GET["q"] ?? "", 120);
    if ($q !== "") {
        $stmt = $pdo->prepare("SELECT id::text, title, description FROM polls WHERE title ILIKE :q OR description ILIKE :q ORDER BY created_at DESC LIMIT 100");
        $stmt->execute([":q" => "%$q%"]);
    } else {
        $stmt = $pdo->query("SELECT id::text, title, description FROM polls ORDER BY created_at DESC LIMIT 100");
    }
    echo json_encode(["items" => $stmt->fetchAll()], JSON_UNESCAPED_UNICODE);
}

function getPoll($pdo, $id) {
    if (!isUuid($id)) jsonError(400, "bad_id", "Неверный ID");
    $stmt = $pdo->prepare("SELECT id::text, title, description FROM polls WHERE id = :id");
    $stmt->execute([":id" => $id]);
    $poll = $stmt->fetch();
    if (!$poll) jsonError(404, "not_found", "Опрос не найден");
    $stmt = $pdo->prepare("SELECT po.id::text, po.option_text as text, COUNT(pv.id)::int as votes FROM poll_options po LEFT JOIN poll_votes pv ON pv.option_id = po.id WHERE po.poll_id = :pid GROUP BY po.id, po.option_text, po.position ORDER BY po.position");
    $stmt->execute([":pid" => $id]);
    $poll["options"] = $stmt->fetchAll();
    echo json_encode($poll, JSON_UNESCAPED_UNICODE);
}

function createPoll($pdo) {
    global $body;
    $title = cleanText($body["title"] ?? "", 160);
    $description = cleanText($body["description"] ?? "", 2000);
    $options = array_values(array_filter(array_map(fn($v) => cleanText($v, 300), $body["options"] ?? [])));
    if ($title === "" || count($options) < 2) jsonError(400, "invalid_payload", "Укажите название и минимум два варианта");
    $userId = getSessionUser($pdo);
    $ownerKey = bin2hex(random_bytes(32));
    $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO polls (title, description, owner_user_id, owner_key_hash) VALUES (:t, :d, :uid, :okh) RETURNING id::text");
        $stmt->execute([":t" => $title, ":d" => $description, ":uid" => $userId, ":okh" => $ownerKeyHash]);
        $id = $stmt->fetch()["id"];
        $stmt = $pdo->prepare("INSERT INTO poll_options (poll_id, option_text, position) VALUES (:pid, :txt, :pos)");
        foreach ($options as $i => $opt) {
            $stmt->execute([":pid" => $id, ":txt" => $opt, ":pos" => $i + 1]);
        }
        $pdo->commit();
        echo json_encode(["id" => $id, "owner_key" => $ownerKey], JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError(500, "create_failed", "Не удалось создать опрос");
    }
}

function votePoll($pdo, $pollId) {
    global $body, $ip;
    if (!isUuid($pollId)) jsonError(400, "bad_id", "Неверный ID");
    $oid = $body["option_id"] ?? null;
    if (!isUuid($oid)) jsonError(400, "bad_option", "Выберите вариант");
    $voteRateFile = sys_get_temp_dir() . "/votely_vote_" . md5($ip . $pollId);
    if (file_exists($voteRateFile) && time() - (int)file_get_contents($voteRateFile) < 60) {
        jsonError(429, "vote_rate_limited", "Подождите перед повторным голосованием");
    }
    $stmt = $pdo->prepare("SELECT 1 FROM poll_options WHERE id = :oid AND poll_id = :pid");
    $stmt->execute([":oid" => $oid, ":pid" => $pollId]);
    if (!$stmt->fetch()) jsonError(400, "bad_option", "Вариант не относится к опросу");
    $userAgent = substr($_SERVER["HTTP_USER_AGENT"] ?? "", 0, 1024);
    $acceptLang = substr($_SERVER["HTTP_ACCEPT_LANGUAGE"] ?? "", 0, 256);
    $deviceHash = hash("sha256", $userAgent . "|" . $acceptLang . "|" . $ip);
    try {
        $stmt = $pdo->prepare("INSERT INTO poll_votes (poll_id, option_id, device_hash, ip_hash) VALUES (:pid, :oid, :dh, :ih)");
        $stmt->execute([":pid" => $pollId, ":oid" => $oid, ":dh" => $deviceHash, ":ih" => hash("sha256", $ip)]);
        file_put_contents($voteRateFile, time(), LOCK_EX);
    } catch (Exception $e) {
        jsonError(409, "already_voted", "Вы уже голосовали");
    }
    getPoll($pdo, $pollId);
}

function pollStats($pdo, $pollId) {
    if (!isUuid($pollId)) jsonError(400, "bad_id", "Неверный ID");
    $ownerKey = $_GET["owner_key"] ?? "";
    if ($ownerKey === "") jsonError(403, "forbidden", "Нет доступа");
    $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
    $stmt = $pdo->prepare("SELECT id::text, title, description, is_anonymous, shuffle_options, allowed_countries, closed_at IS NOT NULL as is_closed FROM polls WHERE id = :pid AND owner_key_hash = :okh");
    $stmt->execute([":pid" => $pollId, ":okh" => $ownerKeyHash]);
    $poll = $stmt->fetch();
    if (!$poll) jsonError(403, "forbidden", "Нет доступа");
    $stmt = $pdo->prepare("SELECT po.id::text, po.option_text as text, COUNT(pv.id)::int as votes FROM poll_options po LEFT JOIN poll_votes pv ON pv.option_id = po.id WHERE po.poll_id = :pid GROUP BY po.id, po.option_text, po.position ORDER BY po.position");
    $stmt->execute([":pid" => $pollId]);
    $options = $stmt->fetchAll();
    $totalVotes = array_sum(array_map(fn($o) => (int)$o["votes"], $options));
    foreach ($options as &$option) {
        $option["votes"] = (int)$option["votes"];
        $option["percent"] = $totalVotes > 0 ? (int)round($option["votes"] / $totalVotes * 100) : 0;
    }
    echo json_encode(["poll" => $poll, "options" => $options, "total_votes" => $totalVotes, "analytics" => []], JSON_UNESCAPED_UNICODE);
}

function listQuizzes($pdo) {
    $q = cleanText($_GET["q"] ?? "", 120);
    if ($q !== "") {
        $stmt = $pdo->prepare("SELECT id::text, title, description FROM quizzes WHERE title ILIKE :q OR description ILIKE :q ORDER BY created_at DESC LIMIT 100");
        $stmt->execute([":q" => "%$q%"]);
    } else {
        $stmt = $pdo->query("SELECT id::text, title, description FROM quizzes ORDER BY created_at DESC LIMIT 100");
    }
    echo json_encode(["items" => $stmt->fetchAll()], JSON_UNESCAPED_UNICODE);
}

function getQuiz($pdo, $id) {
    if (!isUuid($id)) jsonError(400, "bad_id", "Неверный ID");
    $stmt = $pdo->prepare("SELECT q.id::text, q.title, q.description, qq.id as qid, qq.question_text FROM quizzes q JOIN quiz_questions qq ON qq.quiz_id = q.id WHERE q.id = :id ORDER BY qq.position LIMIT 1");
    $stmt->execute([":id" => $id]);
    $quiz = $stmt->fetch();
    if (!$quiz) jsonError(404, "not_found", "Викторина не найдена");
    $stmt = $pdo->prepare("SELECT answer_text as text, is_correct::bool FROM quiz_answers WHERE question_id = :qid ORDER BY position");
    $stmt->execute([":qid" => $quiz["qid"]]);
    $quiz["answers"] = $stmt->fetchAll();
    $quiz["question"] = $quiz["question_text"];
    unset($quiz["qid"], $quiz["question_text"]);
    echo json_encode($quiz, JSON_UNESCAPED_UNICODE);
}

function createQuiz($pdo) {
    global $body;
    $title = cleanText($body["title"] ?? "", 160);
    $description = cleanText($body["description"] ?? "", 2000);
    $question = cleanText($body["question"] ?? "", 500);
    $answers = $body["answers"] ?? [];
    $cleanAnswers = [];
    foreach ($answers as $answer) {
        $text = cleanText($answer["text"] ?? "", 300);
        if ($text !== "") $cleanAnswers[] = ["text" => $text, "is_correct" => !empty($answer["is_correct"])];
    }
    if ($title === "" || $question === "" || count($cleanAnswers) < 2) jsonError(400, "invalid_payload", "Заполните название, вопрос и минимум два ответа");
    if (!array_filter($cleanAnswers, fn($a) => $a["is_correct"])) jsonError(400, "invalid_payload", "Отметьте правильный ответ");
    $userId = getSessionUser($pdo);
    $ownerKey = bin2hex(random_bytes(32));
    $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO quizzes (title, description, owner_user_id, owner_key_hash) VALUES (:t, :d, :uid, :okh) RETURNING id::text");
        $stmt->execute([":t" => $title, ":d" => $description, ":uid" => $userId, ":okh" => $ownerKeyHash]);
        $qid = $stmt->fetch()["id"];
        $stmt = $pdo->prepare("INSERT INTO quiz_questions (quiz_id, question_text, position) VALUES (:qid, :txt, 1) RETURNING id::text");
        $stmt->execute([":qid" => $qid, ":txt" => $question]);
        $questionId = $stmt->fetch()["id"];
        $stmt = $pdo->prepare("INSERT INTO quiz_answers (question_id, answer_text, is_correct, position) VALUES (:qid, :txt, :corr, :pos)");
        foreach ($cleanAnswers as $i => $ans) {
            $stmt->execute([":qid" => $questionId, ":txt" => $ans["text"], ":corr" => $ans["is_correct"] ? "true" : "false", ":pos" => $i + 1]);
        }
        $pdo->commit();
        echo json_encode(["id" => $qid, "owner_key" => $ownerKey], JSON_UNESCAPED_UNICODE);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError(500, "create_failed", "Не удалось создать викторину");
    }
}

function authMe($pdo) {
    $userId = getSessionUser($pdo);
    if (!$userId) {
        echo json_encode(["authenticated" => false]);
        return;
    }
    $stmt = $pdo->prepare("SELECT id, username, first_name FROM telegram_users WHERE id = :id");
    $stmt->execute([":id" => $userId]);
    echo json_encode(["authenticated" => true, "user" => $stmt->fetch()], JSON_UNESCAPED_UNICODE);
}

function telegramConfig() {
    $username = trim(getenv("TELEGRAM_BOT_USERNAME") ?: "");
    $token = trim(getenv("TELEGRAM_BOT_TOKEN") ?: "");
    echo json_encode([
        "enabled" => $username !== "" && $token !== "",
        "bot_username" => $username,
    ], JSON_UNESCAPED_UNICODE);
}

function telegramAuth($pdo) {
    global $body;
    $botToken = getenv("TELEGRAM_BOT_TOKEN") ?: "";
    if (!$botToken) jsonError(503, "not_configured", "Telegram не настроен");
    $hash = $body["hash"] ?? "";
    $authDate = (int)($body["auth_date"] ?? 0);
    if (!$hash || time() - $authDate > 86400) jsonError(400, "expired", "Данные устарели");
    $checkData = [];
    foreach ($body as $key => $value) {
        if ($key !== "hash") $checkData[] = "$key=$value";
    }
    sort($checkData);
    $secretKey = hash("sha256", $botToken, true);
    if (!hash_equals(hash_hmac("sha256", implode("\n", $checkData), $secretKey), $hash)) {
        jsonError(400, "invalid_hash", "Неверная подпись");
    }
    $userId = (int)($body["id"] ?? 0);
    if ($userId <= 0) jsonError(400, "invalid_user", "Неверный ID");
    $stmt = $pdo->prepare("INSERT INTO telegram_users (id, username, first_name, last_name, photo_url, auth_date, updated_at) VALUES (:id, :username, :first_name, :last_name, :photo_url, to_timestamp(:auth_date), NOW()) ON CONFLICT (id) DO UPDATE SET username=EXCLUDED.username, first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, photo_url=EXCLUDED.photo_url, auth_date=to_timestamp(:auth_date), updated_at=NOW()");
    $stmt->execute([":id" => $userId, ":username" => $body["username"] ?? "", ":first_name" => $body["first_name"] ?? "", ":last_name" => $body["last_name"] ?? "", ":photo_url" => $body["photo_url"] ?? "", ":auth_date" => $authDate]);
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash("sha256", "session-token:" . $token);
    $expiresAt = time() + (30 * 24 * 60 * 60);
    $stmt = $pdo->prepare("INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (:uid, :token, to_timestamp(:exp))");
    $stmt->execute([":uid" => $userId, ":token" => $tokenHash, ":exp" => $expiresAt]);
    $sig = hash_hmac("sha256", "session:" . $token, getenv("HASH_SECRET") ?: "dev-secret");
    setSecureCookie("votely_session", "$token.$sig", $expiresAt, true);
    echo json_encode(["success" => true, "user" => ["id" => $userId, "username" => $body["username"] ?? ""]], JSON_UNESCAPED_UNICODE);
}

function adminPasswordOk($password) {
    return false;
}

function adminCookieData() {
    return null;
}

function requireAdmin() {
    $data = adminCookieData();
    if (!$data) jsonError(401, "unauthorized", "Нужен вход администратора");
    return $data;
}

function requireAdminCsrf() {
    $data = requireAdmin();
    $csrf = $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "";
    if (!hash_equals($data["csrf"], $csrf)) jsonError(403, "csrf_failed", "Сессия устарела, обновите страницу");
    return $data;
}

function adminMe() {
    $data = adminCookieData();
    echo json_encode(["authenticated" => (bool)$data, "csrf" => $data["csrf"] ?? null], JSON_UNESCAPED_UNICODE);
}

function setSecureCookie($name, $value, $expires, $httpOnly) {
    setcookie($name, $value, [
        "expires" => $expires,
        "path" => "/",
        "secure" => (!empty($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off"),
        "httponly" => $httpOnly,
        "samesite" => "Strict"
    ]);
}

function adminSummary($pdo) {
    $summary = [];
    $summary["polls"] = (int)$pdo->query("SELECT COUNT(*) FROM polls")->fetchColumn();
    $summary["quizzes"] = (int)$pdo->query("SELECT COUNT(*) FROM quizzes")->fetchColumn();
    $summary["votes"] = (int)$pdo->query("SELECT COUNT(*) FROM poll_votes")->fetchColumn();
    $summary["users"] = (int)$pdo->query("SELECT COUNT(*) FROM telegram_users")->fetchColumn();
    echo json_encode($summary, JSON_UNESCAPED_UNICODE);
}

function adminItems($pdo) {
    $type = ($_GET["type"] ?? "polls") === "quizzes" ? "quizzes" : "polls";
    $table = $type === "quizzes" ? "quizzes" : "polls";
    $stmt = $pdo->query("SELECT id::text, title, description, created_at FROM $table ORDER BY created_at DESC LIMIT 100");
    echo json_encode(["items" => $stmt->fetchAll()], JSON_UNESCAPED_UNICODE);
}

function deleteItem($pdo, $type, $id) {
    if (!isUuid($id)) jsonError(400, "bad_id", "Неверный ID");
    $table = ($type === "polls") ? "polls" : "quizzes";
    $stmt = $pdo->prepare("DELETE FROM $table WHERE id = :id");
    $stmt->execute([":id" => $id]);
    echo json_encode(["success" => true], JSON_UNESCAPED_UNICODE);
}
