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
	OwnerKeyHash     string
	IsAnonymous      bool
	ShuffleOptions   bool
	AllowedCountries []string
	EndsAt           *time.Time
}

type QuizInput struct {
	Title            string
	Description      string
	Questions        []QuizQuestionInput
	OwnerUserID      int64
	OwnerKeyHash     string
	AllowedCountries []string
	EndsAt           *time.Time
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
}

type PollDetail struct {
	ID               string       `json:"id"`
	Title            string       `json:"title"`
	Description      string       `json:"description"`
	Options          []OptionItem `json:"options"`
	IsAnonymous      bool         `json:"is_anonymous"`
	ShuffleOptions   bool         `json:"shuffle_options"`
	AllowedCountries []string     `json:"allowed_countries"`
	EndsAt           string       `json:"ends_at,omitempty"`
	ClosedAt         string       `json:"closed_at,omitempty"`
	IsClosed         bool         `json:"is_closed"`
}

type QuizDetail struct {
	ID          string       `json:"id"`
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Question    string       `json:"question"`
	Answers     []AnswerItem `json:"answers"`
}

type OptionItem struct {
	ID    string `json:"id"`
	Text  string `json:"text"`
	Votes int    `json:"votes"`
}

type AnswerItem struct {
	Text      string `json:"text"`
	IsCorrect bool   `json:"is_correct"`
}

type VoteResult struct {
	Options []OptionItem `json:"options"`
}

type SQLResult struct {
	Columns      []string `json:"columns"`
	Rows         [][]any  `json:"rows"`
	AffectedRows int64    `json:"affected_rows"`
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

	var id string
	if err := tx.QueryRow(ctx,
		`INSERT INTO polls (title, description, owner_user_id, owner_key_hash, is_anonymous, shuffle_options, allowed_countries, ends_at)
		VALUES ($1, $2, nullif($3, 0), nullif($4, ''), $5, $6, $7, $8) RETURNING id`,
		strings.TrimSpace(input.Title),
		strings.TrimSpace(input.Description),
		input.OwnerUserID,
		input.OwnerKeyHash,
		input.IsAnonymous,
		input.ShuffleOptions,
		input.AllowedCountries,
		input.EndsAt,
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

	var quizID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO quizzes (title, description, owner_user_id, owner_key_hash, allowed_countries, ends_at)
		VALUES ($1, $2, nullif($3, 0), nullif($4, ''), $5, $6) RETURNING id`,
		strings.TrimSpace(input.Title),
		strings.TrimSpace(input.Description),
		input.OwnerUserID,
		input.OwnerKeyHash,
		input.AllowedCountries,
		input.EndsAt,
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

func (s *Store) ListPolls(ctx context.Context, query string) ([]ListItem, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		rows, err := s.db.Query(ctx, `SELECT id::text, title, description, created_at::text FROM polls ORDER BY created_at DESC LIMIT 100`)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		return scanList(rows)
	}

	pattern := "%" + escapeLike(query) + "%"
	rows, err := s.db.Query(ctx, `
		SELECT id::text, title, description, created_at::text
		FROM polls
		WHERE title ILIKE $1 ESCAPE '\' OR description ILIKE $1 ESCAPE '\'
		ORDER BY created_at DESC
		LIMIT 100`, pattern)
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

func (s *Store) ListQuizzes(ctx context.Context) ([]ListItem, error) {
	rows, err := s.db.Query(ctx, `SELECT id::text, title, description, created_at::text FROM quizzes ORDER BY created_at DESC LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanList(rows)
}

func (s *Store) GetPoll(ctx context.Context, id string) (PollDetail, error) {
	var poll PollDetail
	var endsAt sql.NullString
	var closedAt sql.NullString
	if err := s.db.QueryRow(ctx, `
		SELECT id::text, title, description, is_anonymous, shuffle_options, allowed_countries, ends_at::text, closed_at::text,
			(closed_at IS NOT NULL OR (ends_at IS NOT NULL AND ends_at <= now()))
		FROM polls WHERE id = $1`,
		id,
	).Scan(&poll.ID, &poll.Title, &poll.Description, &poll.IsAnonymous, &poll.ShuffleOptions, &poll.AllowedCountries, &endsAt, &closedAt, &poll.IsClosed); err != nil {
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
	return poll, rows.Err()
}

func (s *Store) VotePoll(ctx context.Context, pollID, optionID string, identity VoteIdentity) (VoteResult, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return VoteResult{}, err
	}
	defer rollback(ctx, tx)

	var exists bool
	var isClosed bool
	var allowedCountries []string
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM poll_options WHERE poll_id = $1 AND id = $2),
			(p.closed_at IS NOT NULL OR (p.ends_at IS NOT NULL AND p.ends_at <= now())),
			p.allowed_countries
		FROM polls p
		WHERE p.id = $1`,
		pollID,
		optionID,
	).Scan(&exists, &isClosed, &allowedCountries); err != nil {
		return VoteResult{}, err
	}
	if !exists {
		return VoteResult{}, pgx.ErrNoRows
	}
	if isClosed {
		return VoteResult{}, ErrPollClosed
	}
	if len(allowedCountries) > 0 && !countryAllowed(identity.Country, allowedCountries) {
		return VoteResult{}, ErrCountryNotAllowed
	}

	var voteID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO poll_votes (poll_id, option_id, voter_token_hash, ip_hash, device_hash)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT DO NOTHING
		RETURNING id::text`,
		pollID,
		optionID,
		identity.VoterTokenHash,
		identity.IPHash,
		identity.DeviceHash,
	).Scan(&voteID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return VoteResult{}, ErrDuplicateVote
		}
		return VoteResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return VoteResult{}, err
	}

	poll, err := s.GetPoll(ctx, pollID)
	if err != nil {
		return VoteResult{}, err
	}
	return VoteResult{Options: poll.Options}, nil
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

func (s *Store) RecordTrafficEvent(ctx context.Context, event TrafficEvent) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO traffic_events (
			event_type, path, method, poll_id, option_id, voter_token_hash, ip_hash, device_hash,
			user_agent, referrer, landing_url, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
			ip_country, ip_region, ip_city, ip_geo_source, accept_language
		)
		VALUES ($1, $2, $3, nullif($4, '')::uuid, nullif($5, '')::uuid, nullif($6, ''), nullif($7, ''), nullif($8, ''),
			$9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
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
		event.IPCountry,
		event.IPRegion,
		event.IPCity,
		event.IPGeoSource,
		event.AcceptLanguage,
	)
	return err
}

func (s *Store) PollStats(ctx context.Context, pollID, ownerKeyHash string, userID int64) (PollStats, error) {
	var allowed bool
	if err := s.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM polls
			WHERE id = $1 AND (
				owner_key_hash = nullif($2, '')
				OR ($3::bigint <> 0 AND owner_user_id = $3)
			)
		)`,
		pollID,
		ownerKeyHash,
		userID,
	).Scan(&allowed); err != nil {
		return PollStats{}, err
	}
	if !allowed {
		return PollStats{}, pgx.ErrNoRows
	}

	poll, err := s.GetPoll(ctx, pollID)
	if err != nil {
		return PollStats{}, err
	}
	stats := PollStats{Poll: poll, Options: make([]OptionStats, 0, len(poll.Options))}
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

	rows, err := s.db.Query(ctx, `
		SELECT coalesce(te.option_id::text, ''), coalesce(po.option_text, ''), te.ip_country, te.ip_geo_source,
			te.utm_source, te.utm_campaign, te.user_agent, te.created_at::text
		FROM traffic_events te
		LEFT JOIN poll_options po ON po.id = te.option_id
		WHERE te.event_type = 'vote' AND te.poll_id = $1
		ORDER BY te.created_at DESC
		LIMIT 100`,
		pollID,
	)
	if err != nil {
		return PollStats{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var item VoteAttribution
		if err := rows.Scan(&item.OptionID, &item.OptionText, &item.Country, &item.GeoSource, &item.UTMSource, &item.UTMCampaign, &item.UserAgent, &item.CreatedAt); err != nil {
			return PollStats{}, err
		}
		if poll.IsAnonymous {
			item.UserAgent = "anonymous"
		}
		stats.Voters = append(stats.Voters, item)
	}
	return stats, rows.Err()
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

func (s *Store) GetQuiz(ctx context.Context, id string) (QuizDetail, error) {
	var quiz QuizDetail
	var questionID string
	if err := s.db.QueryRow(ctx, `
		SELECT q.id::text, q.title, q.description, qq.id::text, qq.question_text
		FROM quizzes q
		JOIN quiz_questions qq ON qq.quiz_id = q.id
		WHERE q.id = $1
		ORDER BY qq.position
		LIMIT 1`, id).Scan(&quiz.ID, &quiz.Title, &quiz.Description, &questionID, &quiz.Question); err != nil {
		return QuizDetail{}, err
	}
	rows, err := s.db.Query(ctx, `SELECT answer_text, is_correct FROM quiz_answers WHERE question_id = $1 ORDER BY position`, questionID)
	if err != nil {
		return QuizDetail{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var answer AnswerItem
		if err := rows.Scan(&answer.Text, &answer.IsCorrect); err != nil {
			return QuizDetail{}, err
		}
		quiz.Answers = append(quiz.Answers, answer)
	}
	return quiz, rows.Err()
}

func (s *Store) DeletePoll(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM polls WHERE id = $1`, id)
	return err
}

func (s *Store) DeleteQuiz(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM quizzes WHERE id = $1`, id)
	return err
}

func scanList(rows pgx.Rows) ([]ListItem, error) {
	items := make([]ListItem, 0)
	for rows.Next() {
		var item ListItem
		if err := rows.Scan(&item.ID, &item.Title, &item.Description, &item.CreatedAt); err != nil {
			return nil, err
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
