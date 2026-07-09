const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const processButton = document.querySelector("#processButton");
const resetButton = document.querySelector("#resetButton");
const downloadButton = document.querySelector("#downloadButton");
const mainCanvas = document.querySelector("#mainCanvas");
const emptyState = document.querySelector("#emptyState");
const canvasStage = document.querySelector("#canvasStage");
const statusText = document.querySelector("#statusText");
const statusDot = document.querySelector("#statusDot");
const progressLabel = document.querySelector("#progressLabel");
const progressValue = document.querySelector("#progressValue");
const progressBar = document.querySelector("#progressBar");
const engineLabel = document.querySelector("#engineLabel");
const sizeLabel = document.querySelector("#sizeLabel");
const aiEngine = document.querySelector("#aiEngine");
const qualityMode = document.querySelector("#qualityMode");
const processSize = document.querySelector("#processSize");
const thresholdRange = document.querySelector("#thresholdRange");
const featherRange = document.querySelector("#featherRange");
const edgeRange = document.querySelector("#edgeRange");
const spillRange = document.querySelector("#spillRange");
const brushSizeRange = document.querySelector("#brushSizeRange");
const brushSoftnessRange = document.querySelector("#brushSoftnessRange");
const thresholdValue = document.querySelector("#thresholdValue");
const featherValue = document.querySelector("#featherValue");
const edgeValue = document.querySelector("#edgeValue");
const spillValue = document.querySelector("#spillValue");
const brushSizeValue = document.querySelector("#brushSizeValue");
const brushSoftnessValue = document.querySelector("#brushSoftnessValue");
const zoomOutButton = document.querySelector("#zoomOutButton");
const zoomInButton = document.querySelector("#zoomInButton");
const zoomLabel = document.querySelector("#zoomLabel");
const customBg = document.querySelector("#customBg");
const clearBrushButton = document.querySelector("#clearBrushButton");

const ctx = mainCanvas.getContext("2d", { willReadFrequently: true });

let originalImage = null;
let originalBitmap = null;
let removedBitmap = null;
let baseResultImageData = null;
let finalImageData = null;
let manualMask = null;
let currentView = "result";
let previewBackground = "transparent";
let zoom = 1;
let isPainting = false;
let imageSegmenter = null;

const state = {
  threshold: Number(thresholdRange.value),
  feather: Number(featherRange.value),
  edge: Number(edgeRange.value),
  spill: Number(spillRange.value),
  brushSize: Number(brushSizeRange.value),
  brushSoftness: Number(brushSoftnessRange.value),
  brushMode: "erase",
};

const presets = {
  person: {
    engine: "mediapipe",
    quality: "balanced",
    size: "768",
    threshold: 8,
    feather: 4,
    edge: 1,
    spill: 14,
  },
  product: {
    engine: "imgly",
    quality: "high",
    size: "1024",
    threshold: 16,
    feather: 2,
    edge: -1,
    spill: 22,
  },
  sticker: {
    engine: "imgly",
    quality: "high",
    size: "1024",
    threshold: 28,
    feather: 1,
    edge: 1,
    spill: 10,
  },
  text: {
    engine: "imgly",
    quality: "high",
    size: "original",
    threshold: 45,
    feather: 1,
    edge: 2,
    spill: 12,
  },
};

const setStatus = (message, type = "idle") => {
  statusText.textContent = message;
  statusDot.className = `status-dot ${type === "idle" ? "" : type}`;
};

const setProgress = (value, label) => {
  const percent = clamp(Math.round(value), 0, 100);
  progressLabel.textContent = label;
  progressValue.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;
};

const setBusy = (busy) => {
  processButton.disabled = busy || !originalImage;
  fileInput.disabled = busy;
  aiEngine.disabled = busy;
  qualityMode.disabled = busy;
  processSize.disabled = busy;
};

const updateRangeLabels = () => {
  thresholdValue.textContent = state.threshold;
  featherValue.textContent = state.feather;
  edgeValue.textContent = state.edge;
  spillValue.textContent = state.spill;
  brushSizeValue.textContent = state.brushSize;
  brushSoftnessValue.textContent = state.brushSoftness;
};

const syncAdjustmentInputs = () => {
  thresholdRange.value = state.threshold;
  featherRange.value = state.feather;
  edgeRange.value = state.edge;
  spillRange.value = state.spill;
  brushSizeRange.value = state.brushSize;
  brushSoftnessRange.value = state.brushSoftness;
  updateRangeLabels();
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const loadBitmap = async (source) => {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(source);
    } catch (error) {
      console.warn("createImageBitmap failed, falling back to HTMLImageElement", error);
    }
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(source);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("브라우저가 이 이미지 파일을 읽지 못했습니다."));
    };
    image.src = url;
  });
};

const getTargetSize = () => {
  const maxSide = Math.max(originalBitmap.width, originalBitmap.height);
  const selected = processSize.value === "original" ? maxSide : Number(processSize.value);
  const qualityMultiplier = qualityMode.value === "high" ? 1.2 : qualityMode.value === "fast" ? 0.75 : 1;
  return Math.min(Math.round(selected * qualityMultiplier), maxSide, 1600);
};

const drawBitmapToImageData = (bitmap, width = bitmap.width, height = bitmap.height) => {
  const canvas = new OffscreenCanvas(width, height);
  const canvasCtx = canvas.getContext("2d", { willReadFrequently: true });
  canvasCtx.drawImage(bitmap, 0, 0, width, height);
  return canvasCtx.getImageData(0, 0, width, height);
};

const resizeImageFile = async (file) => {
  const target = getTargetSize();
  const scale = Math.min(1, target / Math.max(originalBitmap.width, originalBitmap.height));
  const width = Math.max(1, Math.round(originalBitmap.width * scale));
  const height = Math.max(1, Math.round(originalBitmap.height * scale));

  if (scale >= 0.999) {
    return file;
  }

  const canvas = new OffscreenCanvas(width, height);
  const canvasCtx = canvas.getContext("2d");
  canvasCtx.imageSmoothingQuality = "high";
  canvasCtx.drawImage(originalBitmap, 0, 0, width, height);
  return canvas.convertToBlob({ type: "image/png" });
};

const simpleColorFallback = () => {
  const maxSide = getTargetSize();
  const scale = Math.min(1, maxSide / Math.max(originalBitmap.width, originalBitmap.height));
  const width = Math.max(1, Math.round(originalBitmap.width * scale));
  const height = Math.max(1, Math.round(originalBitmap.height * scale));
  const imageData = drawBitmapToImageData(originalBitmap, width, height);
  const data = imageData.data;
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  const bg = corners.reduce(
    (acc, [x, y]) => {
      const index = (y * width + x) * 4;
      acc.r += data[index];
      acc.g += data[index + 1];
      acc.b += data[index + 2];
      return acc;
    },
    { r: 0, g: 0, b: 0 },
  );
  bg.r /= corners.length;
  bg.g /= corners.length;
  bg.b /= corners.length;

  for (let index = 0; index < data.length; index += 4) {
    const dr = data[index] - bg.r;
    const dg = data[index + 1] - bg.g;
    const db = data[index + 2] - bg.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    data[index + 3] = clamp((distance - 32) * 4, 0, 255);
  }

  engineLabel.textContent = "색상 기반 fallback";
  return imageData;
};

const getMediaPipeSegmenter = async () => {
  if (imageSegmenter) return imageSegmenter;

  setProgress(25, "MediaPipe 로딩");
  const { FilesetResolver, ImageSegmenter } = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs"
  );
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  );

  const options = {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
      delegate: "GPU",
    },
    runningMode: "IMAGE",
    outputCategoryMask: true,
    outputConfidenceMasks: true,
  };

  try {
    imageSegmenter = await ImageSegmenter.createFromOptions(vision, options);
  } catch (error) {
    console.warn("MediaPipe GPU delegate failed, retrying with CPU", error);
    imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
      ...options,
      baseOptions: {
        ...options.baseOptions,
        delegate: "CPU",
      },
    });
  }

  return imageSegmenter;
};

const createProcessingCanvas = () => {
  const target = getTargetSize();
  const scale = Math.min(1, target / Math.max(originalBitmap.width, originalBitmap.height));
  const width = Math.max(1, Math.round(originalBitmap.width * scale));
  const height = Math.max(1, Math.round(originalBitmap.height * scale));
  const canvas = document.createElement("canvas");
  const canvasCtx = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = width;
  canvas.height = height;
  canvasCtx.imageSmoothingQuality = "high";
  canvasCtx.drawImage(originalBitmap, 0, 0, width, height);
  return canvas;
};

const readMaskData = (result, expectedLength) => {
  if (result.confidenceMasks?.length) {
    const masks = result.confidenceMasks;
    const foregroundMask = masks[masks.length - 1];
    const confidence = foregroundMask.getAsFloat32Array();
    foregroundMask.close?.();
    return Uint8ClampedArray.from(confidence, (value) => clamp(value * 255, 0, 255));
  }

  if (result.categoryMask) {
    const categories = result.categoryMask.getAsUint8Array();
    result.categoryMask.close?.();
    return Uint8ClampedArray.from(categories, (value) => (value > 0 ? 255 : 0));
  }

  return new Uint8ClampedArray(expectedLength);
};

const removeBackgroundWithImgly = async () => {
  setProgress(18, "IMG.LY 로딩");
  const { removeBackground } = await import("https://esm.sh/@imgly/background-removal@1.5.5");
  setProgress(42, "이미지 준비");
  const inputBlob = await resizeImageFile(originalImage);
  setProgress(68, "배경 분석");
  const resultBlob = await removeBackground(inputBlob, {
    debug: false,
    output: {
      format: "image/png",
      quality: 0.95,
    },
  });

  setProgress(86, "마스크 생성");
  removedBitmap = await loadBitmap(resultBlob);
  engineLabel.textContent = "IMG.LY";
  return drawBitmapToImageData(removedBitmap);
};

const removeBackgroundWithMediaPipe = async () => {
  setProgress(15, "이미지 준비");
  const segmenter = await getMediaPipeSegmenter();
  const inputCanvas = createProcessingCanvas();
  const imageData = inputCanvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, inputCanvas.width, inputCanvas.height);

  setProgress(55, "배경 분석");
  const result = await new Promise((resolve, reject) => {
    try {
      segmenter.segment(inputCanvas, resolve);
    } catch (error) {
      reject(error);
    }
  });

  setProgress(82, "마스크 생성");
  const alpha = readMaskData(result, imageData.width * imageData.height);
  for (let pixel = 0, index = 0; index < imageData.data.length; pixel += 1, index += 4) {
    imageData.data[index + 3] = alpha[pixel];
  }

  result.close?.();
  engineLabel.textContent = "MediaPipe";
  return imageData;
};

const removeBackgroundWithSelectedEngine = () => {
  if (aiEngine.value === "mediapipe") {
    return removeBackgroundWithMediaPipe();
  }

  return removeBackgroundWithImgly();
};

const boxAlpha = (alpha, width, height, radius, mode) => {
  if (radius === 0) return alpha;
  const output = new Uint8ClampedArray(alpha.length);
  const size = Math.abs(radius);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = mode === "max" ? 0 : 255;
      for (let oy = -size; oy <= size; oy += 1) {
        const ny = clamp(y + oy, 0, height - 1);
        for (let ox = -size; ox <= size; ox += 1) {
          const nx = clamp(x + ox, 0, width - 1);
          const sample = alpha[ny * width + nx];
          value = mode === "max" ? Math.max(value, sample) : Math.min(value, sample);
        }
      }
      output[y * width + x] = value;
    }
  }

  return output;
};

const blurAlpha = (alpha, width, height, radius) => {
  if (radius <= 0) return alpha;
  let current = alpha;
  for (let pass = 0; pass < 2; pass += 1) {
    const output = new Uint8ClampedArray(current.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let total = 0;
        let count = 0;
        for (let oy = -radius; oy <= radius; oy += 1) {
          const ny = y + oy;
          if (ny < 0 || ny >= height) continue;
          for (let ox = -radius; ox <= radius; ox += 1) {
            const nx = x + ox;
            if (nx < 0 || nx >= width) continue;
            total += current[ny * width + nx];
            count += 1;
          }
        }
        output[y * width + x] = total / count;
      }
    }
    current = output;
  }
  return current;
};

const resetManualMask = () => {
  if (!baseResultImageData) {
    manualMask = null;
    return;
  }

  manualMask = new Uint8ClampedArray(baseResultImageData.width * baseResultImageData.height);
  manualMask.fill(128);
  clearBrushButton.disabled = true;
};

const applyManualMask = (alpha, width, height) => {
  if (!manualMask || manualMask.length !== width * height) return alpha;

  const output = new Uint8ClampedArray(alpha);
  for (let index = 0; index < manualMask.length; index += 1) {
    if (manualMask[index] !== 128) {
      output[index] = manualMask[index];
    }
  }
  return output;
};

const createMaskImageData = (imageData) => {
  const mask = new ImageData(imageData.width, imageData.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3];
    mask.data[index] = alpha;
    mask.data[index + 1] = alpha;
    mask.data[index + 2] = alpha;
    mask.data[index + 3] = 255;
  }
  return mask;
};

const getCanvasPoint = (event) => {
  const rect = mainCanvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  return {
    x: clamp(Math.floor(((event.clientX - rect.left) / rect.width) * mainCanvas.width), 0, mainCanvas.width - 1),
    y: clamp(Math.floor(((event.clientY - rect.top) / rect.height) * mainCanvas.height), 0, mainCanvas.height - 1),
  };
};

const paintManualMask = (point) => {
  if (!manualMask || !finalImageData || !point) return;

  const { width, height } = finalImageData;
  const radius = state.brushSize / 2;
  const softness = state.brushSoftness / 100;
  const hardRadius = radius * (1 - softness);
  const value = state.brushMode === "restore" ? 255 : 0;
  const startX = Math.max(0, Math.floor(point.x - radius));
  const endX = Math.min(width - 1, Math.ceil(point.x + radius));
  const startY = Math.max(0, Math.floor(point.y - radius));
  const endY = Math.min(height - 1, Math.ceil(point.y + radius));

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance > radius) continue;

      const fade = softness === 0 ? 1 : 1 - clamp((distance - hardRadius) / Math.max(radius - hardRadius, 1), 0, 1);
      const index = y * width + x;
      const current = manualMask[index] === 128 ? finalImageData.data[index * 4 + 3] : manualMask[index];
      manualMask[index] = Math.round(current * (1 - fade) + value * fade);
    }
  }

  clearBrushButton.disabled = false;
  applyAdjustments();
};

const applyAdjustments = () => {
  if (!baseResultImageData) return;

  const { width, height } = baseResultImageData;
  const adjusted = new ImageData(new Uint8ClampedArray(baseResultImageData.data), width, height);
  const data = adjusted.data;
  let alpha = new Uint8ClampedArray(width * height);

  for (let pixel = 0, index = 3; index < data.length; pixel += 1, index += 4) {
    alpha[pixel] = clamp(data[index] + state.threshold, 0, 255);
  }

  if (state.edge !== 0) {
    alpha = boxAlpha(alpha, width, height, Math.abs(state.edge), state.edge > 0 ? "max" : "min");
  }

  alpha = blurAlpha(alpha, width, height, state.feather);
  alpha = applyManualMask(alpha, width, height);

  for (let pixel = 0, index = 0; index < data.length; pixel += 1, index += 4) {
    const a = alpha[pixel];
    const spill = state.spill / 100;
    if (a > 0 && a < 245 && spill > 0) {
      const lightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
      data[index] = Math.round(data[index] * (1 - spill) + lightness * spill);
      data[index + 1] = Math.round(data[index + 1] * (1 - spill) + lightness * spill);
      data[index + 2] = Math.round(data[index + 2] * (1 - spill) + lightness * spill);
    }
    data[index + 3] = a;
  }

  finalImageData = adjusted;
  renderCanvas();
};

const drawImageDataContain = (imageData) => {
  mainCanvas.width = imageData.width;
  mainCanvas.height = imageData.height;
  ctx.putImageData(imageData, 0, 0);
};

const composeOnBackground = (imageData, background) => {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const canvasCtx = canvas.getContext("2d");
  if (background !== "transparent") {
    canvasCtx.fillStyle = background;
    canvasCtx.fillRect(0, 0, imageData.width, imageData.height);
  }
  canvasCtx.putImageData(imageData, 0, 0);
  return canvasCtx.getImageData(0, 0, imageData.width, imageData.height);
};

const renderCompare = () => {
  if (!finalImageData) return;
  const result = composeOnBackground(finalImageData, previewBackground);
  const original = drawBitmapToImageData(originalBitmap, result.width, result.height);
  const compare = new ImageData(result.width, result.height);
  const split = Math.floor(result.width / 2);

  for (let y = 0; y < result.height; y += 1) {
    for (let x = 0; x < result.width; x += 1) {
      const index = (y * result.width + x) * 4;
      const source = x < split ? original.data : result.data;
      compare.data[index] = source[index];
      compare.data[index + 1] = source[index + 1];
      compare.data[index + 2] = source[index + 2];
      compare.data[index + 3] = 255;
    }
  }

  drawImageDataContain(compare);
  ctx.fillStyle = "#0f766e";
  ctx.fillRect(split - 1, 0, 2, result.height);
};

const renderCanvas = () => {
  if (!originalBitmap) return;

  mainCanvas.style.display = "block";
  mainCanvas.classList.toggle("brush-ready", Boolean(finalImageData) && currentView !== "original" && currentView !== "compare");
  emptyState.style.display = "none";
  canvasStage.classList.toggle("checkerboard", previewBackground === "transparent" && currentView !== "mask");
  canvasStage.style.backgroundColor = currentView === "mask" ? "#1f2933" : previewBackground === "transparent" ? "#ffffff" : previewBackground;

  if (currentView === "original") {
    drawImageDataContain(drawBitmapToImageData(originalBitmap));
  } else if (currentView === "compare" && finalImageData) {
    renderCompare();
  } else if (currentView === "mask" && finalImageData) {
    drawImageDataContain(createMaskImageData(finalImageData));
  } else if (finalImageData) {
    drawImageDataContain(composeOnBackground(finalImageData, previewBackground));
  } else {
    drawImageDataContain(drawBitmapToImageData(originalBitmap));
  }

  mainCanvas.style.width = `${Math.round(mainCanvas.width * zoom)}px`;
  mainCanvas.style.height = `${Math.round(mainCanvas.height * zoom)}px`;
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
};

const loadImage = async (file) => {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setStatus("이미지 파일만 업로드할 수 있습니다.", "error");
    return;
  }

  setBusy(true);
  setStatus("이미지를 불러오는 중입니다.", "busy");
  setProgress(8, "이미지 로딩");

  try {
    originalImage = file;
    originalBitmap = await loadBitmap(file);
    removedBitmap = null;
    baseResultImageData = null;
    finalImageData = null;
    manualMask = null;

    sizeLabel.textContent = `${originalBitmap.width} x ${originalBitmap.height}`;
    engineLabel.textContent = "대기 중";
    processButton.disabled = false;
    resetButton.disabled = false;
    downloadButton.disabled = true;
    clearBrushButton.disabled = true;
    setStatus("이미지를 불러왔습니다. 배경 제거를 실행하세요.", "ready");
    setProgress(0, "대기");
    renderCanvas();
  } catch (error) {
    console.error(error);
    originalImage = null;
    originalBitmap = null;
    manualMask = null;
    processButton.disabled = true;
    setStatus("이미지를 불러오지 못했습니다. JPG, PNG, WEBP처럼 브라우저가 지원하는 형식으로 다시 시도하세요.", "error");
    setProgress(0, "오류");
  } finally {
    setBusy(false);
  }
};

const processImage = async () => {
  if (!originalImage) return;
  setBusy(true);
  downloadButton.disabled = true;
  const engineName = aiEngine.value === "mediapipe" ? "MediaPipe 인물용" : "IMG.LY 범용";
  setStatus(`${engineName} 모델로 배경을 분석하는 중입니다. 첫 실행은 시간이 걸릴 수 있습니다.`, "busy");
  setProgress(5, "시작");

  try {
    baseResultImageData = await removeBackgroundWithSelectedEngine();
    setProgress(92, "후처리");
    setStatus("배경 제거가 완료되었습니다. 오른쪽 조절값으로 가장자리를 다듬을 수 있습니다.", "ready");
  } catch (error) {
    console.warn(error);
    setProgress(88, "fallback 처리");
    baseResultImageData = simpleColorFallback();
    setStatus("선택한 AI 방식 실행에 실패해 색상 기반 방식으로 처리했습니다. 단색 배경 이미지에서 가장 잘 동작합니다.", "error");
  } finally {
    setBusy(false);
    downloadButton.disabled = false;
    resetManualMask();
    applyAdjustments();
    setProgress(100, "완료");
  }
};

const downloadPng = () => {
  if (!finalImageData) return;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = finalImageData.width;
  exportCanvas.height = finalImageData.height;
  exportCanvas.getContext("2d").putImageData(finalImageData, 0, 0);
  const link = document.createElement("a");
  link.download = "background-removed.png";
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
};

const resetAll = () => {
  originalImage = null;
  originalBitmap = null;
  removedBitmap = null;
  baseResultImageData = null;
  finalImageData = null;
  manualMask = null;
  fileInput.value = "";
  mainCanvas.style.display = "none";
  emptyState.style.display = "block";
  processButton.disabled = true;
  resetButton.disabled = true;
  downloadButton.disabled = true;
  clearBrushButton.disabled = true;
  engineLabel.textContent = "대기 중";
  sizeLabel.textContent = "-";
  setProgress(0, "대기");
  setStatus("이미지를 선택하면 브라우저에서 처리합니다.");
};

fileInput.addEventListener("change", (event) => {
  loadImage(event.target.files[0]);
});

dropZone.addEventListener("click", (event) => {
  if (event.target !== fileInput) {
    event.preventDefault();
    fileInput.value = "";
    fileInput.click();
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
});

dropZone.addEventListener("drop", (event) => {
  loadImage(event.dataTransfer.files[0]);
});

processButton.addEventListener("click", processImage);
downloadButton.addEventListener("click", downloadPng);
resetButton.addEventListener("click", resetAll);
clearBrushButton.addEventListener("click", () => {
  resetManualMask();
  applyAdjustments();
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    currentView = button.dataset.view;
    renderCanvas();
  });
});

document.querySelectorAll("[data-brush]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-brush]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.brushMode = button.dataset.brush;
  });
});

document.querySelectorAll("[data-bg]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".swatch, #customBg").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    previewBackground = button.dataset.bg;
    renderCanvas();
  });
});

customBg.addEventListener("input", () => {
  document.querySelectorAll(".swatch, #customBg").forEach((item) => item.classList.remove("active"));
  customBg.classList.add("active");
  previewBackground = customBg.value;
  renderCanvas();
});

const clearProcessedResult = () => {
  engineLabel.textContent = "대기 중";
  baseResultImageData = null;
  finalImageData = null;
  manualMask = null;
  downloadButton.disabled = true;
  clearBrushButton.disabled = true;
};

aiEngine.addEventListener("change", () => {
  if (!originalImage) return;
  const engineName = aiEngine.value === "mediapipe" ? "MediaPipe 인물용" : "IMG.LY 범용";
  clearProcessedResult();
  setProgress(0, "대기");
  setStatus(`${engineName}으로 다시 배경 제거를 실행하세요.`, "ready");
  renderCanvas();
});

[qualityMode, processSize].forEach((select) => {
  select.addEventListener("change", () => {
    if (!originalImage) return;
    clearProcessedResult();
    setProgress(0, "대기");
    setStatus("처리 설정이 바뀌었습니다. 다시 배경 제거를 실행하세요.", "ready");
    renderCanvas();
  });
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    const preset = presets[button.dataset.preset];
    if (!preset) return;

    const engineChanged = aiEngine.value !== preset.engine;
    const processingChanged = engineChanged || qualityMode.value !== preset.quality || processSize.value !== preset.size;
    aiEngine.value = preset.engine;
    qualityMode.value = preset.quality;
    processSize.value = preset.size;
    state.threshold = preset.threshold;
    state.feather = preset.feather;
    state.edge = preset.edge;
    state.spill = preset.spill;
    syncAdjustmentInputs();

    document.querySelectorAll("[data-preset]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");

    if (originalImage && processingChanged) {
      clearProcessedResult();
      setProgress(0, "대기");
      setStatus("프리셋이 적용되었습니다. 바뀐 처리 설정으로 다시 배경 제거를 실행하세요.", "ready");
      renderCanvas();
      return;
    }

    if (baseResultImageData) {
      applyAdjustments();
      setStatus("프리셋이 현재 결과에 적용되었습니다.", "ready");
    } else {
      setStatus("프리셋이 적용되었습니다.", originalImage ? "ready" : "idle");
    }
  });
});

[
  [thresholdRange, "threshold"],
  [featherRange, "feather"],
  [edgeRange, "edge"],
  [spillRange, "spill"],
  [brushSizeRange, "brushSize"],
  [brushSoftnessRange, "brushSoftness"],
].forEach(([range, key]) => {
  range.addEventListener("input", () => {
    state[key] = Number(range.value);
    updateRangeLabels();
    if (["threshold", "feather", "edge", "spill"].includes(key)) {
      applyAdjustments();
    }
  });
});

mainCanvas.addEventListener("pointerdown", (event) => {
  if (!finalImageData || currentView === "original" || currentView === "compare") return;
  event.preventDefault();
  mainCanvas.setPointerCapture(event.pointerId);
  isPainting = true;
  paintManualMask(getCanvasPoint(event));
});

mainCanvas.addEventListener("pointermove", (event) => {
  if (!isPainting) return;
  event.preventDefault();
  paintManualMask(getCanvasPoint(event));
});

["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
  mainCanvas.addEventListener(eventName, () => {
    isPainting = false;
  });
});

zoomOutButton.addEventListener("click", () => {
  zoom = clamp(zoom - 0.25, 0.25, 3);
  renderCanvas();
});

zoomInButton.addEventListener("click", () => {
  zoom = clamp(zoom + 0.25, 0.25, 3);
  renderCanvas();
});

updateRangeLabels();
