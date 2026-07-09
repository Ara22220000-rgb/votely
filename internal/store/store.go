package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrDuplicateVote        = errors.New("duplicate vote")
	ErrPollClosed           = errors.New("poll closed")
	ErrCountryNotAllowed    = errors.New("country not allowed")
	ErrFreePlanVoteLimit    = errors.New("free plan vote limit")
	ErrFreePlanLinksLimit   = errors.New("free plan links limit")
	ErrFreePlanContentLimit = errors.New("free plan content limit")
)

const (
	freePlanMonthlyVotesLimit   = 100
	freePlanShareLinksLimit     = 5
	freePlanMonthlyContentLimit = 10
)

type (
	VoteIdentity struct {
		TelegramUserID int64
		VoterTokenHash string
		IPHash         string
		DeviceHash     string
		Country        string
	}

	TrafficEvent struct {
		EventType      string
		Path           string
		Method         string
		PollID         string
		OptionID       string
		VoterTokenHash string
		IPHash         string
		DeviceHash     string
		UserAgent      string
		Referrer       string
		LandingURL     string
		UTMSource      string
		UTMMedium      string
		UTMCampaign    string
		UTMTerm        string
		UTMContent     string
		ShareLinkID    string
		IPCountry      string
		IPRegion       string
		IPCity         string
		IPGeoSource    string
		AcceptLanguage string
	}

	VoteAttribution struct {
		OptionID    string
		OptionText  string
		Country     string
		GeoSource   string
		UTMSource   string
		UTMCampaign string
		UserAgent   string
		CreatedAt   string
	}

	OptionStats struct {
		ID      string `json:"id"`
		Text    string `json:"text"`
		Votes   int    `json:"votes"`
		Percent int    `json:"percent"`
	}

	AnalyticsItem struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	}

	ShareLinkStats struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		Slug      string `json:"slug"`
		URL       string `json:"url,omitempty"`
		Visits    int    `json:"visits"`
		Votes     int    `json:"votes"`
		CreatedAt string `json:"created_at"`
	}

	PollAnalytics struct {
		Browsers  []AnalyticsItem  `json:"browsers,omitempty"`
		OS        []AnalyticsItem  `json:"os,omitempty"`
		Devices   []AnalyticsItem  `json:"devices,omitempty"`
		Locations []AnalyticsItem  `json:"locations,omitempty"`
		Sources   []AnalyticsItem  `json:"sources,omitempty"`
		Links     []ShareLinkStats `json:"links,omitempty"`
	}

	PollStats struct {
		Poll       PollDetail        `json:"poll"`
		Options    []OptionStats     `json:"options"`
		TotalVotes int               `json:"total_votes"`
		Voters     []VoteAttribution `json:"voters"`
		Analytics  PollAnalytics     `json:"analytics"`
	}

	TelegramUser struct {
		ID        int64     `json:"id"`
		FirstName string    `json:"first_name"`
		LastName  string    `json:"last_name"`
		Username  string    `json:"username"`
		PhotoURL  string    `json:"photo_url"`
		AuthDate  time.Time `json:"auth_date"`
	}
)

type Store struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

type PollInput struct {
	Title            string
	Description      string
	Options          []string
	OwnerUserID      int64
	OwnerTelegramID  int64
	OwnerKeyHash     string
	IsAnonymous      bool
	ShuffleOptions   bool
	AllowMultiple    bool
	AllowedCountries []string
	EndsAt           *time.Time
	Visibility       string
}

type QuizInput struct {
	Title            string
	Description      string
	Questions        []QuizQuestionInput
	OwnerUserID      int64
	OwnerKeyHash     string
	AllowedCountries []string
	EndsAt           *time.Time
	Visibility       string
	AllowMultiple    bool
}

type QuizQuestionInput struct {
	Text    string
	Answers []QuizAnswerInput
}

type QuizAnswerInput struct {
	Text      string
	IsCorrect bool
}

type CreatedEntity struct {
	ID       string `json:"id"`
	OwnerKey string `json:"owner_key,omitempty"`
}

type ListItem struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
	TotalVotes  int    `json:"total_votes,omitempty"`
	IsOwner     bool   `json:"is_owner,omitempty"`
}


type PollDetail struct {
	ID               string       `json:"id"`
	Title            string       `json:"title"`
	Description      string       `json:"description"`
	Options          []OptionItem `json:"options"`
	SelectedOptionID string       `json:"selected_option_id,omitempty"`
	SelectedOptionIDs []string    `json:"selected_option_ids,omitempty"`
	IsOwner          bool         `json:"is_owner"`
	IsAnonymous      bool         `json:"is_anonymous"`
	ShuffleOptions   bool         `json:"shuffle_options"`
	AllowMultiple    bool         `json:"allow_multiple"`
	AllowedCountries []string     `json:"allowed_countries"`
	EndsAt           string       `json:"ends_at,omitempty"`
	ClosedAt         string       `json:"closed_at,omitempty"`
	IsClosed         bool         `json:"is_closed"`
	Visibility       string       `json:"visibility"`
}

type QuizDetail struct {
	ID               string       `json:"id"`
	Title            string       `json:"title"`
	Description      string       `json:"description"`
	Question         string       `json:"question"`
	Answers          []AnswerItem `json:"answers"`
	SelectedAnswerID string       `json:"selected_answer_id,omitempty"`
	IsOwner          bool         `json:"is_owner"`
	Visibility       string       `json:"visibility"`
	AllowMultiple    bool         `json:"allow_multiple"`
}

type OptionItem struct {
	ID    string `json:"id"`
	Text  string `json:"text"`
	Votes int    `json:"votes"`
}

type AnswerItem struct {
	ID        string `json:"id"`
	Text      string `json:"text"`
	IsCorrect bool   `json:"is_correct,omitempty"`
	Attempts  int    `json:"attempts,omitempty"`
	Percent   int    `json:"percent,omitempty"`
}

type VoteResult struct {
	Options           []OptionItem `json:"options"`
	SelectedOptionID  string       `json:"selected_option_id,omitempty"`
	SelectedOptionIDs []string     `json:"selected_option_ids,omitempty"`
}

type QuizSubmitResult struct {
	Answers          []AnswerItem `json:"answers"`
	SelectedAnswerID string       `json:"selected_answer_id"`
	IsCorrect        bool         `json:"is_correct"`
	TotalAttempts    int          `json:"total_attempts"`
}

type QuizStats struct {
	Quiz          QuizDetail    `json:"quiz"`
	Answers       []OptionStats `json:"answers"`
	TotalAttempts int           `json:"total_attempts"`
	Analytics     PollAnalytics `json:"analytics"`
}

type SQLResult struct {
	Columns      []string `json:"columns"`
	Rows         [][]any  `json:"rows"`
	AffectedRows int64    `json:"affected_rows"`
}

type AdminSummary struct {
	Polls   int `json:"polls"`
	Quizzes int `json:"quizzes"`
	Votes   int `json:"votes"`
	Users   int `json:"users"`
}

type ShareLinkInput struct {
	PollID string
	QuizID string
	Name   string
	Slug   string
}

func (s *Store) ExecuteSQL(ctx context.Context, query string) (*SQLResult, error) {
	upper := strings.ToUpper(strings.TrimSpace(query))
	isSelect := strings.HasPrefix(upper, "SELECT") || strings.HasPrefix(upper, "WITH") || strings.HasPrefix(upper, "EXPLAIN")

	if isSelect {
		rows, err := s.db.Query(ctx, query)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		cols := make([]string, len(rows.FieldDescriptions()))
		for i, f := range rows.FieldDescriptions() {
			cols[i] = f.Name
		}

		var resultRows [][]any
		for rows.Next() {
			values := make([]any, len(cols))
			valPointers := make([]any, len(cols))
			for i := range values {
				valPointers[i] = &values[i]
			}
			if err := rows.Scan(valPointers...); err != nil {
				return nil, err
			}
			resultRows = append(resultRows, values)
		}
		if err := rows.Err(); err != nil {
			return nil, err
		}
		return &SQLResult{Columns: cols, Rows: resultRows}, nil
	}

	res, err := s.db.Exec(ctx, query)
	if err != nil {
		return nil, err
	}
	return &SQLResult{AffectedRows: res.RowsAffected()}, nil
}

func (s *Store) CreatePoll(ctx context.Context, input PollInput) (CreatedEntity, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return CreatedEntity{}, err
	}
	defer rollback(ctx, tx)

	if input.OwnerUserID != 0 {
		var monthlyContentCount int
		if err := tx.QueryRow(ctx, `
			SELECT (
				SELECT count(*)::int
				FROM polls p
				WHERE COALESCE(p.owner_telegram_id, p.owner_user_id) = $1
					AND p.created_at >= date_trunc('month', now())
					AND p.created_at < date_trunc('month', now()) + interval '1 month'
			) + (
				SELECT count(*)::int
				FROM quizzes q
				WHERE q.owner_user_id = $1
					AND q.created_at >= date_trunc('month', now())
					AND q.created_at < date_trunc('month', now()) + interval '1 month'
			)`, input.OwnerUserID).Scan(&monthlyContentCount); err != nil {

			return CreatedEntity{}, err
		}
		if monthlyContentCount >= freePlanMonthlyContentLimit {
			return CreatedEntity{}, ErrFreePlanContentLimit
		}
	}

	var id string
	if err := tx.QueryRow(ctx,

	`INSERT INTO polls (title, description, owner_user_id, owner_telegram_id, owner_key_hash, is_anonymous, shuffle_options, allow_multiple, allowed_countries, ends_at, visibility)
		VALUES ($1, $2, nullif($3::bigint, 0), nullif($4::bigint, 0), $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
		strings.TrimSpace(input.Title),
		strings.TrimSpace(input.Description),
		input.OwnerUserID,
		input.OwnerTelegramID,
		input.OwnerKeyHash,
		input.IsAnonymous,
		input.ShuffleOptions,
		input.AllowMultiple,
		input.AllowedCountries,
		input.EndsAt,
		input.Visibility,
	).Scan(&id); err != nil {
		return CreatedEntity{}, err
	}

	for index, option := range input.Options {
		if _, err := tx.Exec(ctx,
			`INSERT INTO poll_options (poll_id, option_text, position) VALUES ($1, $2, $3)`,
			id,
			strings.TrimSpace(option),
			index+1,
		); err != nil {
			return CreatedEntity{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return CreatedEntity{}, err
	}
	return CreatedEntity{ID: id}, nil
}

func (s *Store) CreateQuiz(ctx context.Context, input QuizInput) (CreatedEntity, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return CreatedEntity{}, err
	}
	defer rollback(ctx, tx)

	if input.OwnerUserID != 0 {
		var monthlyContentCount int
		if err := tx.QueryRow(ctx, `
			SELECT (
				SELECT count(*)::int
				FROM polls p
				WHERE COALESCE(p.owner_telegram_id, p.owner_user_id) = $1
					AND p.created_at >= date_trunc('month', now())
					AND p.created_at < date_trunc('month', now()) + interval '1 month'
			) + (
				SELECT count(*)::int
				FROM quizzes q
				WHERE q.owner_user_id = $1
					AND q.created_at >= date_trunc('month', now())
					AND q.created_at < date_trunc('month', now()) + interval '1 month'
			)`, input.OwnerUserID).Scan(&monthlyContentCount); err != nil {
			return CreatedEntity{}, err
		}
		if monthlyContentCount >= freePlanMonthlyContentLimit {
			return CreatedEntity{}, ErrFreePlanContentLimit
		}
	}

	var quizID string
	if err := tx.QueryRow(ctx,

		`INSERT INTO quizzes (title, description, owner_user_id, owner_key_hash, allowed_countries, ends_at, visibility, allow_multiple)
		VALUES ($1, $2, nullif($3::bigint, 0), nullif($4, ''), $5, $6, $7, $8) RETURNING id`,
		strings.TrimSpace(input.Title),
		strings.TrimSpace(input.Description),
		input.OwnerUserID,
		input.OwnerKeyHash,
		input.AllowedCountries,
		input.EndsAt,
		input.Visibility,
		input.AllowMultiple,
	).Scan(&quizID); err != nil {
		return CreatedEntity{}, err
	}

	for questionIndex, question := range input.Questions {
		var questionID string
		if err := tx.QueryRow(ctx,
			`INSERT INTO quiz_questions (quiz_id, question_text, position) VALUES ($1, $2, $3) RETURNING id`,
			quizID,
			strings.TrimSpace(question.Text),
			questionIndex+1,
		).Scan(&questionID); err != nil {
			return CreatedEntity{}, err
		}

		for answerIndex, answer := range question.Answers {
			if _, err := tx.Exec(ctx,
				`INSERT INTO quiz_answers (question_id, answer_text, is_correct, position) VALUES ($1, $2, $3, $4)`,
				questionID,
				strings.TrimSpace(answer.Text),
				answer.IsCorrect,
				answerIndex+1,
			); err != nil {
				return CreatedEntity{}, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return CreatedEntity{}, err
	}
	return CreatedEntity{ID: quizID}, nil
}

func (s *Store) ListPolls(ctx context.Context, query string, userID int64) ([]ListItem, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		rows, err := s.db.Query(ctx, `
			SELECT p.id::text, p.title, p.description, p.created_at::text,
				(COALESCE(p.owner_user_id, p.owner_telegram_id) = $1) AS is_owner,
				COALESCE(v.cnt, 0)::int AS total_votes
			FROM polls p
			LEFT JOIN LATERAL (
				SELECT count(*) AS cnt FROM poll_votes WHERE poll_id = p.id
			) v ON true
			WHERE p.visibility = 'public'
			ORDER BY p.created_at DESC
			LIMIT 100`, userID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		return scanList(rows)
	}

	pattern := "%" + escapeLike(query) + "%"
	rows, err := s.db.Query(ctx, `
		SELECT p.id::text, p.title, p.description, p.created_at::text,
			(COALESCE(p.owner_user_id, p.owner_telegram_id) = $2) AS is_owner,
			COALESCE(v.cnt, 0)::int AS total_votes
		FROM polls p
		LEFT JOIN LATERAL (
			SELECT count(*) AS cnt FROM poll_votes WHERE poll_id = p.id
		) v ON true
		WHERE p.visibility = 'public' AND (p.title ILIKE $1 ESCAPE '\' OR p.description ILIKE $1 ESCAPE '\')
		ORDER BY p.created_at DESC
		LIMIT 100`, pattern, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanList(rows)
}



func escapeLike(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return replacer.Replace(value)
}

func (s *Store) ListQuizzes(ctx context.Context, query string, userID int64) ([]ListItem, error) {
	query = strings.TrimSpace(query)
	visibilityFilter := ""
	visibilityExists, err := s.quizVisibilityColumnExists(ctx)
	if err != nil {
		return nil, err
	}
	if visibilityExists {
		visibilityFilter = "WHERE q.visibility = 'public'"
	}

	if query == "" {
		rows, err := s.db.Query(ctx, `
			SELECT q.id::text, q.title, q.description, q.created_at::text,
				(q.owner_user_id = $1) AS is_owner,
				COALESCE(v.cnt, 0)::int AS total_votes
			FROM quizzes q
			LEFT JOIN LATERAL (
				SELECT count(*) AS cnt FROM quiz_attempts WHERE quiz_id = q.id
			) v ON true
			`+visibilityFilter+`
			ORDER BY q.created_at DESC
			LIMIT 100`, userID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		return scanList(rows)
	}

	pattern := "%" + escapeLike(query) + "%"
	where := "WHERE (q.title ILIKE $1 ESCAPE '\\' OR q.description ILIKE $1 ESCAPE '\\')"
	if visibilityFilter != "" {
		where = "WHERE q.visibility = 'public' AND (q.title ILIKE $1 ESCAPE '\\' OR q.description ILIKE $1 ESCAPE '\\')"
	}
	rows, err := s.db.Query(ctx, `
		SELECT q.id::text, q.title, q.description, q.created_at::text,
			(q.owner_user_id = $2) AS is_owner,
			COALESCE(v.cnt, 0)::int AS total_votes
		FROM quizzes q
		LEFT JOIN LATERAL (
			SELECT count(*) AS cnt FROM quiz_attempts WHERE quiz_id = q.id
		) v ON true
		`+where+`
		ORDER BY q.created_at DESC
		LIMIT 100`, pattern, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanList(rows)
}



func (s *Store) quizVisibilityColumnExists(ctx context.Context) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = current_schema()
				AND table_name = 'quizzes'
				AND column_name = 'visibility'
		)`).Scan(&exists)
	return exists, err
}


func (s *Store) ListUserPolls(ctx context.Context, userID int64, query string) ([]ListItem, error) {
	query = strings.TrimSpace(query)
	var rows pgx.Rows
	var err error
	if query == "" {
		rows, err = s.db.Query(ctx, `
			SELECT p.id::text, p.title, p.description, p.created_at::text, count(pv.id)::int
			FROM polls p
			LEFT JOIN poll_votes pv ON pv.poll_id = p.id
			WHERE p.owner_user_id = $1 OR p.owner_telegram_id = $1
			GROUP BY p.id, p.title, p.description, p.created_at
			ORDER BY p.created_at DESC
			LIMIT 100`, userID)
	} else {
		pattern := "%" + escapeLike(query) + "%"
		rows, err = s.db.Query(ctx, `
			SELECT p.id::text, p.title, p.description, p.created_at::text, count(pv.id)::int
			FROM polls p
			LEFT JOIN poll_votes pv ON pv.poll_id = p.id
			WHERE (p.owner_user_id = $1 OR p.owner_telegram_id = $1)
				AND (p.title ILIKE $2 ESCAPE '\' OR p.description ILIKE $2 ESCAPE '\')
			GROUP BY p.id, p.title, p.description, p.created_at
			ORDER BY p.created_at DESC
			LIMIT 100`, userID, pattern)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanList(rows)
}

func (s *Store) ListUserQuizzes(ctx context.Context, userID int64, query string) ([]ListItem, error) {
	query = strings.TrimSpace(query)
	var rows pgx.Rows
	var err error
	if query == "" {
		rows, err = s.db.Query(ctx, `
			SELECT q.id::text, q.title, q.description, q.created_at::text, count(qat.id)::int
			FROM quizzes q
			JOIN quiz_questions qq ON qq.quiz_id = q.id
			JOIN quiz_answers qa ON qa.question_id = qq.id
			LEFT JOIN quiz_attempts qat ON qat.answer_id = qa.id
			WHERE q.owner_user_id = $1
			GROUP BY q.id, q.title, q.description, q.created_at
			ORDER BY q.created_at DESC
			LIMIT 100`, userID)
	} else {
		pattern := "%" + escapeLike(query) + "%"
		rows, err = s.db.Query(ctx, `
			SELECT q.id::text, q.title, q.description, q.created_at::text, count(qat.id)::int
			FROM quizzes q
			JOIN quiz_questions qq ON qq.quiz_id = q.id
			JOIN quiz_answers qa ON qa.question_id = qq.id
			LEFT JOIN quiz_attempts qat ON qat.answer_id = qa.id
			WHERE (q.owner_user_id = $1)
				AND (q.title ILIKE $2 ESCAPE '\' OR q.description ILIKE $2 ESCAPE '\')
			GROUP BY q.id, q.title, q.description, q.created_at
			ORDER BY q.created_at DESC
			LIMIT 100`, userID, pattern)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanList(rows)
}

func (s *Store) GetPoll(ctx context.Context, id string, userID int64, ownerKeyHash string, isAdmin bool) (PollDetail, error) {
	var poll PollDetail
	var endsAt sql.NullString
	var closedAt sql.NullString
	if err := s.db.QueryRow(ctx, `
		SELECT id::text, title, description, is_anonymous, shuffle_options, allow_multiple, allowed_countries, ends_at::text, closed_at::text, visibility,
			(closed_at IS NOT NULL OR (ends_at IS NOT NULL AND ends_at <= now())),
			COALESCE(owner_key_hash = nullif($2, ''), false) OR ($3::bigint <> 0 AND (owner_user_id = $3 OR owner_telegram_id = $3)) OR $4::boolean
		FROM polls WHERE id = $1`,
		id, ownerKeyHash, userID, isAdmin,
	).Scan(&poll.ID, &poll.Title, &poll.Description, &poll.IsAnonymous, &poll.ShuffleOptions, &poll.AllowMultiple, &poll.AllowedCountries, &endsAt, &closedAt, &poll.Visibility, &poll.IsClosed, &poll.IsOwner); err != nil {
		return PollDetail{}, err
	}
	if endsAt.Valid {
		poll.EndsAt = endsAt.String
	}
	if closedAt.Valid {
		poll.ClosedAt = closedAt.String
	}
	orderSQL := "po.position"
	if poll.ShuffleOptions {
		orderSQL = "random()"
	}
	rows, err := s.db.Query(ctx, `
		SELECT po.id::text, po.option_text, count(pv.id)::int
		FROM poll_options po
		LEFT JOIN poll_votes pv ON pv.option_id = po.id
		WHERE po.poll_id = $1
		GROUP BY po.id, po.option_text, po.position
		ORDER BY `+orderSQL, id)
	if err != nil {
		return PollDetail{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var option OptionItem
		if err := rows.Scan(&option.ID, &option.Text, &option.Votes); err != nil {
			return PollDetail{}, err
		}
		poll.Options = append(poll.Options, option)
	}
	if err := rows.Err(); err != nil {
		return PollDetail{}, err
	}
	if userID != 0 {
		if poll.AllowMultiple {
			// Для множественного выбора получаем все выбранные варианты
			optionRows, err := s.db.Query(ctx, `
				SELECT option_id::text
				FROM poll_votes
				WHERE poll_id = $1 AND telegram_user_id = $2`, id, userID)
			if err == nil {
				defer optionRows.Close()
				for optionRows.Next() {
					var optID string
					if err := optionRows.Scan(&optID); err == nil {
						poll.SelectedOptionIDs = append(poll.SelectedOptionIDs, optID)
					}
				}
			}
		} else {
			_ = s.db.QueryRow(ctx, `
				SELECT option_id::text
				FROM poll_votes
				WHERE poll_id = $1 AND telegram_user_id = $2
				LIMIT 1`, id, userID).Scan(&poll.SelectedOptionID)
		}
	}
	return poll, nil
}

func (s *Store) VotePoll(ctx context.Context, pollID string, optionIDs []string, identity VoteIdentity) (VoteResult, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return VoteResult{}, err
	}
	defer rollback(ctx, tx)

	// Проверяем, что опрос существует и не закрыт
	var isClosed bool
	var allowMultiple bool
	var allowedCountries []string
	var ownerID sql.NullInt64
	if err := tx.QueryRow(ctx, `
		SELECT (p.closed_at IS NOT NULL OR (p.ends_at IS NOT NULL AND p.ends_at <= now())),
			p.allow_multiple, p.allowed_countries, COALESCE(p.owner_telegram_id, p.owner_user_id)
		FROM polls p
		WHERE p.id = $1`,
		pollID,
	).Scan(&isClosed, &allowMultiple, &allowedCountries, &ownerID); err != nil {
		return VoteResult{}, err
	}

	if isClosed {
		return VoteResult{}, ErrPollClosed
	}
	if len(allowedCountries) > 0 && !countryAllowed(identity.Country, allowedCountries) {
		return VoteResult{}, ErrCountryNotAllowed
	}
	if ownerID.Valid {
		var monthlyVotesCount int
		if err := tx.QueryRow(ctx, `
			SELECT count(*)::int
			FROM poll_votes pv
			JOIN polls p ON p.id = pv.poll_id
			WHERE COALESCE(p.owner_telegram_id, p.owner_user_id) = $1
				AND pv.created_at >= date_trunc('month', now())
				AND pv.created_at < date_trunc('month', now()) + interval '1 month'`, ownerID.Int64).Scan(&monthlyVotesCount); err != nil {
			return VoteResult{}, err
		}
		if monthlyVotesCount >= freePlanMonthlyVotesLimit {
			return VoteResult{}, ErrFreePlanVoteLimit
		}
	}

	// Проверяем, что все варианты существуют
	for _, optionID := range optionIDs {
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM poll_options WHERE poll_id = $1 AND id = $2)`, pollID, optionID).Scan(&exists); err != nil {
			return VoteResult{}, err
		}
		if !exists {
			return VoteResult{}, pgx.ErrNoRows
		}
	}

	// Проверяем, не голосовал ли пользователь уже (любой голос в этом опросе)
	var alreadyVoted bool
	if identity.TelegramUserID != 0 {
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM poll_votes WHERE poll_id = $1 AND telegram_user_id = $2)`, pollID, identity.TelegramUserID).Scan(&alreadyVoted); err != nil {
			return VoteResult{}, err
		}
	} else if identity.VoterTokenHash != "" {
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM poll_votes WHERE poll_id = $1 AND voter_token_hash = $2)`, pollID, identity.VoterTokenHash).Scan(&alreadyVoted); err != nil {
			return VoteResult{}, err
		}
	} else if identity.IPHash != "" {
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM poll_votes WHERE poll_id = $1 AND ip_hash = $2)`, pollID, identity.IPHash).Scan(&alreadyVoted); err != nil {
			return VoteResult{}, err
		}
	} else if identity.DeviceHash != "" {
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM poll_votes WHERE poll_id = $1 AND device_hash = $2)`, pollID, identity.DeviceHash).Scan(&alreadyVoted); err != nil {
			return VoteResult{}, err
		}
	}
	if alreadyVoted {
		return VoteResult{}, ErrDuplicateVote
	}

	// Вставляем голоса для всех выбранных вариантов
	for _, optionID := range optionIDs {
		if identity.TelegramUserID != 0 {
			if _, err := tx.Exec(ctx, `
				INSERT INTO poll_votes (poll_id, option_id, telegram_user_id)
				VALUES ($1, $2, $3)`,
				pollID, optionID, identity.TelegramUserID,
			); err != nil {
				return VoteResult{}, err
			}
		} else if identity.VoterTokenHash != "" {
			if _, err := tx.Exec(ctx, `
				INSERT INTO poll_votes (poll_id, option_id, voter_token_hash)
				VALUES ($1, $2, $3)`,
				pollID, optionID, identity.VoterTokenHash,
			); err != nil {
				return VoteResult{}, err
			}
		} else if identity.IPHash != "" {
			if _, err := tx.Exec(ctx, `
				INSERT INTO poll_votes (poll_id, option_id, ip_hash)
				VALUES ($1, $2, $3)`,
				pollID, optionID, identity.IPHash,
			); err != nil {
				return VoteResult{}, err
			}
		} else if identity.DeviceHash != "" {
			if _, err := tx.Exec(ctx, `
				INSERT INTO poll_votes (poll_id, option_id, device_hash)
				VALUES ($1, $2, $3)`,
				pollID, optionID, identity.DeviceHash,
			); err != nil {
				return VoteResult{}, err
			}
		} else {
			if _, err := tx.Exec(ctx, `
				INSERT INTO poll_votes (poll_id, option_id)
				VALUES ($1, $2)`,
				pollID, optionID,
			); err != nil {
				return VoteResult{}, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return VoteResult{}, err
	}

	poll, err := s.GetPoll(ctx, pollID, identity.TelegramUserID, "", false)
	if err != nil {
		return VoteResult{}, err
	}
	result := VoteResult{Options: poll.Options}
	if allowMultiple {
		result.SelectedOptionIDs = poll.SelectedOptionIDs
	} else {
		result.SelectedOptionID = poll.SelectedOptionID
	}
	return result, nil
}

func countryAllowed(country string, allowed []string) bool {
	country = strings.ToUpper(strings.TrimSpace(country))
	if country == "" {
		return false
	}
	for _, value := range allowed {
		if strings.ToUpper(strings.TrimSpace(value)) == country {
			return true
		}
	}
	return false
}

func (s *Store) PollAccess(ctx context.Context, pollID, ownerKeyHash string, userID int64, admin bool) (visible bool, owner bool, err error) {
	err = s.db.QueryRow(ctx, `
		SELECT
			visibility = 'public'
				OR coalesce(owner_key_hash = nullif($2, ''), false)
				OR ($3::bigint <> 0 AND (owner_user_id = $3 OR owner_telegram_id = $3))
				OR $4::boolean,
			coalesce(owner_key_hash = nullif($2, ''), false)
				OR ($3::bigint <> 0 AND (owner_user_id = $3 OR owner_telegram_id = $3))
				OR $4::boolean
		FROM polls
		WHERE id = $1`,
		pollID,
		ownerKeyHash,
		userID,
		admin,
	).Scan(&visible, &owner)
	return visible, owner, err
}

func (s *Store) CreatePollShareLink(ctx context.Context, input ShareLinkInput) (ShareLinkStats, error) {
	var linksCount int
	if err := s.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM poll_share_links
		WHERE poll_id = $1`, input.PollID).Scan(&linksCount); err != nil {
		return ShareLinkStats{}, err
	}
	if linksCount >= freePlanShareLinksLimit {
		return ShareLinkStats{}, ErrFreePlanLinksLimit
	}

	var item ShareLinkStats
	err := s.db.QueryRow(ctx, `
		INSERT INTO poll_share_links (poll_id, name, slug, utm_source, utm_medium)
		VALUES ($1, $2, $3, $3, 'named')
		RETURNING id::text, name, slug, created_at::text`,
		input.PollID,
		strings.TrimSpace(input.Name),
		strings.TrimSpace(input.Slug),
	).Scan(&item.ID, &item.Name, &item.Slug, &item.CreatedAt)
	return item, err
}

func (s *Store) PollShareLinks(ctx context.Context, pollID string) ([]ShareLinkStats, error) {
	rows, err := s.db.Query(ctx, `
		SELECT psl.id::text, psl.name, psl.slug, psl.created_at::text,
			count(te.id) FILTER (WHERE te.event_type = 'visit')::int,
			count(te.id) FILTER (WHERE te.event_type = 'vote')::int
		FROM poll_share_links psl
		LEFT JOIN traffic_events te ON te.share_link_id = psl.id
		WHERE psl.poll_id = $1
		GROUP BY psl.id, psl.name, psl.slug, psl.created_at
		ORDER BY psl.created_at DESC`,
		pollID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ShareLinkStats{}
	for rows.Next() {
		var item ShareLinkStats
		if err := rows.Scan(&item.ID, &item.Name, &item.Slug, &item.CreatedAt, &item.Visits, &item.Votes); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) DeletePollShareLink(ctx context.Context, pollID, linkID string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM poll_share_links WHERE poll_id = $1 AND id = $2`, pollID, linkID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) PollShareLinkBySlug(ctx context.Context, pollID, slug string) (ShareLinkStats, error) {
	var item ShareLinkStats
	err := s.db.QueryRow(ctx, `
		SELECT id::text, name, slug, created_at::text
		FROM poll_share_links
		WHERE poll_id = $1 AND slug = $2`,
		pollID,
		slug,
	).Scan(&item.ID, &item.Name, &item.Slug, &item.CreatedAt)
	return item, err
}

func (s *Store) CreateQuizShareLink(ctx context.Context, input ShareLinkInput) (ShareLinkStats, error) {
	var linksCount int
	if err := s.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM quiz_share_links
		WHERE quiz_id = $1`, input.QuizID).Scan(&linksCount); err != nil {
		return ShareLinkStats{}, err
	}
	if linksCount >= freePlanShareLinksLimit {
		return ShareLinkStats{}, ErrFreePlanLinksLimit
	}

	var item ShareLinkStats
	err := s.db.QueryRow(ctx, `
		INSERT INTO quiz_share_links (quiz_id, name, slug, utm_source, utm_medium)
		VALUES ($1, $2, $3, $3, 'named')
		RETURNING id::text, name, slug, created_at::text`,
		input.QuizID,
		strings.TrimSpace(input.Name),
		strings.TrimSpace(input.Slug),
	).Scan(&item.ID, &item.Name, &item.Slug, &item.CreatedAt)
	return item, err
}

func (s *Store) QuizShareLinks(ctx context.Context, quizID string) ([]ShareLinkStats, error) {
	rows, err := s.db.Query(ctx, `
		SELECT qsl.id::text, qsl.name, qsl.slug, qsl.created_at::text,
			count(qa.id) FILTER (WHERE qa.id IS NOT NULL)::int as visits,
			count(qa.id) FILTER (WHERE qa.id IS NOT NULL)::int as votes
		FROM quiz_share_links qsl
		LEFT JOIN quiz_attempts qa ON qa.share_link_id = qsl.id
		WHERE qsl.quiz_id = $1
		GROUP BY qsl.id, qsl.name, qsl.slug, qsl.created_at
		ORDER BY qsl.created_at DESC`,
		quizID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ShareLinkStats{}
	for rows.Next() {
		var item ShareLinkStats
		if err := rows.Scan(&item.ID, &item.Name, &item.Slug, &item.CreatedAt, &item.Visits, &item.Votes); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) DeleteQuizShareLink(ctx context.Context, quizID, linkID string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM quiz_share_links WHERE quiz_id = $1 AND id = $2`, quizID, linkID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) QuizShareLinkBySlug(ctx context.Context, quizID, slug string) (ShareLinkStats, error) {
	var item ShareLinkStats
	err := s.db.QueryRow(ctx, `
		SELECT id::text, name, slug, created_at::text
		FROM quiz_share_links
		WHERE quiz_id = $1 AND slug = $2`,
		quizID,
		slug,
	).Scan(&item.ID, &item.Name, &item.Slug, &item.CreatedAt)
	return item, err
}

func (s *Store) RecordTrafficEvent(ctx context.Context, event TrafficEvent) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO traffic_events (
			event_type, path, method, poll_id, option_id, voter_token_hash, ip_hash, device_hash,
			user_agent, referrer, landing_url, utm_source, utm_medium, utm_campaign, utm_term, utm_content, share_link_id,
			ip_country, ip_region, ip_city, ip_geo_source, accept_language
		)
		VALUES ($1, $2, $3, nullif($4, '')::uuid, nullif($5, '')::uuid, nullif($6, ''), nullif($7, ''), nullif($8, ''),
			$9, $10, $11, $12, $13, $14, $15, $16, nullif($17, '')::uuid, $18, $19, $20, $21, $22)`,
		event.EventType,
		event.Path,
		event.Method,
		event.PollID,
		event.OptionID,
		event.VoterTokenHash,
		event.IPHash,
		event.DeviceHash,
		event.UserAgent,
		event.Referrer,
		event.LandingURL,
		event.UTMSource,
		event.UTMMedium,
		event.UTMCampaign,
		event.UTMTerm,
		event.UTMContent,
		event.ShareLinkID,
		event.IPCountry,
		event.IPRegion,
		event.IPCity,
		event.IPGeoSource,
		event.AcceptLanguage,
	)
	return err
}

func (s *Store) PollStats(ctx context.Context, pollID, ownerKeyHash string, userID int64, admin bool) (PollStats, error) {
	var allowed bool
	if err := s.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM polls
			WHERE id = $1 AND (
				owner_key_hash = nullif($2, '')
				OR ($3::bigint <> 0 AND (owner_user_id = $3 OR owner_telegram_id = $3))
				OR $4::boolean
			)
		)`,
		pollID,
		ownerKeyHash,
		userID,
		admin,
	).Scan(&allowed); err != nil {
		return PollStats{}, err
	}
	if !allowed {
		return PollStats{}, pgx.ErrNoRows
	}

	poll, err := s.GetPoll(ctx, pollID, userID, ownerKeyHash, admin)
	if err != nil {
		return PollStats{}, err
	}
	stats := PollStats{Poll: poll, Options: make([]OptionStats, 0, len(poll.Options)), Analytics: PollAnalytics{}}
	for _, option := range poll.Options {
		stats.TotalVotes += option.Votes
	}
	for _, option := range poll.Options {
		percent := 0
		if stats.TotalVotes > 0 {
			percent = int(float64(option.Votes) / float64(stats.TotalVotes) * 100)
		}
		stats.Options = append(stats.Options, OptionStats{ID: option.ID, Text: option.Text, Votes: option.Votes, Percent: percent})
	}

	// Load analytics from traffic_events
	rows, err := s.db.Query(ctx, `
		SELECT 'browser' as type,
			CASE
				WHEN user_agent LIKE '%Edg%' THEN 'Edge'
				WHEN user_agent LIKE '%OPR%' OR user_agent LIKE '%Opera%' THEN 'Opera'
				WHEN user_agent LIKE '%Chrome%' OR user_agent LIKE '%CriOS%' THEN 'Chrome'
				WHEN user_agent LIKE '%Firefox%' OR user_agent LIKE '%FxiOS%' THEN 'Firefox'
				WHEN user_agent LIKE '%Safari%' THEN 'Safari'
				ELSE 'Other'
			END as name, COUNT(*) as count
		FROM traffic_events te
		WHERE te.event_type = 'vote' AND te.poll_id = $1
		GROUP BY type, name
		ORDER BY count DESC`,
		pollID,
	)
	if err != nil {
		return PollStats{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var itemType, name string
		var count int
		if err := rows.Scan(&itemType, &name, &count); err != nil {
			return PollStats{}, err
		}
		stats.Analytics.Browsers = append(stats.Analytics.Browsers, AnalyticsItem{Name: name, Count: count})
	}
	rows.Close()

	// Load OS analytics
	rows, err = s.db.Query(ctx, `
		SELECT 'os' as type, 
			CASE 
				WHEN user_agent LIKE '%iPhone%' OR user_agent LIKE '%iPad%' THEN 'iOS'
				WHEN user_agent LIKE '%Android%' THEN 'Android'
				WHEN user_agent LIKE '%Windows%' THEN 'Windows'
				WHEN user_agent LIKE '%Mac%' OR user_agent LIKE '%OS X%' THEN 'macOS'
				WHEN user_agent LIKE '%Linux%' THEN 'Linux'
				ELSE 'Other'
			END as name, 
			COUNT(*) as count
		FROM traffic_events te
		WHERE te.event_type = 'vote' AND te.poll_id = $1
		GROUP BY type, name
		ORDER BY count DESC`,
		pollID,
	)
	if err != nil {
		return PollStats{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var itemType, name string
		var count int
		if err := rows.Scan(&itemType, &name, &count); err != nil {
			return PollStats{}, err
		}
		stats.Analytics.OS = append(stats.Analytics.OS, AnalyticsItem{Name: name, Count: count})
	}
	rows.Close()

	// Load devices analytics
	rows, err = s.db.Query(ctx, `
		SELECT 'device' as type,
			CASE
				WHEN user_agent LIKE '%Mobile%' AND user_agent NOT LIKE '%iPad%' THEN 'mobile'
				WHEN user_agent LIKE '%iPad%' OR user_agent LIKE '%Tablet%' OR user_agent LIKE '%Android%' THEN 'tablet'
				ELSE 'desktop'
			END as name,
			COUNT(*) as count
		FROM traffic_events te
		WHERE te.event_type = 'vote' AND te.poll_id = $1
		GROUP BY type, name
		ORDER BY count DESC`,
		pollID,
	)
	if err != nil {
		return PollStats{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var itemType, name string
		var count int
		if err := rows.Scan(&itemType, &name, &count); err != nil {
			return PollStats{}, err
		}
		stats.Analytics.Devices = append(stats.Analytics.Devices, AnalyticsItem{Name: name, Count: count})
	}
	rows.Close()

	// Load locations analytics
	rows, err = s.db.Query(ctx, `
		SELECT 'location' as type, COALESCE(NULLIF(ip_country, ''), 'Unknown') as name, COUNT(*) as count
		FROM traffic_events te
		WHERE te.event_type = 'vote' AND te.poll_id = $1
		GROUP BY type, name
		ORDER BY count DESC
		LIMIT 15`,
		pollID,
	)
	if err != nil {
		return PollStats{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var itemType, name string
		var count int
		if err := rows.Scan(&itemType, &name, &count); err != nil {
			return PollStats{}, err
		}
		stats.Analytics.Locations = append(stats.Analytics.Locations, AnalyticsItem{Name: name, Count: count})
	}
	rows.Close()

	// Load sources analytics
	rows, err = s.db.Query(ctx, `
		SELECT 'source' as type, COALESCE(NULLIF(utm_source, ''), 'direct') as name, COUNT(*) as count
		FROM traffic_events te
		WHERE te.event_type = 'vote' AND te.poll_id = $1
		GROUP BY type, name
		ORDER BY count DESC
		LIMIT 10`,
		pollID,
	)
	if err != nil {
		return PollStats{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var itemType, name string
		var count int
		if err := rows.Scan(&itemType, &name, &count); err != nil {
			return PollStats{}, err
		}
		stats.Analytics.Sources = append(stats.Analytics.Sources, AnalyticsItem{Name: name, Count: count})
	}
	rows.Close()

	linkRows, linkErr := s.db.Query(ctx, `
		SELECT psl.id::text, psl.name, psl.slug, psl.created_at::text,
			count(te.id) FILTER (WHERE te.event_type = 'visit')::int,
			count(te.id) FILTER (WHERE te.event_type = 'vote')::int
		FROM poll_share_links psl
		LEFT JOIN traffic_events te ON te.share_link_id = psl.id
		WHERE psl.poll_id = $1
		GROUP BY psl.id, psl.name, psl.slug, psl.created_at
		ORDER BY 5 DESC, 6 DESC, psl.created_at DESC`,
		pollID,
	)
	if linkErr != nil {
		return PollStats{}, linkErr
	}
	defer linkRows.Close()
	for linkRows.Next() {
		var item ShareLinkStats
		if err := linkRows.Scan(&item.ID, &item.Name, &item.Slug, &item.CreatedAt, &item.Visits, &item.Votes); err != nil {
			return PollStats{}, err
		}
		stats.Analytics.Links = append(stats.Analytics.Links, item)
	}
	if err := linkRows.Err(); err != nil {
		return PollStats{}, err
	}

	// Load voters
	voterRows, voterErr := s.db.Query(ctx, `
		SELECT coalesce(te.option_id::text, ''), coalesce(po.option_text, ''), te.ip_country, te.ip_geo_source,
			te.utm_source, te.utm_campaign, te.user_agent, te.created_at::text
		FROM traffic_events te
		LEFT JOIN poll_options po ON po.id = te.option_id
		WHERE te.event_type = 'vote' AND te.poll_id = $1
		ORDER BY te.created_at DESC
		LIMIT 100`,
		pollID,
	)
	if voterErr != nil {
		return PollStats{}, voterErr
	}
	defer voterRows.Close()
	for voterRows.Next() {
		var item VoteAttribution
		if err := voterRows.Scan(&item.OptionID, &item.OptionText, &item.Country, &item.GeoSource, &item.UTMSource, &item.UTMCampaign, &item.UserAgent, &item.CreatedAt); err != nil {
			return PollStats{}, err
		}
		if poll.IsAnonymous {
			item.UserAgent = "anonymous"
		}
		stats.Voters = append(stats.Voters, item)
	}
	return stats, voterRows.Err()
}

func (s *Store) UpsertTelegramUser(ctx context.Context, user TelegramUser) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO telegram_users (id, first_name, last_name, username, photo_url, auth_date, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, now())
		ON CONFLICT (id) DO UPDATE SET
			first_name = excluded.first_name,
			last_name = excluded.last_name,
			username = excluded.username,
			photo_url = excluded.photo_url,
			auth_date = excluded.auth_date,
			updated_at = now()`,
		user.ID, user.FirstName, user.LastName, user.Username, user.PhotoURL, user.AuthDate,
	)
	return err
}

func (s *Store) TelegramUser(ctx context.Context, id int64) (TelegramUser, error) {
	var user TelegramUser
	err := s.db.QueryRow(ctx, `
		SELECT id, first_name, last_name, username, photo_url, auth_date
		FROM telegram_users
		WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.FirstName, &user.LastName, &user.Username, &user.PhotoURL, &user.AuthDate)
	return user, err
}

func (s *Store) CreateSession(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) error {
	_, err := s.db.Exec(ctx, `INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, userID, tokenHash, expiresAt)
	return err
}

func (s *Store) SessionUserID(ctx context.Context, tokenHash string) (int64, error) {
	var userID int64
	if err := s.db.QueryRow(ctx, `SELECT user_id FROM user_sessions WHERE token_hash = $1 AND expires_at > now()`, tokenHash).Scan(&userID); err != nil {
		return 0, err
	}
	return userID, nil
}

func (s *Store) GetQuiz(ctx context.Context, id string, userID int64, ownerKeyHash string, isAdmin bool) (QuizDetail, error) {
	var quiz QuizDetail
	var questionID string
	if err := s.db.QueryRow(ctx, `
		SELECT q.id::text, q.title, q.description, qq.id::text, qq.question_text, q.visibility, q.allow_multiple,
			COALESCE(q.owner_key_hash = nullif($2, ''), false) OR ($3::bigint <> 0 AND q.owner_user_id = $3) OR $4::boolean
		FROM quizzes q
		JOIN quiz_questions qq ON qq.quiz_id = q.id
		WHERE q.id = $1
		ORDER BY qq.position
		LIMIT 1`, id, ownerKeyHash, userID, isAdmin).Scan(&quiz.ID, &quiz.Title, &quiz.Description, &questionID, &quiz.Question, &quiz.Visibility, &quiz.AllowMultiple, &quiz.IsOwner); err != nil {
		return QuizDetail{}, err
	}
	rows, err := s.db.Query(ctx, `SELECT id::text, answer_text, false FROM quiz_answers WHERE question_id = $1 ORDER BY position`, questionID)
	if err != nil {
		return QuizDetail{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var answer AnswerItem
		if err := rows.Scan(&answer.ID, &answer.Text, &answer.IsCorrect); err != nil {
			return QuizDetail{}, err
		}
		quiz.Answers = append(quiz.Answers, answer)
	}
	if err := rows.Err(); err != nil {
		return QuizDetail{}, err
	}
	if userID != 0 {
		_ = s.db.QueryRow(ctx, `
			SELECT answer_id::text
			FROM quiz_attempts
			WHERE quiz_id = $1 AND telegram_user_id = $2
			LIMIT 1`, id, userID).Scan(&quiz.SelectedAnswerID)
	}
	return quiz, rows.Err()
}

func (s *Store) SubmitQuizAnswer(ctx context.Context, quizID string, answerIDs []string, userID int64) (QuizSubmitResult, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return QuizSubmitResult{}, err
	}
	defer rollback(ctx, tx)

	// Проверяем, не отвечал ли уже пользователь
	var alreadyAttempted bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM quiz_attempts WHERE quiz_id = $1 AND telegram_user_id = $2)`,
		quizID, userID).Scan(&alreadyAttempted); err != nil {
		return QuizSubmitResult{}, err
	}
	if alreadyAttempted {
		return QuizSubmitResult{}, ErrDuplicateVote
	}

	// Получаем информацию о каждом ответе
	type answerInfo struct {
		questionID string
		isCorrect  bool
	}
	answers := make([]answerInfo, 0, len(answerIDs))
	anyCorrect := false
	for _, answerID := range answerIDs {
		var questionID string
		var isCorrect bool
		if err := tx.QueryRow(ctx, `
			SELECT qq.id::text, qa.is_correct
			FROM quizzes q
			JOIN quiz_questions qq ON qq.quiz_id = q.id
			JOIN quiz_answers qa ON qa.question_id = qq.id
			WHERE q.id = $1 AND qa.id = $2
			ORDER BY qq.position
			LIMIT 1`,
			quizID,
			answerID,
		).Scan(&questionID, &isCorrect); err != nil {
			return QuizSubmitResult{}, err
		}
		answers = append(answers, answerInfo{questionID: questionID, isCorrect: isCorrect})
		if isCorrect {
			anyCorrect = true
		}
	}

	// Вставляем попытки для всех выбранных ответов
	for i, a := range answers {
		if _, err := tx.Exec(ctx, `
			INSERT INTO quiz_attempts (quiz_id, question_id, answer_id, telegram_user_id, is_correct)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT DO NOTHING`,
			quizID,
			a.questionID,
			answerIDs[i],
			userID,
			a.isCorrect,
		); err != nil {
			return QuizSubmitResult{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return QuizSubmitResult{}, err
	}

	return s.QuizResults(ctx, quizID, answerIDs, anyCorrect)
}

func (s *Store) QuizResults(ctx context.Context, quizID string, selectedAnswerIDs []string, selectedCorrect bool) (QuizSubmitResult, error) {
	rows, err := s.db.Query(ctx, `
		SELECT qa.id::text, qa.answer_text, qa.is_correct, count(qat.id)::int
		FROM quiz_answers qa
		JOIN quiz_questions qq ON qq.id = qa.question_id
		LEFT JOIN quiz_attempts qat ON qat.answer_id = qa.id
		WHERE qq.quiz_id = $1
		GROUP BY qa.id, qa.answer_text, qa.is_correct, qa.position
		ORDER BY qa.position`,
		quizID,
	)
	if err != nil {
		return QuizSubmitResult{}, err
	}
	defer rows.Close()
	result := QuizSubmitResult{IsCorrect: selectedCorrect}
	selectedSet := make(map[string]bool, len(selectedAnswerIDs))
	for _, id := range selectedAnswerIDs {
		selectedSet[id] = true
	}
	for rows.Next() {
		var answer AnswerItem
		if err := rows.Scan(&answer.ID, &answer.Text, &answer.IsCorrect, &answer.Attempts); err != nil {
			return QuizSubmitResult{}, err
		}
		result.TotalAttempts += answer.Attempts
		if selectedSet[answer.ID] {
			result.SelectedAnswerID = answer.ID
		}
		result.Answers = append(result.Answers, answer)
	}
	if err := rows.Err(); err != nil {
		return QuizSubmitResult{}, err
	}
	for i := range result.Answers {
		if result.TotalAttempts > 0 {
			result.Answers[i].Percent = int(float64(result.Answers[i].Attempts) / float64(result.TotalAttempts) * 100)
		}
	}
	return result, nil
}

func (s *Store) QuizAccess(ctx context.Context, quizID, ownerKeyHash string, userID int64, admin bool) (visible bool, owner bool, err error) {
	err = s.db.QueryRow(ctx, `
		SELECT
			visibility = 'public'
				OR coalesce(owner_key_hash = nullif($2, ''), false)
				OR ($3::bigint <> 0 AND q.owner_user_id = $3)
				OR $4::boolean,
			coalesce(owner_key_hash = nullif($2, ''), false)
				OR ($3::bigint <> 0 AND q.owner_user_id = $3)
				OR $4::boolean
		FROM quizzes q
		WHERE q.id = $1`,
		quizID,
		ownerKeyHash,
		userID,
		admin,
	).Scan(&visible, &owner)
	return visible, owner, err
}

func (s *Store) QuizStats(ctx context.Context, quizID, ownerKeyHash string, userID int64, admin bool) (QuizStats, error) {
	var allowed bool
	if err := s.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM quizzes
			WHERE id = $1 AND (
				owner_key_hash = nullif($2, '')
				OR ($3::bigint <> 0 AND owner_user_id = $3)
				OR $4::boolean
			)
		)`,
		quizID,
		ownerKeyHash,
		userID,
		admin,
	).Scan(&allowed); err != nil {
		return QuizStats{}, err
	}
	if !allowed {
		return QuizStats{}, pgx.ErrNoRows
	}

	quiz, err := s.GetQuiz(ctx, quizID, userID, ownerKeyHash, admin)
	if err != nil {
		return QuizStats{}, err
	}
	stats := QuizStats{Quiz: quiz, Answers: make([]OptionStats, 0, len(quiz.Answers)), Analytics: PollAnalytics{}}
	for _, answer := range quiz.Answers {
		stats.TotalAttempts += answer.Attempts
	}
	for _, answer := range quiz.Answers {
		percent := 0
		if stats.TotalAttempts > 0 {
			percent = int(float64(answer.Attempts) / float64(stats.TotalAttempts) * 100)
		}
		stats.Answers = append(stats.Answers, OptionStats{ID: answer.ID, Text: answer.Text, Votes: answer.Attempts, Percent: percent})
	}

	rows, err := s.db.Query(ctx, `
		SELECT 'browser' as type,
			CASE
				WHEN user_agent LIKE '%Edg%' THEN 'Edge'
				WHEN user_agent LIKE '%OPR%' OR user_agent LIKE '%Opera%' THEN 'Opera'
				WHEN user_agent LIKE '%Chrome%' OR user_agent LIKE '%CriOS%' THEN 'Chrome'
				WHEN user_agent LIKE '%Firefox%' OR user_agent LIKE '%FxiOS%' THEN 'Firefox'
				WHEN user_agent LIKE '%Safari%' THEN 'Safari'
				ELSE 'Other'
			END as name, COUNT(*) as count
		FROM quiz_attempts qa
		WHERE qa.quiz_id = $1
		GROUP BY type, name
		ORDER BY count DESC`,
		quizID,
	)
	if err != nil {
		return QuizStats{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var itemType, name string
		var count int
		if err := rows.Scan(&itemType, &name, &count); err != nil {
			return QuizStats{}, err
		}
		stats.Analytics.Browsers = append(stats.Analytics.Browsers, AnalyticsItem{Name: name, Count: count})
	}
	rows.Close()

	rows, err = s.db.Query(ctx, `
		SELECT 'os' as type, 
			CASE 
				WHEN user_agent LIKE '%iPhone%' OR user_agent LIKE '%iPad%' THEN 'iOS'
				WHEN user_agent LIKE '%Android%' THEN 'Android'
				WHEN user_agent LIKE '%Windows%' THEN 'Windows'
				WHEN user_agent LIKE '%Mac%' OR user_agent LIKE '%OS X%' THEN 'macOS'
				WHEN user_agent LIKE '%Linux%' THEN 'Linux'
				ELSE 'Other'
			END as name, 
			COUNT(*) as count
		FROM quiz_attempts qa
		WHERE qa.quiz_id = $1
		GROUP BY type, name
		ORDER BY count DESC`,
		quizID,
	)
	if err != nil {
		return QuizStats{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var itemType, name string
		var count int
		if err := rows.Scan(&itemType, &name, &count); err != nil {
			return QuizStats{}, err
		}
		stats.Analytics.OS = append(stats.Analytics.OS, AnalyticsItem{Name: name, Count: count})
	}
	rows.Close()

	rows, err = s.db.Query(ctx, `
		SELECT 'device' as type,
			CASE
				WHEN user_agent LIKE '%Mobile%' AND user_agent NOT LIKE '%iPad%' THEN 'mobile'
				WHEN user_agent LIKE '%iPad%' OR user_agent LIKE '%Tablet%' OR user_agent LIKE '%Android%' THEN 'tablet'
				ELSE 'desktop'
			END as name,
			COUNT(*) as count
		FROM quiz_attempts qa
		WHERE qa.quiz_id = $1
		GROUP BY type, name
		ORDER BY count DESC`,
		quizID,
	)
	if err != nil {
		return QuizStats{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var itemType, name string
		var count int
		if err := rows.Scan(&itemType, &name, &count); err != nil {
			return QuizStats{}, err
		}
		stats.Analytics.Devices = append(stats.Analytics.Devices, AnalyticsItem{Name: name, Count: count})
	}
	rows.Close()

	rows, err = s.db.Query(ctx, `
		SELECT 'location' as type, COALESCE(NULLIF(ip_country, ''), 'Unknown') as name, COUNT(*) as count
		FROM quiz_attempts qa
		WHERE qa.quiz_id = $1
		GROUP BY type, name
		ORDER BY count DESC
		LIMIT 15`,
		quizID,
	)
	if err != nil {
		return QuizStats{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var itemType, name string
		var count int
		if err := rows.Scan(&itemType, &name, &count); err != nil {
			return QuizStats{}, err
		}
		stats.Analytics.Locations = append(stats.Analytics.Locations, AnalyticsItem{Name: name, Count: count})
	}
	rows.Close()

	rows, err = s.db.Query(ctx, `
		SELECT 'source' as type, COALESCE(NULLIF(utm_source, ''), 'direct') as name, COUNT(*) as count
		FROM quiz_attempts qa
		WHERE qa.quiz_id = $1
		GROUP BY type, name
		ORDER BY count DESC
		LIMIT 10`,
		quizID,
	)
	if err != nil {
		return QuizStats{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var itemType, name string
		var count int
		if err := rows.Scan(&itemType, &name, &count); err != nil {
			return QuizStats{}, err
		}
		stats.Analytics.Sources = append(stats.Analytics.Sources, AnalyticsItem{Name: name, Count: count})
	}
	rows.Close()

	// Load quiz share links
	linkRows, linkErr := s.db.Query(ctx, `
		SELECT qsl.id::text, qsl.name, qsl.slug, qsl.created_at::text,
			count(qa.id) FILTER (WHERE qa.id IS NOT NULL)::int as visits,
			count(qa.id) FILTER (WHERE qa.id IS NOT NULL)::int as votes
		FROM quiz_share_links qsl
		LEFT JOIN quiz_attempts qa ON qa.share_link_id = qsl.id
		WHERE qsl.quiz_id = $1
		GROUP BY qsl.id, qsl.name, qsl.slug, qsl.created_at
		ORDER BY visits DESC, votes DESC, qsl.created_at DESC`,
		quizID,
	)
	if linkErr != nil {
		return QuizStats{}, linkErr
	}
	defer linkRows.Close()
	for linkRows.Next() {
		var item ShareLinkStats
		if err := linkRows.Scan(&item.ID, &item.Name, &item.Slug, &item.CreatedAt, &item.Visits, &item.Votes); err != nil {
			return QuizStats{}, err
		}
		stats.Analytics.Links = append(stats.Analytics.Links, item)
	}
	linkRows.Close()

	return stats, nil
}

func (s *Store) DeletePoll(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM polls WHERE id = $1`, id)
	return err
}

func (s *Store) DeleteQuiz(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM quizzes WHERE id = $1`, id)
	return err
}

func (s *Store) AdminSummary(ctx context.Context) (AdminSummary, error) {
	var summary AdminSummary
	err := s.db.QueryRow(ctx, `
		SELECT
			(SELECT count(*)::int FROM polls),
			(SELECT count(*)::int FROM quizzes),
			(SELECT count(*)::int FROM poll_votes),
			(SELECT count(*)::int FROM telegram_users)`,
	).Scan(&summary.Polls, &summary.Quizzes, &summary.Votes, &summary.Users)
	return summary, err
}

func (s *Store) AdminItems(ctx context.Context, itemType string) ([]ListItem, error) {
	table := "polls"
	if itemType == "quizzes" {
		table = "quizzes"
	}
	rows, err := s.db.Query(ctx, `
		SELECT id::text, title, description, created_at::text
		FROM `+table+`
		ORDER BY created_at DESC
		LIMIT 200`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanList(rows)
}

func scanList(rows pgx.Rows) ([]ListItem, error) {
	items := make([]ListItem, 0)
	fields := rows.FieldDescriptions()

	for rows.Next() {
		values := make([]any, len(fields))
		dests := make([]any, len(fields))
		for i := range values {
			dests[i] = &values[i]
		}
		if err := rows.Scan(dests...); err != nil {
			return nil, err
		}

		item := ListItem{}
		for i, field := range fields {
			name := string(field.Name)
			switch name {
			case "id":
				if v, ok := values[i].(string); ok {
					item.ID = v
				}
			case "title":
				if v, ok := values[i].(string); ok {
					item.Title = v
				}
			case "description":
				if v, ok := values[i].(string); ok {
					item.Description = v
				}
			case "created_at":
				if v, ok := values[i].(string); ok {
					item.CreatedAt = v
				}
			case "count", "total_votes":
				if v, ok := values[i].(int32); ok {
					item.TotalVotes = int(v)
				} else if v, ok := values[i].(int64); ok {
					item.TotalVotes = int(v)
				}
			case "is_owner":
				if v, ok := values[i].(bool); ok {
					item.IsOwner = v
				}
			}
		}
		items = append(items, item)
	}
	return items, rows.Err()
}


func rollback(ctx context.Context, tx pgx.Tx) {
	err := tx.Rollback(ctx)
	if err != nil && !errors.Is(err, pgx.ErrTxClosed) {
		return
	}
}

// EmailCodeRecord хранит запись о коде подтверждения email.
type EmailCodeRecord struct {
	CodeHash  string
	ExpiresAt time.Time
	Attempts  int
}

// SaveEmailCode удаляет старые коды для email и сохраняет новый.
func (s *Store) SaveEmailCode(ctx context.Context, email, codeHash string, expiresAt time.Time) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM email_auth_codes WHERE email = $1`, email); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx, `INSERT INTO email_auth_codes (email, code_hash, expires_at) VALUES ($1, $2, $3)`, email, codeHash, expiresAt)
	return err
}

// GetEmailCode возвращает последнюю запись кода для email.
func (s *Store) GetEmailCode(ctx context.Context, email string) (EmailCodeRecord, error) {
	var rec EmailCodeRecord
	err := s.db.QueryRow(ctx, `SELECT code_hash, expires_at, attempts FROM email_auth_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`, email).Scan(&rec.CodeHash, &rec.ExpiresAt, &rec.Attempts)
	return rec, err
}

// IncrementEmailCodeAttempts увеличивает счётчик неудачных попыток ввода кода.
func (s *Store) IncrementEmailCodeAttempts(ctx context.Context, email string) error {
	_, err := s.db.Exec(ctx, `UPDATE email_auth_codes SET attempts = attempts + 1 WHERE email = $1`, email)
	return err
}

// DeleteEmailCode удаляет код после успешной верификации.
func (s *Store) DeleteEmailCode(ctx context.Context, email string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM email_auth_codes WHERE email = $1`, email)
	return err
}

// GetOrCreateEmailUser находит или создаёт пользователя с данным email.
func (s *Store) GetOrCreateEmailUser(ctx context.Context, email string) (TelegramUser, error) {
	// Сначала ищем существующего пользователя по email
	var user TelegramUser
	err := s.db.QueryRow(ctx, `SELECT id, first_name, COALESCE(username, '') FROM telegram_users WHERE email = $1 AND auth_method = 'email'`, email).Scan(&user.ID, &user.FirstName, &user.Username)
	if err == nil {
		return user, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return TelegramUser{}, err
	}

	// Создаём нового email-пользователя
	name := email
	if idx := strings.Index(email, "@"); idx > 0 {
		name = email[:idx]
	}
	err = s.db.QueryRow(ctx, `INSERT INTO telegram_users (id, first_name, username, email, auth_method, auth_date) VALUES (nextval('email_user_id_seq'), $1, '', $2, 'email', NOW()) RETURNING id, first_name`, name, email).Scan(&user.ID, &user.FirstName)
	return user, err
}

