import fs from 'fs';
import path from 'path';

function fixTracking(dirPath: string) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixTracking(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            // Remove tracking-tight or tracking-tighter entirely, 
            // as for arabic it looks bad. We can just replace them with empty string.
            if (content.includes('tracking-tight') || content.includes('tracking-tighter') || content.includes('tracking-widest')) {
                content = content.replace(/tracking-tighter/g, '');
                content = content.replace(/tracking-tight/g, '');
                content = content.replace(/tracking-widest/g, '');
                // also fix leading spaces where it was removed
                content = content.replace(/\s{2,}/g, ' '); 
                fs.writeFileSync(fullPath, content);
            }
        }
    }
}

fixTracking(path.join(process.cwd(), 'src'));
console.log('Fixed tracking issues');
