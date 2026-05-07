const fs = require('fs');

const data = fs.readFileSync('src/fallback_translations.ts', 'utf8');

// The file has export const fallbackTranslations: Translations = { ... };
const match = data.match(/export const fallbackTranslations: Translations = {([\s\S]*?)};\n/);
if (!match) {
    console.error("Match not found");
    process.exit(1);
}

const body = match[1];
const lines = body.split('\n');

const keys = new Set();
const outLines = [];

// We go backwards to keep the newest override.
for (let i = lines.length - 1; i >= 0; i--) {
    let line = lines[i];
    const keyMatch = line.match(/^\s*(?:'|")?([a-zA-Z0-9_]+)(?:'|")?\s*:/);
    if (keyMatch) {
        const key = keyMatch[1];
        if (!keys.has(key)) {
            keys.add(key);
            outLines.unshift(line);
        }
    } else {
        outLines.unshift(line);
    }
}

const newFile = data.replace(body, outLines.join('\n'));
fs.writeFileSync('src/fallback_translations.ts', newFile);
console.log("Deduplicated");
