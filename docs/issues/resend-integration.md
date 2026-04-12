# Resend Email Integration

## Summary
Add server-side email delivery with Resend for transactional messages such as account verification, password reset support, therapist application updates, and admin notifications.

## Why this is needed
- The project already sends auth emails through Supabase and needs a clearer branded email path.
- The live site handles personal data, so the API key must never be shipped in frontend code.
- Email delivery should happen server-side, ideally through a Supabase Edge Function or another backend service.

## Suggested implementation
Use the Resend SDK in a server-side function, and store the API key in an environment secret.

```javascript
import { Resend } from 'resend';

const resend = new Resend('re_xxxxxxxxx'); // replace with the real API key

await resend.emails.send({
  from: 'onboarding@resend.dev',
  to: 'admin.nawe@gmail.com',
  subject: 'Hello World',
  html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
});
```

## Important
- Replace `re_xxxxxxxxx` with the real Resend API key.
- Do not commit the API key to git.
- Do not call Resend directly from the React frontend.
- Use a verified sender domain before moving to production.

## Acceptance criteria
- A server-side function can send at least one branded transactional email.
- API key is stored in env/secret management, not in client code.
- Basic error handling and logging are included.
- The sender address matches the verified domain.
