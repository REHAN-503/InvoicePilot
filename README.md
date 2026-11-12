# InvoicePilot

An AI accounts-receivable agent for freelancers and small businesses, built for the PayPal AI Hackathon.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind + shadcn/ui
- Prisma + PostgreSQL (Render)
- Zod, @anthropic-ai/sdk
- AG Grid Community
- PayPal Invoicing API v2 + Webhooks (sandbox only)
- Deployed on Render

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or Render)
- PayPal Developer Sandbox account
- Anthropic API key

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# DATABASE_URL, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, ANTHROPIC_API_KEY, APP_BASE_URL

# Set up database
npx prisma migrate dev

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Verify the project

```bash
# Start dev server
npm run dev

# In another terminal, test health endpoint
curl http://localhost:3000/api/health
# Should return: {"ok":true}

# Run lint
npm run lint

# Run typecheck
npx tsc --noEmit
```

## Deployment (Render)

1. Connect your GitHub repo to Render
2. Create a PostgreSQL database on Render
3. Create a Web Service:
   - Build command: `npm install && npx prisma generate && npm run build`
   - Start command: `npm start`
4. Add environment variables in Render dashboard
5. Set up PayPal webhook URL: `https://your-app.onrender.com/api/webhooks/paypal`

## Project Structure

```
src/app/          # Pages and API routes
src/lib/paypal/   # PayPal client
src/lib/ai/       # AI agent, prompts, schemas
src/lib/db.ts     # Prisma client
src/components/   # UI components
prisma/schema.prisma  # Database schema
```

## License

MIT