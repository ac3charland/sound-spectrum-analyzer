// TODO Mobile view
// TODO Refine flow (write stories)
// TODO Edge case: bluetooth microphone disconnect
// TODO dynamic canvas size https://www.tutorialspoint.com/HTML5-Canvas-fit-to-window
// TODO draw scales before start
// TODO Reorganize code into:
// TODO Lifecycle
// TODO Drawing
// TODO Audio Processing
// TODO Contact/Social Media Links

function showError(id) {
  document.getElementById(id).style.display = "block";
  document.getElementById("start-button").style.display = "none";
  document.getElementById("spectrum-meter").style.backgroundColor = "#777";
}

/*
  1. CHECK BROWSER COMPATIBILITY
*/
if (
  navigator.mediaDevices &&
  navigator.mediaDevices.getUserMedia &&
  (window.AudioContext || window.webkitAudioContext)
) {
  /*
    2. BROWSER IS COMPATIBLE - ASK MICROPHONE PERMISSION
  */
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      document.getElementById("start-button").addEventListener("click", () => {
        // Hide start button after app start
        document.getElementById("start-button").hidden = true;

        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);

        // Connect the audio source to an analyzer node
        const analyzer = audioContext.createAnalyser();
        source.connect(analyzer);

        analyzer.fftSize = 2048;
        const MAX_FREQ = analyzer.context.sampleRate / 2;
        const MAX_FREQ_LOG = Math.log10(MAX_FREQ);
        const BUFFER_LENGTH = analyzer.frequencyBinCount;

        // This will contain the audio data for each frame
        const dataArray = new Uint8Array(BUFFER_LENGTH);

        // Set up canvas context for visualizer
        const canvas = document.querySelector("#spectrum-meter");
        const canvasCtx = canvas.getContext("2d");

        const WIDTH = canvas.width;
        const HEIGHT = canvas.height;

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

        function convertFrequencyToX(frequency) {
          const offSet = 0.41;
          const logFreq = Math.log10(frequency);
          // 1. Figure out how high the freq is in the range as a percent
          const percent = logFreq / MAX_FREQ_LOG;

          // 2. Convert that percentage to an X coordinate
          return percent * WIDTH * (1 + offSet) - WIDTH * offSet;
        }

        // Draw the frequency scale
        function drawFrequencyScale() {
          // TODO DRY color & style
          canvasCtx.fillStyle = "black";
          canvasCtx.font = "10px Arial";
          canvasCtx.textAlign = "center";

          const frequencyTicks = [
            20, 50, 100, 200, 400, 600, 800, 1000, 2000, 4000, 6000, 8000,
            10000, 20000,
          ];
          for (const frequency of frequencyTicks) {
            // Map the logarithmic frequency to the canvas width
            const x = convertFrequencyToX(frequency);

            // Draw tick mark
            canvasCtx.fillRect(x, HEIGHT - 5, 1, 5);

            // Draw frequency label
            if (
              frequency === 20 ||
              frequency === 50 ||
              frequency === 100 ||
              frequency === 1000 ||
              frequency === 10000 ||
              frequency === 20000
            )
              canvasCtx.fillText(frequency.toString(), x, HEIGHT - 10);
          }
        }

        function drawSpectralCentroidLine(spectralCentroid) {
          canvasCtx.fillStyle = "white";
          const x = convertFrequencyToX(spectralCentroid);

          // Draw line
          canvasCtx.fillRect(x, 0, 3, HEIGHT);
        }

        const loudnessCanvas = document.getElementById("loudness-meter");
        const loudnessCanvasCtx = loudnessCanvas.getContext("2d");
        const LOUDNESS_HEIGHT = loudnessCanvas.height;
        const LOUDNESS_WIDTH = loudnessCanvas.width;

        function drawLoudnessScale() {
          loudnessCanvasCtx.fillStyle = "black";
          loudnessCanvasCtx.font = "10px Arial";
          loudnessCanvasCtx.textAlign = "center";

          const loudnessTicks = [10, 20, 30, 40, 50, 60, 70, 80, 90];

          for (const loudness of loudnessTicks) {
            loudnessCanvasCtx.fillRect(
              0,
              (LOUDNESS_HEIGHT * loudness) / 100,
              4,
              1
            );

            if (loudness % 20 === 0) {
              loudnessCanvasCtx.fillText(
                loudness.toString(),
                12,
                LOUDNESS_HEIGHT - (LOUDNESS_HEIGHT * loudness) / 100 + 4
              );
            }
          }
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

          document.getElementById("loudness").textContent = percent;

          // Clear the canvas for the new frame
          loudnessCanvasCtx.clearRect(0, 0, LOUDNESS_WIDTH, LOUDNESS_HEIGHT);

          // Draw the loudness meter
          loudnessCanvasCtx.fillStyle = "dodgerblue";
          const loudnessMeterHeight =
            (avgAmp / referenceLevel) * LOUDNESS_HEIGHT;
          loudnessCanvasCtx.fillRect(
            LOUDNESS_WIDTH - 40,
            LOUDNESS_HEIGHT - loudnessMeterHeight,
            LOUDNESS_WIDTH,
            loudnessMeterHeight
          );

          drawLoudnessScale();
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

            const x = convertFrequencyToX(centerFrequency);
            const y = HEIGHT - (amplitude / 255) * HEIGHT;

            sum += amplitude * centerFrequency;
            totalWeight += amplitude;

            if (i === 0) {
              canvasCtx.moveTo(x, y);
            } else {
              canvasCtx.lineTo(x, y);
            }
          }

          const spectralCentroid = Math.round(sum / totalWeight);
          if (displayUpdateCounter === Math.round(16 / displayUpdateFPS)) {
            spectralCentroidDisplay.textContent = spectralCentroid;
            displayUpdateCounter = 0;
          } else {
            displayUpdateCounter += 1;
          }
          canvasCtx.stroke();
          drawSpectralCentroidLine(spectralCentroid);
          drawFrequencyScale();

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
