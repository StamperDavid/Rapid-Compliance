/**
 * Product Knowledge for Our AI Sales Agent
 * Training data about our own platform
 */

export const OUR_PRODUCT_KNOWLEDGE = `
# AI Sales Platform - Product Knowledge Base

## What We Do
We provide an AI-powered sales platform that combines a trainable AI sales agent, CRM, workflow automation, and e-commerce into one powerful solution.

## Core Value Proposition
"Replace your entire sales team with an AI agent that works 24/7, never forgets a customer, and gets smarter with every conversation."

## Target Customers
- Small to medium businesses (10-500 employees)
- E-commerce stores
- SaaS companies
- Service businesses
- B2B companies
- Anyone who needs to qualify leads, answer questions, and close deals online

## Key Differentiators

### 1. Trainable AI Agent (Not a Generic Chatbot)
- Custom-trained on YOUR specific business
- Upload product docs, pricing, FAQs
- Practice in training sandbox
- Give feedback and watch it improve
- Deploy when ready

### 2. Customer Memory System
- Remembers every conversation
- Recognizes returning customers
- Builds long-term relationships
- Tracks preferences and objections
- Perfect continuity across sessions

### 3. Built-in CRM
- Fully customizable objects
- 20+ field types
- Relationships and formulas
- Multiple views (Kanban, Calendar, Table)
- No need for separate CRM

### 4. E-Commerce Integration
- Accept payments in-chat
- Stripe, PayPal, Square
- Shopping cart
- Order management
- Embed anywhere

### 5. Workflow Automation
- Auto-follow-ups
- Lead scoring
- Task creation
- Slack/email notifications
- Complex triggers and conditions

### 6. White-Labeling
- Your brand, your colors
- Custom domain
- Remove our branding
- Complete customization

## Pricing Plans

### Starter - $49/month ($470/year)
- 1 AI sales agent
- 1,000 conversations/month
- Basic CRM (1,000 records)
- Email support
- Standard training
- Website embed
- Basic analytics

### Professional - $149/month ($1,430/year)
- 3 AI sales agents
- 10,000 conversations/month
- Advanced CRM (10,000 records)
- Priority support
- Advanced training & feedback
- Custom domain
- Workflow automation
- Advanced analytics
- Integrations
- E-commerce features

### Enterprise - Custom Pricing
- Unlimited AI agents
- Unlimited conversations
- Unlimited CRM records
- Dedicated support
- Custom training program
- White-label options
- Custom integrations
- SLA guarantee
- Advanced security
- Multi-region deployment

## Free Trial
- 14 days free
- No credit card required
- Full Professional plan access
- Cancel anytime

## Overage Pricing
- Conversations: $0.05 per additional conversation
- CRM records: $0.01 per additional record
- Or upgrade to a higher plan

## Setup Time
- 5 minutes to complete onboarding wizard
- 30 minutes to train your agent
- Deploy immediately after training
- Total: Less than 1 hour to go live

## Common Objections & Responses

### "This sounds too good to be true"
"I understand the skepticism. That's why we offer a 14-day free trial with no credit card required. Try it risk-free and see for yourself. Our own website uses our AI agent - the one you're chatting with right now!"

### "How is this different from a chatbot?"
"Great question. Traditional chatbots follow scripts and forget everything. Our AI agent is TRAINED on your specific business, remembers every customer interaction, and actually improves over time with your feedback. It's the difference between a robot reading a script and a sales rep who knows your business inside and out."

### "What if it gives wrong information?"
"We've built in multiple safeguards: 1) You train it on your exact information, 2) It only answers based on your knowledge base, 3) It escalates to humans when unsure, 4) You review and improve it continuously. Plus, you can set it to training mode until you're 100% confident."

### "This seems expensive"
"Let's break it down. The Professional plan at $149/month is less than hiring one sales rep for even 2 hours per month. But your AI agent works 24/7/365, never calls in sick, and handles unlimited conversations. Most customers see ROI in the first month."

### "We already have a CRM"
"No problem! We integrate with major CRMs like Salesforce and HubSpot. Or, you can use our built-in CRM and migrate your data. Many customers actually prefer our CRM because it's more flexible and customizable."

### "How long does setup take?"
"Most customers are fully live within 1 hour:
- 5 minutes: Complete onboarding wizard
- 30 minutes: Train your agent in our sandbox
- 2 minutes: Get embed code and add to website
- Done! Your AI agent is now working 24/7."

### "What if I need help?"
"We offer email support on all plans, priority support on Professional, and dedicated support on Enterprise. Plus, our documentation is comprehensive, and we have a growing community of users."

### "Can I cancel anytime?"
"Absolutely. No long-term contracts. Cancel anytime and your subscription ends at the current billing period. We'll even help you export your data if you need it."

## Key Features Explained

### AI Agent Training
1. Answer questions about your business (onboarding wizard)
2. Upload docs (PDFs, pricing sheets, FAQs)
3. Practice in training sandbox (role-play as customer)
4. Give feedback after each session
5. Agent improves based on your feedback
6. Deploy when it scores 90%+

### Customer Memory
- Every conversation saved
- Preferences tracked
- Purchase history
- Sentiment analysis
- Context flags (VIP, price sensitive, etc.)
- Agent notes and insights

### CRM Customization
- Create any object type (Leads, Deals, Properties, etc.)
- 20+ field types (text, number, dropdown, formula, AI-generated)
- Build relationships between objects
- Custom views for each team member
- Permissions and access control

### Workflow Automation
- Triggers: Record created/updated, schedule, webhook
- Actions: Email, SMS, create record, HTTP request, AI agent
- Conditions and branching
- Error handling and retries

### E-Commerce
- Product catalog from CRM
- Shopping cart in-chat
- Payment processing
- Inventory tracking
- Order management
- Shipping calculations

## Integration Options
- **Stripe** - Payments
- **Slack** - Notifications
- **Gmail/Google Workspace** - Email
- **Google Calendar** - Scheduling
- **QuickBooks/Xero** - Accounting
- **Zapier** - Connect to 5,000+ apps
- **Webhooks** - Custom integrations

## Security & Compliance
- SOC 2 Type II certified
- GDPR compliant
- SOC 2 Type II certified
- Data encryption at rest and in transit
- Regular security audits
- Role-based access control

## Support & Resources
- Comprehensive documentation
- Video tutorials
- Community forum
- Email support (all plans)
- Priority support (Professional+)
- Dedicated support manager (Enterprise)

## Success Stories
- TechStart Inc: 300% increase in lead conversion
- GrowthLabs: Saved 20 hours/week on lead qualification
- CloudCorp: Up and running in under 1 hour

## Next Steps for Prospects
1. **Start Free Trial** - No credit card, full access
2. **Book Demo** - See it in action with our team
3. **Contact Sales** - Custom Enterprise solutions
`;

export const OUR_AGENT_PERSONA = {
  name: "Alex",
  tone: "professional yet friendly",
  greeting: "Hi! I'm Alex, an AI sales assistant for the AI Sales Platform. I can answer any questions about our platform, pricing, or how to get started. What would you like to know?",
  closingMessage: "Thanks for chatting with me! Ready to start your free trial? I can help you get set up right now, or feel free to reach out anytime.",
  objectives: [
    "Qualify leads by understanding their needs",
    "Explain features and benefits clearly",
    "Address objections with empathy",
    "Guide prospects to free trial signup",
    "Schedule demos for Enterprise prospects"
  ],
  escalationRules: [
    "Prospect asks for custom pricing or contracts → Offer to connect with sales team",
    "Prospect has technical questions beyond knowledge base → Offer to connect with support",
    "Prospect is frustrated or upset → Immediately escalate to human",
    "Prospect asks for features we don't have → Be honest, take feature request"
  ]
};

export const OUR_COMMON_QUESTIONS = [
  {
    q: "How much does it cost?",
    a: "We have three plans: Starter ($49/month), Professional ($149/month), and Enterprise (custom pricing). All plans include a 14-day free trial with no credit card required. Would you like me to explain what's included in each plan?"
  },
  {
    q: "How long does setup take?",
    a: "Most customers are fully live within 1 hour! It's three simple steps: 1) Complete our 5-minute onboarding wizard, 2) Train your agent for 30 minutes in our sandbox, 3) Copy-paste one line of code to embed it on your website. Want to start your free trial now?"
  },
  {
    q: "What makes this different from other chatbots?",
    a: "Great question! Unlike generic chatbots, our AI agent is custom-trained on YOUR specific business. It remembers every customer interaction (we call it Customer Memory), and it actually improves over time based on your feedback. It's like having a top sales rep who never forgets and works 24/7."
  },
  {
    q: "Can it integrate with our existing CRM?",
    a: "Yes! We integrate with Salesforce, HubSpot, and other major CRMs. Or you can use our built-in CRM, which many customers prefer because it's more flexible. Would you like to hear more about our CRM features?"
  },
  {
    q: "Is there a free trial?",
    a: "Absolutely! 14 days free, no credit card required. You get full access to all Professional plan features. If you love it (which most people do!), you can upgrade. If not, your trial simply expires. Want me to help you get started?"
  }
];





