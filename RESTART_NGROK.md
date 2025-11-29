# How to Restart ngrok

## Step 1: Check if ngrok is running
Look for a terminal window running ngrok. If you don't see one, ngrok is not running.

## Step 2: Start ngrok
Open a new terminal/command prompt and run:

```bash
ngrok http 3000 --host-header=rewrite
```

**Important:** Use the `--host-header=rewrite` flag to bypass the warning page!

## Step 3: Copy the new HTTPS URL
You'll see output like:
```
Forwarding  https://abc123.ngrok-free.dev -> http://localhost:3000
```

Copy the HTTPS URL (the one starting with `https://`)

## Step 4: Update API_URL in script.js
1. Open `docs/script.js`
2. Find line with: `const API_URL = "https://unsponged-roseann-slackly.ngrok-free.dev";`
3. Replace with your new ngrok URL: `const API_URL = "https://YOUR-NEW-URL.ngrok-free.dev";`

## Step 5: Make sure backend is running
In another terminal, run:
```bash
cd back
node index.js
```

You should see:
```
API running on port 3000
```

## Step 6: Commit and push changes
```bash
git add docs/script.js
git commit -m "Update ngrok URL"
git push
```

## Step 7: Test
1. Wait a minute for GitHub Pages to update
2. Test in Telegram Web App
3. Check backend console for incoming requests

## Troubleshooting

**If ngrok URL keeps changing:**
- Free ngrok URLs change each time you restart
- Consider upgrading to ngrok paid plan for static domain
- Or deploy backend to cloud service (Railway, Render, Heroku)

**If backend not receiving requests:**
- Make sure both ngrok AND backend are running
- Check ngrok is forwarding to port 3000
- Verify API_URL matches your ngrok URL exactly

