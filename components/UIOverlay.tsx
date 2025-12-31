import React, { useRef, useState, useEffect } from 'react';
import { TreeMode } from '../types';

interface UIOverlayProps {
  mode: TreeMode;
  onToggle: () => void;
  onPhotosUpload: (photos: string[]) => void;
  hasPhotos: boolean;
  uploadedPhotos: string[];
  isSharedView: boolean;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({ mode, onToggle, onPhotosUpload, hasPhotos, uploadedPhotos, isSharedView }) => {
  const isFormed = mode === TreeMode.FORMED;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string>('');
  const [shareError, setShareError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [uploadProgress, setUploadProgress] = useState<string>('');

  useEffect(() => {
    // Target Date: Jan 1, 2026
    const targetDate = new Date('2026-01-01T00:00:00');

    const updateTimer = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds });
    };

    const timer = setInterval(updateTimer, 1000);
    updateTimer(); // Initial call

    return () => clearInterval(timer);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const photoUrls: string[] = [];
    const readers: Promise<string>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const promise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            resolve(event.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      });

      readers.push(promise);
    }

    Promise.all(readers).then((urls) => {
      onPhotosUpload(urls);
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Helper function to convert base64 to Blob
  const base64ToBlob = (base64: string): Blob => {
    const byteString = atob(base64.split(',')[1]);
    const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };

  const handleShare = async () => {
    if (!uploadedPhotos || uploadedPhotos.length === 0) {
      setShareError('请先上传照片');
      return;
    }

    setIsSharing(true);
    setShareError('');
    setShareLink('');
    setUploadProgress('准备上传...');

    try {
      // Step 1: Get presigned upload URLs from server
      setUploadProgress('获取上传地址...');
      const urlsResponse = await fetch('/api/get-upload-urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageCount: uploadedPhotos.length,
        }),
      });

      // If API returns 404, use localStorage fallback
      if (urlsResponse.status === 404) {
        const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1');

        if (isLocalDev) {
          console.log('API not available, using localStorage fallback');
          try {
            const shareId = Math.random().toString(36).substring(2, 10);
            const shareData = {
              images: uploadedPhotos,
              createdAt: Date.now(),
            };
            localStorage.setItem(`share_${shareId}`, JSON.stringify(shareData));
            const shareLink = `${window.location.origin}/?share=${shareId}`;
            setShareLink(shareLink);
            return;
          } catch (storageError: any) {
            setShareError('图片数据太大，请减少照片数量或大小');
            return;
          }
        } else {
          throw new Error('API 未配置，请检查部署设置');
        }
      }

      const urlsData = await urlsResponse.json();

      if (!urlsResponse.ok) {
        throw new Error(urlsData.error || '获取上传地址失败');
      }

      const { shareId, uploadUrls } = urlsData;

      // Step 2: Upload images directly to R2 using presigned URLs
      setUploadProgress(`上传照片中 (0/${uploadedPhotos.length})...`);

      let uploadedCount = 0;
      const uploadPromises = uploadedPhotos.map(async (photo, index) => {
        const blob = base64ToBlob(photo);
        const { uploadUrl, publicUrl } = uploadUrls[index];

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': 'image/jpeg',
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`上传第 ${index + 1} 张图片失败`);
        }

        uploadedCount++;
        setUploadProgress(`上传照片中 (${uploadedCount}/${uploadedPhotos.length})...`);
        return publicUrl;
      });

      const imageUrls = await Promise.all(uploadPromises);

      // Step 3: Complete the upload by storing metadata in KV
      setUploadProgress('生成分享链接...');
      const completeResponse = await fetch('/api/complete-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareId,
          imageUrls,
        }),
      });

      const completeData = await completeResponse.json();

      if (!completeResponse.ok) {
        throw new Error(completeData.error || '保存分享信息失败');
      }

      setShareLink(completeData.shareLink);
    } catch (error: any) {
      console.error('Share error:', error);

      // Fallback to localStorage for network errors
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1');

      if (isLocalDev && (error.message?.includes('Failed to fetch') || error.name === 'TypeError')) {
        try {
          console.log('Network error, using localStorage fallback');
          const shareId = Math.random().toString(36).substring(2, 10);
          const shareData = {
            images: uploadedPhotos,
            createdAt: Date.now(),
          };
          localStorage.setItem(`share_${shareId}`, JSON.stringify(shareData));
          const shareLink = `${window.location.origin}/?share=${shareId}`;
          setShareLink(shareLink);
          return;
        } catch (storageError: any) {
          setShareError('图片数据太大，请减少照片数量或大小');
          return;
        }
      }

      setShareError(error.message || '分享失败，请重试');
    } finally {
      setIsSharing(false);
      setUploadProgress('');
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleCreateMine = () => {
    // 清除 URL 参数，刷新页面
    window.location.href = window.location.origin;
  };

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">

      {/* Header */}
      <header className="absolute top-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
        <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#F5E6BF] to-[#D4AF37] font-serif drop-shadow-lg tracking-wider text-center animate-pulse-slow">
          Happy New Year Babysa
        </h1>

        {/* Countdown Timer */}
        <div className="flex gap-4 mt-6">
          {[
            { label: 'DAYS', value: timeRemaining.days },
            { label: 'HOURS', value: timeRemaining.hours },
            { label: 'MINS', value: timeRemaining.minutes },
            { label: 'SECS', value: timeRemaining.seconds }
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col items-center bg-black/40 backdrop-blur-sm px-3 py-2 border border-[#D4AF37]/30 rounded">
              <span className="text-2xl font-serif text-[#D4AF37] font-bold">{item.value.toString().padStart(2, '0')}</span>
              <span className="text-[10px] text-[#F5E6BF]/70 tracking-widest">{item.label}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Right Bottom Action Area */}
      <div className="absolute bottom-8 right-8 flex flex-col items-end gap-4 pointer-events-auto">

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Shared View: Show "制作我的圣诞树" button */}
        {isSharedView && (
          <button
            onClick={handleCreateMine}
            className="group px-6 py-3 border-2 border-[#D4AF37] bg-black/70 backdrop-blur-md overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_#D4AF37] hover:border-[#fff] hover:bg-[#D4AF37]/20"
          >
            <span className="relative z-10 font-serif text-base md:text-lg text-[#D4AF37] tracking-[0.1em] group-hover:text-white transition-colors whitespace-nowrap">
              Create My New Year Greeting
            </span>
          </button>
        )}

        {/* Not Shared View: Show upload and share controls */}
        {!isSharedView && (
          <>
            {/* Upload Button - Show when no photos */}
            {!hasPhotos && (
              <button
                onClick={handleUploadClick}
                className="group px-6 py-3 border-2 border-[#D4AF37] bg-black/70 backdrop-blur-md overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_#D4AF37] hover:border-[#fff] hover:bg-[#D4AF37]/20"
              >
                <span className="relative z-10 font-serif text-base md:text-lg text-[#D4AF37] tracking-[0.1em] group-hover:text-white transition-colors whitespace-nowrap">
                  Upload Photos
                </span>
              </button>
            )}

            {/* Share Button - Show when photos are uploaded but link not generated */}
            {hasPhotos && !shareLink && (
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={handleShare}
                  disabled={isSharing}
                  className="group px-6 py-3 border-2 border-[#D4AF37] bg-black/70 backdrop-blur-md overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_#D4AF37] hover:border-[#fff] hover:bg-[#D4AF37]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10 font-serif text-base md:text-lg text-[#D4AF37] tracking-[0.1em] group-hover:text-white transition-colors whitespace-nowrap">
                    {uploadProgress || (isSharing ? 'Generating...' : 'Generate Share Link')}
                  </span>
                </button>
                {shareError && (
                  <p className="text-red-400 text-xs font-serif text-right">{shareError}</p>
                )}
              </div>
            )}

            {/* Share Link Display - Show after link is generated */}
            {shareLink && (
              <div className="bg-black/80 backdrop-blur-md border-2 border-[#D4AF37] p-4 max-w-sm">
                <p className="text-[#F5E6BF] font-serif text-sm mb-2">Share Link Generated</p>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 bg-black/50 text-[#D4AF37] px-3 py-2 text-xs border border-[#D4AF37]/30 font-mono"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 border border-[#D4AF37] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 transition-colors shrink-0"
                  >
                    <span className="text-[#D4AF37] text-xs font-serif whitespace-nowrap">
                      {copied ? '✓ Copied' : 'Copy'}
                    </span>
                  </button>
                </div>
                <p className="text-[#F5E6BF]/50 text-xs font-serif">
                  Expires in 30 days
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Decorative Corners */}
      <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-[#D4AF37] opacity-50"></div>
      <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-[#D4AF37] opacity-50"></div>

      {/* Galaxy Note / Message - Shows when Formed (Galaxy Mode) */}
      <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-1000 ${isFormed ? 'opacity-100 translate-y-[-50%]' : 'opacity-0 translate-y-[-40%]'} z-40 w-full max-w-3xl px-4 md:px-6`}>
        <div className="text-center bg-black/30 backdrop-blur-sm p-6 md:p-12 rounded-2xl border border-[#D4AF37]/20 shadow-[0_0_50px_rgba(212,175,55,0.15)]">
          <p className="text-[#D4AF37] font-serif text-lg md:text-2xl tracking-[0.3em] uppercase mb-4 md:mb-6 drop-shadow-md">For You</p>

          <div className="space-y-3 md:space-y-4">
            <p className="text-[#F5E6BF] font-serif text-base md:text-2xl leading-relaxed drop-shadow-md italic">
              "New years aren't just about changing dates, they're about changing directions."
            </p>
            <p className="text-[#F5E6BF]/90 font-serif text-sm md:text-lg leading-relaxed drop-shadow-md">
              May 2026 give you space to move toward what matters to you, and let things fall into place in time.
            </p>
            <p className="text-[#D4AF37] font-serif text-base md:text-xl font-bold pt-2 md:pt-4">
              Let's make this one count! ✨
            </p>
          </div>

          <div className="mt-6 md:mt-8 w-32 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto"></div>
        </div>
      </div>
    </div>
  );
};
