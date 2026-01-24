# Vercel Deployment Setup

## Environment Variables

Set these in your Vercel project settings (Settings → Environment Variables):

### Required for Production:
- `ALLOWED_ORIGINS`: Comma-separated list of allowed frontend origins
  - Example: `https://your-frontend.vercel.app,http://localhost:3000,http://localhost:3001,http://localhost:5173`
  - Include all your frontend domains (production, staging, localhost)

### Optional (with defaults):
- `NODE_ENV`: Set to `production` for production
- `JWT_SECRET`: Your JWT secret key
- `JWT_EXPIRES_IN`: Token expiration (default: `30d`)
- `ADMIN_PHONE`: Admin phone number
- `ADMIN_NAME`: Admin name

## CORS Configuration

The backend now:
- ✅ Allows all localhost origins in development mode
- ✅ Allows requests with no origin (like curl, Postman, mobile apps)
- ✅ Respects `ALLOWED_ORIGINS` environment variable in production

## Testing

Test your API:
```bash
curl 'https://your-api.vercel.app/api/auth/send-otp' \
  -H 'Content-Type: application/json' \
  --data-raw '{"phone":"8564455455"}'
```

## Troubleshooting

If you get CORS errors:
1. Make sure `ALLOWED_ORIGINS` includes your frontend domain
2. Check that the origin matches exactly (including http/https and port)
3. For development, localhost origins are automatically allowed
