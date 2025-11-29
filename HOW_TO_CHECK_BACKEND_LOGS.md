# How to Check Backend Console Logs

## Step 1: Start Your Backend Server

Open a terminal/command prompt and run:

```bash
cd back
node index.js
```

You should see output like:
```
Database connected: C:\Users\Raf\Desktop\selfie-studio-1\back\reservations.db
Reservations table ready
API running on port 3000
Local: http://localhost:3000
Ready for ngrok tunnel or external connections
Bot is running...
```

## Step 2: Keep This Terminal Window Open

**This terminal window IS your backend console.** All logs will appear here.

## Step 3: What to Look For

When someone uses your Telegram Web App or website, you'll see logs like:

### When loading slots:
```
2025-01-XX - GET /slots/2025-01-15
{ query: { user_id: '123456789' }, body: 'no body' }
```

### When making a reservation:
```
Reservation request received: { date: '2025-01-15', slots: 2, name: 'John', phone: '123', user_id: '123456789' }
Reservation saved: 2025-01-15 10:00-10:30 for user 123456789
All 2 reservations saved successfully
```

### If there are errors:
```
Error saving reservation: [error details]
Database error saving reservation: [error]
```

## Step 4: Testing

1. **Keep the backend terminal open** (where you ran `node index.js`)
2. **Open your Telegram Web App** or website
3. **Try to reserve a slot**
4. **Watch the backend terminal** - you should see logs appear in real-time

## Troubleshooting

**If you don't see any logs:**
- The requests aren't reaching your backend
- Check if ngrok is running and forwarding correctly
- Check if the API_URL in script.js matches your ngrok URL

**If you see errors:**
- Read the error message in the console
- Check the database file exists and is writable
- Verify all dependencies are installed

## Quick Test

You can test if the backend is receiving requests by:
1. Opening your browser
2. Going to: `http://localhost:3000/test-db`
3. You should see: `{"success":true,"count":X,"message":"Database connection OK"}`
4. Check your backend console - you should see the GET request logged

