const fs = require('fs');
let content = fs.readFileSync('public/app.js', 'utf8');

// Remove escaped backticks and interpolation
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$\{/g, '${');

// Check for double escaped newlines that should just be \n
content = content.replace(/\\\\n/g, '\\n');

fs.writeFileSync('public/app.js', content, 'utf8');
console.log('Fixed syntax in app.js');
