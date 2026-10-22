/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require('sharp');
const fs = require('fs');

const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Deep Roast Background -->
  <rect width="512" height="512" rx="112" fill="#382215"/>
  
  <!-- Coffee Cup Icon -->
  <g transform="translate(106, 106) scale(12.5)" stroke="#FCFBF9" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
    <line x1="6" x2="6" y1="2" y2="4" />
    <line x1="10" x2="10" y1="2" y2="4" />
    <line x1="14" x2="14" y1="2" y2="4" />
  </g>
</svg>
`;

async function generate() {
  const svgBuffer = Buffer.from(svgIcon);

  // 1. Apple Touch Icon (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile('public/apple-touch-icon.png');
  console.log('Generated public/apple-touch-icon.png (180x180)');

  // 2. Apple Touch Icon Precomposed (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile('public/apple-touch-icon-precomposed.png');
  console.log('Generated public/apple-touch-icon-precomposed.png');

  // 3. PWA Icons
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile('public/icon-192.png');
  console.log('Generated public/icon-192.png');

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('public/icon-512.png');
  console.log('Generated public/icon-512.png');

  // 4. Update public/icons/cafe360.svg
  fs.writeFileSync('public/icons/cafe360.svg', svgIcon.trim());
  console.log('Updated public/icons/cafe360.svg');
}

generate().catch(console.error);
