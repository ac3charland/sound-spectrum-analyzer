// Check if the browser supports the MediaDevices API
if (
  navigator.mediaDevices &&
  navigator.mediaDevices.getUserMedia &&
  (window.AudioContext || window.webkitAudioContext)
) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  // Request microphone permission
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then(function (stream) {
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
      const canvas = document.querySelector(".visualizer");
      const canvasCtx = canvas.getContext("2d");

      const WIDTH = canvas.width;
      const HEIGHT = canvas.height;

      let displayUpdateCounter = 0;
      const displayUpdateFPS = 2;
      const spectralCentroidDisplay =
        document.querySelector("#spectral-centroid");

      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

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
        canvasCtx.fillStyle = "black";
        canvasCtx.font = "10px Arial";
        canvasCtx.textAlign = "center";

        const frequencyTicks = [
          20, 50, 100, 200, 400, 600, 800, 1000, 2000, 4000, 6000, 8000, 10000,
          20000,
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
    })
    .catch(function (error) {
      // TODO Error handling
      // Handle errors, such as the user denying permission
      console.error("Error accessing microphone:", error);
    });
} else {
  // TODO Error handling
  console.error("MediaDevices API is not supported in this browser");
}