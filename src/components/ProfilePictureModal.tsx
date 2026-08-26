import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Image as ImageIcon,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  processAndCompressImage,
  readFileAsDataUrl,
} from '../services/avatarStorage';

interface ProfilePictureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAvatar: (dataUrl: string) => void;
  currentAvatar: string | null;
}

export const ProfilePictureModal: React.FC<ProfilePictureModalProps> = ({
  isOpen,
  onClose,
  onSaveAvatar,
  currentAvatar,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setPreviewSrc(currentAvatar || null);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
      setErrorMessage(null);
    }
  }, [isOpen, currentAvatar]);

  if (!isOpen) return null;

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WebP, etc.)');
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPreviewSrc(dataUrl);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to read image');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSave = async () => {
    if (!previewSrc) {
      setErrorMessage('Please select an image first.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const compressedDataUrl = await processAndCompressImage(previewSrc, {
        maxDimension: 384,
        quality: 0.85,
        zoom,
        offsetX,
        offsetY,
      });

      onSaveAvatar(compressedDataUrl);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetAdjustments = () => {
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        id="profile-picture-modal"
        className="hud-panel w-full max-w-lg border border-[#00f2ff]/40 bg-[#0a0f18] p-5 sm:p-6 space-y-4 shadow-[0_0_30px_rgba(0,242,255,0.15)] font-mono text-xs"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#1a2b3c] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00f2ff]" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff]">
              CHANGE PROFILE PICTURE
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop zone / File selector */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-none p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-[#00f2ff] bg-[#00f2ff]/10'
              : 'border-[#1a2b3c] hover:border-[#00f2ff]/50 bg-[#05070a] hover:bg-[#00f2ff]/5'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <Upload className="w-8 h-8 mx-auto text-[#00f2ff] mb-2 opacity-80" />
          <p className="text-slate-200 font-bold uppercase tracking-wider text-xs">
            {selectedFile ? selectedFile.name : 'CHOOSE IMAGE OR DRAG & DROP'}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            Supports PNG, JPEG, WebP, GIF, SVG. Images are automatically optimized and securely stored locally.
          </p>
        </div>

        {/* Live Circular Preview & Adjustment Controls */}
        {previewSrc && (
          <div className="p-4 bg-[#05070a] border border-[#1a2b3c] space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Circular Avatar Preview Container */}
              <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-[#00f2ff] bg-[#0a0f16] shadow-[0_0_15px_rgba(0,242,255,0.3)] shrink-0 flex items-center justify-center">
                <div
                  className="w-full h-full"
                  style={{
                    transform: `scale(${zoom}) translate(${offsetX * 20}%, ${offsetY * 20}%)`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.05s ease-out',
                  }}
                >
                  <img
                    src={previewSrc}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Sliders & Tools */}
              <div className="flex-1 w-full space-y-2.5">
                {/* Zoom control */}
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span className="flex items-center gap-1">
                      <ZoomIn className="w-3 h-3 text-[#00f2ff]" /> ZOOM
                    </span>
                    <span className="text-[#00f2ff] font-bold">{zoom.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-[#0a0f16] rounded-lg appearance-none cursor-pointer accent-[#00f2ff]"
                  />
                </div>

                {/* Horizontal Pan */}
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>PAN X (HORIZONTAL)</span>
                    <span className="text-[#00f2ff] font-bold">{Math.round(offsetX * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={offsetX}
                    onChange={(e) => setOffsetX(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-[#0a0f16] rounded-lg appearance-none cursor-pointer accent-[#00f2ff]"
                  />
                </div>

                {/* Vertical Pan */}
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>PAN Y (VERTICAL)</span>
                    <span className="text-[#00f2ff] font-bold">{Math.round(offsetY * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={offsetY}
                    onChange={(e) => setOffsetY(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-[#0a0f16] rounded-lg appearance-none cursor-pointer accent-[#00f2ff]"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleResetAdjustments}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-[#00f2ff] uppercase transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>RESET POSITION</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-2.5 bg-rose-950/30 border border-rose-500/50 text-rose-300 flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1a2b3c]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#1a2b3c] bg-[#05070a] hover:bg-slate-800 text-slate-400 hover:text-slate-200 uppercase font-bold text-xs tracking-wider transition-colors"
          >
            CANCEL
          </button>

          <button
            id="save-profile-picture-button"
            type="button"
            onClick={handleSave}
            disabled={!previewSrc || isProcessing}
            className="flex items-center gap-1.5 px-5 py-2 border border-[#00f2ff]/60 bg-[#00f2ff]/15 hover:bg-[#00f2ff]/25 text-[#00f2ff] uppercase font-bold text-xs tracking-wider transition-all disabled:opacity-50 shadow-[0_0_10px_rgba(0,242,255,0.2)]"
          >
            <Check className="w-4 h-4" />
            <span>{isProcessing ? 'OPTIMIZING...' : 'SAVE PROFILE PICTURE'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
