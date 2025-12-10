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

    const code = response.data.toString().trim();

    res.json({
      success: code === '202',
      code: code,
      message: getCodeMessage(code),
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

    if (!numbers || !Array.isArray(numbers) || !message) {
      return res.status(400).json({
        success: false,
        error: 'Numbers (array) and message are required'
      });
    }

    const cleanNumbers = numbers.map(num => {
      let clean = num.toString().replace(/\D/g, '');
      if (clean.startsWith('0')) return '88' + clean;
      if (!clean.startsWith('88')) return '88' + clean;
      return clean;
    }).join(',');

    const response = await axios.get('http://bulksmsbd.net/api/smsapi', {
      params: {
        api_key: process.env.BULKSMS_API_KEY,
        type: 'text',
        number: cleanNumbers,
        senderid: senderid || process.env.BULKSMS_SENDER_ID,
        message: message
      }
    });

    const code = response.data.toString().trim();

    res.json({
      success: code === '202',
      code: code,
      message: getCodeMessage(code),
      count: numbers.length,
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
    '1032': 'IP Not whitelisted'
  };
  return codes[code] || `Error code: ${code}`;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SMS Proxy running on port ${PORT}`);
});
