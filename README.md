# BulkSMSBD Proxy

Proxy server for BulkSMSBD API with static IP.

## Endpoints
- GET / - Health check
- GET /api/balance - Check balance
- POST /api/send-sms - Send single SMS
- POST /api/send-sms-bulk - Send bulk SMS

## Environment Variables
- `BULKSMS_API_KEY` - Your BulkSMSBD API key
- `BULKSMS_SENDER_ID` - Your default sender ID
- `PORT` - Server port (default: 3000)

## Local Development
```bash
npm install
npm start
```

## Deployment to Railway
1. Create a new project on Railway
2. Connect your GitHub repository
3. Add environment variables in Railway dashboard
4. Railway will automatically deploy

## API Usage Examples

### Check Balance
```bash
curl https://your-railway-app.railway.app/api/balance
```

### Send Single SMS
```bash
curl -X POST https://your-railway-app.railway.app/api/send-sms \
  -H "Content-Type: application/json" \
  -d '{
    "number": "01712345678",
    "message": "Test message"
  }'
```

### Send Bulk SMS
```bash
curl -X POST https://your-railway-app.railway.app/api/send-sms-bulk \
  -H "Content-Type: application/json" \
  -d '{
    "numbers": ["01712345678", "01812345678"],
    "message": "Test bulk message"
  }'
```
