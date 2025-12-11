const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow your Vercel domain
app.use(cors({
  origin: '*', // Change this to your Vercel domain after testing
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'BulkSMSBD Proxy'
  });
});

// Check balance
app.get('/api/balance', async (req, res) => {
  try {
    const response = await axios.get('http://bulksmsbd.net/api/getBalanceApi', {
      params: {
        api_key: process.env.BULKSMS_API_KEY
      }
    });

    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send single SMS
app.post('/api/send-sms', async (req, res) => {
  try {
    const { number, message, senderid } = req.body;

    if (!number || !message) {
      return res.status(400).json({
        success: false,
        error: 'Number and message are required'
      });
    }

    // Clean phone number
    let cleanNumber = number.toString().replace(/\D/g, '');
    if (cleanNumber.startsWith('0')) {
      cleanNumber = '88' + cleanNumber;
    } else if (!cleanNumber.startsWith('88')) {
      cleanNumber = '88' + cleanNumber;
    }

    const response = await axios.get('http://bulksmsbd.net/api/smsapi', {
      params: {
        api_key: process.env.BULKSMS_API_KEY,
        type: 'text',
        number: cleanNumber,
        senderid: senderid || process.env.BULKSMS_SENDER_ID,
        message: message
      }
    });

    // Handle both string and object responses from BulkSMSBD
    let code, errorMessage;
    if (typeof response.data === 'object' && response.data !== null) {
      code = response.data.response_code?.toString() || response.data.code?.toString() || 'unknown';
      errorMessage = response.data.error_message || response.data.message || '';
    } else {
      code = response.data.toString().trim();
    }

    const codeStr = code.toString();
    const statusMessage = errorMessage || getCodeMessage(codeStr);

    res.json({
      success: codeStr === '202',
      code: codeStr,
      message: statusMessage,
      data: response.data
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send bulk SMS
app.post('/api/send-sms-bulk', async (req, res) => {
  try {
    const { numbers, message, senderid } = req.body;

    // Validation
    if (!numbers || !Array.isArray(numbers) || !message) {
      return res.status(400).json({
        success: false,
        error: 'Numbers (array) and message are required'
      });
    }

    if (numbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Numbers array cannot be empty'
      });
    }

    // Limit bulk sends to prevent URL length issues (max 100 numbers per request)
    const MAX_BULK_COUNT = 100;
    if (numbers.length > MAX_BULK_COUNT) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${MAX_BULK_COUNT} numbers allowed per bulk request. Received ${numbers.length} numbers.`
      });
    }

    // Clean and validate phone numbers, filter out invalid ones
    const cleanNumbers = numbers
      .map(num => {
        if (!num) return null;
        let clean = num.toString().replace(/\D/g, '');
        if (!clean || clean.length < 10) return null; // Minimum 10 digits
        
        if (clean.startsWith('0')) return '88' + clean;
        if (!clean.startsWith('88')) return '88' + clean;
        return clean;
      })
      .filter(num => num !== null); // Remove invalid numbers

    if (cleanNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid phone numbers found in the array'
      });
    }

    // Join numbers with comma
    const numbersString = cleanNumbers.join(',');

    // Check URL length (rough estimate: each number ~13 chars + commas)
    // Most servers have 2048 char URL limit, we'll be conservative
    const estimatedUrlLength = numbersString.length + message.length + 200; // 200 for other params
    if (estimatedUrlLength > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Request too large. Reduce number of recipients or message length.'
      });
    }

    const response = await axios.get('http://bulksmsbd.net/api/smsapi', {
      params: {
        api_key: process.env.BULKSMS_API_KEY,
        type: 'text',
        number: numbersString,
        senderid: senderid || process.env.BULKSMS_SENDER_ID,
        message: message
      }
    });

    // Handle both string and object responses from BulkSMSBD
    let code, errorMessage;
    if (typeof response.data === 'object' && response.data !== null) {
      code = response.data.response_code?.toString() || response.data.code?.toString() || 'unknown';
      errorMessage = response.data.error_message || response.data.message || '';
    } else {
      code = response.data.toString().trim();
    }

    const codeStr = code.toString();
    const statusMessage = errorMessage || getCodeMessage(codeStr);

    res.json({
      success: codeStr === '202',
      code: codeStr,
      message: statusMessage,
      count: cleanNumbers.length,
      originalCount: numbers.length,
      invalidCount: numbers.length - cleanNumbers.length,
      data: response.data
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function getCodeMessage(code) {
  const codes = {
    '202': 'SMS Submitted Successfully',
    '1001': 'Invalid Number',
    '1002': 'Sender ID not correct/disabled',
    '1007': 'Balance Insufficient',
    '1032': 'IP Not whitelisted. Please contact BulkSMSBD to whitelist your Railway IP address.'
  };
  return codes[code] || `Error code: ${code}`;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SMS Proxy running on port ${PORT}`);
});
