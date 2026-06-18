import https from 'https';
import fs from 'fs';
import path from 'path';

const BASE = 'D:\\Improve\\Project\\Mine\\Shimmer';
const OUT = BASE + '\\docs\\images';

const files = [
  { name: 'server-ai-service-2', file: BASE + '\\server\\src\\services\\ai.js', lang: 'javascript', startLine: 181, endLine: 463 },
];

function generate(name, code, lang) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      code: code,
      language: lang,
      theme: 'one-dark',
      backgroundColor: 'rgba(40,44,52,1)',
      windowTheme: 'none',
      dropShadow: false,
      exportSize: '1x',
      paddingHorizontal: '16px',
      paddingVertical: '16px',
      fontSize: 13,
      lineNumbers: true
    });

    console.log(`Sending ${name}: ${data.length} bytes`);

    const req = https.request({
      hostname: 'carbon.now.sh',
      path: '/api',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      },
      timeout: 60000
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode === 200) {
          const outpath = path.join(OUT, name + '.png');
          fs.writeFileSync(outpath, Buffer.concat(chunks));
          console.log('OK:', name, '(' + chunks.reduce((s, c) => s + c.length, 0) + ' bytes)');
        } else {
          const text = Buffer.concat(chunks).toString().slice(0, 500);
          console.log('FAIL:', name, 'status:', res.statusCode, text);
        }
        resolve();
      });
    });
    req.on('error', e => { console.log('ERR:', name, e.message); resolve(); });
    req.on('timeout', () => { req.destroy(); console.log('TIMEOUT:', name); resolve(); });
    req.write(data);
    req.end();
  });
}

(async () => {
  for (const f of files) {
    if (fs.existsSync(f.file)) {
      let code = fs.readFileSync(f.file, 'utf-8');
      const lines = code.split(/\r?\n/);
      if (f.startLine) {
        code = lines.slice(f.startLine - 1, f.endLine).join('\n');
      }
      console.log(`Generating ${f.name} (${code.length} chars, ${lines.length} total lines)...`);
      await generate(f.name, code, f.lang);
    } else {
      console.log('NOT FOUND:', f.file);
    }
  }
  console.log('All done');
})();
