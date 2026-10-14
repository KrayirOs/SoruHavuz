export function qualityLabel(score) {
  if (score >= .9) return "Excellent";
  if (score >= .75) return "Good";
  if (score >= .5) return "Warning";
  return "Poor";
}

export function analyseImageQuality(imageData, width, height) {
  const data = imageData.data;
  let sum = 0, sumSq = 0, laplacianEnergy = 0, samples = 0;
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    const i = (y * width + x) * 4;
    const value = (.2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2]) / 255;
    gray[y * width + x] = value; sum += value; sumSq += value * value; samples++;
  }
  for (let y = 2; y < height - 2; y += 2) for (let x = 2; x < width - 2; x += 2) {
    const center = gray[y * width + x];
    const lap = 4 * center - gray[(y - 2) * width + x] - gray[(y + 2) * width + x] - gray[y * width + x - 2] - gray[y * width + x + 2];
    laplacianEnergy += lap * lap;
  }
  const brightness = sum / Math.max(samples, 1);
  const contrast = Math.sqrt(Math.max(0, sumSq / Math.max(samples, 1) - brightness * brightness));
  const blur = Math.max(0, Math.min(1, 1 - laplacianEnergy / Math.max(1, samples) / .08));
  const resolution = width * height >= 1_000_000 ? "good" : width * height >= 480_000 ? "warning" : "poor";
  const resolutionScore = resolution === "good" ? 1 : resolution === "warning" ? .7 : .35;
  const exposureScore = Math.max(0, 1 - Math.abs(brightness - .55) / .55);
  const contrastScore = Math.min(1, contrast / .22);
  const score = Math.max(0, Math.min(1, .3 * resolutionScore + .25 * exposureScore + .2 * contrastScore + .25 * (1 - blur)));
  return { resolution, blur: Number(blur.toFixed(2)), brightness: Number(brightness.toFixed(2)), contrast: Number(contrast.toFixed(2)), score: Number(score.toFixed(2)), label: qualityLabel(score) };
}
