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
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const previewCanvasRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target.result);
        setOriginalFileName(file.name);
        setImageLoaded(true);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prevZoom => Math.max(0.5, Math.min(5, prevZoom * zoomFactor)));
  }, []);

  const handlePanStart = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

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
    const img = imageRef.current;
    
    // Calculate the mouse position relative to the container
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    // Convert container coordinates to image coordinates accounting for zoom and pan
    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;
    
    // Calculate image dimensions as displayed
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
    
    // Apply zoom
    displayWidth *= zoom;
    displayHeight *= zoom;
    
    // Calculate the image position considering pan
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
  }, [isDragging, isPanning, handlePanMove, zoom, pan]);

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

  const updatePreview = useCallback(() => {
    if (!imageRef.current || !previewCanvasRef.current || !selectedImage) return;

    const img = imageRef.current;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');

    const left = Math.min(cropLines.vertical1, cropLines.vertical2);
    const right = Math.max(cropLines.vertical1, cropLines.vertical2);
    const top = Math.min(cropLines.horizontal1, cropLines.horizontal2);
    const bottom = Math.max(cropLines.horizontal1, cropLines.horizontal2);

    const cropX = (left / 100) * img.naturalWidth;
    const cropY = (top / 100) * img.naturalHeight;
    const cropWidth = ((right - left) / 100) * img.naturalWidth;
    const cropHeight = ((bottom - top) / 100) * img.naturalHeight;

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
        const tilesX = Math.ceil(canvas.offsetWidth / scaledTileWidth) + 1;
        const tilesY = Math.ceil(canvas.offsetHeight / scaledTileHeight) + 1;

        for (let x = 0; x < tilesX; x++) {
          for (let y = 0; y < tilesY; y++) {
            ctx.drawImage(
              tileCanvas,
              x * scaledTileWidth,
              y * scaledTileHeight,
              scaledTileWidth,
              scaledTileHeight
            );
          }
        }
      }

      setTileCanvas(tileCanvas);
    }
  }, [cropLines, selectedImage, previewZoom]);

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
        <h1 className="page-title">Edit Fabric</h1>
        
        <div className="fabric-workspace">
          <div className="left-panel">
            <div className="upload-section">
              <div className="upload-area">
                <input
                  type="file"
                  id="fabric-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="file-input"
                />
                <label htmlFor="fabric-upload" className="upload-button">
                  Upload Fabric Image
                </label>
                {originalFileName && (
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
                  style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
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
                    onLoad={() => setImageLoaded(true)}
                    draggable={false}
                  />
                  
                  <div 
                    className="crop-overlay"
                    style={{
                      transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                      transformOrigin: 'center center'
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
                
                <div className="editor-controls">
                  <button onClick={handleCrop} className="crop-button">
                    Download Tile
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="right-panel">
            {imageLoaded && (
              <div className="preview-section">
                <div className="preview-header">
                  <h3>Pattern Preview</h3>
                  <div className="preview-zoom-controls">
                    <button onClick={() => setPreviewZoom(Math.max(0.1, previewZoom - 0.25))}>-</button>
                    <span>Zoom: {Math.round(previewZoom * 100)}%</span>
                    <button onClick={() => setPreviewZoom(Math.min(10, previewZoom + 0.25))}>+</button>
                    <button onClick={() => setPreviewZoom(1)}>Reset</button>
                  </div>
                </div>
                <canvas 
                  ref={previewCanvasRef}
                  className="preview-canvas"
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