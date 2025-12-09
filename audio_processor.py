"""
Audio Processing Module
Handles audio conversion, noise reduction, and analysis.
"""

import os
import numpy as np
import librosa
import soundfile as sf
import noisereduce as nr
from scipy import signal
from scipy.io import wavfile
from pydub import AudioSegment
import warnings

warnings.filterwarnings('ignore')


class AudioProcessor:
    """Audio processing class for conversion, noise reduction, and analysis."""
    
    def __init__(self):
        self.supported_formats = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']
    
    def get_audio_info(self, filepath):
        """Get basic audio file information."""
        try:
            audio = AudioSegment.from_file(filepath)
            return {
                'duration': len(audio) / 1000,  # seconds
                'channels': audio.channels,
                'sample_rate': audio.frame_rate,
                'bit_depth': audio.sample_width * 8,
                'file_size': os.path.getsize(filepath),
                'format': filepath.rsplit('.', 1)[-1].lower()
            }
        except Exception as e:
            return {'error': str(e)}
    
    def convert_format(self, input_path, output_path, target_format, 
                       bitrate='192k', sample_rate=44100):
        """Convert audio to specified format."""
        try:
            audio = AudioSegment.from_file(input_path)
            
            # Set sample rate
            audio = audio.set_frame_rate(sample_rate)
            
            # Export with specified settings
            export_params = {}
            
            if target_format == 'mp3':
                export_params = {
                    'format': 'mp3',
                    'bitrate': bitrate,
                    'parameters': ['-q:a', '0']
                }
            elif target_format == 'wav':
                export_params = {
                    'format': 'wav'
                }
            elif target_format == 'ogg':
                export_params = {
                    'format': 'ogg',
                    'codec': 'libvorbis',
                    'bitrate': bitrate
                }
            elif target_format == 'flac':
                export_params = {
                    'format': 'flac'
                }
            elif target_format in ['aac', 'm4a']:
                export_params = {
                    'format': 'ipod',
                    'codec': 'aac',
                    'bitrate': bitrate
                }
            else:
                export_params = {'format': target_format}
            
            audio.export(output_path, **export_params)
            return True
            
        except Exception as e:
            raise Exception(f"Conversion failed: {str(e)}")
    
    def clean_audio(self, input_path, output_path, options):
        """Apply various audio cleaning operations."""
        try:
            # Load audio
            y, sr = librosa.load(input_path, sr=None, mono=False)
            
            # Handle stereo audio
            is_stereo = len(y.shape) > 1
            if is_stereo:
                # Process each channel separately
                cleaned_channels = []
                for channel in y:
                    cleaned = self._process_channel(channel, sr, options)
                    cleaned_channels.append(cleaned)
                y_cleaned = np.array(cleaned_channels)
            else:
                y_cleaned = self._process_channel(y, sr, options)
            
            # Save processed audio
            if is_stereo:
                sf.write(output_path, y_cleaned.T, sr)
            else:
                sf.write(output_path, y_cleaned, sr)
            
            return {
                'original_duration': len(y if not is_stereo else y[0]) / sr,
                'processed_duration': len(y_cleaned if not is_stereo else y_cleaned[0]) / sr,
                'sample_rate': sr
            }
            
        except Exception as e:
            raise Exception(f"Audio cleaning failed: {str(e)}")
    
    def _process_channel(self, y, sr, options):
        """Process a single audio channel."""
        
        # 1. Noise Reduction
        if options.get('noise_reduction_strength', 0) > 0:
            strength = options['noise_reduction_strength']
            y = nr.reduce_noise(
                y=y, 
                sr=sr,
                prop_decrease=strength,
                stationary=True
            )
        
        # 2. Remove clicks and pops
        if options.get('remove_clicks', False):
            y = self._remove_clicks(y, sr)
        
        # 3. Reduce echo/reverb
        if options.get('reduce_echo', False):
            y = self._reduce_echo(y, sr)
        
        # 4. Remove silence
        if options.get('remove_silence', False):
            y = self._remove_silence(y, sr)
        
        # 5. Normalize audio
        if options.get('normalize', False):
            y = self._normalize(y)
        
        return y
    
    def _remove_clicks(self, y, sr):
        """Remove clicks and pops from audio."""
        try:
            # Use median filter to detect and remove clicks
            window_size = int(sr * 0.002)  # 2ms window
            if window_size % 2 == 0:
                window_size += 1
            
            # Calculate local median
            y_median = signal.medfilt(y, kernel_size=window_size)
            
            # Find clicks (samples that deviate significantly from local median)
            threshold = np.std(y) * 3
            clicks = np.abs(y - y_median) > threshold
            
            # Replace clicks with median values
            y_cleaned = y.copy()
            y_cleaned[clicks] = y_median[clicks]
            
            return y_cleaned
        except:
            return y
    
    def _reduce_echo(self, y, sr):
        """Reduce echo and reverb from audio."""
        try:
            # Apply spectral subtraction for echo reduction
            # This is a simplified approach
            
            # Compute STFT
            n_fft = 2048
            hop_length = 512
            
            D = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
            magnitude, phase = np.abs(D), np.angle(D)
            
            # Estimate reverb tail and reduce it
            # Use spectral subtraction with decay estimation
            alpha = 0.5  # Reduction factor
            
            # Create a decay mask
            n_frames = magnitude.shape[1]
            decay = np.exp(-np.arange(n_frames) / (n_frames / 4))
            
            # Apply subtle reduction to late reflections
            for i in range(1, min(10, n_frames)):
                magnitude[:, i:] -= alpha * magnitude[:, :-i] * 0.1
            
            # Ensure non-negative
            magnitude = np.maximum(magnitude, 0)
            
            # Reconstruct
            D_cleaned = magnitude * np.exp(1j * phase)
            y_cleaned = librosa.istft(D_cleaned, hop_length=hop_length)
            
            # Match original length
            if len(y_cleaned) > len(y):
                y_cleaned = y_cleaned[:len(y)]
            elif len(y_cleaned) < len(y):
                y_cleaned = np.pad(y_cleaned, (0, len(y) - len(y_cleaned)))
            
            return y_cleaned
        except:
            return y
    
    def _remove_silence(self, y, sr, threshold_db=-40, min_silence_duration=0.3):
        """Remove silent parts from audio."""
        try:
            # Get intervals of non-silent audio
            intervals = librosa.effects.split(
                y, 
                top_db=abs(threshold_db),
                frame_length=2048,
                hop_length=512
            )
            
            if len(intervals) == 0:
                return y
            
            # Concatenate non-silent parts with small fade
            fade_samples = int(sr * 0.01)  # 10ms fade
            
            parts = []
            for start, end in intervals:
                part = y[start:end]
                
                # Apply fade in/out
                if len(part) > fade_samples * 2:
                    part[:fade_samples] *= np.linspace(0, 1, fade_samples)
                    part[-fade_samples:] *= np.linspace(1, 0, fade_samples)
                
                parts.append(part)
            
            return np.concatenate(parts)
        except:
            return y
    
    def _normalize(self, y, target_db=-3):
        """Normalize audio to target dB level."""
        try:
            # Calculate current peak
            peak = np.max(np.abs(y))
            
            if peak > 0:
                # Calculate target peak
                target_peak = 10 ** (target_db / 20)
                
                # Apply gain
                y = y * (target_peak / peak)
            
            # Ensure we don't clip
            y = np.clip(y, -1.0, 1.0)
            
            return y
        except:
            return y
    
    def analyze_audio(self, filepath):
        """Perform detailed audio analysis."""
        try:
            y, sr = librosa.load(filepath, sr=None)
            
            # Basic info
            duration = len(y) / sr
            
            # RMS energy
            rms = librosa.feature.rms(y=y)[0]
            avg_rms = np.mean(rms)
            
            # Estimate noise level (using quietest parts)
            rms_sorted = np.sort(rms)
            noise_floor = np.mean(rms_sorted[:int(len(rms_sorted) * 0.1)])
            
            # Peak detection
            peak_amplitude = np.max(np.abs(y))
            
            # Zero crossing rate (can indicate noise)
            zcr = librosa.feature.zero_crossing_rate(y)[0]
            avg_zcr = np.mean(zcr)
            
            # Spectral centroid (brightness)
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            avg_centroid = np.mean(spectral_centroid)
            
            # Estimate SNR
            signal_power = np.mean(rms ** 2)
            noise_power = noise_floor ** 2
            if noise_power > 0:
                snr = 10 * np.log10(signal_power / noise_power)
            else:
                snr = float('inf')
            
            # Silence detection
            silent_threshold = 0.01
            silent_samples = np.sum(np.abs(y) < silent_threshold)
            silence_percentage = (silent_samples / len(y)) * 100
            
            return {
                'duration_seconds': round(duration, 2),
                'sample_rate': sr,
                'peak_amplitude': round(float(peak_amplitude), 4),
                'peak_db': round(20 * np.log10(peak_amplitude + 1e-10), 2),
                'average_rms': round(float(avg_rms), 4),
                'average_rms_db': round(20 * np.log10(avg_rms + 1e-10), 2),
                'estimated_noise_floor_db': round(20 * np.log10(noise_floor + 1e-10), 2),
                'estimated_snr_db': round(float(snr), 2) if snr != float('inf') else 'N/A',
                'silence_percentage': round(silence_percentage, 2),
                'spectral_brightness': round(float(avg_centroid), 2),
                'zero_crossing_rate': round(float(avg_zcr), 4),
                'quality_assessment': self._assess_quality(snr, noise_floor, silence_percentage)
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    def _assess_quality(self, snr, noise_floor, silence_pct):
        """Provide a quality assessment of the audio."""
        issues = []
        score = 100
        
        if snr < 20:
            issues.append("High noise level detected")
            score -= 30
        elif snr < 40:
            issues.append("Moderate noise present")
            score -= 15
        
        if noise_floor > 0.05:
            issues.append("Significant background noise")
            score -= 20
        
        if silence_pct > 50:
            issues.append("Large portions of silence")
            score -= 10
        
        score = max(0, score)
        
        if score >= 80:
            rating = "Excellent"
        elif score >= 60:
            rating = "Good"
        elif score >= 40:
            rating = "Fair"
        else:
            rating = "Poor"
        
        return {
            'score': score,
            'rating': rating,
            'issues': issues if issues else ["No significant issues detected"]
        }
