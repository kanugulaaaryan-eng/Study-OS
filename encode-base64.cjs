const fs = require('fs');
const content = fs.readFileSync('test-doc.txt', 'utf8');
const base64 = Buffer.from(content).toString('base64');
console.log(base64);