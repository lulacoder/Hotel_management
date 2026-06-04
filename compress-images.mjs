import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

const outDir = 'public/assets';
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const images = [
  { input: 'assets/ChatGPT Image Jun 3, 2026, 12_33_17 PM (1).png', output: 'public/assets/mountain-lodge.webp' },
  { input: 'assets/ChatGPT Image Jun 3, 2026, 12_33_17 PM (2).png', output: 'public/assets/rustic-suite.webp' },
  { input: 'assets/ChatGPT Image Jun 3, 2026, 12_33_21 PM (3).png', output: 'public/assets/adventure-lodge.webp' },
];

for (const { input, output } of images) {
  console.log(`Converting: ${input} -> ${output}`);
  execSync(`npx -y sharp-cli -i "${input}" -o "${output}" -- resize 1200`, { stdio: 'inherit' });
  console.log(`Done: ${output}`);
}
console.log('All images compressed!');
