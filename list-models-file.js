const https = require('https');
const fs = require('fs');

const key = 'AIzaSyBoR3NM7GEto-GdV7t8Bcrh1LZlTRmSlZU';
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

const req = https.get(url, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        try {
            const data = JSON.parse(body);
            fs.writeFileSync('models.txt', JSON.stringify(data, null, 2));
            console.log('Models saved to models.txt');
        } catch (e) {
            console.error('Error parsing JSON:', e);
        }
    });
});

req.on('error', (e) => {
    console.error(`Error: ${e}`);
});
