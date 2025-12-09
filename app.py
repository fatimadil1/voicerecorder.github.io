"""
Voice Recorder Pro - Main Flask Application
A web app for recording, converting, and cleaning audio files.
"""

import os
import uuid
import logging
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
from werkzeug.utils import secure_filename
from audio_processor import AudioProcessor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['PROCESSED_FOLDER'] = 'processed'
app.config['ALLOWED_EXTENSIONS'] = {'wav', 'mp3', 'ogg', 'webm', 'flac', 'm4a', 'aac'}

# Create necessary directories
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)

# Initialize audio processor
audio_processor = AudioProcessor()


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


def generate_unique_filename(original_filename, suffix=''):
    """Generate a unique filename."""
    ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'wav'
    unique_id = str(uuid.uuid4())[:8]
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    return f"{timestamp}_{unique_id}{suffix}.{ext}"


@app.route('/')
def index():
    """Render main page."""
    return render_template('index.html')


@app.route('/api/upload', methods=['POST'])
def upload_audio():
    """Handle audio file upload for processing."""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        file = request.files['audio']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        # Save uploaded file
        filename = generate_unique_filename(secure_filename(file.filename))
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Get audio info
        audio_info = audio_processor.get_audio_info(filepath)
        
        logger.info(f"File uploaded: {filename}")
        
        return jsonify({
            'success': True,
            'filename': filename,
            'info': audio_info
        })
    
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/record', methods=['POST'])
def save_recording():
    """Save recorded audio from browser."""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio data provided'}), 400
        
        file = request.files['audio']
        
        # Generate filename for recording
        filename = generate_unique_filename('recording.webm')
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Get audio info
        audio_info = audio_processor.get_audio_info(filepath)
        
        logger.info(f"Recording saved: {filename}")
        
        return jsonify({
            'success': True,
            'filename': filename,
            'info': audio_info
        })
    
    except Exception as e:
        logger.error(f"Recording save error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/convert', methods=['POST'])
def convert_audio():
    """Convert audio to specified format."""
    try:
        data = request.json
        filename = data.get('filename')
        target_format = data.get('format', 'mp3')
        bitrate = data.get('bitrate', '192k')
        sample_rate = data.get('sample_rate', 44100)
        
        if not filename:
            return jsonify({'error': 'No filename provided'}), 400
        
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        if not os.path.exists(input_path):
            return jsonify({'error': 'File not found'}), 404
        
        # Generate output filename
        output_filename = filename.rsplit('.', 1)[0] + f'.{target_format}'
        output_path = os.path.join(app.config['PROCESSED_FOLDER'], output_filename)
        
        # Convert audio
        audio_processor.convert_format(
            input_path, 
            output_path, 
            target_format,
            bitrate=bitrate,
            sample_rate=sample_rate
        )
        
        logger.info(f"Converted: {filename} -> {output_filename}")
        
        return jsonify({
            'success': True,
            'filename': output_filename,
            'download_url': f'/api/download/{output_filename}'
        })
    
    except Exception as e:
        logger.error(f"Conversion error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/reduce-noise', methods=['POST'])
def reduce_noise():
    """Apply noise reduction to audio."""
    try:
        data = request.json
        filename = data.get('filename')
        noise_reduction_strength = float(data.get('strength', 0.75))
        remove_clicks = data.get('remove_clicks', True)
        remove_silence = data.get('remove_silence', False)
        normalize = data.get('normalize', True)
        reduce_echo = data.get('reduce_echo', False)
        
        if not filename:
            return jsonify({'error': 'No filename provided'}), 400
        
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        if not os.path.exists(input_path):
            return jsonify({'error': 'File not found'}), 404
        
        # Generate output filename
        base_name = filename.rsplit('.', 1)[0]
        output_filename = f"{base_name}_cleaned.wav"
        output_path = os.path.join(app.config['PROCESSED_FOLDER'], output_filename)
        
        # Process audio
        processing_options = {
            'noise_reduction_strength': noise_reduction_strength,
            'remove_clicks': remove_clicks,
            'remove_silence': remove_silence,
            'normalize': normalize,
            'reduce_echo': reduce_echo
        }
        
        result = audio_processor.clean_audio(input_path, output_path, processing_options)
        
        logger.info(f"Noise reduced: {filename} -> {output_filename}")
        
        return jsonify({
            'success': True,
            'filename': output_filename,
            'download_url': f'/api/download/{output_filename}',
            'processing_info': result
        })
    
    except Exception as e:
        logger.error(f"Noise reduction error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/download/<filename>')
def download_file(filename):
    """Download processed audio file."""
    try:
        # Check processed folder first, then uploads
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], filename)
        upload_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        if os.path.exists(processed_path):
            return send_file(processed_path, as_attachment=True)
        elif os.path.exists(upload_path):
            return send_file(upload_path, as_attachment=True)
        else:
            return jsonify({'error': 'File not found'}), 404
    
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/analyze', methods=['POST'])
def analyze_audio():
    """Analyze audio and return detailed information."""
    try:
        data = request.json
        filename = data.get('filename')
        
        if not filename:
            return jsonify({'error': 'No filename provided'}), 400
        
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        if not os.path.exists(input_path):
            return jsonify({'error': 'File not found'}), 404
        
        analysis = audio_processor.analyze_audio(input_path)
        
        return jsonify({
            'success': True,
            'analysis': analysis
        })
    
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/cleanup', methods=['POST'])
def cleanup_files():
    """Clean up temporary files."""
    try:
        data = request.json
        filenames = data.get('filenames', [])
        
        deleted = []
        for filename in filenames:
            for folder in [app.config['UPLOAD_FOLDER'], app.config['PROCESSED_FOLDER']]:
                filepath = os.path.join(folder, filename)
                if os.path.exists(filepath):
                    os.remove(filepath)
                    deleted.append(filename)
        
        return jsonify({
            'success': True,
            'deleted': deleted
        })
    
    except Exception as e:
        logger.error(f"Cleanup error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# Error handlers
@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large. Maximum size is 100MB.'}), 413


@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
