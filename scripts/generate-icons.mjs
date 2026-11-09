/**
 * Resizes the primary source icon into the 5 standard extension icon sizes
 * (16, 32, 48, 128, 256) into public/icon/.
 *
 * Source: assets/icon-source.png
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcImage = path.resolve(rootDir, 'assets/icon-source.png');
const outDir = path.resolve(rootDir, 'public/icon');

if (!existsSync(srcImage)) {
  console.error(`Source icon not found at: ${srcImage}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const targetSizes = [16, 32, 48, 128, 256];

console.log(`Generating icons from ${path.relative(rootDir, srcImage)}...`);

if (process.platform === 'win32') {
  // Use PowerShell with System.Drawing on Windows for high-quality bicubic downsampling
  const psCommands = [
    'Add-Type -AssemblyName System.Drawing',
    `$src = [System.Drawing.Image]::FromFile('${srcImage.replace(/'/g, "''")}')`,
    ...targetSizes.map(
      (s) => `
$bmp = New-Object System.Drawing.Bitmap ${s}, ${s}, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.DrawImage($src, 0, 0, ${s}, ${s})
$g.Dispose()
$dest = '${path.join(outDir, `${s}.png`).replace(/'/g, "''")}'
$bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "  -> Generated ${s}x${s} icon: $dest"
`
    ),
    '$src.Dispose()',
  ].join('\n');

  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', psCommands], {
      stdio: 'inherit',
    });
    console.log('✓ Icon generation complete.');
  } catch (error) {
    console.error('Failed to generate icons via PowerShell:', error);
    process.exit(1);
  }
} else {
  // Cross-platform fallback: sips (macOS) or ImageMagick (convert)
  for (const s of targetSizes) {
    const dest = path.join(outDir, `${s}.png`);
    try {
      if (process.platform === 'darwin') {
        execFileSync('sips', ['-z', String(s), String(s), srcImage, '--out', dest], {
          stdio: 'ignore',
        });
      } else {
        execFileSync('convert', [srcImage, '-resize', `${s}x${s}`, dest], {
          stdio: 'ignore',
        });
      }
      console.log(`  -> Generated ${s}x${s} icon: ${dest}`);
    } catch {
      console.error(`Error resizing to ${s}x${s}. Ensure 'convert' (ImageMagick) or 'sips' is installed.`);
      process.exit(1);
    }
  }
  console.log('✓ Icon generation complete.');
}
