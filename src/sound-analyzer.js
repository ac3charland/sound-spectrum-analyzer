// TODO Edge case: bluetooth microphone disconnect

/*
  GENERAL PAGE FUNCTIONS
*/

function showError(id) {
  document.getElementById(id).style.display = "block";
  document.getElementById("start-button").style.display = "none";
  document.getElementById("spectrum-meter").style.backgroundColor = "#777";
}

/*
  DRAWING FUNCTIONS
*/

function convertFrequencyToX(frequency, maxFreqLog, width) {
  if (frequency === undefined || !maxFreqLog || !width) {
    console.error("convertFrequencyToX: Missing arguments");
    if (frequency === undefined) {
      console.error("missing frequency");
    }
    if (!maxFreqLog) {
      console.error("missing maxFreqLog");
    }
    if (!width) {
      console.error("missing width");
    }
    return;
  }
  const offSet = 0.41;
  const logFreq = Math.log10(frequency);
  // 1. Figure out how high the freq is in the range as a percent
  const percent = logFreq / maxFreqLog;

  // 2. Convert that percentage to an X coordinate
  return percent * width * (1 + offSet) - width * offSet;
}

const scaleFillColor = "white";
const scaleFont = "10px Arial";

function drawFrequencyScale(ctx, width, height, maxFreqLog) {
  if (!ctx || !width || !height || !maxFreqLog) {
    console.error("drawFrequencyScale: Missing arguments");
    if (!ctx) {
      console.error("ctx is falsy");
    }
    if (!width) {
      console.error("width is falsy");
    }
    if (!height) {
      console.error("height is falsy");
    }
    if (!maxFreqLog) {
      console.error("maxFreqLog is falsy");
    }
    return;
  }
  ctx.fillStyle = scaleFillColor;
  ctx.font = scaleFont;
  ctx.textAlign = "center";

  const frequencyTicks = [
    20, 50, 100, 200, 400, 600, 800, 1000, 2000, 4000, 6000, 8000, 10000, 20000,
  ];
  for (const frequency of frequencyTicks) {
    // Map the logarithmic frequency to the canvas width
    const x = convertFrequencyToX(frequency, maxFreqLog, width);

    // Draw tick mark
    ctx.fillRect(x, height - 5, 1, 5);

    // Draw frequency label
    if (
      frequency === 20 ||
      frequency === 50 ||
      frequency === 100 ||
      frequency === 1000 ||
      frequency === 10000 ||
      frequency === 20000
    ) {
      if (frequency < 10000) {
        ctx.fillText(frequency.toString(), x, height - 10);
      }
      else {
        ctx.fillText(`${(frequency / 1000).toString()}k`, x, height - 10);
      }
    }
  }
}

function drawLoudnessScale(ctx, height) {
  if (!ctx || !height) {
    console.error("drawLoudnessScale: Missing arguments");
    return;
  }
  ctx.fillStyle = scaleFillColor;
  ctx.font = scaleFont;
  ctx.textAlign = "center";

  const loudnessTicks = [10, 20, 30, 40, 50, 60, 70, 80, 90];

  for (const loudness of loudnessTicks) {
    ctx.fillRect(0, (height * loudness) / 100, 4, 1);

    if (loudness % 20 === 0) {
      ctx.fillText(
        loudness.toString(),
        12,
        height - (height * loudness) / 100 + 4
      );
    }
  }
}

document.getElementById("current-year").textContent = new Date().getFullYear();

/*
  1. CHECK BROWSER COMPATIBILITY
*/
if (
  navigator.mediaDevices &&
  navigator.mediaDevices.getUserMedia &&
  (window.AudioContext || window.webkitAudioContext)
) {
  /*
    BROWSER IS COMPATIBLE
  */

  // Set up audio context
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyzer = audioContext.createAnalyser();
  const MAX_FREQ = analyzer.context.sampleRate / 2;
  const MAX_FREQ_LOG = Math.log10(MAX_FREQ);

  // Set up frequency visualizer
  const canvas = document.querySelector("#spectrum-meter");
  const canvasCtx = canvas.getContext("2d");
  // TODO Add screen resize event listener to set WIDTH
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  drawFrequencyScale(canvasCtx, WIDTH, HEIGHT, MAX_FREQ_LOG);

  // Set up loudness meter
  const loudnessCanvas = document.getElementById("loudness-meter");
  const loudnessCanvasCtx = loudnessCanvas.getContext("2d");
  const LOUDNESS_HEIGHT = loudnessCanvas.height;
  const LOUDNESS_WIDTH = loudnessCanvas.width;
  drawLoudnessScale(loudnessCanvasCtx, LOUDNESS_HEIGHT);

  /*
    2. ASK MICROPHONE PERMISSION
  */
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((micStream) => {
      document.getElementById("start-button").addEventListener("click", () => {
        // Hide start button after app start
        document.getElementById("start-button").hidden = true;

        // Resume the audio context and connect mic to the analyzer
        audioContext.resume();
        const source = audioContext.createMediaStreamSource(micStream);
        source.connect(analyzer);

        analyzer.fftSize = 2048;
        const BUFFER_LENGTH = analyzer.frequencyBinCount;

        // This will contain the audio data for each frame
        const dataArray = new Uint8Array(BUFFER_LENGTH);

        let displayUpdateCounter = 0;
        const displayUpdateFPS = 2;
        const spectralCentroidDisplay =
          document.querySelector("#spectral-centroid");

        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

        // Function to calculate average amplitude
        function calculateAvgAmp(dataArray) {
          const arraySum = dataArray.reduce((a, value) => a + value, 0);
          return arraySum / dataArray.length;
        }

        function drawSpectralCentroidLine(spectralCentroid) {
          canvasCtx.fillStyle = "white";
          const x = convertFrequencyToX(spectralCentroid, MAX_FREQ_LOG, WIDTH);

          // Draw line
          canvasCtx.fillRect(x, 0, 3, HEIGHT);
        }

        // Function to draw the loudness meter
        function drawLoudnessMeter() {
          // TODO refactor so this is only called once
          // Get frequency data
          analyzer.getByteFrequencyData(dataArray);

          loudnessCanvasCtx.clearRect(0, 0, LOUDNESS_WIDTH, LOUDNESS_HEIGHT);

          // Calculate RMS amplitude
          const avgAmp = calculateAvgAmp(dataArray);

          // Update loudness variable

          const referenceLevel = 255; // Adjust as needed

          const percent = Math.round((avgAmp / referenceLevel) * 100);

          if (displayUpdateCounter === Math.round(16 / displayUpdateFPS)) {
            document.getElementById("loudness").textContent = percent;
          }

          // Clear the canvas for the new frame
          loudnessCanvasCtx.clearRect(0, 0, LOUDNESS_WIDTH, LOUDNESS_HEIGHT);

          // Draw the loudness meter
          // TODO here is the loudness meter logic
          loudnessCanvasCtx.fillStyle = "dodgerblue";
          const loudnessMeterHeight =
            (avgAmp / referenceLevel) * LOUDNESS_HEIGHT;
          loudnessCanvasCtx.fillRect(
            LOUDNESS_WIDTH - 40,
            LOUDNESS_HEIGHT - loudnessMeterHeight,
            LOUDNESS_WIDTH,
            loudnessMeterHeight
          );

          drawLoudnessScale(loudnessCanvasCtx, LOUDNESS_HEIGHT);
          // Request the next animation frame
          requestAnimationFrame(drawLoudnessMeter);
        }

        const drawSpectrum = () => {
          analyzer.getByteFrequencyData(dataArray);

          canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
          canvasCtx.fillStyle = "dodgerblue";
          canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

          // Set up line style
          canvasCtx.strokeStyle = "white";
          canvasCtx.lineWidth = 2;
          canvasCtx.beginPath();

          let sum = 0;
          let totalWeight = 0;

          for (let i = 0; i < dataArray.length; i++) {
            const amplitude = dataArray[i];

            // Calculate the center frequency of the bin
            const centerFrequency =
              (i * analyzer.context.sampleRate) / analyzer.fftSize;

            const x = convertFrequencyToX(centerFrequency, MAX_FREQ_LOG, WIDTH);
            const y = HEIGHT - (amplitude / 255) * HEIGHT;

            sum += amplitude * centerFrequency;
            totalWeight += amplitude;

            if (i === 0) {
              canvasCtx.moveTo(x, y);
            } else {
              canvasCtx.lineTo(x, y);
            }
          }

          const spectralCentroid = totalWeight
            ? Math.round(sum / totalWeight)
            : 0;
          // TODO here is the update counter
          // TODO break this outside
          if (displayUpdateCounter === Math.round(16 / displayUpdateFPS)) {
            spectralCentroidDisplay.textContent = spectralCentroid;
            displayUpdateCounter = 0;
          } else {
            displayUpdateCounter += 1;
          }
          canvasCtx.stroke();
          drawSpectralCentroidLine(spectralCentroid);
          drawFrequencyScale(canvasCtx, WIDTH, HEIGHT, MAX_FREQ_LOG);

          requestAnimationFrame(drawSpectrum);
        };
        drawSpectrum();
        drawLoudnessMeter();
      });
    })
    .catch(() => {
      /*
        MICROPHONE PERMISSION DENIED
      */
      showError("microphone-permission-error");
    });
} else {
  /*
  BROWSER NOT COMPATIBLE
  */
  showError("browser-compatibility-error");
}
