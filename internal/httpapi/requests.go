package httpapi

import (
	"errors"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"votely/internal/store"
)

const (
	maxTitleLength       = 160
	maxDescriptionLength = 2000
	maxOptionLength      = 300
	maxQuestionLength    = 500
	maxShareLinkName     = 80
)

type createPollRequest struct {
	Title            string   `json:"title"`
	Description      string   `json:"description"`
	Options          []string `json:"options"`
	IsAnonymous      bool     `json:"is_anonymous"`
	ShuffleOptions   bool     `json:"shuffle_options"`
	AllowedCountries []string `json:"allowed_countries"`
	EndsAt           string   `json:"ends_at"`
	Visibility       string   `json:"visibility"`
}

type createQuizRequest struct {
	Title            string                `json:"title"`
	Description      string                `json:"description"`
	Question         string                `json:"question"`
	Answers          []createQuizAnswerReq `json:"answers"`
	AllowedCountries []string              `json:"allowed_countries"`
	EndsAt           string                `json:"ends_at"`
}

type createQuizAnswerReq struct {
	Text      string `json:"text"`
	IsCorrect bool   `json:"is_correct"`
}

type votePollRequest struct {
	OptionID string `json:"option_id"`
}

type submitQuizAnswerRequest struct {
	AnswerID string `json:"answer_id"`
}

type createShareLinkRequest struct {
	Name string `json:"name"`
}

// telegramAuthPayload mirrors the JSON sent by the Telegram Login Widget.
// id and auth_date arrive as JSON numbers and are typed as int64 to avoid
// float64 precision loss. Optional fields use *string so we can distinguish
// "field absent" (nil) from "field present but empty" — only present fields
// must be included in the data-check string for HMAC verification.
type telegramAuthPayload struct {
	ID        int64   `json:"id"`
	AuthDate  int64   `json:"auth_date"`
	FirstName string  `json:"first_name"`
	LastName  *string `json:"last_name"`
	Username  *string `json:"username"`
	PhotoURL  *string `json:"photo_url"`
	Hash      string  `json:"hash"`
}

func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func (r createPollRequest) toInput(ownerUserID int64, ownerTelegramID int64, ownerKeyHash string) (store.PollInput, error) {
	title, err := validateText(r.Title, "Название опроса", maxTitleLength, true)
	if err != nil {
		return store.PollInput{}, err
	}
	if title == "" {
		return store.PollInput{}, errors.New("Укажите название опроса.")
	}
	description, err := validateText(r.Description, "Описание опроса", maxDescriptionLength, false)
	if err != nil {
		return store.PollInput{}, err
	}
	options, err := compactStrings(r.Options, maxOptionLength)
	if err != nil {
		return store.PollInput{}, err
	}
	if len(options) < 2 {
		return store.PollInput{}, errors.New("Добавьте минимум два варианта ответа.")
	}
	if len(options) > 20 {
		return store.PollInput{}, errors.New("В опросе может быть не больше 20 вариантов.")
	}
	allowedCountries, err := normalizeCountries(r.AllowedCountries)
	if err != nil {
		return store.PollInput{}, err
	}
	endsAt, err := parseEndsAt(r.EndsAt)
	if err != nil {
		return store.PollInput{}, err
	}
	visibility, err := normalizeVisibility(r.Visibility)
	if err != nil {
		return store.PollInput{}, err
	}
	return store.PollInput{
		Title:            title,
		Description:      description,
		Options:          options,
		OwnerUserID:      ownerUserID,
		OwnerTelegramID:  ownerTelegramID,
		OwnerKeyHash:     ownerKeyHash,
		IsAnonymous:      r.IsAnonymous,
		ShuffleOptions:   r.ShuffleOptions,
		AllowedCountries: allowedCountries,
		EndsAt:           endsAt,
		Visibility:       visibility,
	}, nil
}

func (r createShareLinkRequest) toInput(pollID string) (store.ShareLinkInput, error) {
	name, err := validateText(r.Name, "Название ссылки", maxShareLinkName, true)
	if err != nil {
		return store.ShareLinkInput{}, err
	}
	slug := slugify(name)
	if slug == "" {
		return store.ShareLinkInput{}, errors.New("Название ссылки должно содержать буквы или цифры.")
	}
	return store.ShareLinkInput{PollID: pollID, Name: name, Slug: slug}, nil
}

func (r createQuizRequest) toInput(ownerUserID int64, ownerKeyHash string) (store.QuizInput, error) {
	title, err := validateText(r.Title, "Название викторины", maxTitleLength, true)
	if err != nil {
		return store.QuizInput{}, err
	}
	if title == "" {
		return store.QuizInput{}, errors.New("Укажите название викторины.")
	}
	description, err := validateText(r.Description, "Описание викторины", maxDescriptionLength, false)
	if err != nil {
		return store.QuizInput{}, err
	}
	questionText, err := validateText(r.Question, "Вопрос викторины", maxQuestionLength, true)
	if err != nil {
		return store.QuizInput{}, err
	}
	if questionText == "" {
		return store.QuizInput{}, errors.New("Заполните единственный вопрос викторины.")
	}
	if len(r.Answers) < 2 {
		return store.QuizInput{}, errors.New("Добавьте минимум два варианта ответа.")
	}

	answers := make([]store.QuizAnswerInput, 0, len(r.Answers))
	correctCount := 0
	for _, answer := range r.Answers {
		answerText, err := validateText(answer.Text, "Вариант ответа", maxOptionLength, true)
		if err != nil {
			return store.QuizInput{}, err
		}
		if answerText == "" {
			continue
		}
		if answer.IsCorrect {
			correctCount++
		}
		answers = append(answers, store.QuizAnswerInput{Text: answerText, IsCorrect: answer.IsCorrect})
	}
	if len(answers) < 2 {
		return store.QuizInput{}, errors.New("Добавьте минимум два заполненных варианта ответа.")
	}
	if len(answers) > 20 {
		return store.QuizInput{}, errors.New("В викторине может быть не больше 20 вариантов ответа.")
	}
	if correctCount != 1 {
		return store.QuizInput{}, errors.New("Отметьте ровно один правильный ответ.")
	}
	allowedCountries, err := normalizeCountries(r.AllowedCountries)
	if err != nil {
		return store.QuizInput{}, err
	}
	endsAt, err := parseEndsAt(r.EndsAt)
	if err != nil {
		return store.QuizInput{}, err
	}

	return store.QuizInput{
		Title:            title,
		Description:      description,
		OwnerUserID:      ownerUserID,
		OwnerKeyHash:     ownerKeyHash,
		AllowedCountries: allowedCountries,
		EndsAt:           endsAt,
		Questions: []store.QuizQuestionInput{{
			Text:    questionText,
			Answers: answers,
		}},
	}, nil
}

func compactStrings(values []string, maxLength int) ([]string, error) {
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed, err := validateText(value, "Вариант ответа", maxLength, true)
		if err != nil {
			return nil, err
		}
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result, nil
}

func validateText(value, field string, maxLength int, required bool) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		if required {
			return "", errors.New(field + " не может быть пустым.")
		}
		return "", nil
	}
	if !utf8.ValidString(trimmed) {
		return "", errors.New(field + " содержит некорректную кодировку.")
	}
	if utf8.RuneCountInString(trimmed) > maxLength {
		return "", errors.New(field + " слишком длинное.")
	}
	for _, r := range trimmed {
		if unicode.IsControl(r) && r != '\n' && r != '\r' && r != '\t' {
			return "", errors.New(field + " содержит недопустимые символы.")
		}
	}
	return trimmed, nil
}

func normalizeCountries(values []string) ([]string, error) {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{})
	for _, value := range values {
		code := strings.ToUpper(strings.TrimSpace(value))
		if code == "" {
			continue
		}
		if len(code) != 2 {
			return nil, errors.New("Код страны должен состоять из двух букв.")
		}
		for _, r := range code {
			if r < 'A' || r > 'Z' {
				return nil, errors.New("Код страны должен состоять из латинских букв.")
			}
		}
		if _, ok := seen[code]; ok {
			continue
		}
		seen[code] = struct{}{}
		result = append(result, code)
	}
	if len(result) > 30 {
		return nil, errors.New("Можно указать не больше 30 стран.")
	}
	return result, nil
}

func normalizeVisibility(value string) (string, error) {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return "public", nil
	}
	if value != "public" && value != "private" {
		return "", errors.New("Тип доступа должен быть public или private.")
	}
	return value, nil
}

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	lastDash := false
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			builder.WriteRune(r)
			lastDash = false
			continue
		}
		if r >= 'а' && r <= 'я' {
			builder.WriteRune(r)
			lastDash = false
			continue
		}
		if (r == '-' || r == '_' || unicode.IsSpace(r)) && !lastDash && builder.Len() > 0 {
			builder.WriteByte('-')
			lastDash = true
		}
	}
	return strings.Trim(builder.String(), "-")
}

func parseEndsAt(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil, errors.New("Укажите время окончания в ISO-формате.")
	}
	if parsed.Before(time.Now().Add(time.Minute)) {
		return nil, errors.New("Время окончания должно быть в будущем.")
	}
	return &parsed, nil
}
