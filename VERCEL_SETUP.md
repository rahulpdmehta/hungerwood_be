# Vercel Deployment Setup

## ⚠️ Important: JSON File Storage Limitations

**Vercel serverless functions have a read-only filesystem** (except `/tmp`). The current setup uses JSON files stored in `/tmp`, which means:

- ✅ **Can read/write**: JSON files work in `/tmp` directory
- ⚠️ **Not persistent**: Data in `/tmp` is **ephemeral** and may be cleared:
  - Between function invocations
  - On cold starts
  - After deployments
  - When the function container is recycled

### For Production Use:

**JSON files are NOT suitable for production on Vercel.** You should use a proper database:

1. **MongoDB Atlas** (Free tier available)
   - Already configured in your codebase (`config/db.js`)
   - Just set `MONGO_URI` environment variable

2. **Other Options:**
   - PostgreSQL (Supabase, Neon, Railway)
   - MySQL (PlanetScale)
   - Redis (Upstash)
   - DynamoDB (AWS)

### Current Setup (Development/Testing Only):

The app currently uses `/tmp/hungerwood-data` for JSON files on Vercel. This works for:
- Testing and development
- Temporary data
- Non-critical operations

**Data will be lost** when:
- Function goes cold
- New deployment happens
- Container is recycled

## Environment Variables

Set these in your Vercel project settings (Settings → Environment Variables):

### Required for Production:
- `ALLOWED_ORIGINS`: Comma-separated list of allowed frontend origins
  - Example: `https://your-frontend.vercel.app,http://localhost:3000,http://localhost:3001,http://localhost:5173`
  - Include all your frontend domains (production, staging, localhost)

### For Database (Recommended):
- `MONGO_URI`: MongoDB connection string
  - Example: `mongodb+srv://username:password@cluster.mongodb.net/hungerwood?retryWrites=true&w=majority`
  - Get free MongoDB Atlas: https://www.mongodb.com/cloud/atlas

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

## Migrating to MongoDB

To use MongoDB instead of JSON files:

1. Get a free MongoDB Atlas account: https://www.mongodb.com/cloud/atlas
2. Create a cluster and get connection string
3. Set `MONGO_URI` in Vercel environment variables
4. Update your code to use MongoDB models (already available in `src/models/`)
5. Remove JSON file dependencies
