const https = require('https');

const key = 'AIzaSyBoR3NM7GEto-GdV7t8Bcrh1LZlTRmSlZU';
const model = 'gemini-pro';

console.log(`Testing ${model}...`);

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
const data = JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] });

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(url, options, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Response: ${body}`);
    });
});

req.on('error', (e) => {
    console.error(`Error: ${e}`);
});

req.write(data);
req.end();
