# Gradient Removal Backend

This backend service provides gradient removal functionality for fabric images. It removes lighting variations and gradients from fabric scans to improve pattern tiling results.

## Features

- **Uniform Mode**: For solid fabrics with simple gradient patterns
- **Advanced Mode**: For multi-color fabrics with complex lighting variations
- **Area-based Processing**: Analyzes a user-selected representative area
- **Polynomial Gradient Modeling**: Uses mathematical modeling to detect and correct lighting gradients
- **Color Space Processing**: Works in LAB color space for better color preservation

## Installation

### Prerequisites
- Python 3.8 or higher
- pip (Python package installer)

### Setup

1. **Quick Setup** (recommended):
   ```bash
   ./setup.sh
   ```

2. **Manual Setup**:
   ```bash
   # Create virtual environment
   python3 -m venv venv
   
   # Activate virtual environment
   source venv/bin/activate  # On macOS/Linux
   # or
   venv\Scripts\activate     # On Windows
   
   # Install dependencies
   pip install -r requirements.txt
   ```

## Running the Service

### Quick Start
```bash
./run.sh
```

### Manual Start
```bash
# Activate virtual environment
source venv/bin/activate

# Start the server
python app.py
```

The API will be available at `http://localhost:5001`

## API Endpoints

### Health Check
```
GET /health
```
Returns service status.

### Gradient Removal Processing
```
POST /api/gradient-removal
```

**Request Body:**
```json
{
  "image": "data:image/jpeg;base64,...",
  "selection": {
    "left": 0.2,
    "top": 0.3,
    "width": 0.4,
    "height": 0.3
  },
  "mode": "advanced",
  "imageSize": {
    "width": 1920,
    "height": 1080
  }
}
```

**Response:**
```json
{
  "processedImage": "data:image/jpeg;base64,...",
  "mode": "advanced",
  "selection": {...},
  "status": "success"
}
```

### Test Endpoint
```
GET /api/gradient-removal/test
```
Returns service availability and supported modes.

## Algorithm Details

### Uniform Mode
- Analyzes gradients using Sobel edge detection
- Creates linear gradient correction based on mean gradients
- Suitable for solid color fabrics

### Advanced Mode
- Converts to LAB color space for better color analysis
- Uses Gaussian blur to isolate lighting gradients from texture
- Fits 2D polynomial to model complex lighting patterns
- Applies correction primarily to lightness channel
- Preserves color information in A and B channels

## Integration

The backend is designed to work with the React frontend fabric editor. The frontend sends:
1. Base64 encoded image data
2. Selection area coordinates (normalized 0-1)
3. Processing mode (uniform/advanced)
4. Image dimensions

The service returns the processed image as base64 data URL for immediate preview.

## Error Handling

The service includes comprehensive error handling for:
- Invalid image data
- Missing required fields
- Invalid selection coordinates
- Processing failures
- Mathematical computation errors

## Logging

The service logs all processing steps and errors for debugging and monitoring.

## Performance Notes

- Processing time depends on image size and selection area
- Smaller selection areas process faster
- Advanced mode requires more computation than uniform mode
- Memory usage scales with image size