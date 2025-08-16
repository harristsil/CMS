import React, { useState, useRef, useCallback, useEffect } from 'react';
import './EditFabric.css';

const EditFabric = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [originalFileName, setOriginalFileName] = useState('');
  const [cropLines, setCropLines] = useState({
    vertical1: 25,
    vertical2: 75,
    horizontal1: 25,
    horizontal2: 75
  });
  const [isDragging, setIsDragging] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [tileCanvas, setTileCanvas] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [isPreviewPanning, setIsPreviewPanning] = useState(false);
  const [previewPanStart, setPreviewPanStart] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState('idle');
  const [uploadError, setUploadError] = useState('');
  const [imageDisplaySize, setImageDisplaySize] = useState({ width: 0, height: 0, left: 0, top: 0 });
  const [editorMode, setEditorMode] = useState('crop');
  const [gradientRemovalMode, setGradientRemovalMode] = useState('uniform');
  const [selectionArea, setSelectionArea] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [gradientPreview, setGradientPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalImageBeforeGradient, setOriginalImageBeforeGradient] = useState(null);
  const [veryOriginalImage, setVeryOriginalImage] = useState(null);
  const [gradientStrength, setGradientStrength] = useState(100);
  const [brightnessPreservation, setBrightnessPreservation] = useState(90);
  const [colorPreservation, setColorPreservation] = useState(0);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!allowedTypes.includes(file.type)) {
      return 'Please select a valid image file (JPEG, PNG, GIF, or WebP)';
    }
    
    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }
    
    return null;
  };

  const processFile = (file) => {
    setUploadError('');
    
    const error = validateFile(file);
    if (error) {
      setUploadError(error);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target.result;
      setSelectedImage(imageData);
      setVeryOriginalImage(imageData); // Store the truly original image
      setOriginalImageBeforeGradient(null); // Reset gradient undo
      setOriginalFileName(file.name);
      setImageLoaded(true);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState('hover');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragState('idle');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState('hover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState('idle');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleUploadAreaClick = () => {
    fileInputRef.current?.click();
  };

  const handleModeSwitch = (mode) => {
    setEditorMode(mode);
    if (mode === 'gradient') {
      setSelectionArea(null);
      setGradientPreview(null);
      // Store the truly original image for undo functionality
      if (veryOriginalImage && !originalImageBeforeGradient) {
        setOriginalImageBeforeGradient(veryOriginalImage);
      }
      // Recalculate image display size when switching to gradient mode
      setTimeout(calculateImageDisplaySize, 100);
    }
  };

  const handleGradientModeChange = (mode) => {
    setGradientRemovalMode(mode);
    if (selectionArea) {
      processGradientRemoval();
    }
  };

  const processGradientRemoval = useCallback(async () => {
    if (!selectionArea || !selectedImage) return;
    
    console.log('Processing gradient removal with:', {
      selection: selectionArea, 
      mode: gradientRemovalMode,
      strength: gradientStrength,
      brightness: brightnessPreservation,
      color: colorPreservation
    });
    setIsProcessing(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = imageRef.current;
      
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      
      const response = await fetch('http://localhost:5001/api/gradient-removal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData,
          selection: selectionArea,
          mode: gradientRemovalMode,
          imageSize: {
            width: img.naturalWidth,
            height: img.naturalHeight
          },
          settings: {
            gradientStrength: gradientStrength / 100,
            brightnessPreservation: brightnessPreservation / 100,
            colorPreservation: colorPreservation / 100
          }
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setGradientPreview(result.processedImage);
        console.log('Gradient removal successful');
      } else {
        console.error('Gradient removal failed:', response.status);
      }
    } catch (error) {
      console.error('Gradient removal processing failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [selectionArea, selectedImage, gradientRemovalMode, gradientStrength, brightnessPreservation, colorPreservation]);

  // Debounced processing for real-time updates
  const debouncedProcessGradientRemoval = useCallback(
    (() => {
      let timeoutId;
      return () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (selectionArea) {
            processGradientRemoval();
          }
        }, 500); // 500ms delay
      };
    })(),
    [processGradientRemoval, selectionArea]
  );

  // Trigger processing when strength values change
  useEffect(() => {
    if (selectionArea) {
      debouncedProcessGradientRemoval();
    }
  }, [gradientStrength, brightnessPreservation, colorPreservation, debouncedProcessGradientRemoval]);

  const applyGradientRemoval = () => {
    if (gradientPreview) {
      setSelectedImage(gradientPreview);
      setEditorMode('crop');
      setSelectionArea(null);
      setGradientPreview(null);
      // Force preview update after applying gradient removal
      setTimeout(() => {
        calculateImageDisplaySize();
        // Trigger preview update by clearing and recalculating
        const currentZoom = zoom;
        const currentPan = pan;
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setTimeout(() => {
          setZoom(currentZoom);
          setPan(currentPan);
        }, 100);
      }, 100);
    }
  };

  const undoGradientRemoval = () => {
    if (originalImageBeforeGradient) {
      setSelectedImage(originalImageBeforeGradient);
      // Don't clear originalImageBeforeGradient - keep it for future undos
      setGradientPreview(null);
      setSelectionArea(null);
      // Force preview update after undo
      setTimeout(() => {
        calculateImageDisplaySize();
        const currentZoom = zoom;
        const currentPan = pan;
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setTimeout(() => {
          setZoom(currentZoom);
          setPan(currentPan);
        }, 100);
      }, 100);
    }
  };

  const cancelGradientRemoval = () => {
    setEditorMode('crop');
    setSelectionArea(null);
    setGradientPreview(null);
  };

  const handlePreviewPanStart = useCallback((e) => {
    setIsPreviewPanning(true);
    setPreviewPanStart({ x: e.clientX - previewPan.x, y: e.clientY - previewPan.y });
  }, [previewPan]);

  const handlePreviewPanMove = useCallback((e) => {
    if (isPreviewPanning) {
      setPreviewPan({
        x: e.clientX - previewPanStart.x,
        y: e.clientY - previewPanStart.y
      });
    }
  }, [isPreviewPanning, previewPanStart]);

  const handlePreviewPanEnd = useCallback(() => {
    setIsPreviewPanning(false);
  }, []);

  const handlePreviewWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setPreviewZoom(prevZoom => Math.max(0.01, Math.min(10, prevZoom * zoomFactor)));
  }, []);

  const calculateImageDisplaySize = useCallback(() => {
    if (!imageRef.current || !containerRef.current) {
      console.log('calculateImageDisplaySize: Missing refs');
      return;
    }

    const img = imageRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = containerRect.width / containerRect.height;
    
    let displayWidth, displayHeight;
    
    if (imgAspect > containerAspect) {
      displayWidth = containerRect.width;
      displayHeight = containerRect.width / imgAspect;
    } else {
      displayHeight = containerRect.height;
      displayWidth = containerRect.height * imgAspect;
    }
    
    const left = (containerRect.width - displayWidth) / 2;
    const top = (containerRect.height - displayHeight) / 2;
    
    const newSize = { width: displayWidth, height: displayHeight, left, top };
    console.log('Image display size calculated:', newSize);
    setImageDisplaySize(newSize);
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prevZoom => Math.max(0.5, Math.min(5, prevZoom * zoomFactor)));
  }, []);

  const handlePanStart = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) || zoom > 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan, zoom]);

  const handlePanMove = useCallback((e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  }, [isPanning, panStart]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseDown = (lineType, e) => {
    e.stopPropagation();
    setIsDragging(lineType);
  };

  const handleSelectionStart = useCallback((e) => {
    if (editorMode !== 'gradient') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    const displayWidth = imageDisplaySize.width * zoom;
    const displayHeight = imageDisplaySize.height * zoom;
    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;
    const imgLeft = containerCenterX - displayWidth / 2 + pan.x;
    const imgTop = containerCenterY - displayHeight / 2 + pan.y;
    
    console.log('Selection start:', { mouseX, mouseY, imgLeft, imgTop, displayWidth, displayHeight });
    
    if (mouseX >= imgLeft && mouseX <= imgLeft + displayWidth &&
        mouseY >= imgTop && mouseY <= imgTop + displayHeight) {
      setIsSelecting(true);
      setSelectionStart({ x: mouseX, y: mouseY });
      setSelectionArea(null);
      console.log('Starting selection');
    } else {
      console.log('Click outside image bounds');
    }
  }, [editorMode, imageDisplaySize, zoom, pan]);

  const handleSelectionMove = useCallback((e) => {
    if (!isSelecting || editorMode !== 'gradient') return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    const width = Math.abs(mouseX - selectionStart.x);
    const height = Math.abs(mouseY - selectionStart.y);
    const left = Math.min(mouseX, selectionStart.x);
    const top = Math.min(mouseY, selectionStart.y);
    
    const displayWidth = imageDisplaySize.width * zoom;
    const displayHeight = imageDisplaySize.height * zoom;
    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;
    const imgLeft = containerCenterX - displayWidth / 2 + pan.x;
    const imgTop = containerCenterY - displayHeight / 2 + pan.y;
    
    const relativeLeft = (left - imgLeft) / displayWidth;
    const relativeTop = (top - imgTop) / displayHeight;
    const relativeWidth = width / displayWidth;
    const relativeHeight = height / displayHeight;
    
    const newSelection = {
      left: Math.max(0, Math.min(1, relativeLeft)),
      top: Math.max(0, Math.min(1, relativeTop)),
      width: Math.max(0, Math.min(1 - Math.max(0, relativeLeft), relativeWidth)),
      height: Math.max(0, Math.min(1 - Math.max(0, relativeTop), relativeHeight))
    };
    
    console.log('Selection area:', newSelection);
    setSelectionArea(newSelection);
  }, [isSelecting, editorMode, selectionStart, imageDisplaySize, zoom, pan]);

  const handleSelectionEnd = useCallback(() => {
    setIsSelecting(false);
    if (selectionArea && selectionArea.width > 0.01 && selectionArea.height > 0.01) {
      setTimeout(() => processGradientRemoval(), 100);
    }
  }, [selectionArea, processGradientRemoval]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      handlePanMove(e);
      return;
    }

    if (isSelecting) {
      handleSelectionMove(e);
      return;
    }

    if (!isDragging || !containerRef.current || !imageRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Calculate the mouse position relative to the container
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    // Use the calculated image display dimensions
    const displayWidth = imageDisplaySize.width * zoom;
    const displayHeight = imageDisplaySize.height * zoom;
    
    // Calculate the image position considering pan and zoom
    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;
    const imgLeft = containerCenterX - displayWidth / 2 + pan.x;
    const imgTop = containerCenterY - displayHeight / 2 + pan.y;
    
    let percentage;

    if (isDragging.includes('vertical')) {
      const relativeX = mouseX - imgLeft;
      percentage = (relativeX / displayWidth) * 100;
      percentage = Math.max(0, Math.min(100, percentage));
      setCropLines(prev => ({ ...prev, [isDragging]: percentage }));
    } else if (isDragging.includes('horizontal')) {
      const relativeY = mouseY - imgTop;
      percentage = (relativeY / displayHeight) * 100;
      percentage = Math.max(0, Math.min(100, percentage));
      setCropLines(prev => ({ ...prev, [isDragging]: percentage }));
    }
  }, [isDragging, isPanning, isSelecting, handlePanMove, handleSelectionMove, zoom, pan, imageDisplaySize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
    handlePanEnd();
    handleSelectionEnd();
  }, [handlePanEnd, handleSelectionEnd]);

  React.useEffect(() => {
    if (isDragging || isPanning || isSelecting) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isPanning, isSelecting, handleMouseMove, handleMouseUp]);

  React.useEffect(() => {
    if (isPreviewPanning) {
      document.addEventListener('mousemove', handlePreviewPanMove);
      document.addEventListener('mouseup', handlePreviewPanEnd);
      return () => {
        document.removeEventListener('mousemove', handlePreviewPanMove);
        document.removeEventListener('mouseup', handlePreviewPanEnd);
      };
    }
  }, [isPreviewPanning, handlePreviewPanMove, handlePreviewPanEnd]);

  React.useEffect(() => {
    if (imageLoaded) {
      calculateImageDisplaySize();
      const handleResize = () => calculateImageDisplaySize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [imageLoaded, calculateImageDisplaySize]);

  React.useEffect(() => {
    if (imageLoaded) {
      calculateImageDisplaySize();
    }
  }, [zoom, pan, imageLoaded, calculateImageDisplaySize]);

  const updatePreview = useCallback(() => {
    if (!imageRef.current || !previewCanvasRef.current || !selectedImage) return;

    const img = imageRef.current;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');

    const left = Math.min(cropLines.vertical1, cropLines.vertical2);
    const right = Math.max(cropLines.vertical1, cropLines.vertical2);
    const top = Math.min(cropLines.horizontal1, cropLines.horizontal2);
    const bottom = Math.max(cropLines.horizontal1, cropLines.horizontal2);

    // Crop exactly at the line positions (lines act as knife edges)
    const cropX = Math.floor((left / 100) * img.naturalWidth);
    const cropY = Math.floor((top / 100) * img.naturalHeight);
    const cropWidth = Math.floor((right / 100) * img.naturalWidth) - cropX;
    const cropHeight = Math.floor((bottom / 100) * img.naturalHeight) - cropY;

    if (cropWidth > 0 && cropHeight > 0) {
      const tileCanvas = document.createElement('canvas');
      const tileCtx = tileCanvas.getContext('2d');
      tileCanvas.width = cropWidth;
      tileCanvas.height = cropHeight;

      tileCtx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );

      // Use fixed canvas dimensions based on available space
      const canvasContainer = canvas.parentElement;
      const containerRect = canvasContainer.getBoundingClientRect();
      const availableWidth = containerRect.width - 32; // Account for padding
      const availableHeight = Math.max(300, containerRect.height - 120); // Min height, minus header space
      
      canvas.width = availableWidth * window.devicePixelRatio;
      canvas.height = availableHeight * window.devicePixelRatio;
      canvas.style.width = availableWidth + 'px';
      canvas.style.height = availableHeight + 'px';
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scaledTileWidth = cropWidth * previewZoom;
      const scaledTileHeight = cropHeight * previewZoom;

      if (scaledTileWidth > 0 && scaledTileHeight > 0) {
        const tilesX = Math.ceil(availableWidth / scaledTileWidth) + 2;
        const tilesY = Math.ceil(availableHeight / scaledTileHeight) + 2;

        const startX = Math.floor(-previewPan.x / scaledTileWidth) - 1;
        const startY = Math.floor(-previewPan.y / scaledTileHeight) - 1;

        for (let x = startX; x < startX + tilesX; x++) {
          for (let y = startY; y < startY + tilesY; y++) {
            ctx.drawImage(
              tileCanvas,
              x * scaledTileWidth + previewPan.x,
              y * scaledTileHeight + previewPan.y,
              scaledTileWidth,
              scaledTileHeight
            );
          }
        }
      }

      setTileCanvas(tileCanvas);
    }
  }, [cropLines, selectedImage, previewZoom, previewPan]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  const handleCrop = () => {
    if (!tileCanvas) return;

    const nameWithoutExt = originalFileName.replace(/\.[^/.]+$/, '');
    const extension = originalFileName.split('.').pop();
    const newFileName = `${nameWithoutExt}_tile.${extension}`;

    tileCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = newFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="edit-fabric">
      <div className="container">
        <div className="fabric-workspace">
          <div className="left-panel">
            <div className="upload-section">
              <div 
                className={`upload-area ${dragState}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={handleUploadAreaClick}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="fabric-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="file-input"
                />
                <div className="upload-content">
                  <div className="upload-icon">📁</div>
                  <div className="upload-text">
                    <span className="primary-text">
                      {dragState === 'hover' ? 'Drop image here' : 'Drop image or click to browse'}
                    </span>
                    <span className="secondary-text">
                      JPEG, PNG, GIF, WebP (max 10MB)
                    </span>
                  </div>
                </div>
                {uploadError && (
                  <p className="error-message">{uploadError}</p>
                )}
                {originalFileName && !uploadError && (
                  <p className="file-name">Selected: {originalFileName}</p>
                )}
              </div>
            </div>

            {imageLoaded && (
              <div className="editor-section">

                {editorMode === 'gradient' && (
                  <div className="gradient-controls">
                    <div className="gradient-mode-selector">
                      <label>
                        <input
                          type="radio"
                          value="uniform"
                          checked={gradientRemovalMode === 'uniform'}
                          onChange={(e) => handleGradientModeChange(e.target.value)}
                        />
                        Uniform (Solid Fabrics)
                      </label>
                      <label>
                        <input
                          type="radio"
                          value="advanced"
                          checked={gradientRemovalMode === 'advanced'}
                          onChange={(e) => handleGradientModeChange(e.target.value)}
                        />
                        Advanced (Multi-color)
                      </label>
                    </div>

                    <div className="strength-controls">
                      <h4>Adjustment Controls</h4>
                      
                      <div className="control-group">
                        <label className="control-label">
                          Gradient Removal Strength: {gradientStrength}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={gradientStrength}
                          onChange={(e) => setGradientStrength(parseInt(e.target.value))}
                          className="strength-slider"
                        />
                        <span className="control-hint">How much gradient to remove</span>
                      </div>

                      <div className="control-group">
                        <label className="control-label">
                          Brightness Preservation: {brightnessPreservation}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={brightnessPreservation}
                          onChange={(e) => setBrightnessPreservation(parseInt(e.target.value))}
                          className="strength-slider"
                        />
                        <span className="control-hint">Maintain original brightness</span>
                      </div>

                      <div className="control-group">
                        <label className="control-label">
                          Color Preservation: {colorPreservation}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={colorPreservation}
                          onChange={(e) => setColorPreservation(parseInt(e.target.value))}
                          className="strength-slider"
                        />
                        <span className="control-hint">Maintain original color tone</span>
                      </div>

                    </div>
                    
                    <div className="select-all-section">
                      <button 
                        onClick={() => {
                          // Select the entire image
                          setSelectionArea({
                            left: 0,
                            top: 0,
                            width: 1,
                            height: 1
                          });
                          // Trigger gradient removal processing
                          setTimeout(() => processGradientRemoval(), 100);
                        }}
                        className="select-all-button"
                      >
                        Select All
                      </button>
                    </div>

                    <div className="gradient-actions">
                      <button 
                        onClick={applyGradientRemoval} 
                        className="apply-button"
                        disabled={!gradientPreview || isProcessing}
                      >
                        {isProcessing ? 'Processing...' : 'Apply'}
                      </button>
                      <button 
                        onClick={cancelGradientRemoval} 
                        className="cancel-button"
                      >
                        Cancel
                      </button>
                    </div>
                    {originalImageBeforeGradient && (
                      <div className="undo-section">
                        <button 
                          onClick={undoGradientRemoval}
                          className="undo-button"
                        >
                          Undo Gradient Removal
                        </button>
                      </div>
                    )}
                    {selectionArea && (
                      <div className="selection-info">
                        <p>Selection area: {Math.round(selectionArea.width * 100)}% × {Math.round(selectionArea.height * 100)}%</p>
                        <p>Tip: Select a small representative area for best results</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="zoom-controls">
                  <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>-</button>
                  <span>Zoom: {Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(Math.min(5, zoom + 0.25))}>+</button>
                  <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset</button>
                </div>
                
                <div 
                  className="image-editor" 
                  ref={containerRef}
                  onWheel={handleWheel}
                  onMouseDown={(e) => {
                    if (editorMode === 'gradient') {
                      handleSelectionStart(e);
                    } else {
                      handlePanStart(e);
                    }
                  }}
                  style={{ 
                    cursor: isPanning ? 'grabbing' : 
                           (editorMode === 'gradient' ? 'crosshair' : 
                           (zoom > 1 ? 'grab' : 'default'))
                  }}
                >
                  <img
                    ref={imageRef}
                    src={selectedImage}
                    alt="Fabric"
                    className="fabric-image"
                    style={{
                      transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                      transformOrigin: 'center center'
                    }}
                    onLoad={() => {
                      setImageLoaded(true);
                      setTimeout(calculateImageDisplaySize, 0);
                    }}
                    draggable={false}
                  />
                  
                  <div 
                    className="crop-overlay"
                    style={{
                      transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                      transformOrigin: 'center center',
                      width: `${imageDisplaySize.width}px`,
                      height: `${imageDisplaySize.height}px`,
                      left: `${imageDisplaySize.left}px`,
                      top: `${imageDisplaySize.top}px`
                    }}
                  >
                    {editorMode === 'crop' && (
                      <>
                        <div
                          className="crop-line vertical"
                          style={{ left: `${cropLines.vertical1}%` }}
                          onMouseDown={(e) => handleMouseDown('vertical1', e)}
                        />
                        <div
                          className="crop-line vertical"
                          style={{ left: `${cropLines.vertical2}%` }}
                          onMouseDown={(e) => handleMouseDown('vertical2', e)}
                        />
                        <div
                          className="crop-line horizontal"
                          style={{ top: `${cropLines.horizontal1}%` }}
                          onMouseDown={(e) => handleMouseDown('horizontal1', e)}
                        />
                        <div
                          className="crop-line horizontal"
                          style={{ top: `${cropLines.horizontal2}%` }}
                          onMouseDown={(e) => handleMouseDown('horizontal2', e)}
                        />
                        
                        <div
                          className="crop-area"
                          style={{
                            left: `${Math.min(cropLines.vertical1, cropLines.vertical2)}%`,
                            top: `${Math.min(cropLines.horizontal1, cropLines.horizontal2)}%`,
                            width: `${Math.abs(cropLines.vertical2 - cropLines.vertical1)}%`,
                            height: `${Math.abs(cropLines.horizontal2 - cropLines.horizontal1)}%`
                          }}
                        />
                      </>
                    )}

                    {editorMode === 'gradient' && selectionArea && (
                      <div
                        className="selection-rectangle"
                        style={{
                          left: `${selectionArea.left * 100}%`,
                          top: `${selectionArea.top * 100}%`,
                          width: `${selectionArea.width * 100}%`,
                          height: `${selectionArea.height * 100}%`
                        }}
                      />
                    )}
                  </div>
                </div>
                
              </div>
            )}
          </div>

          <div className="right-panel">
            {imageLoaded && (
              <div className="preview-section">
                <div className="preview-header">
                  <div className="preview-title-section">
                    <h3>Pattern Preview</h3>
                    <button onClick={handleCrop} className="download-tile-button">
                      Download Tile
                    </button>
                  </div>
                  <div className="preview-zoom-controls">
                    <button onClick={() => setPreviewZoom(Math.max(0.01, previewZoom > 0.5 ? previewZoom - 0.25 : previewZoom - 0.05))}>-</button>
                    <span>Zoom: {previewZoom >= 0.1 ? Math.round(previewZoom * 100) : Math.round(previewZoom * 1000) / 10}%</span>
                    <button onClick={() => setPreviewZoom(Math.min(10, previewZoom >= 0.5 ? previewZoom + 0.25 : previewZoom + 0.05))}>+</button>
                    <button onClick={() => { setPreviewZoom(1); setPreviewPan({ x: 0, y: 0 }); }}>Reset</button>
                  </div>
                </div>
                <canvas 
                  ref={previewCanvasRef}
                  className="preview-canvas"
                  onMouseDown={handlePreviewPanStart}
                  onWheel={handlePreviewWheel}
                  style={{ cursor: isPreviewPanning ? 'grabbing' : 'grab' }}
                />
              </div>
            )}
            
            {imageLoaded && (
              <div className="feature-buttons-section">
                <h3>Tools</h3>
                <div className="feature-buttons">
                  <button 
                    className={`feature-button ${editorMode === 'crop' ? 'active' : ''}`}
                    onClick={() => handleModeSwitch('crop')}
                  >
                    Crop & Tile
                  </button>
                  <button 
                    className={`feature-button ${editorMode === 'gradient' ? 'active' : ''}`}
                    onClick={() => handleModeSwitch('gradient')}
                  >
                    Gradient Removal
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditFabric;