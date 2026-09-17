use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream, StreamConfig};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

const TARGET_SAMPLE_RATE: u32 = 16_000;
const EMIT_SAMPLES: usize = 6_400;

#[derive(Default)]
struct MicState {
    stream: Mutex<Option<Stream>>,
}

#[derive(Serialize, Clone)]
struct MicPcmChunk {
    data: String,

    #[serde(rename = "sampleRate")]
    sample_rate: u32,

    channels: u16,

    samples: usize,
}

#[derive(Serialize, Clone)]
struct MicError {
    message: String,
}

struct Resampler {
    input_rate: u32,
    channels: u16,
    step: f64,
    phase: f64,
    mono: VecDeque<f32>,
}

impl Resampler {
    fn new(input_rate: u32, channels: u16) -> Self {
        let safe_rate = input_rate.max(1);
        let safe_channels = channels.max(1);

        Self {
            input_rate: safe_rate,
            channels: safe_channels,
            step: safe_rate as f64 / TARGET_SAMPLE_RATE as f64,
            phase: 0.0,
            mono: VecDeque::new(),
        }
    }

    fn push_f32_samples(&mut self, input: &[f32]) -> Vec<i16> {
        let channel_count = self.channels as usize;
        let mut mono_input = Vec::with_capacity(input.len() / channel_count.max(1));

        for frame in input.chunks(channel_count.max(1)) {
            if frame.is_empty() {
                continue;
            }

            let sum: f32 = frame.iter().copied().sum();
            mono_input.push(sum / frame.len() as f32);
        }

        self.mono.extend(mono_input);

        self.resample()
    }

    fn resample(&mut self) -> Vec<i16> {
        let mut output = Vec::new();

        while self.phase + 1.0 < self.mono.len() as f64 {
            let index = self.phase.floor() as usize;
            let fraction = (self.phase - index as f64) as f32;

            let a = self.mono[index];
            let b = self.mono[index + 1];

            let sample = a + (b - a) * fraction;

            let sample_i16 = (sample.clamp(-1.0, 1.0) * 32_767.0).round() as i16;

            output.push(sample_i16);

            self.phase += self.step;
        }

        let consumed = self.phase.floor() as usize;

        if consumed > 0 {
            let count = consumed.min(self.mono.len().saturating_sub(1));

            for _ in 0..count {
                self.mono.pop_front();
            }

            self.phase -= count as f64;
        }

        output
    }
}

struct PcmEmitter {
    app: AppHandle,
    resampler: Resampler,
    pending: Vec<i16>,
}

impl PcmEmitter {
    fn new(app: AppHandle, input_rate: u32, channels: u16) -> Self {
        Self {
            app,
            resampler: Resampler::new(input_rate, channels),
            pending: Vec::with_capacity(EMIT_SAMPLES * 2),
        }
    }

    fn push_f32(&mut self, data: &[f32]) {
        let samples = self.resampler.push_f32_samples(data);

        if samples.is_empty() {
            return;
        }

        self.pending.extend(samples);

        self.emit_ready();
    }

    fn push_i16(&mut self, data: &[i16]) {
        let input: Vec<f32> = data
            .iter()
            .map(|sample| *sample as f32 / 32_768.0)
            .collect();

        self.push_f32(&input);
    }

    fn push_u16(&mut self, data: &[u16]) {
        let input: Vec<f32> = data
            .iter()
            .map(|sample| (*sample as f32 - 32_768.0) / 32_768.0)
            .collect();

        self.push_f32(&input);
    }

    fn emit_ready(&mut self) {
        while self.pending.len() >= EMIT_SAMPLES {
            let chunk: Vec<i16> = self.pending.drain(..EMIT_SAMPLES).collect();
            let bytes = samples_to_le_bytes(&chunk);
            let data = BASE64.encode(bytes);

            let payload = MicPcmChunk {
                data,
                sample_rate: TARGET_SAMPLE_RATE,
                channels: 1,
                samples: chunk.len(),
            };

            let _ = self.app.emit("mic:pcm", payload);
        }
    }
}

fn samples_to_le_bytes(samples: &[i16]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(samples.len() * 2);

    for sample in samples {
        bytes.extend_from_slice(&sample.to_le_bytes());
    }

    bytes
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn microphone_running(state: State<'_, MicState>) -> Result<bool, String> {
    let guard = state
        .stream
        .lock()
        .map_err(|_| "Microphone state lock failed.".to_string())?;

    Ok(guard.is_some())
}

#[tauri::command]
fn stop_microphone(
    app: AppHandle,
    state: State<'_, MicState>,
) -> Result<(), String> {
    let stream = {
        let mut guard = state
            .stream
            .lock()
            .map_err(|_| "Microphone state lock failed.".to_string())?;

        guard.take()
    };

    drop(stream);

    let _ = app.emit("mic:stopped", true);

    Ok(())
}

#[tauri::command]
fn start_microphone(
    app: AppHandle,
    state: State<'_, MicState>,
) -> Result<(), String> {
    {
        let guard = state
            .stream
            .lock()
            .map_err(|_| "Microphone state lock failed.".to_string())?;

        if guard.is_some() {
            return Ok(());
        }
    }

    let host = cpal::default_host();

    let device = host
        .default_input_device()
        .ok_or_else(|| {
            "No default microphone input device was found.".to_string()
        })?;

    let supported = device.default_input_config().map_err(|error| {
        format!("Could not read microphone configuration: {error}")
    })?;

    let sample_format = supported.sample_format();
    let stream_config: StreamConfig = supported.clone().into();

    let input_rate = stream_config.sample_rate.0;
    let channels = stream_config.channels;

    let processor = Arc::new(Mutex::new(PcmEmitter::new(
        app.clone(),
        input_rate,
        channels,
    )));

    let error_app = app.clone();

    let error_callback = move |error| {
        let payload = MicError {
            message: format!("Microphone stream error: {error}"),
        };

        let _ = error_app.emit("mic:error", payload);
    };

    let stream_result = match sample_format {
        SampleFormat::F32 => {
            let processor = processor.clone();

            device.build_input_stream(
                &stream_config,
                move |data: &[f32], _| {
                    if let Ok(mut processor) = processor.lock() {
                        processor.push_f32(data);
                    }
                },
                error_callback,
                None,
            )
        }

        SampleFormat::I16 => {
            let processor = processor.clone();

            device.build_input_stream(
                &stream_config,
                move |data: &[i16], _| {
                    if let Ok(mut processor) = processor.lock() {
                        processor.push_i16(data);
                    }
                },
                error_callback,
                None,
            )
        }

        SampleFormat::U16 => {
            let processor = processor.clone();

            device.build_input_stream(
                &stream_config,
                move |data: &[u16], _| {
                    if let Ok(mut processor) = processor.lock() {
                        processor.push_u16(data);
                    }
                },
                error_callback,
                None,
            )
        }

        other => {
            return Err(format!(
                "Unsupported microphone sample format: {other:?}"
            ));
        }
    };

    let stream = stream_result.map_err(|error| {
        format!("Could not create microphone stream: {error}")
    })?;

    stream.play().map_err(|error| {
        format!("Could not start microphone stream: {error}")
    })?;

    {
        let mut guard = state
            .stream
            .lock()
            .map_err(|_| "Microphone state lock failed.".to_string())?;

        *guard = Some(stream);
    }

    let _ = app.emit("mic:started", true);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MicState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            start_microphone,
            stop_microphone,
            microphone_running
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
