package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestVoterTokenCreatesHttpOnlyCookie(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/polls/id/votes", nil)
	rec := httptest.NewRecorder()

	server := apiServer{hashSecret: "test-secret"}
	token, err := server.voterToken(rec, req)
	if err != nil {
		t.Fatalf("voterToken() error = %v", err)
	}
	if !validVoterToken(token) {
		t.Fatalf("generated invalid token %q", token)
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected one cookie, got %d", len(cookies))
	}
	if cookies[0].Name != voterCookieName || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteLaxMode {
		t.Fatalf("unexpected cookie attributes: %#v", cookies[0])
	}
	if _, ok := verifySignedVoterToken("test-secret", cookies[0].Value); !ok {
		t.Fatalf("cookie value is not signed correctly: %q", cookies[0].Value)
	}
}

func TestVoterTokenReusesValidCookie(t *testing.T) {
	signed := signVoterToken("test-secret", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/polls/id/votes", nil)
	req.AddCookie(&http.Cookie{Name: voterCookieName, Value: signed})
	rec := httptest.NewRecorder()

	server := apiServer{hashSecret: "test-secret"}
	token, err := server.voterToken(rec, req)
	if err != nil {
		t.Fatalf("voterToken() error = %v", err)
	}
	if token != "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" {
		t.Fatalf("unexpected token %q", token)
	}
	if len(rec.Result().Cookies()) != 0 {
		t.Fatal("did not expect replacement cookie")
	}
}

func TestVoterTokenRejectsTamperedCookie(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/polls/id/votes", nil)
	req.AddCookie(&http.Cookie{Name: voterCookieName, Value: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bad"})
	rec := httptest.NewRecorder()

	server := apiServer{hashSecret: "test-secret"}
	token, err := server.voterToken(rec, req)
	if err != nil {
		t.Fatalf("voterToken() error = %v", err)
	}
	if token == "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" {
		t.Fatal("tampered token was reused")
	}
	if len(rec.Result().Cookies()) != 1 {
		t.Fatal("expected replacement cookie")
	}
}

func TestClientIPParsesRemoteAddr(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ip, err := clientIP(req, "127.0.0.1:12345")
	if err != nil {
		t.Fatalf("clientIP() error = %v", err)
	}
	if ip != "127.0.0.1" {
		t.Fatalf("clientIP() = %q", ip)
	}
}

func TestKeyedHashIsStableAndSecretDependent(t *testing.T) {
	first := keyedHash("secret-a", "value")
	second := keyedHash("secret-a", "value")
	third := keyedHash("secret-b", "value")
	if first != second {
		t.Fatal("expected stable hash")
	}
	if first == third {
		t.Fatal("expected hash to depend on secret")
	}
	if len(first) != 64 {
		t.Fatalf("unexpected hash length %d", len(first))
	}
}

func TestIPGeoUsesEdgeHeaders(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/?utm_source=test", nil)
	req.Header.Set("CF-IPCountry", "US")

	geo := ipGeo(req, "8.8.8.8")
	if geo.country != "US" || geo.source != "cf-ipcountry" {
		t.Fatalf("unexpected geo hint: %#v", geo)
	}
}

func TestIPGeoMarksPrivateIP(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)

	geo := ipGeo(req, "127.0.0.1")
	if geo.source != "private" {
		t.Fatalf("unexpected geo hint: %#v", geo)
	}
}
