# Sprint 21 – Registration & Payment Center

## Included

- Per-event public registration controls
- Registration open/close dates
- Capacity and waitlist configuration
- Base event fees
- Manual/pay-later and Stripe-ready provider settings
- Discount code management
- Payment, refund, and adjustment ledger
- Automatic updates to registration payment totals and statuses
- Public-safe registration event catalog RPC

## Stripe status

This sprint adds the database and UI configuration needed for Stripe, but it intentionally does not place secret Stripe keys in the browser. Live card processing requires a secure Supabase Edge Function or another trusted server endpoint to create Stripe Checkout sessions and receive webhook events.

## Migration

Apply:

`supabase/migrations/20260727120000_registration_payment_center.sql`
