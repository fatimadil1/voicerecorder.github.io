# 🎙️ Voice Recorder Pro

A powerful web application for recording, converting, and cleaning audio files with advanced noise reduction capabilities.

![Voice Recorder Pro](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.11-green.svg)
![License](https://img.shields.io/badge/license-MIT-yellow.svg)

## ✨ Features

### 🎤 Voice Recording
- Record audio directly in your browser
- Real-time audio visualization
- Pause and resume recording
- Instant playback

### 🔄 Format Conversion
- Convert to MP3, WAV, OGG, FLAC, M4A
- Adjustable bitrate (128k - 320k)
- Custom sample rate options

### 🧹 Audio Cleaning
- **Noise Reduction**: Remove background noise
- **Click & Pop Removal**: Eliminate audio artifacts
- **Echo Reduction**: Reduce reverb and echo
- **Silence Removal**: Trim silent parts
- **Normalization**: Balance audio levels

### 📊 Audio Analysis
- Quality scoring
- Duration and format info
- Peak and average levels
- Signal-to-noise ratio estimation
- Automatic issue detection

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/voice-recorder-pro.git
cd voice-recorder-pro

# Run with Docker Compose
docker-compose up -d

# Access at http://localhost:5000
