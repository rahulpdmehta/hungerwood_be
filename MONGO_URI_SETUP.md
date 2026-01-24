# MongoDB Atlas Connection Setup

## Your MongoDB Atlas Connection String

Add this to your `backend/.env` file:

```
MONGO_URI=mongodb+srv://rahulkumarsobh_db_user:OVI0Kd2gx1ozBMOM@cluster0.oakwg8e.mongodb.net/hungerwood?retryWrites=true&w=majority
```

## Important Notes:

1. **Database Name**: I've added `hungerwood` as the database name. You can change this to any name you prefer.

2. **IP Whitelist (CRITICAL for Vercel)**: 
   
   **⚠️ Vercel serverless functions run from dynamic IP addresses. You MUST whitelist IPs in MongoDB Atlas.**
   
   **For Vercel Deployment (Required):**
   - Go to MongoDB Atlas Dashboard → https://cloud.mongodb.com/
   - Click **"Network Access"** in the left sidebar
   - Click **"Add IP Address"**
   - Click **"Allow Access from Anywhere"** (this adds `0.0.0.0/0`)
   - Click **"Confirm"**
   - **Wait 1-2 minutes** for changes to propagate
   - **Redeploy your Vercel function**
   
   **For Local Development:**
   - Click "Add Current IP Address" or use "0.0.0.0/0" (allows all IPs - less secure but good for testing)
   - Click "Confirm"
   
   **Why this is needed:**
   - Vercel functions run from multiple IP addresses that change
   - MongoDB Atlas blocks all connections by default for security
   - Without whitelisting, you'll see timeout errors like: `Operation 'users.findOne()' buffering timed out after 10000ms`

3. **Database User**: Make sure the user `rahulkumarsobh_db_user` has read/write permissions:
   - Go to "Database Access" in MongoDB Atlas
   - Find your user and ensure they have "Read and write to any database" or at least access to the `hungerwood` database

4. **Test Connection**: After adding to `.env`, restart your server and check if it connects successfully.

## Connection String Format:
```
mongodb+srv://[username]:[password]@[cluster].mongodb.net/[database]?retryWrites=true&w=majority
```
