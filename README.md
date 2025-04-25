# Hack the 6ix Landing API

API service for Hack the 6ix landing page functionality.

## Endpoints

### Subscribe to Mailing List

```
POST /api/subscribe
```

Adds an email address to the "Main Web Mailing List" on Mailtrain.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response:**
- Status: 200
- Body: `You have subscribed successfully!`

**Error Responses:**
- 400: Invalid email format
- 400: Already subscribed
- 500: Server error

### Send Contact Form Message

```
POST /api/contact
```

Sends a message via the contact form. Sends to the hello@hackthe6ix.com contact Google Group.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "message": "Hello, I have a question...",
  "captchaToken": "valid-captcha-token"
}
```

**Success Response:**
- Status: 200
- Body: `Your message has been sent!`

**Error Responses:**
- 400: Missing required fields
- 400: Invalid email format
- 400: Message length exceeded
- 400: Invalid or missing captcha token
- 500: Server error

## CORS Policy

- Only origins ending with `.hackthe6ix.com` or `https://hackthe6ix.com` are allowed
- Allowed methods: GET, HEAD, PUT, PATCH, POST, DELETE
