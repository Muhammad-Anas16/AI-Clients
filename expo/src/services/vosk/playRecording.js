export function playRecording(player) {
  if (!player) {
    throw new Error("Audio player is not ready");
  }

  player.seekTo(0);
  player.play();
}

export function stopPlayback(player) {
  if (!player) {
    return;
  }

  player.pause();
  player.seekTo(0);
}
