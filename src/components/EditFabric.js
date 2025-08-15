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
      setSelectedImage(event.target.result);
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
    if (!imageRef.current || !containerRef.current) return;

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
    
    setImageDisplaySize({ width: displayWidth, height: displayHeight, left, top });
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

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      handlePanMove(e);
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
  }, [isDragging, isPanning, handlePanMove, zoom, pan, imageDisplaySize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
    handlePanEnd();
  }, [handlePanEnd]);

  React.useEffect(() => {
    if (isDragging || isPanning) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isPanning, handleMouseMove, handleMouseUp]);

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

      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      canvas.style.width = canvas.offsetWidth + 'px';
      canvas.style.height = canvas.offsetHeight + 'px';
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scaledTileWidth = cropWidth * previewZoom;
      const scaledTileHeight = cropHeight * previewZoom;

      if (scaledTileWidth > 0 && scaledTileHeight > 0) {
        const tilesX = Math.ceil(canvas.offsetWidth / scaledTileWidth) + 2;
        const tilesY = Math.ceil(canvas.offsetHeight / scaledTileHeight) + 2;

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
                  onMouseDown={handlePanStart}
                  style={{ cursor: isPanning ? 'grabbing' : (zoom > 1 ? 'grab' : 'default') }}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditFabric;