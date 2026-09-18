export async function createWebRTCAudioLoopback(audioElement) {
  if (!audioElement) {
    throw new Error("Audio element not found.");
  }

  if (!window.isSecureContext) {
    throw new Error(
      "This page is not a secure context. Open it using localhost or HTTPS.",
    );
  }

  if (!navigator.mediaDevices) {
    throw new Error("Microphone API is unavailable in this browser/origin.");
  }

  if (!navigator.mediaDevices.getUserMedia) {
    throw new Error("getUserMedia is not supported.");
  }

  // Get microphone
  const rawStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });

  const AudioContext = window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    throw new Error("Web Audio API is not supported.");
  }

  const audioContext = new AudioContext();

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  // Microphone
  const source = audioContext.createMediaStreamSource(rawStream);

  // Remove low frequency rumble
  const highPass = audioContext.createBiquadFilter();

  highPass.type = "highpass";
  highPass.frequency.value = 100;
  highPass.Q.value = 0.7;

  // Reduce 50Hz electrical hum
  const notch50 = audioContext.createBiquadFilter();

  notch50.type = "notch";
  notch50.frequency.value = 50;
  notch50.Q.value = 8;

  // Reduce 100Hz harmonic
  const notch100 = audioContext.createBiquadFilter();

  notch100.type = "notch";
  notch100.frequency.value = 100;
  notch100.Q.value = 8;

  // Keep useful speech range
  const lowPass = audioContext.createBiquadFilter();

  lowPass.type = "lowpass";
  lowPass.frequency.value = 8000;
  lowPass.Q.value = 0.7;

  // Voice level control
  const compressor = audioContext.createDynamicsCompressor();

  compressor.threshold.value = -24;
  compressor.knee.value = 18;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.15;

  // Create processed stream
  const destination = audioContext.createMediaStreamDestination();

  // Audio chain
  source.connect(highPass);
  highPass.connect(notch50);
  notch50.connect(notch100);
  notch100.connect(lowPass);
  lowPass.connect(compressor);
  compressor.connect(destination);

  // WebRTC sender
  const senderPC = new RTCPeerConnection();

  // WebRTC receiver
  const receiverPC = new RTCPeerConnection();

  // Send processed audio
  const processedStream = destination.stream;

  processedStream.getAudioTracks().forEach((track) => {
    senderPC.addTrack(track, processedStream);
  });

  // Receive processed audio
  receiverPC.ontrack = async (event) => {
    const stream = event.streams[0];

    if (!stream) {
      return;
    }

    audioElement.srcObject = stream;

    try {
      await audioElement.play();
    } catch (error) {
      console.warn("Audio playback blocked:", error);
    }
  };

  const waitForICE = (pc) => {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
        return;
      }

      const check = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", check);

          resolve();
        }
      };

      pc.addEventListener("icegatheringstatechange", check);
    });
  };

  // Offer
  const offer = await senderPC.createOffer();

  await senderPC.setLocalDescription(offer);

  await waitForICE(senderPC);

  // Offer -> receiver
  await receiverPC.setRemoteDescription(senderPC.localDescription);

  // Answer
  const answer = await receiverPC.createAnswer();

  await receiverPC.setLocalDescription(answer);

  await waitForICE(receiverPC);

  // Answer -> sender
  await senderPC.setRemoteDescription(receiverPC.localDescription);

  return {
    rawStream,
    processedStream,
    senderPC,
    receiverPC,
    audioContext,

    stop() {
      rawStream.getTracks().forEach((track) => {
        track.stop();
      });

      processedStream.getTracks().forEach((track) => {
        track.stop();
      });

      senderPC.close();
      receiverPC.close();

      if (audioContext.state !== "closed") {
        audioContext.close();
      }

      audioElement.pause();
      audioElement.srcObject = null;
    },
  };
}
