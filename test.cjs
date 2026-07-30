const fs = require('fs');
const { JSDOM } = require('jsdom');
const code = fs.readFileSync('app.js', 'utf-8');
const dom = new JSDOM('<div id="app"></div><script>'+code+'</script>', { url: 'http://localhost:3000/#landing', runScripts: 'dangerously' });
console.log('App loaded', dom.window.document.body.innerHTML.substring(0, 100));
