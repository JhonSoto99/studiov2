"use client";

import React, {useState, useEffect} from 'react';
import {Folder, File, Copy, Download} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useToast} from "@/hooks/use-toast";

interface ImageNode {
  type: 'folder' | 'image';
  name: string;
  url?: string;
  children?: ImageNode[];
}

async function fetchImageData(): Promise<ImageNode[]> {
  try {
    const response = await fetch(
      'https://storage.googleapis.com/storage/v1/b/emkt_platform-prod-asset-manager/o?maxResults=10000000'
    );
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();

    // Process the fetched data to match the ImageNode structure
    const items: ImageNode[] = data.items.map((item: any) => {
      if (item.name.endsWith('/')) {
        // It's a folder
        return {
          type: 'folder',
          name: item.name,
          children: [], // Folders will need to be populated recursively if needed
        };
      } else {
        // It's an image
        return {
          type: 'image',
          name: item.name,
          url: `https://storage.googleapis.com/${item.bucket}/${item.name}`,
        };
      }
    });
    return items;
  } catch (error) {
    console.error('Failed to fetch image data:', error);
    return [];
  }
}

function ImageGrid({images}: { images: ImageNode[] }) {
  return (
    <div className="grid-container">
      {images.map((image, index) => (
        <div key={index} className="grid-item">
          <img
            src={image.url}
            alt={image.name}
            className="w-full h-auto rounded-md"
            style={{
              aspectRatio: '250 / 150',
              objectFit: 'cover',
            }}
          />
          <div className="absolute bottom-0 left-0 w-full bg-background/75 p-2 text-foreground flex justify-between items-center">
            <span>{image.name}</span>
            <ImageActions imageUrl={image.url || ''}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function FolderNode({folder, depth = 0}: { folder: ImageNode; depth?: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const paddingLeft = 16 + depth * 16;

  const toggleFolder = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div>
      <div
        className="image-node"
        style={{paddingLeft: `${paddingLeft}px`}}
        onClick={toggleFolder}
      >
        <Folder className="image-icon"/>
        {folder.name}
      </div>
      {isOpen &&
        folder.children?.map((child, index) =>
          child.type === 'folder' ? (
            <FolderNode key={index} folder={child} depth={depth + 1}/>
          ) : (
            <ImageNodeComponent key={index} image={child} depth={depth + 1}/>
          )
        )}
    </div>
  );
}

function ImageNodeComponent({image, depth = 0}: { image: ImageNode; depth?: number }) {
  const paddingLeft = 16 + depth * 16;

  return (
    <div className="image-node" style={{paddingLeft: `${paddingLeft}px`}}>
      <File className="image-icon"/>
      {image.name}
    </div>
  );
}

function ImageActions({imageUrl}: { imageUrl: string }) {
  const {toast} = useToast();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(imageUrl);
    toast({
      title: "Image link copied!",
      description: "You can now share this link.",
    });
  };

  const downloadImage = () => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Image downloading...",
      description: "The image will be saved to your downloads folder.",
    });
  };

  return (
    <div>
      <Button
        variant="secondary"
        size="icon"
        onClick={copyToClipboard}
        aria-label="Copy image link"
      >
        <Copy className="h-4 w-4"/>
      </Button>
      <Button
        variant="secondary"
        size="icon"
        onClick={downloadImage}
        aria-label="Download image"
      >
        <Download className="h-4 w-4"/>
      </Button>
    </div>
  );
}

export default function Home() {
  const [imageData, setImageData] = useState<ImageNode[]>([]);

  useEffect(() => {
    async function loadImages() {
      const images = await fetchImageData();
      setImageData(images);
    }

    loadImages();
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 p-4 border-r bg-secondary/10">
        <h2 className="text-lg font-semibold mb-4">Image Explorer</h2>
        {imageData.map((node, index) =>
          node.type === 'folder' ? (
            <FolderNode key={index} folder={node} depth={0}/>
          ) : (
            <ImageNodeComponent key={index} image={node} depth={0}/>
          )
        )}
      </aside>
      <main className="flex-1 p-4">
        <ImageGrid
          images={
            imageData.filter((node) => node.type === 'image')
          }
        />
      </main>
    </div>
  );
}
