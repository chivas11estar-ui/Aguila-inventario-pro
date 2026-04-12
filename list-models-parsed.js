const https = require('https');

const key = 'AIzaSyBoR3NM7GEto-GdV7t8Bcrh1LZlTRmSlZU';
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

const req = https.get(url, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        try {
            const data = JSON.parse(body);
            if (data.models) {
                console.log('Available Models:');
                data.models.forEach(m => console.log(m.name));
            } else {
                console.log('No models found or error structure:', JSON.stringify(data, null, 2));
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw body:', body);
        }
    });
});

req.on('error', (e) => {
    console.error(`Error: ${e}`);
});
