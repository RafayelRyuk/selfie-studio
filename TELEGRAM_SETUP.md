# Telegram Web App Setup Guide

## Problem
The Telegram Web App runs on users' devices and cannot access `localhost:3000` on your PC. You need to expose your local backend to the internet.

## Solution: Use ngrok (Recommended)

### Step 1: Install ngrok
1. Download ngrok from: https://ngrok.com/download
2. Extract the executable
3. (Optional) Add ngrok to your PATH for easier access

### Step 2: Start your backend
```bash
cd back
node index.js
```
You should see: "API running on port 3000"

### Step 3: Start ngrok tunnel
Open a new terminal and run:
```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

### Step 4: Copy the ngrok URL
Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Step 5: Update the frontend
1. Open `docs/script.js`
2. Find the line: `const PRODUCTION_API_URL = "https://your-backend-server.com";`
3. Replace it with your ngrok URL: `const PRODUCTION_API_URL = "https://abc123.ngrok.io";`
4. Save the file

### Step 6: Deploy updated frontend
Commit and push the changes to GitHub so the Telegram Web App uses the new URL.

### Step 7: Test
1. Open your Telegram bot
2. Click the calendar button
3. Try to reserve a slot
4. Check the browser console (if accessible) for any errors

## Important Notes

⚠️ **ngrok Free Plan Limitations:**
- The URL changes every time you restart ngrok (unless you have a paid plan)
- You'll need to update `PRODUCTION_API_URL` each time
- The tunnel closes when you close ngrok

💡 **For Production:**
Consider deploying your backend to:
- Heroku (free tier available)
- Railway (free tier available)
- Render (free tier available)
- DigitalOcean
- Your own VPS

## Alternative: Use ngrok with a static domain (Paid)

If you have ngrok paid plan, you can use a static domain:
```bash
ngrok http 3000 --domain=your-static-domain.ngrok.io
```

Then set: `const PRODUCTION_API_URL = "https://your-static-domain.ngrok.io";`

## Troubleshooting

**Backend not accessible:**
- Make sure your backend is running on port 3000
- Check Windows Firewall allows connections on port 3000
- Verify ngrok is forwarding correctly

**CORS errors:**
- The backend already has CORS enabled, so this shouldn't be an issue

**URL not updating:**
- Make sure you've committed and pushed changes to GitHub
- Clear browser cache or use incognito mode
- Check that GitHub Pages has deployed the latest version

