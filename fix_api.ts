import fs from 'fs';
import path from 'path';

const apiPath = path.join(process.cwd(), 'src', 'lib', 'api.ts');
let content = fs.readFileSync(apiPath, 'utf8');

// replace 'profiles' with 'users'
content = content.replace(/\.from\('profiles'\)/g, `.from('users')`);

// replace 'product_categories' with 'categories'
content = content.replace(/\.from\('product_categories'\)/g, `.from('categories')`);

// replace 'submissions' with 'quiz_submissions'
content = content.replace(/\.from\('submissions'\)/g, `.from('quiz_submissions')`);

fs.writeFileSync(apiPath, content);
console.log('Fixed api.ts');
