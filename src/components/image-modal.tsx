// src/components/image-modal.tsx
'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  imageName?: string;
}

export function ImageModal({ isOpen, onClose, imageUrl, imageName }: ImageModalProps) {
  if (!isOpen || !imageUrl) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Close modal only if clicking the backdrop itself, not the content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in-0 duration-300"
      onClick={handleBackdropClick} // Close on backdrop click
    >
      <div
        className="relative bg-background rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-auto animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal content
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-background/50 text-foreground hover:bg-background/80"
          onClick={onClose}
          aria-label="Close image viewer"
        >
          <X className="h-5 w-5" />
        </Button>
        <img
          src={imageUrl}
          alt={imageName || 'Preview'}
          className="block max-w-full max-h-[85vh] object-contain rounded-lg" // Ensure image scales down
        />
        {imageName && (
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/70 to-transparent p-4 text-white rounded-b-lg">
            <p className="text-sm truncate">{imageName}</p>
          </div>
        )}
      </div>
    </div>
  );
}