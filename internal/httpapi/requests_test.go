package httpapi

import "testing"

func TestCreatePollRequestValidationRejectsLongTitle(t *testing.T) {
	req := createPollRequest{
		Title:   repeat("a", maxTitleLength+1),
		Options: []string{"yes", "no"},
	}

	if _, err := req.toInput(0, "ownerhash"); err == nil {
		t.Fatal("expected validation error")
	}
}

func TestCreatePollRequestValidationRejectsControlCharacters(t *testing.T) {
	req := createPollRequest{
		Title:   "Safe title",
		Options: []string{"yes", "n\x00o"},
	}

	if _, err := req.toInput(0, "ownerhash"); err == nil {
		t.Fatal("expected validation error")
	}
}

func TestCreatePollRequestValidationTrimsAcceptedInput(t *testing.T) {
	req := createPollRequest{
		Title:       "  Safe title  ",
		Description: "  Description  ",
		Options:     []string{"  yes  ", " no "},
	}

	input, err := req.toInput(0, "ownerhash")
	if err != nil {
		t.Fatalf("unexpected validation error: %v", err)
	}
	if input.Title != "Safe title" || input.Description != "Description" {
		t.Fatalf("unexpected normalized text: %#v", input)
	}
	if input.Options[0] != "yes" || input.Options[1] != "no" {
		t.Fatalf("unexpected normalized options: %#v", input.Options)
	}
}

func repeat(value string, count int) string {
	result := ""
	for i := 0; i < count; i++ {
		result += value
	}
	return result
}
