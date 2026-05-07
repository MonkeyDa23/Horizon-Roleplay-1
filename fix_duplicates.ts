import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src', 'fallback_translations.ts');
const content = fs.readFileSync(file, 'utf8');

// Instead of trying to parse TS with regex easily, let's just make it a clean obj.
const lines = content.split('\n');

const keyMap = new Map();
const newLines = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if it's a key line
    const match = line.match(/^\s*'?([a-zA-Z0-9_]+)'?:\s*\{/);
    if (match) {
        const key = match[1];
        if (keyMap.has(key)) {
            // Remove previous occurrence by replacing it or just skip this one.
            // Actually we want the last one to be kept usually since we just appended them,
            // so we will just completely re-read everything!
        }
    }
}
// Actually, let's just use regex to replace the duplicate definitions. 
