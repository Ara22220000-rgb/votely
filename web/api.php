<<<<<<< HEAD
﻿<?php
error_reporting(0);
ini_set('display_errors', 0);
=======
<?php
>>>>>>> 0a626c65f1b8fde26287197a9752a2aa76a2115a
header("Content-Type: application/json; charset=utf-8");

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
$body = json_decode(file_get_contents("php://input"), true);

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
    $stmt = $pdo->prepare("SELECT user_id FROM user_sessions WHERE token = :t AND expires_at > NOW()");
    $stmt->execute([":t" => $token]);
    $row = $stmt->fetch();
    return $row ? (int)$row["user_id"] : null;
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
}

function getPoll($pdo, $id) {
    $stmt = $pdo->prepare("SELECT id::text, title, description FROM polls WHERE id = :id");
    $stmt->execute([":id" => $id]);
    $poll = $stmt->fetch();
    if (!$poll) { http_response_code(404); echo json_encode(["message" => "Not found"]); return; }
    $stmt = $pdo->prepare("SELECT po.id::text, po.option_text as text, COUNT(pv.id)::int as votes FROM poll_options po LEFT JOIN poll_votes pv ON pv.option_id = po.id WHERE po.poll_id = :pid GROUP BY po.id, po.option_text, po.position ORDER BY po.position");
    $stmt->execute([":pid" => $id]);
    $poll["options"] = $stmt->fetchAll();
    echo json_encode($poll);
}

function votePoll($pdo, $pollId) {
    global $body, $ip;
    $oid = $body["option_id"] ?? null;
    if (!$oid) { http_response_code(400); echo json_encode(["message" => "Выберите вариант"]); return; }
    
    // Validate UUID format
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $oid)) {
        http_response_code(400);
        echo json_encode(["message" => "Неверный формат варианта"]);
        return;
    }
    
    // Rate limit per IP for voting
    $voteRateFile = sys_get_temp_dir() . "/votely_vote_" . md5($ip . $pollId);
    if (file_exists($voteRateFile)) {
        $lastVote = (int)file_get_contents($voteRateFile);
        if (time() - $lastVote < 60) {
            http_response_code(429);
            echo json_encode(["message" => "Подождите перед повторным голосованием"]);
            return;
        }
    }
    file_put_contents($voteRateFile, time());
    
    // Get device fingerprint
    $userAgent = substr($_SERVER["HTTP_USER_AGENT"] ?? "", 0, 255);
    $acceptLang = substr($_SERVER["HTTP_ACCEPT_LANGUAGE"] ?? "en", 0, 20);
    $deviceHash = hash("sha256", $userAgent . $acceptLang . $ip);
    $utmSource = substr($_GET["utm_source"] ?? "", 0, 100);
    $ipCountry = substr($_SERVER["HTTP_CF_IPCOUNTRY"] ?? "", 0, 2);
    
    // Check if already voted from this device
    $stmt = $pdo->prepare("SELECT id FROM poll_votes WHERE poll_id = :pid AND device_hash = :dh LIMIT 1");
    $stmt->execute([":pid" => $pollId, ":dh" => $deviceHash]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(["message" => "Вы уже голосовали"]);
        return;
    }
    
    $stmt = $pdo->prepare("INSERT INTO poll_votes (poll_id, option_id, device_hash, ip_address, user_agent, utm_source, ip_country) VALUES (:pid, :oid, :dh, :ip, :ua, :utm, :ct)");
    $stmt->execute([":pid" => $pollId, ":oid" => $oid, ":dh" => $deviceHash, ":ip" => $ip, ":ua" => $userAgent, ":utm" => $utmSource, ":ct" => $ipCountry]);
    getPoll($pdo, $pollId);
}

function createPoll($pdo) {
    global $body;
<<<<<<< HEAD
    if (empty($body['title'])) {
        http_response_code(400);
        echo json_encode(['message' => 'Title required']);
        return;
    }
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO polls (title, description) VALUES (:t, :d) RETURNING id::text");
        $stmt->execute([":t" => $body["title"], ":d" => $body["description"] ?? ""]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $id = $row['id'];

        if (!empty($body['options'])) {
=======
    $userId = getSessionUser($pdo);
    if (!$userId) {
        http_response_code(401);
        echo json_encode(["code" => "unauthorized", "message" => "Требуется авторизация"]);
        return;
    }
    $ownerKey = bin2hex(random_bytes(32));
    $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO polls (title, description, owner_user_id, owner_key_hash) VALUES (:t, :d, :uid, :okh) RETURNING id");
        $stmt->execute([":t" => $body["title"], ":d" => $body["description"] ?? "", ":uid" => $userId, ":okh" => $ownerKeyHash]);
        $id = $stmt->fetch()["id"];
        if (!empty($body["options"])) {
>>>>>>> 0a626c65f1b8fde26287197a9752a2aa76a2115a
            $stmt = $pdo->prepare("INSERT INTO poll_options (poll_id, option_text, position) VALUES (:pid, :txt, :pos)");
            foreach ($body['options'] as $i => $opt) {
                $stmt->execute([":pid" => $id, ":txt" => $opt, ":pos" => $i + 1]);
            }
        }
        $pdo->commit();
<<<<<<< HEAD
        echo json_encode(["id" => $id]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["message" => $e->getMessage()]);
    }
=======
        echo json_encode(["id" => $id, "owner_key" => $ownerKey]);
    } catch (Exception $e) { $pdo->rollBack(); http_response_code(500); }
>>>>>>> 0a626c65f1b8fde26287197a9752a2aa76a2115a
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
}

function getQuiz($pdo, $id) {
    $stmt = $pdo->prepare("SELECT q.id::text, q.title, q.description, qq.id as qid, qq.question_text FROM quizzes q JOIN quiz_questions qq ON qq.quiz_id = q.id WHERE q.id = :id LIMIT 1");
    $stmt->execute([":id" => $id]);
    $quiz = $stmt->fetch();
    if (!$quiz) { http_response_code(404); return; }
    $stmt = $pdo->prepare("SELECT answer_text as text, is_correct::bool FROM quiz_answers WHERE question_id = :qid ORDER BY position");
    $stmt->execute([":qid" => $quiz["qid"]]);
    $quiz["answers"] = $stmt->fetchAll();
    $quiz["question"] = $quiz["question_text"];
    unset($quiz["qid"], $quiz["question_text"]);
    echo json_encode($quiz);
}

function createQuiz($pdo) {
    global $body;
<<<<<<< HEAD
    if (empty($body['title']) || empty($body['question'])) {
        http_response_code(400);
        echo json_encode(['message' => 'Fields required']);
        return;
    }
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO quizzes (title, description) VALUES (:t, :d) RETURNING id::text");
        $stmt->execute([":t" => $body["title"], ":d" => $body["description"] ?? ""]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $qid = $row['id'];

        $stmt = $pdo->prepare("INSERT INTO quiz_questions (quiz_id, question_text, position) VALUES (:qid, :txt, 1) RETURNING id::text");
=======
    $userId = getSessionUser($pdo);
    if (!$userId) {
        http_response_code(401);
        echo json_encode(["code" => "unauthorized", "message" => "Требуется авторизация"]);
        return;
    }
    $ownerKey = bin2hex(random_bytes(32));
    $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO quizzes (title, description, owner_user_id, owner_key_hash) VALUES (:t, :d, :uid, :okh) RETURNING id");
        $stmt->execute([":t" => $body["title"], ":d" => $body["description"] ?? "", ":uid" => $userId, ":okh" => $ownerKeyHash]);
        $qid = $stmt->fetch()["id"];
        $stmt = $pdo->prepare("INSERT INTO quiz_questions (quiz_id, question_text, position) VALUES (:qid, :txt, 1) RETURNING id");
>>>>>>> 0a626c65f1b8fde26287197a9752a2aa76a2115a
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
<<<<<<< HEAD
        echo json_encode(["id" => $qid]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["message" => $e->getMessage()]);
    }
=======
        echo json_encode(["id" => $qid, "owner_key" => $ownerKey]);
    } catch (Exception $e) { $pdo->rollBack(); http_response_code(500); }
>>>>>>> 0a626c65f1b8fde26287197a9752a2aa76a2115a
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
    if (!$ownerKey) { http_response_code(403); echo json_encode(["message" => "Forbidden"]); return; }
    $ownerKeyHash = hash("sha256", "owner:" . $ownerKey);
    $stmt = $pdo->prepare("SELECT 1 FROM polls WHERE id = :pid AND owner_key_hash = :okh LIMIT 1");
    $stmt->execute([":pid" => $pollId, ":okh" => $ownerKeyHash]);
    if (!$stmt->fetch()) { http_response_code(403); echo json_encode(["message" => "Forbidden"]); return; }
    
    $stmt = $pdo->prepare("SELECT id::text, title, description, is_anonymous, shuffle_options, allowed_countries FROM polls WHERE id = :id");
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
    
    // Analytics
    $analytics = [];
    
    // Countries
    $stmt = $pdo->prepare("SELECT ip_country as name, COUNT(*) as count FROM poll_votes pv WHERE pv.poll_id = :pid AND ip_country IS NOT NULL AND ip_country != '' GROUP BY ip_country ORDER BY count DESC LIMIT 10");
    $stmt->execute([":pid" => $pollId]);
    $countries = $stmt->fetchAll();
    if ($countries) $analytics['countries'] = $countries;
    
    // Devices (simplified - mobile vs desktop based on user agent)
    $stmt = $pdo->prepare("SELECT CASE WHEN user_agent LIKE '%Mobile%' OR user_agent LIKE '%Android%' OR user_agent LIKE '%iPhone%' THEN 'Mobile' ELSE 'Desktop' END as name, COUNT(*) as count FROM poll_votes pv WHERE pv.poll_id = :pid GROUP BY name ORDER BY count DESC");
    $stmt->execute([":pid" => $pollId]);
    $devices = $stmt->fetchAll();
    if ($devices) $analytics['devices'] = $devices;
    
    // Browsers (simplified)
    $stmt = $pdo->prepare("SELECT CASE WHEN user_agent LIKE '%Chrome%' THEN 'Chrome' WHEN user_agent LIKE '%Firefox%' THEN 'Firefox' WHEN user_agent LIKE '%Safari%' THEN 'Safari' WHEN user_agent LIKE '%Edge%' THEN 'Edge' ELSE 'Other' END as name, COUNT(*) as count FROM poll_votes pv WHERE pv.poll_id = :pid GROUP BY name ORDER BY count DESC LIMIT 5");
    $stmt->execute([":pid" => $pollId]);
    $browsers = $stmt->fetchAll();
    if ($browsers) $analytics['browsers'] = $browsers;
    
    // Sources (UTM)
    $stmt = $pdo->prepare("SELECT COALESCE(NULLIF(utm_source, ''), 'direct') as name, COUNT(*) as count FROM poll_votes pv WHERE pv.poll_id = :pid GROUP BY name ORDER BY count DESC LIMIT 5");
    $stmt->execute([":pid" => $pollId]);
    $sources = $stmt->fetchAll();
    if ($sources) $analytics['sources'] = $sources;
    
    echo json_encode([
        "poll" => $poll,
        "options" => $optionsWithPercent,
        "total_votes" => $totalVotes,
        "analytics" => $analytics
    ]);
}

function authMe($pdo) {
    $userId = getSessionUser($pdo);
    if (!$userId) {
        echo json_encode(["authenticated" => false]);
        return;
    }
    $stmt = $pdo->prepare("SELECT id, username, first_name FROM telegram_users WHERE id = :id");
    $stmt->execute([":id" => $userId]);
    $user = $stmt->fetch();
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
    
    // Save/update user
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
    
    // Create session
    $token = bin2hex(random_bytes(32));
    $expiresAt = time() + (30 * 24 * 60 * 60); // 30 days
    $stmt = $pdo->prepare("INSERT INTO user_sessions (user_id, token, expires_at) VALUES (:uid, :token, to_timestamp(:exp))");
    $stmt->execute([":uid" => $userId, ":token" => $token, ":exp" => $expiresAt]);
    
    // Set cookie
    $sig = hash_hmac("sha256", "session:" . $token, getenv("HASH_SECRET") ?: "dev-secret");
    setcookie("votely_session", "$token.$sig", $expiresAt, "/", "", false, true);
    
    echo json_encode(["success" => true, "user" => ["id" => $userId, "username" => $body["username"] ?? ""]]);
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
?>