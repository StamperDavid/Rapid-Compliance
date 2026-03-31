# Jasper Orchestration Test Suite

**Purpose:** Validate that Jasper correctly routes user requests to the right tools regardless of how the request is phrased. Real users don't write numbered prompts with tool names — Jasper must understand intent from casual, vague, and compound language.

**Last Updated:** March 31, 2026

---

## How to Use This Suite

1. Open Jasper chat at `localhost:3000`
2. Send each prompt exactly as written
3. Check the **three success criteria** for every test:
   - **Zero narration before tools** — No text before the first tool call
   - **Correct tools fired** — Compare against the "Expected Tools" column
   - **Useful response after results** — Summary with review links, not vague promises
4. Mark PASS / FAIL / PARTIAL for each test
5. Note any issues in the "Notes" column

---

## Category A: The Power User (Numbered, Explicit Requests)

These are well-structured prompts. If Jasper can't handle these, nothing else matters.

| # | Prompt | Expected Tools | Tests | Result |
|---|--------|---------------|-------|--------|
| A.1 | *[See CONTINUATION_PROMPT test prompt — the 5-part end-to-end campaign]* | scrape_website x3, research_trending_topics, scan_leads, orchestrate_campaign, draft_outreach_email, get_seo_config | Zero narration, 8+ parallel tool calls, leads saved to CRM | |
| A.2 | "1. Research our top 3 competitors: GoHighLevel, Vendasta, HubSpot. 2. Write a blog post comparing us to them. 3. Post a summary on Twitter and LinkedIn." | research_competitors (or scrape_website x3), save_blog_draft, social_post x2 | 4-6 tool calls, blog + social created separately, not collapsed into one campaign | |
| A.3 | "Scrape salesforce.com and hubspot.com. Then score all my existing leads. Then draft an outreach email to whoever scores highest." | scrape_website x2, score_leads, draft_outreach_email | Sequential dependency understood (outreach depends on scoring), scrape runs parallel | |

---

## Category B: The Casual User (Natural Language, No Structure)

These test whether Jasper can extract intent from conversational requests.

| # | Prompt | Expected Tools | Tests | Result |
|---|--------|---------------|-------|--------|
| B.1 | "I need more customers. Can you help me find some?" | scan_leads (or delegate_to_intelligence) | Doesn't ask clarifying questions forever — takes action with reasonable defaults | |
| B.2 | "What are my competitors doing that I'm not?" | research_competitors or scrape_website on known competitors | Uses tools, doesn't answer from training data | |
| B.3 | "Write me something I can post on social media today" | social_post or generate_content | Creates actual content, not a suggestion to create content | |
| B.4 | "I want to start doing videos" | list_avatars → then guidance based on hasClone result | Checks avatar status FIRST before producing anything | |
| B.5 | "Help me get my SEO sorted out" | get_seo_config | Pulls current config first, then advises based on real data | |
| B.6 | "Can you look into what GoHighLevel charges?" | scrape_website (gohighlevel.com) or research_competitors | Actually scrapes/researches, never answers from memory | |
| B.7 | "I'm not getting enough leads from my website" | get_analytics or get_seo_config, then actionable advice | Pulls real data before recommending fixes | |
| B.8 | "I've got a product launch next week, help me promote it" | orchestrate_campaign or create_campaign + individual tools | Creates multi-channel content, doesn't just give a plan | |

---

## Category C: The Busy Executive (Terse, One-Liners)

Minimal input — Jasper must infer scope and act.

| # | Prompt | Expected Tools | Tests | Result |
|---|--------|---------------|-------|--------|
| C.1 | "Blog post about AI in sales" | save_blog_draft | Single tool, no campaign created, actual blog written | |
| C.2 | "Find me leads in the HVAC industry" | scan_leads(industry: "HVAC") | Leads scanned AND saved to CRM | |
| C.3 | "Check my analytics" | get_analytics | Returns real data, not a description of what analytics are | |
| C.4 | "Email my top leads" | score_leads → draft_outreach_email | Scores first to find "top", then drafts email | |
| C.5 | "What's our website look like to Google?" | get_seo_config | SEO data returned | |
| C.6 | "Make a video about our product" | list_avatars → produce_video | Avatar check first, then storyboard only (no auto-generate) | |
| C.7 | "Post on LinkedIn" | social_post(platform: "linkedin") | Creates and posts content | |
| C.8 | "Who are we competing with?" | research_competitors | Tool-based research, not training data | |
| C.9 | "Scrape this: https://competitor.com" | scrape_website(url: "https://competitor.com") | Direct scrape of provided URL | |
| C.10 | "How's business?" | get_platform_stats or get_analytics | Real metrics, not a pep talk | |

---

## Category D: Compound Requests (Multiple Tasks, No Numbers)

The hardest category — Jasper must decompose natural language into multiple tool calls.

| # | Prompt | Expected Tools | Tests | Result |
|---|--------|---------------|-------|--------|
| D.1 | "Find me some leads in SaaS, enrich the best ones, and draft cold emails to them" | scan_leads, enrich_lead, draft_outreach_email | Three distinct tools, correct order | |
| D.2 | "I need a blog post and social media posts about our new pricing" | save_blog_draft, social_post (or create_campaign + both) | 2+ deliverables, not collapsed into one tool | |
| D.3 | "Research what Vendasta is doing, then build a campaign that positions us as better" | scrape_website or research_competitors, then orchestrate_campaign | Research tool fires SEPARATELY from campaign, not inside it | |
| D.4 | "Scrape these three sites and summarize the findings: hubspot.com, salesforce.com, zoho.com" | scrape_website x3 | Three separate scrape calls, not one | |
| D.5 | "Write a blog, make a video, post on all our socials, and send an email blast about our summer sale" | orchestrate_campaign (or create_campaign + individual tools) | Multi-channel campaign created | |
| D.6 | "Look at our SEO, find what keywords we're missing, and write content to fill the gaps" | get_seo_config, research_trending_topics, save_blog_draft (or generate_content) | SEO audit → gap analysis → content creation chain | |
| D.7 | "I want to run an outbound campaign — find 20 prospects in fintech, score them, and email the top 5" | scan_leads(industry: "fintech", limit: "20"), score_leads, draft_outreach_email | Full outbound pipeline, leads saved to CRM | |
| D.8 | "Build me a landing page for our webinar and write 3 emails to drive registrations" | orchestrate_campaign (with landing page + email) or delegate_to_builder + delegate_to_marketing | Landing page AND email sequence created | |

---

## Category E: Ambiguous Requests (Multiple Valid Interpretations)

Jasper should pick the most useful interpretation and act, not ask endless clarifying questions.

| # | Prompt | Expected Tools | Tests | Result |
|---|--------|---------------|-------|--------|
| E.1 | "Content" | generate_content or save_blog_draft (ask what type is OK here) | One quick clarification OR reasonable default action | |
| E.2 | "Do something with my leads" | score_leads or get_platform_stats (check lead status) | Takes action, doesn't freeze | |
| E.3 | "Marketing stuff" | delegate_to_marketing or get_system_state | At minimum checks what marketing tools are available | |
| E.4 | "Make it better" | get_system_state → advice based on actual state | Asks ONE clarifying question at most | |
| E.5 | "What should I be doing right now?" | get_platform_stats, get_analytics, get_system_state | Checks real system state, gives data-driven recommendations | |

---

## Category F: Industry-Specific Jargon

Real users use marketing/sales jargon — Jasper must map it to tools.

| # | Prompt | Expected Tools | Tests | Result |
|---|--------|---------------|-------|--------|
| F.1 | "Run an ABM play targeting enterprise fintech" | scan_leads(industry: "fintech"), draft_outreach_email | Understands ABM = Account-Based Marketing = targeted lead outreach | |
| F.2 | "I need a nurture sequence for cold leads" | delegate_to_marketing or draft_outreach_email (multi-email) | Creates email drip sequence, not a single email | |
| F.3 | "Set up a drip campaign" | delegate_to_marketing or orchestrate_campaign (email-focused) | Multi-touch email sequence | |
| F.4 | "I need top-of-funnel content" | save_blog_draft or generate_content (educational/awareness content) | Understands TOFU = broad awareness content | |
| F.5 | "Pipeline is thin, need to fill it" | scan_leads, then actionable next steps | Lead generation, not a motivational speech | |
| F.6 | "What's our MQL to SQL conversion rate?" | get_analytics or get_platform_stats | Pulls real metrics if available | |
| F.7 | "Build me an outbound sequence with 5 touchpoints" | delegate_to_outreach or delegate_to_marketing | Multi-step outreach created, not just one email | |
| F.8 | "I need competitive intel on Vendasta" | scrape_website("vendasta.com") or research_competitors | Actual web scraping, never training data | |

---

## Category G: Error Paths and Edge Cases

Jasper should handle failures gracefully with real error messages.

| # | Prompt | Expected Tools | Tests | Result |
|---|--------|---------------|-------|--------|
| G.1 | "Post on Instagram" (not connected) | social_post(platform: "instagram") | Tool fires, returns real error about missing connection, no fake success | |
| G.2 | "Send an email to john@example.com" (no SendGrid) | Attempts tool call | Real error about missing API key, link to settings | |
| G.3 | "Generate an image of our product" (no Fal.ai key) | Attempts tool call | Real error about missing Fal.ai key, not "I can't do images" | |
| G.4 | "Call my top lead on the phone" (no Twilio number) | voice_agent or error | Real error about missing Twilio phone number | |
| G.5 | "Scrape https://thisdomaindoesnotexist12345.com" | scrape_website | Graceful error handling, real error message shown | |
| G.6 | "Create a campaign about..." then cancel mid-way | Mission cancel | Mission status → FAILED, "Cancelled by user" | |
| G.7 | "Do everything" (maximally vague) | get_system_state at minimum | Doesn't crash, makes a reasonable effort or asks one question | |

---

## Category H: Follow-Up and Contextual Requests

These test whether Jasper handles conversational context correctly.

| # | Prompt | Expected Tools | Tests | Result |
|---|--------|---------------|-------|--------|
| H.1 | *After B.6 (GoHighLevel research):* "Now write a blog post about why we're better" | save_blog_draft | Uses context from previous research, doesn't re-research | |
| H.2 | *After C.2 (HVAC leads):* "Enrich the first 3" | enrich_lead x3 | References leads from previous scan | |
| H.3 | *After C.6 (video):* "Looks good, generate it" | generate_video | Understands approval context, proceeds to generation | |
| H.4 | *After D.1 (lead pipeline):* "Great, now do the same for healthcare" | scan_leads(industry: "healthcare"), enrich_lead, draft_outreach_email | Repeats the same pipeline for new industry | |
| H.5 | *After any campaign:* "Add a TikTok post to that campaign" | social_post(platform: "tiktok", campaignId: previous) | Adds to existing campaign, doesn't create new one | |

---

## Category I: Conversational (No Tools Expected)

Jasper should NOT call tools for simple conversation.

| # | Prompt | Expected Tools | Tests | Result |
|---|--------|---------------|-------|--------|
| I.1 | "Hey Jasper, what's up?" | None | Conversational response, no tool calls | |
| I.2 | "Thanks, that was great" | None | Acknowledgment, no tools | |
| I.3 | "What can you do?" | None (or get_system_state for accuracy) | Capability overview, may optionally verify via tools | |
| I.4 | "Who built you?" | None | Identity response about SalesVelocity.ai | |
| I.5 | "Tell me a joke" | None | Brief response, no tools | |

---

## Scoring

| Grade | Criteria |
|-------|----------|
| **PASS** | Correct tools fired, zero pre-tool narration, useful response with links |
| **PARTIAL** | Right tools but with narration before them, OR missing one expected tool |
| **FAIL** | Wrong tools, collapsed into wrong tool, answered from training data, or narrated extensively before acting |

### Aggregate Targets

| Category | Target Pass Rate |
|----------|-----------------|
| A (Power User) | 100% |
| B (Casual User) | 90%+ |
| C (Terse) | 90%+ |
| D (Compound) | 85%+ |
| E (Ambiguous) | 75%+ |
| F (Jargon) | 85%+ |
| G (Error Paths) | 90%+ |
| H (Follow-Up) | 80%+ |
| I (Conversational) | 100% |

---

## Test Run Log

| Date | Tester | Prompts Tested | Pass | Partial | Fail | Notes |
|------|--------|---------------|------|---------|------|-------|
| | | | | | | |
