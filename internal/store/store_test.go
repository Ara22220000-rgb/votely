package store

import "testing"

func TestEscapeLikeEscapesWildcards(t *testing.T) {
	got := escapeLike(`50%\_match`)
	want := `50\%\\\_match`
	if got != want {
		t.Fatalf("escapeLike() = %q, want %q", got, want)
	}
}
