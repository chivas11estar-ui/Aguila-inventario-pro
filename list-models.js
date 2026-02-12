const https = require('https');

const key = 'AIzaSyBoR3NM7GEto-GdV7t8Bcrh1LZlTRmSlZU';
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

console.log(`Listing models...`);

const req = https.get(url, (res) => {
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
