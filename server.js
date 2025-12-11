const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure axios with timeout and retry settings
const axiosConfig = {
  timeout: 30000, // 30 seconds timeout
  headers: {
    'User-Agent': 'BulkSMS-Proxy/1.0',
    'Connection': 'keep-alive'
  }
};

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
      ...axiosConfig,
      params: {
        api_key: process.env.BULKSMS_API_KEY
      }
    });

    res.json({ success: true, data: response.data });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    res.status(500).json({ success: false, error: errorMessage });
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

    // Detect Unicode and set appropriate type
    const smsConfig = getSmsTypeAndMaxLength(message);
    
    // Validate message length
    if (message.length > smsConfig.maxLength) {
      return res.status(400).json({
        success: false,
        error: `Message too long. Maximum ${smsConfig.maxLength} characters allowed for ${smsConfig.isUnicode ? 'Unicode (Bangla/English mixed)' : 'text'} messages. Current length: ${message.length}`
      });
    }

    const response = await axios.get('http://bulksmsbd.net/api/smsapi', {
      ...axiosConfig,
      params: {
        api_key: process.env.BULKSMS_API_KEY,
        type: smsConfig.type,
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
      isUnicode: smsConfig.isUnicode,
      maxLength: smsConfig.maxLength,
      data: response.data
    });

  } catch (error) {
    const errorMessage = getErrorMessage(error);
    res.status(500).json({ 
      success: false, 
      error: errorMessage,
      code: undefined,
      message: errorMessage
    });
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

    // Detect Unicode and set appropriate type
    const smsConfig = getSmsTypeAndMaxLength(message);
    
    // Validate message length
    if (message.length > smsConfig.maxLength) {
      return res.status(400).json({
        success: false,
        error: `Message too long. Maximum ${smsConfig.maxLength} characters allowed for ${smsConfig.isUnicode ? 'Unicode (Bangla/English mixed)' : 'text'} messages. Current length: ${message.length}`
      });
    }

    // Check URL length (rough estimate: each number ~13 chars + commas)
    // Most servers have 2048 char URL limit, we'll be conservative
    // Note: Unicode messages may be URL-encoded, so we need extra buffer
    const urlEncodedMessageLength = smsConfig.isUnicode ? message.length * 3 : message.length;
    const estimatedUrlLength = numbersString.length + urlEncodedMessageLength + 200; // 200 for other params
    if (estimatedUrlLength > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Request too large. Reduce number of recipients or message length.'
      });
    }

    const response = await axios.get('http://bulksmsbd.net/api/smsapi', {
      ...axiosConfig,
      params: {
        api_key: process.env.BULKSMS_API_KEY,
        type: smsConfig.type,
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
      isUnicode: smsConfig.isUnicode,
      maxLength: smsConfig.maxLength,
      data: response.data
    });

  } catch (error) {
    const errorMessage = getErrorMessage(error);
    res.status(500).json({ 
      success: false, 
      error: errorMessage,
      code: undefined,
      message: errorMessage
    });
  }
});

// Helper function to detect if message contains Unicode characters (Bangla, Arabic, etc.)
function containsUnicode(message) {
  // Check if message contains any non-ASCII characters
  // This includes Bangla (Bengali), Arabic, and other Unicode characters
  for (let i = 0; i < message.length; i++) {
    const charCode = message.charCodeAt(i);
    // ASCII range is 0-127, anything above is Unicode
    if (charCode > 127) {
      return true;
    }
  }
  return false;
}

// Helper function to determine SMS type and max length
function getSmsTypeAndMaxLength(message) {
  const hasUnicode = containsUnicode(message);
  return {
    type: hasUnicode ? 'unicode' : 'text',
    maxLength: hasUnicode ? 70 : 160, // Unicode SMS: 70 chars, GSM-7: 160 chars
    isUnicode: hasUnicode
  };
}

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

// Helper function to format error messages
function getErrorMessage(error) {
  if (error.code === 'ECONNRESET') {
    return 'Connection reset by BulkSMSBD server. Please try again. If the issue persists, the BulkSMSBD service may be temporarily unavailable.';
  }
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
    return 'Request timeout. The BulkSMSBD server took too long to respond. Please try again.';
  }
  if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
    return 'Cannot reach BulkSMSBD server. Please check your internet connection and try again.';
  }
  if (error.response) {
    // Server responded with error status
    return `BulkSMSBD API error: ${error.response.status} - ${error.response.statusText}`;
  }
  if (error.request) {
    // Request was made but no response received
    return 'No response from BulkSMSBD server. The service may be down or unreachable.';
  }
  // Other errors
  return error.message || 'Unknown error occurred while communicating with BulkSMSBD';
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SMS Proxy running on port ${PORT}`);
});
