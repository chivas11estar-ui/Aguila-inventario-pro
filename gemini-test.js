const https = require('https');

const key = 'AIzaSyBoR3NM7GEto-GdV7t8Bcrh1LZlTRmSlZU';
const models = ['gemini-1.5-flash', 'gemini-pro', 'gemini-1.0-pro'];

async function testModel(model) {
    return new Promise((resolve) => {
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
                console.log(`\n--- Model: ${model} ---`);
                console.log(`Status: ${res.statusCode}`);
                console.log(`Response: ${body}`);
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error(`Model: ${model}, Error: ${e}`);
            resolve();
        });

        req.write(data);
        req.end();
    });
}

(async () => {
    for (const model of models) {
        await testModel(model);
    }
})();
