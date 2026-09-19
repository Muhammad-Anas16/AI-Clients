export async function startListening(stream) {
  if (!stream) {
    throw new Error("Audio stream not available");
  }

  if (stream.isStreaming) {
    return;
  }

  await stream.start();

  console.log("Microphone listening started");
}

export async function stopListening(stream) {
  if (!stream) {
    return;
  }

  if (!stream.isStreaming) {
    return;
  }

  await stream.stop();

  console.log("Microphone listening stopped");
}