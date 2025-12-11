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

## Vercel Integration

### Environment Variable Setup

In your Vercel project, add the `SMS_PROXY_URL` environment variable:

**⚠️ IMPORTANT: The URL MUST include `https://` protocol**

```
SMS_PROXY_URL=https://bulksms-proxy-production.up.railway.app
```

**❌ WRONG:**
```
SMS_PROXY_URL=bulksms-proxy-production.up.railway.app
```

**✅ CORRECT:**
```
SMS_PROXY_URL=https://bulksms-proxy-production.up.railway.app
```

### Example Vercel API Route

**For Next.js App Router** (`app/api/sms/proxy/route.ts`):

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { number, message } = body;

    if (!number || !message) {
      return NextResponse.json(
        { error: 'Number and message are required' },
        { status: 400 }
      );
    }

    // Ensure URL has protocol
    const proxyUrl = process.env.SMS_PROXY_URL;
    if (!proxyUrl) {
      return NextResponse.json(
        { error: 'SMS_PROXY_URL not configured' },
        { status: 500 }
      );
    }

    // Ensure URL has https:// protocol
    const baseUrl = proxyUrl.startsWith('http') 
      ? proxyUrl 
      : `https://${proxyUrl}`;

    const response = await fetch(`${baseUrl}/api/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ number, message }),
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json(
        { error: data.message || 'Failed to send SMS' },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Unicode/Bangla Support

✅ **The SMS system automatically handles Bangla and English mixed messages!**

### How It Works

- **Automatic Detection**: The system automatically detects if your message contains Unicode characters (Bangla, Arabic, etc.)
- **Auto Type Selection**: 
  - If Unicode detected → Uses `type: 'unicode'` (supports Bangla/English mixed)
  - If ASCII only → Uses `type: 'text'` (standard SMS)
- **Message Length Limits**:
  - **Unicode messages**: Maximum 70 characters per SMS
  - **Text messages**: Maximum 160 characters per SMS

### Examples

**English only:**
```json
{
  "number": "01712345678",
  "message": "Hello, this is a test message"
}
```

**Bangla only:**
```json
{
  "number": "01712345678",
  "message": "আপনার OTP হল 123456"
}
```

**Bangla + English mixed:**
```json
{
  "number": "01712345678",
  "message": "Your OTP is 123456. এটি 5 মিনিটের জন্য বৈধ।"
}
```

**No configuration needed!** The system handles everything automatically.

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

### Response Format

The API response includes Unicode detection info:
```json
{
  "success": true,
  "code": "202",
  "message": "SMS Submitted Successfully",
  "isUnicode": true,
  "maxLength": 70,
  "data": {...}
}
```

## Troubleshooting

### Error: "Failed to parse URL" or "Invalid URL"

**Problem:** The `SMS_PROXY_URL` environment variable is missing the `https://` protocol.

**Solution:**
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Update `SMS_PROXY_URL` to include `https://`:
   ```
   https://bulksms-proxy-production.up.railway.app
   ```
4. Redeploy your Vercel app

**Alternative:** Update your Vercel API route code to automatically add the protocol (see example above).

### Error: "IP Not whitelisted" (Code 1032)

**Problem:** BulkSMSBD requires IP whitelisting. Your Railway IP address needs to be whitelisted.

**Solution:**
1. Find your Railway IP address:
   ```bash
   # Windows (PowerShell/CMD)
   nslookup bulksms-proxy-production.up.railway.app
   
   # Mac/Linux
   dig bulksms-proxy-production.up.railway.app +short
   ```
   Or check Railway's network settings in the dashboard.

2. Contact BulkSMSBD support:
   - Call or email BulkSMSBD support
   - Provide your Railway IP address (e.g., `162.220.232.176`)
   - Request IP whitelisting for your account
   - Wait for confirmation (usually 1-24 hours)

3. Once whitelisted, the error should resolve automatically.

**Note:** The proxy service now properly handles object responses from BulkSMSBD API and will show the actual error message instead of `[object Object]`.

### Error: "read ECONNRESET" or Connection Reset

**Problem:** The connection to BulkSMSBD server was reset unexpectedly. This can happen due to:
- Network instability
- BulkSMSBD server closing connections
- Request timeout
- Server overload

**Solution:**
1. The proxy now includes:
   - 30-second timeout for all requests
   - Better error handling and retry-friendly error messages
   - Connection keep-alive headers

2. If the error persists:
   - Wait a few seconds and try again (temporary network issue)
   - Check if BulkSMSBD service is operational
   - Verify your Railway IP is whitelisted (error 1032)
   - For bulk sends, try sending in smaller batches

3. The error message will now be more descriptive:
   - `ECONNRESET`: "Connection reset by BulkSMSBD server. Please try again..."
   - `ETIMEDOUT`: "Request timeout. The BulkSMSBD server took too long to respond..."
   - Other connection errors are also handled with clear messages

### Railway deployment failed

- Check Railway's "Deployments" tab for error logs
- Ensure `package.json` has the correct start script
- Verify all environment variables are set in Railway dashboard
