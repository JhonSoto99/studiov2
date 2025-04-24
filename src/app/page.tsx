"use client";

import React, { useState, useEffect } from 'react';
import { Folder, Copy, Download, Image as ImageIcon, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImageNode {
  type: 'folder' | 'image';
  name: string;
  path: string;
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

    const items = data.items || [];

    const root: ImageNode[] = [];

    const foldersMap: Record<string, ImageNode> = {};

    for (const item of items) {
      const fullPath = item.name;
      const parts = fullPath.split('/');
      const fileName = parts.pop()!;
      const isImage = !!item.contentType?.startsWith('image/');

      let currentLevel = root;
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const folderName = parts[i];
        currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

        if (!foldersMap[currentPath]) {
          const folderNode: ImageNode = {
            type: 'folder',
            name: folderName,
            path: currentPath,
            children: [],
          };
          foldersMap[currentPath] = folderNode;

          const parentPath = parts.slice(0, i).join('/');
          if (i === 0) {
            root.push(folderNode);
          } else {
            foldersMap[parentPath].children!.push(folderNode);
          }
        }

        currentLevel = foldersMap[currentPath].children!;
      }

      if (isImage) {
        const imageNode: ImageNode = {
          type: 'image',
          name: fileName,
          path: fullPath,
          url: `https://storage.googleapis.com/emkt_platform-prod-asset-manager/${fullPath}`,
        };

        if (parts.length === 0) {
          const defaultFolderPath = 'Asset Manager';
          if (!foldersMap[defaultFolderPath]) {
            const defaultFolderNode: ImageNode = {
              type: 'folder',
              name: 'Asset Manager',
              path: defaultFolderPath,
              children: [],
            };
            foldersMap[defaultFolderPath] = defaultFolderNode;
            root.push(defaultFolderNode);
          }
          foldersMap[defaultFolderPath].children!.push(imageNode);
        } else {
          const folderPath = parts.join('/');
          foldersMap[folderPath].children!.push(imageNode);
        }
        
      }
    }

    return root;
  } catch (error) {
    console.error('Failed to fetch image data:', error);
    return [];
  }
}

function ImageGrid({ images }: { images: ImageNode[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {images.map((image, index) => (
        <div key={index} className="relative">
          <img
            src={image.url}
            alt={image.name}
            className="w-full h-auto rounded-md object-cover"
            style={{ aspectRatio: '250 / 150' }}
          />
          <div className="absolute bottom-0 left-0 w-full bg-background/75 p-2 text-foreground flex justify-between items-center">
            <span>{image.name}</span>
            <ImageActions imageUrl={image.url!} imageName={image.name} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FolderNode({ folder, depth = 0, onSelect }: { folder: ImageNode; depth?: number; onSelect: (f: ImageNode) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const paddingLeft = 16 + depth * 16;

  const toggleFolder = () => {
    setIsOpen(!isOpen);
    onSelect(folder);
  };

  return (
    <div>
      <div
        className="flex items-center cursor-pointer image-node"
        style={{ paddingLeft }}
        onClick={toggleFolder}
      >
        <File className="mr-2" /> {folder.name}
      </div>
      {isOpen &&
        folder.children?.map((child, idx) =>
          child.type === 'folder' ? (
            <FolderNode key={idx} folder={child} depth={depth + 1} onSelect={onSelect} />
          ) : null
        )}
    </div>
  );
}

function ImageActions({ imageUrl, imageName }: { imageUrl: string; imageName: string }) {
  const { toast } = useToast();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(imageUrl);
    toast({ title: 'Image link copied!', description: 'You can now share this link.' });
  };

  const downloadImage = (imageUrl: string, imageName: string) => {
    fetch(imageUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'image/jpeg',
      },
    })
    .then((response) => response.blob())
    .then((blob) => {
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', imageName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast({ title: 'Image downloading...', description: 'The image will be saved to your downloads folder.' });
    })
    .catch((error) => console.log('Error downloading image:', error));
  };

  return (
    <div className="flex space-x-2">
      <Button variant="secondary" size="icon" onClick={copyToClipboard} aria-label="Copy image link">
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="secondary" size="icon" onClick={() => downloadImage(imageUrl, imageName)} aria-label="Download image">
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}

function MainContent({ selectedFolder, imagesToShow, isLoading }: { selectedFolder: ImageNode | null; imagesToShow: ImageNode[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="p-4">
        <h3 className="text-xl font-medium mb-4">Loading images...</h3>
      </div>
    );
  }

  if (selectedFolder) {
    return (
      <div className="p-4">
        <h3 className="text-xl font-medium mb-4">{selectedFolder.name}</h3>
        <ImageGrid images={imagesToShow} />
      </div>
    );
  }

  return (
    <div className="p-4">
      <p>Select a folder to view images.</p>
    </div>
  );
}

export default function Home() {
  const [tree, setTree] = useState<ImageNode[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<ImageNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetchImageData().then(nodes => {
      setTree(nodes);
      if (nodes.length) setSelectedFolder(nodes[0]);
      setIsLoading(false);
    });
  }, []);

  const imagesToShow = selectedFolder?.children?.filter(node => node.type === 'image') || [];

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 p-4 border-r bg-secondary/10 overflow-auto">
        <h2 className="text-lg font-semibold mb-4">Image Explorer</h2>
        {isLoading ? (
          <p>Loading Folders...</p>
        ) : (
          <ScrollArea className="h-[calc(100vh-100px)]">
            {tree.map((node, idx) =>
              node.type === 'folder' ? (
                <FolderNode key={idx} folder={node} onSelect={setSelectedFolder} />
              ) : node.type === 'image' ? (
                <div
                  key={idx}
                  className="flex items-center cursor-pointer px-4 py-2 hover:bg-muted rounded-md image-node"
                  onClick={() => setSelectedFolder({ ...node, children: [node] })}
                >
                  <File className="mr-2 w-4 h-4" /> {node.name}
                </div>
              ) : null
            )}
          </ScrollArea>
        )}
      </aside>
      <main className="flex-1 overflow-auto">
        <MainContent selectedFolder={selectedFolder} imagesToShow={imagesToShow} isLoading={isLoading} />
      </main>
    </div>
  );
}
