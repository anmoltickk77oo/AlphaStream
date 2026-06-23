const http = require('http');

const data = JSON.stringify({
  side: 'BUY',
  amountUSD: 1000
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/trade',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  let responseData = '';
  res.on('data', d => {
    responseData += d;
  });
  res.on('end', () => {
    console.log('RESPONSE:', responseData);
  });
});

req.on('error', error => {
  console.error('ERROR:', error);
});

req.write(data);
req.end();
