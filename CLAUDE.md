# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Novità is a telemedicine and home care platform demo built with React. It enables patients to manage medical consultations, prescriptions, and medication orders. The app is in Portuguese (Brazilian).

## Development Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

## Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State**: TanStack Query (React Query) for server state
- **Routing**: React Router v6
- **Backend**: Supabase (auth, database)
- **Forms**: React Hook Form + Zod validation

## Architecture

### Path Aliases
Use `@/` to import from `src/` directory (configured in tsconfig.json and vite.config.ts).

### Directory Structure
- `src/pages/` - Route components (Index, Dashboard, Auth, etc.)
- `src/components/ui/` - shadcn/ui primitives (auto-generated, avoid editing directly)
- `src/components/` - Custom components (Header, NavLink, layout/)
- `src/integrations/supabase/` - Supabase client and auto-generated types
- `src/types/` - Custom TypeScript types (prescription.ts)
- `src/data/` - Mock data for development
- `src/hooks/` - Custom React hooks
- `src/lib/utils.ts` - Utility functions (cn for className merging)

### Key Patterns

**Supabase Integration**: Import the typed client from `@/integrations/supabase/client`. Database types are auto-generated in `types.ts`.

**Authentication Flow**: Uses Supabase Auth with `onAuthStateChange` listener. Protected routes redirect to `/auth` when unauthenticated.

**Component Styling**: Use the `cn()` utility from `@/lib/utils` to merge Tailwind classes. Follow shadcn/ui patterns for component variants.

### Database Schema (Supabase)
Key tables: `profiles`, `prescriptions`, `medications`, `cart_items`, `subscription_plans`, `user_subscriptions`, `dependents`

Subscription plan types: bronze, prata, ouro, platina, coletivo, diamante

## Cielo Payment Integration

The project integrates with Cielo E-commerce API for payment processing.

### Files Structure
- `src/integrations/cielo/` - Cielo API client, types, and configuration
  - `client.ts` - Main client (auto-switches to mock when no credentials)
  - `mockClient.ts` - Mock client for local testing without API credentials
  - `types.ts` - TypeScript types for API requests/responses
  - `config.ts` - URLs and test card configurations
- `src/services/paymentService.ts` - High-level payment functions
- `src/components/checkout/` - Payment UI components
- `src/pages/CheckoutSubscription.tsx` - Subscription checkout page
- `src/pages/CheckoutMedication.tsx` - Medication checkout page

### Mock Mode
When Cielo credentials are not configured, the client automatically uses a mock implementation that simulates the API behavior locally. The mock:
- Simulates network delay (800-1500ms)
- Uses the last digit of card number to determine success/failure
- Stores transactions in memory

### Key Functions (paymentService.ts)
- `processMedicationPayment()` - Single payment for medication orders
- `createSubscription()` - Recurring payment for subscription plans
- `cancelSubscription()` - Deactivate a recurring payment
- `updateSubscriptionAmount()` - Change subscription price (upgrade/downgrade)

### Checkout Flow
- Plans page → Auth (with plan param) → `/checkout/subscription?plan=tipo`
- Cart → Checkout → `/checkout/medication`

### Test Cards
The last digit determines the transaction result:
- Ends in 0, 1, 4: Authorized
- Ends in 2: Denied
- Ends in 3: Expired card

Example: `4024007153763191` (Visa, authorized)

### Sandbox Registration (Optional)
For real API testing:
1. Access: https://cadastrosandbox.cieloecommerce.cielo.com.br/
2. Create a test account
3. Receive MerchantId and MerchantKey by email

## Environment Variables

Required in `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Optional (Cielo - uses mock if not set):
- `VITE_CIELO_MERCHANT_ID` - Cielo store identifier
- `VITE_CIELO_MERCHANT_KEY` - Cielo API key
- `VITE_CIELO_SANDBOX` - Set to "true" for sandbox environment
