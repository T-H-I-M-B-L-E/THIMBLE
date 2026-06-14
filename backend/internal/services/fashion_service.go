package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/resend/resend-go/v2"

	"chat-app/internal/config"
	"chat-app/internal/db"
	"chat-app/internal/repositories"
)

// StartFashionDigest schedules a daily fashion news email at 12:00pm WAT (11:00 UTC).
func StartFashionDigest(ctx context.Context) {
	go func() {
		for {
			now := time.Now().UTC()
			// 12:00 WAT = 11:00 UTC
			next := time.Date(now.Year(), now.Month(), now.Day(), 11, 0, 0, 0, time.UTC)
			if !next.After(now) {
				next = next.Add(24 * time.Hour)
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(time.Until(next)):
			}
			sendFashionDigest(ctx)
		}
	}()
}

type newsItem struct {
	Headline string
	Summary  string
	Source   string
	Region   string // "nigeria" | "international"
}

func sendFashionDigest(ctx context.Context) {
	groqKey := config.GroqAPIKey()
	newsKey := config.NewsAPIKey()

	var nigerian, international []newsItem

	// Try NewsAPI first if key is configured
	if newsKey != "" {
		nigerian = fetchNewsAPI(ctx, newsKey, "fashion Nigeria", "nigeria", 5)
		international = fetchNewsAPI(ctx, newsKey, "fashion week runway trends", "international", 5)
	}

	// Fall back to Groq-generated summaries if no news key or fetch failed
	if groqKey != "" && len(nigerian) < 3 {
		nigerian = generateFashionNews(ctx, groqKey, "Nigeria", 5)
	}
	if groqKey != "" && len(international) < 3 {
		international = generateFashionNews(ctx, groqKey, "global", 5)
	}

	if len(nigerian) == 0 && len(international) == 0 {
		log.Printf("fashion digest: no news to send (configure GROQ_API_KEY or NEWS_API_KEY)")
		return
	}

	// Trim to 5 each
	if len(nigerian) > 5 {
		nigerian = nigerian[:5]
	}
	if len(international) > 5 {
		international = international[:5]
	}

	html := buildFashionHTML(nigerian, international)
	subject := fmt.Sprintf("✦ Fashion Digest — %s", time.Now().UTC().Format("Mon Jan 2"))

	// Send to all users (honours product_updates opt-out via broadcast)
	result, err := SendBroadcast(ctx, "aria-system", BroadcastInput{
		Subject:   subject,
		Body:      buildFashionPlainText(nigerian, international),
		Audience:  Audience{Roles: []string{}, VerifiedOnly: false},
		SendEmail: true,
		ShowBanner: false,
	})
	if err != nil {
		// Fall back to admin-only if broadcast fails
		log.Printf("fashion digest: broadcast error: %v — sending to admins only", err)
		sendFashionToAdmins(ctx, subject, html)
		return
	}

	log.Printf("fashion digest: sent to %d users (%d succeeded)", result.Recipients, result.Succeeded)
	_ = html
}

// fetchNewsAPI pulls headlines from newsapi.org
func fetchNewsAPI(ctx context.Context, apiKey, query, region string, limit int) []newsItem {
	url := fmt.Sprintf(
		"https://newsapi.org/v2/everything?q=%s&sortBy=publishedAt&pageSize=%d&language=en&apiKey=%s",
		strings.ReplaceAll(query, " ", "+"), limit, apiKey,
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	var result struct {
		Articles []struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			Source      struct{ Name string `json:"name"` } `json:"source"`
		} `json:"articles"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil
	}

	items := make([]newsItem, 0, len(result.Articles))
	for _, a := range result.Articles {
		if a.Title == "" || strings.Contains(a.Title, "[Removed]") {
			continue
		}
		summary := a.Description
		if len(summary) > 160 {
			summary = summary[:157] + "…"
		}
		items = append(items, newsItem{
			Headline: a.Title,
			Summary:  summary,
			Source:   a.Source.Name,
			Region:   region,
		})
	}
	return items
}

// generateFashionNews uses Groq/Llama to generate fashion news summaries
func generateFashionNews(ctx context.Context, apiKey, region string, count int) []newsItem {
	today := time.Now().UTC().Format("January 2, 2006")
	var prompt string
	if region == "Nigeria" {
		prompt = fmt.Sprintf(`Generate %d short, realistic Nigerian fashion news headlines for %s.
Focus on: Lagos fashion week, Aso-ebi trends, Nigerian designers (like Lisa Folawiyo, Deola Sagoe, Mai Atafo),
Afro-fusion styles, Nigerian celebrity fashion, local fabric trends (Ankara, Adire, Aso-oke).

Respond with ONLY a JSON array, no other text:
[{"headline":"...","summary":"...","source":"Fashion Nigeria"}]

Make each summary 1-2 sentences, readable and engaging. Do not mention dates.`, count, today)
	} else {
		prompt = fmt.Sprintf(`Generate %d short, realistic global fashion news headlines for %s.
Focus on: Paris/Milan/New York/London fashion weeks, luxury brands (Chanel, Gucci, Prada, Balenciaga, Louis Vuitton),
sustainability trends, street style, celebrity looks, emerging designers, upcoming seasons.

Respond with ONLY a JSON array, no other text:
[{"headline":"...","summary":"...","source":"Vogue / WWD / Business of Fashion"}]

Make each summary 1-2 sentences, readable and engaging. Do not mention dates.`, count, today)
	}

	body, _ := json.Marshal(map[string]interface{}{
		"model":      "llama-3.1-8b-instant",
		"max_tokens": 800,
		"messages": []map[string]string{
			{"role": "system", "content": "You are a fashion news editor. Return only valid JSON arrays."},
			{"role": "user", "content": prompt},
		},
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.groq.com/openai/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("fashion: groq request error: %v", err)
		return nil
	}
	defer resp.Body.Close()

	var groqResp struct {
		Choices []struct {
			Message struct{ Content string `json:"content"` } `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil || len(groqResp.Choices) == 0 {
		return nil
	}

	content := strings.TrimSpace(groqResp.Choices[0].Message.Content)
	// Strip markdown code blocks if present
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var raw []struct {
		Headline string `json:"headline"`
		Summary  string `json:"summary"`
		Source   string `json:"source"`
	}
	if err := json.Unmarshal([]byte(content), &raw); err != nil {
		log.Printf("fashion: parse error: %v | content: %s", err, content)
		return nil
	}

	items := make([]newsItem, 0, len(raw))
	for _, r := range raw {
		if r.Headline == "" {
			continue
		}
		items = append(items, newsItem{
			Headline: r.Headline,
			Summary:  r.Summary,
			Source:   r.Source,
			Region:   region,
		})
	}
	return items
}

func buildFashionPlainText(nigerian, international []newsItem) string {
	var sb strings.Builder
	sb.WriteString("✦ Your daily fashion digest from THIMBLE\n\n")
	sb.WriteString("🇳🇬 NIGERIA\n\n")
	for i, n := range nigerian {
		sb.WriteString(fmt.Sprintf("%d. %s\n%s\n— %s\n\n", i+1, n.Headline, n.Summary, n.Source))
	}
	sb.WriteString("\n🌍 INTERNATIONAL\n\n")
	for i, n := range international {
		sb.WriteString(fmt.Sprintf("%d. %s\n%s\n— %s\n\n", i+1, n.Headline, n.Summary, n.Source))
	}
	sb.WriteString("\nUnsubscribe from fashion news in your THIMBLE settings.")
	return sb.String()
}

func buildFashionHTML(nigerian, international []newsItem) string {
	var sb strings.Builder

	sb.WriteString(`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e5e5e5;border-radius:12px;overflow:hidden">`)

	// Header
	fmt.Fprintf(&sb, `
  <div style="background:linear-gradient(135deg,#1a0a1a,#0a0a0f);padding:28px 32px;border-bottom:1px solid #2a1a2a">
    <p style="font-size:10px;letter-spacing:0.3em;color:#666;text-transform:uppercase;margin:0 0 10px">THIMBLE · Fashion Digest</p>
    <h1 style="margin:0 0 4px;font-size:26px;font-weight:700;color:#fff;letter-spacing:-0.02em">Today in Fashion ✦</h1>
    <p style="margin:0;font-size:13px;color:#666">%s</p>
  </div>`, time.Now().UTC().Format("Monday, January 2 · 12:00pm WAT"))

	// Nigerian section
	sb.WriteString(`
  <div style="padding:24px 32px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
      <span style="font-size:18px">🇳🇬</span>
      <span style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#c084fc">Nigeria</span>
    </div>`)

	for i, n := range nigerian {
		num := fmt.Sprintf("%02d", i+1)
		sb.WriteString(fmt.Sprintf(`
    <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #1a1a2a">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <span style="font-size:11px;font-weight:700;color:#c084fc;opacity:0.5;min-width:20px;margin-top:2px">%s</span>
        <div>
          <h3 style="margin:0 0 6px;font-size:15px;font-weight:600;color:#fff;line-height:1.4">%s</h3>
          <p style="margin:0 0 8px;font-size:13px;color:#999;line-height:1.6">%s</p>
          <span style="font-size:11px;color:#5a5a6a">%s</span>
        </div>
      </div>
    </div>`, num, n.Headline, n.Summary, n.Source))
	}

	sb.WriteString(`</div>`)

	// International section
	sb.WriteString(`
  <div style="padding:0 32px 24px;border-top:1px solid #111">
    <div style="display:flex;align-items:center;gap:8px;margin:24px 0 20px">
      <span style="font-size:18px">🌍</span>
      <span style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#60a5fa">International</span>
    </div>`)

	for i, n := range international {
		num := fmt.Sprintf("%02d", i+1)
		sb.WriteString(fmt.Sprintf(`
    <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #1a1a2a">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <span style="font-size:11px;font-weight:700;color:#60a5fa;opacity:0.5;min-width:20px;margin-top:2px">%s</span>
        <div>
          <h3 style="margin:0 0 6px;font-size:15px;font-weight:600;color:#fff;line-height:1.4">%s</h3>
          <p style="margin:0 0 8px;font-size:13px;color:#999;line-height:1.6">%s</p>
          <span style="font-size:11px;color:#5a5a6a">%s</span>
        </div>
      </div>
    </div>`, num, n.Headline, n.Summary, n.Source))
	}

	sb.WriteString(`</div>`)

	// Footer
	sb.WriteString(`
  <div style="padding:20px 32px;background:#060606;border-top:1px solid #111;text-align:center">
    <p style="font-size:12px;color:#444;margin:0 0 8px">You're receiving this because you're a THIMBLE member.</p>
    <a href="https://tvimble.tech/settings" style="font-size:11px;color:#555;text-decoration:none">Manage email preferences</a>
    <span style="color:#333;margin:0 8px">·</span>
    <a href="https://tvimble.tech" style="font-size:11px;color:#555;text-decoration:none">tvimble.tech</a>
  </div>
</div>`)

	return sb.String()
}

func sendFashionToAdmins(ctx context.Context, subject, html string) {
	adminEmails, err := repositories.ListAdminEmails(ctx)
	if err != nil || len(adminEmails) == 0 {
		return
	}
	client := resend.NewClient(config.ResendKey())
	_, err = client.Emails.Send(&resend.SendEmailRequest{
		From:    "alerts@tvimble.tech",
		To:      adminEmails,
		Subject: subject,
		Html:    html,
	})
	if err != nil {
		log.Printf("fashion: admin fallback send error: %v", err)
		return
	}
	db.Pool.Exec(ctx, "INSERT INTO email_log (type, recipients) VALUES ('fashion_digest', $1)", len(adminEmails))
}
