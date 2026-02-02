use napi::bindgen_prelude::*;
use napi_derive::napi;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use std::fs::File;
use std::io::BufReader;
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[napi]
pub struct AudioPlayer {
    sink: Arc<Mutex<Option<Sink>>>,
    _stream: Arc<Mutex<Option<OutputStream>>>,
    stream_handle: Arc<Mutex<Option<OutputStreamHandle>>>,
    current_file: Arc<Mutex<Option<String>>>,
    duration: Arc<Mutex<Duration>>,
    start_time: Arc<Mutex<Option<std::time::Instant>>>,
}

#[napi(object)]
pub struct WaveformData {
    pub duration_ms: f64,
    /// Peaks are normalized to 0..1 but exposed as f64 for N-API compatibility.
    pub peaks: Vec<f64>,
}

#[napi]
impl AudioPlayer {
    #[napi(constructor)]
    pub fn new() -> Result<Self> {
        let (stream, stream_handle) = match OutputStream::try_default() {
            Ok((s, sh)) => (s, sh),
            Err(e) => {
                return Err(Error::new(
                    Status::GenericFailure,
                    format!("Failed to create audio output stream: {}", e),
                ));
            }
        };

        Ok(Self {
            sink: Arc::new(Mutex::new(None)),
            _stream: Arc::new(Mutex::new(Some(stream))),
            stream_handle: Arc::new(Mutex::new(Some(stream_handle))),
            current_file: Arc::new(Mutex::new(None)),
            duration: Arc::new(Mutex::new(Duration::ZERO)),
            start_time: Arc::new(Mutex::new(None)),
        })
    }

    #[napi]
    pub fn load_file(&mut self, file_path: String) -> Result<f64> {
        // Stop current playback
        self.stop()?;

        // Open file and decode to get duration
        let file = File::open(&file_path).map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to open file {}: {}", file_path, e),
            )
        })?;

        let source = Decoder::new(BufReader::new(file)).map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to decode audio file: {}", e),
            )
        })?;

        // Get duration
        let duration = source.total_duration().unwrap_or(Duration::ZERO);
        let duration_secs = duration.as_secs_f64();

        // Create new sink - need to get reference to stream handle
        let stream_handle_guard = self
            .stream_handle
            .lock()
            .unwrap();
        
        let stream_handle_ref = stream_handle_guard
            .as_ref()
            .ok_or_else(|| Error::new(Status::GenericFailure, "Stream handle not available"))?;

        let sink = Sink::try_new(stream_handle_ref).map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to create sink: {}", e),
            )
        })?;

        // Recreate source for playback
        let file = File::open(&file_path).map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to reopen file: {}", e),
            )
        })?;
        let source = Decoder::new(BufReader::new(file)).map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to decode audio file: {}", e),
            )
        })?;

        sink.append(source);

        // Store sink and file info
        *self.sink.lock().unwrap() = Some(sink);
        *self.current_file.lock().unwrap() = Some(file_path);
        *self.duration.lock().unwrap() = duration;
        *self.start_time.lock().unwrap() = None;

        Ok(duration_secs)
    }

    /// Seek to a position (in seconds) within the current file.
    /// This recreates the decoder and skips samples up to the target position.
    #[napi]
    pub fn seek(&mut self, position_secs: f64) -> Result<()> {
        let position_secs = if position_secs.is_sign_negative() {
            0.0
        } else {
            position_secs
        };

        let maybe_path = self.current_file.lock().unwrap().clone();
        let path = match maybe_path {
            Some(p) => p,
            None => {
                return Err(Error::new(
                    Status::GenericFailure,
                    "No audio file loaded for seeking",
                ))
            }
        };

        // Stop any current playback.
        self.stop()?;

        // Open decoder again.
        let file = File::open(&path).map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to open file for seek {}: {}", path, e),
            )
        })?;

        let mut source = Decoder::new(BufReader::new(file)).map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to decode audio file for seek: {}", e),
            )
        })?;

        let duration = source.total_duration().unwrap_or(Duration::ZERO);
        let duration_secs = duration.as_secs_f64();

        let sample_rate = source.sample_rate() as u64;
        let channels = source.channels() as u64;

        // Clamp target to duration.
        let target_secs = position_secs
            .min(duration_secs)
            .max(0.0);
        let target_frames = (target_secs * sample_rate as f64).round() as u64;
        let samples_to_skip = target_frames.saturating_mul(channels);

        // Skip samples by decoding and discarding.
        let mut skipped: u64 = 0;
        while skipped < samples_to_skip {
            match source.next() {
                Some(_sample) => {
                    skipped += 1;
                }
                None => break,
            }
        }

        // Create a new sink at this position.
        let stream_handle_guard = self.stream_handle.lock().unwrap();
        let stream_handle_ref = stream_handle_guard
            .as_ref()
            .ok_or_else(|| Error::new(Status::GenericFailure, "Stream handle not available"))?;

        let sink = Sink::try_new(stream_handle_ref).map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to create sink for seek: {}", e),
            )
        })?;

        sink.append(source);

        *self.sink.lock().unwrap() = Some(sink);
        *self.duration.lock().unwrap() = duration;

        // Start time offset so native get_position aligns if used.
        *self.start_time.lock().unwrap() =
            Some(std::time::Instant::now() - Duration::from_secs_f64(target_secs));

        Ok(())
    }

    #[napi]
    pub fn play(&self) -> Result<()> {
        let sink = self.sink.lock().unwrap();
        if let Some(ref s) = *sink {
            s.play();
            *self.start_time.lock().unwrap() = Some(std::time::Instant::now());
            Ok(())
        } else {
            Err(Error::new(
                Status::GenericFailure,
                "No audio file loaded. Call load_file first.",
            ))
        }
    }

    #[napi]
    pub fn pause(&self) -> Result<()> {
        let sink = self.sink.lock().unwrap();
        if let Some(ref s) = *sink {
            s.pause();
            // Note: We keep start_time so position can be calculated when resumed
            Ok(())
        } else {
            Err(Error::new(
                Status::GenericFailure,
                "No audio file loaded",
            ))
        }
    }

    #[napi]
    pub fn stop(&self) -> Result<()> {
        let mut sink = self.sink.lock().unwrap();
        if let Some(s) = sink.take() {
            s.stop();
        }
        *self.start_time.lock().unwrap() = None;
        Ok(())
    }

    #[napi]
    pub fn set_volume(&self, volume: f64) -> Result<()> {
        let volume = volume.max(0.0).min(1.0);
        let sink = self.sink.lock().unwrap();
        if let Some(ref s) = *sink {
            s.set_volume(volume as f32);
            Ok(())
        } else {
            Err(Error::new(
                Status::GenericFailure,
                "No audio file loaded",
            ))
        }
    }

    #[napi]
    pub fn get_duration(&self) -> Result<f64> {
        let dur = self.duration.lock().unwrap();
        Ok(dur.as_secs_f64())
    }

    #[napi]
    pub fn get_position(&self) -> Result<f64> {
        let start_time = self.start_time.lock().unwrap();
        if let Some(start) = *start_time {
            let elapsed = start.elapsed();
            Ok(elapsed.as_secs_f64())
        } else {
            Ok(0.0)
        }
    }

    #[napi]
    pub fn is_playing(&self) -> Result<bool> {
        let sink = self.sink.lock().unwrap();
        if let Some(ref s) = *sink {
            // Check if sink is not paused and has content
            Ok(!s.is_paused() && s.len() > 0)
        } else {
            Ok(false)
        }
    }

    #[napi]
    pub fn is_paused(&self) -> Result<bool> {
        let sink = self.sink.lock().unwrap();
        if let Some(ref s) = *sink {
            Ok(s.is_paused())
        } else {
            Ok(false)
        }
    }
}

/// Generate a simple waveform: bucketed peak amplitudes in 0..1.
#[napi]
pub fn get_waveform(path: String, buckets: u32) -> Result<WaveformData> {
    let buckets = buckets.max(8).min(4096); // clamp for sanity

    let file = File::open(&path).map_err(|e| {
        Error::new(
            Status::GenericFailure,
            format!("Failed to open file for waveform {}: {}", path, e),
        )
    })?;

    let mut source = Decoder::new(BufReader::new(file)).map_err(|e| {
        Error::new(
            Status::GenericFailure,
            format!("Failed to decode audio file for waveform: {}", e),
        )
    })?;

    let duration = source.total_duration().unwrap_or(Duration::ZERO);
    let duration_secs = duration.as_secs_f64();
    let duration_ms = duration_secs * 1000.0;

    let sample_rate = source.sample_rate() as u64;
    let channels = source.channels() as u64;
    let total_frames =
        (duration_secs.max(0.0) * sample_rate as f64).round().max(1.0) as u64;

    // Use RMS (root mean square) for smoother waveform, with log scaling like OneTagger
    let mut bucket_samples: Vec<Vec<f32>> = vec![Vec::new(); buckets as usize];
    let mut sample_index: u64 = 0;
    
    while let Some(sample) = source.next() {
        let frame_index = sample_index / channels.max(1);
        let bucket_index = ((frame_index.saturating_mul(buckets as u64)) / total_frames)
            .min(buckets as u64 - 1);

        // Decoder currently yields i16 samples; normalize to -1.0..1.0.
        let value = sample as f32 / i16::MAX as f32;
        bucket_samples[bucket_index as usize].push(value);

        sample_index = sample_index.saturating_add(1);
    }

    // Convert to mono and compute RMS per bucket, then apply log scaling
    let mut peaks = vec![0.0_f32; buckets as usize];
    for (idx, samples) in bucket_samples.iter().enumerate() {
        if samples.is_empty() {
            peaks[idx] = 0.0;
            continue;
        }

        // Convert to mono: average samples across channels
        let mut sum_sq = 0.0_f32;
        let mut count = 0;
        for chunk in samples.chunks(channels as usize) {
            // Average channels for mono
            let mono_value = if channels > 1 {
                chunk.iter().sum::<f32>() / channels as f32
            } else {
                chunk[0]
            };
            sum_sq += mono_value * mono_value;
            count += 1;
        }

        // RMS
        let rms = if count > 0 {
            (sum_sq / count as f32).sqrt()
        } else {
            0.0
        };

        // Apply log2 scaling like OneTagger: log2(abs + 1) / 10
        // This gives better perceptual representation
        peaks[idx] = ((rms.abs() + 1.0).log2() / 10.0).min(1.0);
    }

    // Normalize peaks to 0..1 based on max value (after log scaling)
    let max_peak = peaks
        .iter()
        .copied()
        .fold(0.0_f32, |acc, v| if v > acc { v } else { acc });
    if max_peak > 0.0 && max_peak < 1.0 {
        // Only normalize if max is less than 1, to preserve the log scaling
        for p in &mut peaks {
            *p /= max_peak;
        }
    }

    let peaks_f64: Vec<f64> = peaks.into_iter().map(|p| p as f64).collect();

    Ok(WaveformData {
        duration_ms,
        peaks: peaks_f64,
    })
}
