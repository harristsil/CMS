"""
Gradient Removal Algorithm for Fabric Images

This module implements gradient removal functionality to eliminate lighting
variations in fabric scans while preserving texture details.
"""

import numpy as np
import cv2
from PIL import Image
import base64
import io
from scipy import ndimage
from scipy.interpolate import griddata
import logging

logger = logging.getLogger(__name__)

class GradientRemovalProcessor:
    def __init__(self):
        self.kernel_size = 15
        self.sigma = 2.0
        
    def decode_image(self, image_data_url):
        """Decode base64 image data URL to numpy array."""
        try:
            # Remove data URL prefix if present
            if ',' in image_data_url:
                image_data = image_data_url.split(',')[1]
            else:
                image_data = image_data_url
                
            # Decode base64
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
                
            # Convert to numpy array
            return np.array(image)
        except Exception as e:
            logger.error(f"Error decoding image: {e}")
            raise ValueError(f"Invalid image data: {e}")
    
    def encode_image(self, image_array):
        """Encode numpy array to base64 data URL."""
        try:
            # Ensure values are in valid range
            image_array = np.clip(image_array, 0, 255).astype(np.uint8)
            
            # Convert to PIL Image
            image = Image.fromarray(image_array)
            
            # Save to bytes
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=95)
            image_data = base64.b64encode(buffer.getvalue()).decode()
            
            return f"data:image/jpeg;base64,{image_data}"
        except Exception as e:
            logger.error(f"Error encoding image: {e}")
            raise ValueError(f"Error encoding image: {e}")
    
    def extract_selection_area(self, image, selection):
        """Extract the selected area from the image."""
        h, w = image.shape[:2]
        
        # Convert relative coordinates to absolute
        x1 = int(selection['left'] * w)
        y1 = int(selection['top'] * h)
        x2 = int((selection['left'] + selection['width']) * w)
        y2 = int((selection['top'] + selection['height']) * h)
        
        # Ensure coordinates are within bounds
        x1 = max(0, min(x1, w-1))
        y1 = max(0, min(y1, h-1))
        x2 = max(x1+1, min(x2, w))
        y2 = max(y1+1, min(y2, h))
        
        return image[y1:y2, x1:x2]
    
    def analyze_gradient_uniform(self, selection_area):
        """Analyze gradient for uniform/solid fabrics with MUCH more aggressive correction."""
        logger.info("🔥🔥🔥 NEW AGGRESSIVE UNIFORM ALGORITHM CALLED! 🔥🔥🔥")
        # Convert to LAB color space for better analysis
        lab = cv2.cvtColor(selection_area, cv2.COLOR_RGB2LAB)
        lightness = lab[:, :, 0].astype(np.float32)
        
        h, w = lightness.shape
        
        # Apply smoothing to reduce texture noise but preserve gradient
        smoothed = cv2.GaussianBlur(lightness, (21, 21), 5.0)  # More aggressive smoothing
        
        # Calculate the gradient across the entire selection
        # Use the difference between edges to determine correction needed
        
        # Get edge values for strong gradient detection
        left_edge = np.mean(smoothed[:, :w//4])     # Left 25%
        right_edge = np.mean(smoothed[:, -w//4:])   # Right 25% 
        top_edge = np.mean(smoothed[:h//4, :])      # Top 25%
        bottom_edge = np.mean(smoothed[-h//4:, :])  # Bottom 25%
        center = np.mean(smoothed[h//4:-h//4, w//4:-w//4])  # Center region
        
        logger.info(f"Edge analysis - Left: {left_edge:.1f}, Right: {right_edge:.1f}, Top: {top_edge:.1f}, Bottom: {bottom_edge:.1f}, Center: {center:.1f}")
        
        # Calculate correction needed - target all regions to center brightness
        y_coords, x_coords = np.mgrid[0:h, 0:w]
        
        # Create STRONG correction surface based on position
        # Normalize coordinates to -1 to +1
        x_norm = (x_coords.astype(np.float32) - w/2) / (w/2)
        y_norm = (y_coords.astype(np.float32) - h/2) / (h/2)
        
        # Calculate gradients in both directions
        horizontal_gradient = (right_edge - left_edge) / w if w > 0 else 0
        vertical_gradient = (bottom_edge - top_edge) / h if h > 0 else 0
        
        logger.info(f"Calculated gradients - Horizontal: {horizontal_gradient:.6f}, Vertical: {vertical_gradient:.6f}")
        
        # Create correction surface - much more aggressive
        gradient_surface = (
            center + 
            horizontal_gradient * x_norm * w * 2.0 +  # 2x amplification
            vertical_gradient * y_norm * h * 2.0      # 2x amplification
        )
        
        # Target brightness (use center or median as target)
        target_brightness = center
        
        # Create aggressive correction factor
        correction = np.divide(
            target_brightness, 
            gradient_surface, 
            out=np.ones_like(gradient_surface), 
            where=gradient_surface > 1
        )
        
        # Allow MUCH more aggressive correction for solid fabrics
        correction = np.clip(correction, 0.1, 10.0)  # Much wider range
        
        # Super-amplify the correction for maximum gradient removal
        correction_delta = correction - 1.0
        correction = 1.0 + (correction_delta * 3.0)  # Triple the correction strength
        correction = np.clip(correction, 0.1, 10.0)
        
        logger.info(f"AGGRESSIVE uniform correction range: {np.min(correction):.3f} - {np.max(correction):.3f}")
        
        # If correction is too weak, force it stronger
        correction_range = np.max(correction) - np.min(correction)
        if correction_range < 0.2:  # If variation is too small
            # Force more variation based on position
            position_correction = 1.0 + (x_norm * 0.3) + (y_norm * 0.3)
            correction = correction * position_correction
            logger.info(f"Forced stronger correction range: {np.min(correction):.3f} - {np.max(correction):.3f}")
        
        return correction
    
    def analyze_gradient_advanced(self, selection_area):
        """Analyze gradient for multi-color fabrics using improved pattern-aware algorithm."""
        # Convert to LAB color space for better color analysis
        lab = cv2.cvtColor(selection_area, cv2.COLOR_RGB2LAB)
        
        # Work with L channel (lightness) for gradient detection
        lightness = lab[:, :, 0].astype(np.float32)
        
        # Detect if this is a patterned fabric by analyzing frequency content
        h, w = lightness.shape
        if h < 50 or w < 50:
            # Too small for reliable pattern detection, use conservative approach
            return self._conservative_correction(lightness)
        
        # Apply different blur levels to separate pattern from lighting
        light_blur = cv2.GaussianBlur(lightness, (31, 31), 8.0)  # Large blur for lighting
        pattern_blur = cv2.GaussianBlur(lightness, (5, 5), 1.0)  # Small blur for patterns
        
        # Calculate the difference to isolate pattern information
        pattern_component = lightness - light_blur
        lighting_component = light_blur
        
        # Analyze pattern regularity using FFT
        pattern_strength = self._analyze_pattern_strength(pattern_component)
        
        if pattern_strength > 0.3:  # Strong pattern detected (like plaid/checkered)
            logger.info(f"Strong pattern detected (strength: {pattern_strength:.3f}), using gentle correction")
            return self._gentle_lighting_correction(lighting_component, lightness)
        else:
            logger.info(f"Weak pattern detected (strength: {pattern_strength:.3f}), using standard correction")
            return self._standard_lighting_correction(lighting_component, lightness)
    
    def _analyze_pattern_strength(self, pattern_component):
        """Analyze the strength of repeating patterns in the fabric."""
        try:
            # Convert to frequency domain
            f_transform = np.fft.fft2(pattern_component)
            f_shift = np.fft.fftshift(f_transform)
            magnitude_spectrum = np.abs(f_shift)
            
            # Analyze frequency distribution
            h, w = magnitude_spectrum.shape
            center_y, center_x = h // 2, w // 2
            
            # Create masks for different frequency regions
            y, x = np.ogrid[:h, :w]
            center_mask = (x - center_x)**2 + (y - center_y)**2 <= (min(h, w) * 0.1)**2
            mid_freq_mask = ((x - center_x)**2 + (y - center_y)**2 > (min(h, w) * 0.1)**2) & \
                           ((x - center_x)**2 + (y - center_y)**2 <= (min(h, w) * 0.4)**2)
            
            # Calculate energy in different frequency bands
            low_freq_energy = np.sum(magnitude_spectrum[center_mask])
            mid_freq_energy = np.sum(magnitude_spectrum[mid_freq_mask])
            total_energy = np.sum(magnitude_spectrum)
            
            # Pattern strength is ratio of mid-frequency to total energy
            if total_energy > 0:
                pattern_strength = mid_freq_energy / total_energy
            else:
                pattern_strength = 0
                
            return min(pattern_strength * 10, 1.0)  # Scale and cap at 1.0
        except:
            return 0.2  # Default moderate pattern strength
    
    def _conservative_correction(self, lightness):
        """Very gentle correction for small areas."""
        mean_val = np.mean(lightness)
        correction = np.ones_like(lightness)
        
        # Apply very gentle gradient removal
        h, w = lightness.shape
        y_coords, x_coords = np.mgrid[0:h, 0:w]
        
        # Simple linear gradient estimation
        grad_x = np.mean(np.gradient(lightness, axis=1))
        grad_y = np.mean(np.gradient(lightness, axis=0))
        
        # Create gentle correction
        x_norm = (x_coords - w/2) / w
        y_norm = (y_coords - h/2) / h
        
        gradient_estimate = mean_val + grad_x * x_norm * w * 0.1 + grad_y * y_norm * h * 0.1
        correction = np.divide(mean_val, gradient_estimate, 
                             out=np.ones_like(gradient_estimate), 
                             where=gradient_estimate!=0)
        
        return np.clip(correction, 0.9, 1.1)
    
    def _gentle_lighting_correction(self, lighting_component, original_lightness):
        """Gentle correction that preserves patterns."""
        h, w = lighting_component.shape
        mean_lighting = np.mean(lighting_component)
        
        # Use very gentle polynomial fitting
        y_coords, x_coords = np.mgrid[0:h, 0:w]
        x_flat = x_coords.flatten()
        y_flat = y_coords.flatten()
        z_flat = lighting_component.flatten()
        
        # Fit only linear terms (no quadratic) for gentler correction
        A = np.column_stack([x_flat, y_flat, np.ones(len(x_flat))])
        
        try:
            coeffs = np.linalg.lstsq(A, z_flat, rcond=None)[0]
            
            # Generate gentle correction surface
            correction_surface = (coeffs[0] * x_coords + 
                                coeffs[1] * y_coords + 
                                coeffs[2])
            
            # Normalize
            correction_surface = correction_surface - np.mean(correction_surface) + mean_lighting
            
            # Create very gentle correction factor
            correction = np.divide(mean_lighting, correction_surface, 
                                 out=np.ones_like(correction_surface), 
                                 where=correction_surface!=0)
            
            # Much tighter limits for pattern preservation
            correction = np.clip(correction, 0.85, 1.15)
            
            return correction
        except:
            return np.ones_like(lighting_component)
    
    def _standard_lighting_correction(self, lighting_component, original_lightness):
        """Standard correction for fabrics without strong patterns."""
        h, w = lighting_component.shape
        mean_lighting = np.mean(lighting_component)
        
        # Standard polynomial fitting
        y_coords, x_coords = np.mgrid[0:h, 0:w]
        x_flat = x_coords.flatten()
        y_flat = y_coords.flatten()
        z_flat = lighting_component.flatten()
        
        # Fit 2D polynomial (degree 2) but with regularization
        A = np.column_stack([
            x_flat**2, y_flat**2, x_flat*y_flat,
            x_flat, y_flat, np.ones(len(x_flat))
        ])
        
        try:
            # Add regularization to prevent overfitting
            reg_param = 1e-6
            ATA = A.T @ A + reg_param * np.eye(A.shape[1])
            ATb = A.T @ z_flat
            coeffs = np.linalg.solve(ATA, ATb)
            
            # Generate correction surface
            correction_surface = (coeffs[0] * x_coords**2 + 
                                coeffs[1] * y_coords**2 + 
                                coeffs[2] * x_coords * y_coords +
                                coeffs[3] * x_coords + 
                                coeffs[4] * y_coords + 
                                coeffs[5])
            
            # Normalize
            correction_surface = correction_surface - np.mean(correction_surface) + mean_lighting
            
            # Create correction factor
            correction = np.divide(mean_lighting, correction_surface, 
                                 out=np.ones_like(correction_surface), 
                                 where=correction_surface!=0)
            
            # Moderate limits to avoid artifacts
            correction = np.clip(correction, 0.7, 1.4)
            
            return correction
        except:
            return np.ones_like(lighting_component)
    
    def apply_gradient_correction(self, image, selection, correction_map, mode='advanced',
                                gradient_strength=0.5, brightness_preservation=0.8, color_preservation=0.9):
        """Apply aggressive gradient correction while preserving fabric texture and thread details."""
        h, w = image.shape[:2]
        result = image.copy().astype(np.float32)
        
        logger.info(f"Applying aggressive texture-preserving correction - Gradient: {gradient_strength}, Brightness: {brightness_preservation}, Color: {color_preservation}")
        
        if gradient_strength == 0:
            logger.info("Gradient strength is 0, returning original image")
            return image
        
        # Resize correction map to match full image with smooth interpolation
        correction_full = cv2.resize(correction_map, (w, h), interpolation=cv2.INTER_CUBIC)
        
        # Apply smoothing but not too heavy - we want effective gradient removal
        correction_full = cv2.GaussianBlur(correction_full, (25, 25), 5.0)
        
        # Make correction more aggressive by amplifying the correction values
        correction_delta = correction_full - 1.0
        # Amplify the correction delta for more aggressive gradient removal
        amplified_delta = correction_delta * 2.0  # Double the correction strength
        effective_correction = 1.0 + (gradient_strength * amplified_delta)
        
        logger.info(f"Aggressive correction range: {np.min(effective_correction):.3f} - {np.max(effective_correction):.3f}")
        
        # ENHANCED TEXTURE-PRESERVING APPROACH:
        # Separate texture at multiple scales for better preservation
        
        # Extract texture details at multiple scales
        fine_texture = result - cv2.GaussianBlur(result, (5, 5), 1.0)    # Fine threads
        medium_texture = result - cv2.GaussianBlur(result, (15, 15), 3.0) # Medium weave
        coarse_texture = result - cv2.GaussianBlur(result, (35, 35), 7.0) # Coarse structure
        
        # Get the base lighting (heavily smoothed)
        base_lighting = cv2.GaussianBlur(result, (35, 35), 7.0)
        
        # Apply AGGRESSIVE correction to base lighting only
        corrected_lighting = np.zeros_like(base_lighting)
        for channel in range(3):  # RGB channels
            corrected_lighting[:, :, channel] = base_lighting[:, :, channel] * effective_correction
        
        # Recombine with preserved texture at all scales
        # Start with corrected base lighting
        result_corrected = corrected_lighting.copy()
        
        # Add back texture details with full strength (100% preservation)
        result_corrected += fine_texture * 0.9     # 90% fine texture preservation
        result_corrected += (medium_texture - fine_texture) * 0.8  # 80% medium texture
        result_corrected += (coarse_texture - medium_texture) * 0.7  # 70% coarse texture
        
        # Alternative approach: Direct lighting gradient flattening
        if mode == 'uniform':
            # For uniform fabrics, create perfectly flat lighting
            logger.info("Uniform mode: Creating perfectly flat lighting")
            
            # Calculate target uniform brightness (median is more robust than mean)
            target_brightness = np.median(base_lighting, axis=(0, 1))
            
            # Create perfectly uniform base lighting
            uniform_lighting = np.full_like(base_lighting, target_brightness)
            
            # Blend based on gradient strength
            final_lighting = gradient_strength * uniform_lighting + (1 - gradient_strength) * base_lighting
            
            # Combine with original texture
            result_corrected = final_lighting + fine_texture + (medium_texture - fine_texture) * 0.8
        
        # Brightness preservation - maintain overall brightness
        if brightness_preservation > 0:
            original_brightness = np.mean(result)
            corrected_brightness = np.mean(result_corrected)
            
            if corrected_brightness > 0:
                brightness_factor = original_brightness / corrected_brightness
                # Less aggressive clamping to allow more correction
                brightness_factor = np.clip(brightness_factor, 0.3, 3.0)
                
                # Apply brightness correction
                brightness_blend = brightness_preservation * brightness_factor + (1 - brightness_preservation) * 1.0
                result_corrected *= brightness_blend
                logger.info(f"Brightness factor: {brightness_factor:.3f}, blend: {brightness_blend:.3f}")
        
        # Color preservation - only if user wants it (lower values = more correction)
        if color_preservation > 0.5:  # Only blend if preservation > 50%
            blend_factor = (color_preservation - 0.5) * 2.0  # Map 0.5-1.0 to 0.0-1.0
            result_corrected = blend_factor * result + (1 - blend_factor) * result_corrected
            logger.info(f"Color preservation blend: {blend_factor:.3f}")
        
        # Ensure values are in valid range
        result_corrected = np.clip(result_corrected, 0, 255)
        
        # Texture quality check
        original_texture_std = np.std(result - cv2.GaussianBlur(result, (15, 15), 3.0))
        final_texture_std = np.std(result_corrected - cv2.GaussianBlur(result_corrected, (15, 15), 3.0))
        
        texture_ratio = final_texture_std / original_texture_std if original_texture_std > 0 else 1.0
        logger.info(f"Texture preservation: {texture_ratio:.3f} (target: >0.8)")
        
        # Calculate lighting uniformity improvement
        original_lighting_std = np.std(cv2.GaussianBlur(result, (25, 25), 5.0))
        final_lighting_std = np.std(cv2.GaussianBlur(result_corrected, (25, 25), 5.0))
        uniformity_improvement = (original_lighting_std - final_lighting_std) / original_lighting_std if original_lighting_std > 0 else 0
        
        logger.info(f"Lighting uniformity improvement: {uniformity_improvement:.3f} (higher is better)")
        logger.info(f"Final brightness: Original={np.mean(result):.1f}, Final={np.mean(result_corrected):.1f}")
        
        return result_corrected.astype(np.uint8)
    
    def process_gradient_removal(self, image_data_url, selection, mode='advanced', 
                                gradient_strength=0.5, brightness_preservation=0.8, color_preservation=0.9):
        """Main processing function for gradient removal."""
        try:
            logger.info(f"Processing gradient removal with mode: {mode}")
            logger.info(f"Strength parameters - Gradient: {gradient_strength}, Brightness: {brightness_preservation}, Color: {color_preservation}")
            
            # Decode image
            image = self.decode_image(image_data_url)
            logger.info(f"Image shape: {image.shape}")
            
            # Extract selection area
            selection_area = self.extract_selection_area(image, selection)
            logger.info(f"Selection area shape: {selection_area.shape}")
            
            # Analyze gradient based on mode
            if mode == 'uniform':
                correction_map = self.analyze_gradient_uniform(selection_area)
            else:
                correction_map = self.analyze_gradient_advanced(selection_area)
            
            # Apply correction to full image with strength parameters
            corrected_image = self.apply_gradient_correction(
                image, selection, correction_map, mode, 
                gradient_strength, brightness_preservation, color_preservation
            )
            
            # Encode result
            result_data_url = self.encode_image(corrected_image)
            
            logger.info("Gradient removal processing completed successfully")
            return result_data_url
            
        except Exception as e:
            logger.error(f"Error in gradient removal processing: {e}")
            raise