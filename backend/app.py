"""
Flask API server for gradient removal processing.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import traceback
from gradient_removal import GradientRemovalProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Initialize gradient removal processor
processor = GradientRemovalProcessor()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'service': 'gradient-removal-api'})

@app.route('/api/gradient-removal', methods=['POST'])
def process_gradient_removal():
    """Process gradient removal request."""
    try:
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['image', 'selection', 'mode']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        image_data = data['image']
        selection = data['selection']
        mode = data['mode']
        image_size = data.get('imageSize', {})
        settings = data.get('settings', {})
        
        # Extract strength parameters with defaults
        gradient_strength = settings.get('gradientStrength', 0.5)
        brightness_preservation = settings.get('brightnessPreservation', 0.8)
        color_preservation = settings.get('colorPreservation', 0.9)
        
        logger.info(f"Processing gradient removal request - Mode: {mode}, Selection: {selection}")
        logger.info(f"Strength settings - Gradient: {gradient_strength}, Brightness: {brightness_preservation}, Color: {color_preservation}")
        
        # Validate selection data
        if not all(key in selection for key in ['left', 'top', 'width', 'height']):
            return jsonify({'error': 'Invalid selection data'}), 400
        
        # Validate mode
        if mode not in ['uniform', 'advanced']:
            return jsonify({'error': 'Invalid mode. Must be "uniform" or "advanced"'}), 400
        
        # Validate strength parameters
        for param_name, param_value in [('gradientStrength', gradient_strength), 
                                      ('brightnessPreservation', brightness_preservation), 
                                      ('colorPreservation', color_preservation)]:
            if not 0 <= param_value <= 1:
                return jsonify({'error': f'Invalid {param_name}: must be between 0 and 1'}), 400
        
        # Process the image
        processed_image = processor.process_gradient_removal(
            image_data, selection, mode, gradient_strength, brightness_preservation, color_preservation
        )
        
        # Return result
        return jsonify({
            'processedImage': processed_image,
            'mode': mode,
            'selection': selection,
            'status': 'success'
        })
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return jsonify({'error': str(e)}), 400
    
    except Exception as e:
        logger.error(f"Processing error: {e}")
        logger.error(traceback.format_exc())
        return jsonify({'error': 'Internal processing error'}), 500

@app.route('/api/gradient-removal/test', methods=['GET'])
def test_endpoint():
    """Test endpoint to verify the service is working."""
    return jsonify({
        'message': 'Gradient removal service is working',
        'available_modes': ['uniform', 'advanced'],
        'status': 'ready'
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    logger.info("Starting gradient removal API server...")
    app.run(host='0.0.0.0', port=5001, debug=True)