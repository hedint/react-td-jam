import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";

const androidResDir = join(process.cwd(), "android", "app", "src", "main", "res");
const shmygIconSource = join(process.cwd(), "public", "assets", "guides", "shmyg", "shmyg-seed-approved-384.png");
const faviconPath = join(process.cwd(), "public", "favicon.png");

const backgroundColor = parseHexColor("#151923");
const iconAccentBackgroundColor = parseHexColor("#c8a76a");
const launcherForegroundSizes = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};
const launcherIconSizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

const source = PNG.sync.read(readFileSync(shmygIconSource));
const faviconSourceBounds = {
  left: 36,
  top: 32,
  right: 292,
  bottom: 250,
};

writePng(faviconPath, createIconPng({
  source,
  sourceBounds: faviconSourceBounds,
  size: 256,
  fillBackground: true,
  background: parseHexColor("#c8a76a"),
  fitRatio: 1.16,
  yOffsetRatio: 0.02,
}));

for (const [density, size] of Object.entries(launcherForegroundSizes)) {
  writePng(join(androidResDir, `mipmap-${density}`, "ic_launcher_foreground.png"), createIconPng({
    source,
    sourceBounds: faviconSourceBounds,
    size,
    fillBackground: false,
    fitRatio: 1.08,
    yOffsetRatio: 0.02,
  }));
}

for (const [density, size] of Object.entries(launcherIconSizes)) {
  const icon = createIconPng({
    source,
    sourceBounds: faviconSourceBounds,
    size,
    fillBackground: true,
    background: iconAccentBackgroundColor,
    fitRatio: 1.12,
    yOffsetRatio: 0.02,
  });

  writePng(join(androidResDir, `mipmap-${density}`, "ic_launcher.png"), icon);
  writePng(join(androidResDir, `mipmap-${density}`, "ic_launcher_round.png"), icon);
}

const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;

const splashScreenXml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated from public/assets/guides/shmyg/shmyg-seed-approved-384.png by scripts/generate-android-assets.mjs. -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/ic_launcher_background" />
    <item
        android:width="96dp"
        android:height="96dp"
        android:drawable="@mipmap/ic_launcher"
        android:gravity="center" />
</layer-list>
`;

const backgroundColorXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#c8a76a</color>
</resources>
`;

const files = new Map([
  [join(androidResDir, "drawable", "splash_screen.xml"), splashScreenXml],
  [join(androidResDir, "mipmap-anydpi-v26", "ic_launcher.xml"), adaptiveIconXml],
  [join(androidResDir, "mipmap-anydpi-v26", "ic_launcher_round.xml"), adaptiveIconXml],
  [join(androidResDir, "values", "ic_launcher_background.xml"), backgroundColorXml],
]);

for (const [filePath, content] of files) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, { encoding: "utf8" });
}

function createIconPng({
  source,
  sourceBounds,
  size,
  fillBackground,
  background = backgroundColor,
  fitRatio,
  yOffsetRatio,
}) {
  const png = new PNG({ width: size, height: size });
  const iconBackground = fillBackground ? background : { red: 0, green: 0, blue: 0, alpha: 0 };

  fillPng(png, iconBackground);

  const boundsWidth = sourceBounds.right - sourceBounds.left + 1;
  const boundsHeight = sourceBounds.bottom - sourceBounds.top + 1;
  const drawScale = Math.min((size * fitRatio) / boundsWidth, (size * fitRatio) / boundsHeight);
  const drawWidth = boundsWidth * drawScale;
  const drawHeight = boundsHeight * drawScale;
  const targetLeft = (size - drawWidth) / 2;
  const targetTop = (size - drawHeight) / 2 + size * yOffsetRatio;

  drawResized(source, sourceBounds, png, {
    left: targetLeft,
    top: targetTop,
    width: drawWidth,
    height: drawHeight,
  });

  return png;
}

function fillPng(png, color) {
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = color.red;
    png.data[index + 1] = color.green;
    png.data[index + 2] = color.blue;
    png.data[index + 3] = color.alpha;
  }
}

function drawResized(source, sourceBounds, target, targetBounds) {
  const sourceWidth = sourceBounds.right - sourceBounds.left + 1;
  const sourceHeight = sourceBounds.bottom - sourceBounds.top + 1;
  const startX = Math.max(0, Math.floor(targetBounds.left));
  const startY = Math.max(0, Math.floor(targetBounds.top));
  const endX = Math.min(target.width, Math.ceil(targetBounds.left + targetBounds.width));
  const endY = Math.min(target.height, Math.ceil(targetBounds.top + targetBounds.height));

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const sourceX = sourceBounds.left + ((x + 0.5 - targetBounds.left) / targetBounds.width) * sourceWidth;
      const sourceY = sourceBounds.top + ((y + 0.5 - targetBounds.top) / targetBounds.height) * sourceHeight;
      const sample = sampleBilinear(source, sourceX, sourceY);
      blendPixel(target, x, y, sample);
    }
  }
}

function sampleBilinear(png, x, y) {
  const clampedX = clamp(x, 0, png.width - 1);
  const clampedY = clamp(y, 0, png.height - 1);
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(png.width - 1, x0 + 1);
  const y1 = Math.min(png.height - 1, y0 + 1);
  const tx = clampedX - x0;
  const ty = clampedY - y0;
  const top = mixColor(readPixel(png, x0, y0), readPixel(png, x1, y0), tx);
  const bottom = mixColor(readPixel(png, x0, y1), readPixel(png, x1, y1), tx);

  return mixColor(top, bottom, ty);
}

function blendPixel(target, x, y, sourceColor) {
  const index = (y * target.width + x) * 4;
  const sourceAlpha = sourceColor.alpha / 255;
  const targetAlpha = target.data[index + 3] / 255;
  const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);

  if (outAlpha <= 0) {
    target.data[index] = 0;
    target.data[index + 1] = 0;
    target.data[index + 2] = 0;
    target.data[index + 3] = 0;
    return;
  }

  target.data[index] = Math.round((sourceColor.red * sourceAlpha + target.data[index] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  target.data[index + 1] = Math.round((sourceColor.green * sourceAlpha + target.data[index + 1] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  target.data[index + 2] = Math.round((sourceColor.blue * sourceAlpha + target.data[index + 2] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
  target.data[index + 3] = Math.round(outAlpha * 255);
}

function readPixel(png, x, y) {
  const index = (y * png.width + x) * 4;

  return {
    red: png.data[index],
    green: png.data[index + 1],
    blue: png.data[index + 2],
    alpha: png.data[index + 3],
  };
}

function mixColor(left, right, amount) {
  return {
    red: Math.round(lerp(left.red, right.red, amount)),
    green: Math.round(lerp(left.green, right.green, amount)),
    blue: Math.round(lerp(left.blue, right.blue, amount)),
    alpha: Math.round(lerp(left.alpha, right.alpha, amount)),
  };
}

function writePng(filePath, png) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, PNG.sync.write(png));
}

function parseHexColor(hex) {
  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16),
    alpha: 255,
  };
}

function lerp(left, right, amount) {
  return left + (right - left) * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
