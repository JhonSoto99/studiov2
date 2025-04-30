// src/app/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Folder, Copy, Download, Image as ImageIcon, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toaster } from "@/components/ui/toaster";
import { ImageModal } from '@/components/image-modal'; // Import the new modal component

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
          } else if (foldersMap[parentPath]) { // Check if parent folder exists
            foldersMap[parentPath].children!.push(folderNode);
          } else {
             // Handle cases where parent folder might not exist (e.g., orphaned files)
             // Maybe create the parent path on the fly or log an error
             console.warn(`Parent folder ${parentPath} not found for ${currentPath}`);
             // For now, let's just add it to the root if the parent is missing
             if (!root.some(node => node.path === folderNode.path)) {
               root.push(folderNode);
             }
          }
        }

        // Ensure currentLevel is correctly assigned even if folder already existed
        currentLevel = foldersMap[currentPath]?.children!;
        if (!currentLevel) {
          console.error(`Error accessing children of folder: ${currentPath}`);
          // Handle this error appropriately, maybe skip this item
          continue;
        }
      }

      if (isImage && fileName) { // Ensure fileName is not empty
        const imageNode: ImageNode = {
          type: 'image',
          name: fileName,
          path: fullPath,
          url: `https://storage.googleapis.com/emkt_platform-prod-asset-manager/${fullPath}`,
        };

        const parentPath = parts.join('/');
        if (parts.length === 0) {
           // If image is at the root, decide where to put it.
           // Option 1: Directly in root (if desired)
           // root.push(imageNode);

           // Option 2: Place in a default "Root Images" folder (similar to current logic)
           const defaultFolderName = 'Asset Manager';
           if (!foldersMap[defaultFolderName]) {
              const defaultFolderNode: ImageNode = {
                 type: 'folder',
                 name: defaultFolderName,
                 path: defaultFolderName,
                 children: [],
              };
              foldersMap[defaultFolderName] = defaultFolderNode;
              root.push(defaultFolderNode);
           }
           foldersMap[defaultFolderName].children!.push(imageNode);

        } else if (foldersMap[parentPath]) {
          foldersMap[parentPath].children!.push(imageNode);
        } else {
           // Handle cases where the direct parent folder might be missing
           console.warn(`Parent folder ${parentPath} for image ${fileName} not found.`);
           // Maybe add to a default folder or handle differently
            const defaultFolderName = 'Asset Manager';
             if (!foldersMap[defaultFolderName]) {
                const defaultFolderNode: ImageNode = {
                   type: 'folder',
                   name: defaultFolderName,
                   path: defaultFolderName,
                   children: [],
                };
                foldersMap[defaultFolderName] = defaultFolderNode;
                root.push(defaultFolderNode);
             }
             foldersMap[defaultFolderName].children!.push(imageNode);
        }
      } else if (!isImage && fileName) { // Handle non-image files if needed
         // console.log(`Skipping non-image file: ${fullPath}`);
         // Optionally create a 'file' node type
      }
    }

    // Sort folders and files alphabetically within each folder
    const sortNodes = (nodes: ImageNode[]) => {
        nodes.sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
        nodes.forEach(node => {
            if (node.type === 'folder' && node.children) {
                sortNodes(node.children);
            }
        });
    };
    sortNodes(root);


    return root;
  } catch (error) {
    console.error('Failed to fetch image data:', error);
    return [];
  }
}

function ImageGrid({ images, onImageClick }: { images: ImageNode[]; onImageClick: (image: ImageNode) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {images.map((image, index) => (
        <div key={index} className="relative group cursor-pointer" onClick={() => onImageClick(image)}>
          <img
            src={image.url}
            alt={image.name}
            className="w-full h-auto rounded-md object-cover aspect-video transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/70 to-transparent p-2 text-white flex justify-between items-center rounded-b-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="truncate text-sm">{image.name}</span>
            {/* Pass event to parent onClick, stop propagation for buttons */}
            <ImageActions imageUrl={image.url!} imageName={image.name} onActionClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      ))}
    </div>
  );
}


function FolderNode({ folder, depth = 0, onSelect, currentPath }: { folder: ImageNode; depth?: number; onSelect: (f: ImageNode) => void; currentPath: string | null }) {
    const [isOpen, setIsOpen] = useState(folder.path === currentPath || (currentPath?.startsWith(folder.path + '/') ?? false));
    const isSelected = folder.path === currentPath;

    // Effect to open folder if it's part of the selected path
    useEffect(() => {
        setIsOpen(folder.path === currentPath || (currentPath?.startsWith(folder.path + '/') ?? false));
    }, [currentPath, folder.path]);


  const toggleFolder = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting when toggling
    setIsOpen(!isOpen);
    onSelect(folder); // Select the folder when its name is clicked
  };

   const handleSelect = (e: React.MouseEvent) => {
     e.stopPropagation();
     onSelect(folder); // Select the folder when its name is clicked
   };

  const paddingLeft = 16 + depth * 16;

  // Filter out empty folders before rendering children
  const visibleChildren = folder.children?.filter(child => child.type === 'folder' || child.type === 'image') || [];
  const hasVisibleChildren = visibleChildren.some(child => child.type === 'folder');


  return (
    <div>
       <div
         className={cn(
           "flex items-center cursor-pointer px-2 py-1 rounded-md hover:bg-accent/20 image-node",
           isSelected && "bg-accent/30 font-medium"
         )}
         style={{ paddingLeft: `${paddingLeft}px` }}
         onClick={handleSelect} // Select when clicking the row
       >
        {hasVisibleChildren ? (
           <button onClick={toggleFolder} className='mr-1 p-0.5 rounded hover:bg-muted'>
              <Folder size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90 transform origin-center'}`} />
           </button>
        ) : (
          <span className="mr-1 p-0.5 inline-block" style={{ width: '20px' }}><Folder size={16} className="text-muted-foreground/50"/></span> // Placeholder for alignment
        )}
         <span className="truncate flex-grow">{folder.name}</span>
       </div>
      {isOpen && hasVisibleChildren &&
        visibleChildren.map((child, idx) =>
          child.type === 'folder' ? (
             <FolderNode key={`${child.path}-${idx}`} folder={child} depth={depth + 1} onSelect={onSelect} currentPath={currentPath} />
          ) : null // Only render folder children here
        )}
    </div>
  );
}

// Separate Component for ImageActions to avoid prop drilling issues and simplify logic
function ImageActions({ imageUrl, imageName, onActionClick }: { imageUrl: string; imageName: string; onActionClick: (e: React.MouseEvent) => void }) {
  const { toast } = useToast();

  const copyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering image click
    navigator.clipboard.writeText(imageUrl)
      .then(() => {
        toast({ title: 'Image link copied!', description: 'The link is ready to be pasted.' });
      })
      .catch((err) => {
        console.error('Could not copy text: ', err);
        toast({
          title: 'Copy failed',
          description: 'Could not copy link to clipboard.',
          variant: 'destructive',
        });
      });
    onActionClick(e);
  };


 const downloadImage = useCallback((e: React.MouseEvent, url: string, name: string) => {
     e.stopPropagation(); // Prevent triggering image click
     try {
       // Create a temporary link element
       const link = document.createElement('a');
       link.href = url;
       link.setAttribute('download', name || 'download'); // Set the desired file name, provide default
       document.body.appendChild(link);

       // Programmatically click the link to trigger the download
       link.click();

       // Clean up by removing the link
       document.body.removeChild(link);

       toast({ title: 'Image downloading...', description: 'Check your downloads folder.' });
     } catch (error) {
       console.error('Download failed:', error);
       toast({
         title: 'Download failed',
         description: 'Could not initiate image download.',
         variant: 'destructive',
       });
     }
      onActionClick(e);
   }, [toast, onActionClick]);


  return (
    <div className="flex space-x-1">
      <Button variant="ghost" size="icon" onClick={copyToClipboard} aria-label="Copy image link" className="h-6 w-6 text-white hover:bg-white/20 hover:text-white">
        <Copy className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" onClick={(e) => downloadImage(e, imageUrl, imageName)} aria-label="Download image" className="h-6 w-6 text-white hover:bg-white/20 hover:text-white">
        <Download className="h-3 w-3" />
      </Button>
    </div>
  );
}

function MainContent({ selectedFolder, imagesToShow, isLoading, onImageClick }: { selectedFolder: ImageNode | null; imagesToShow: ImageNode[]; isLoading: boolean; onImageClick: (image: ImageNode) => void }) {
  if (isLoading) {
    return (
      <div className="p-4">
        <h3 className="text-xl font-medium mb-4">Loading images...</h3>
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
           {[...Array(8)].map((_, i) => (
             <div key={i} className="relative">
               <Skeleton className="w-full h-40 rounded-md loading-skeleton" />
             </div>
           ))}
         </div>
      </div>
    );
  }

  if (selectedFolder) {
    const imagesInFolder = selectedFolder.children?.filter(node => node.type === 'image') || [];
    return (
      <div className="p-4">
        <h3 className="text-xl font-medium mb-4">{selectedFolder.name}</h3>
        {imagesInFolder.length > 0 ? (
          <ImageGrid images={imagesInFolder} onImageClick={onImageClick} />
        ) : (
          <p>No images in this folder.</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 flex items-center justify-center h-full">
      <p className="text-muted-foreground">Select a folder from the sidebar to view images.</p>
    </div>
  );
}

export default function Home() {
  const [tree, setTree] = useState<ImageNode[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ImageNode | null>(null); // State for modal

   // Function to find a folder node by path
   const findFolderByPath = (nodes: ImageNode[], path: string | null): ImageNode | null => {
     if (!path) return null;
     for (const node of nodes) {
       if (node.type === 'folder') {
         if (node.path === path) {
           return node;
         }
         if (path.startsWith(node.path + '/')) {
            const foundInChildren = findFolderByPath(node.children || [], path);
            if (foundInChildren) return foundInChildren;
         }
       }
     }
     // If path is not a folder path, check if it's an image path (special case handled in MainContent)
      if (path && !path.includes('/')) { // Simple check for root-level items
        const rootItem = nodes.find(node => node.path === path);
        if (rootItem && rootItem.type === 'image') {
            // Return a pseudo-folder containing just this image for display purposes
            // Or handle image selection directly if preferred
             return { type: 'folder', name: 'Selected Image', path: 'selected-image-pseudo-path', children: [rootItem] };
        }
      }

     return null;
   };

    // Derive selectedFolder based on selectedFolderPath
    const selectedFolder = findFolderByPath(tree, selectedFolderPath);


  useEffect(() => {
    setIsLoading(true);
    fetchImageData().then(nodes => {
      setTree(nodes);
      // Optionally select the first folder by default
       if (nodes.length > 0 && nodes[0].type === 'folder') {
          setSelectedFolderPath(nodes[0].path);
       } else if (nodes.length > 0) {
           // Handle case where first item might be an image or different structure
           const firstFolder = nodes.find(n => n.type === 'folder');
           if (firstFolder) {
              setSelectedFolderPath(firstFolder.path);
           }
       }
      setIsLoading(false);
    });
  }, []);


  const handleSelectFolder = (folder: ImageNode) => {
    setSelectedFolderPath(folder.path);
  };

  const handleImageClick = (image: ImageNode) => {
    setSelectedImage(image);
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
  };


  // imagesToShow is now derived directly within MainContent based on the actual selectedFolder
  // const imagesToShow = selectedFolder?.children?.filter(node => node.type === 'image') || [];

  return (
    <>
      <div className="flex h-screen bg-background">
        <aside className="w-64 flex-shrink-0 p-4 border-r bg-card overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4 px-2">Image Explorer</h2>
          {isLoading ? (
            <div className='px-2 space-y-2'>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-6 w-1/2 ml-4" />
                <Skeleton className="h-6 w-1/2 ml-4" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-6 w-2/3" />
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-80px)] pr-2"> {/* Adjusted height and added padding */}
             {tree.length > 0 ? tree.map((node, idx) =>
               node.type === 'folder' ? (
                  <FolderNode key={`${node.path}-${idx}`} folder={node} onSelect={handleSelectFolder} currentPath={selectedFolderPath}/>
               ) : node.type === 'image' ? (
                 // Optionally display root-level images differently or hide them from the folder view
                 <div
                    key={`${node.path}-${idx}`}
                    className="flex items-center cursor-pointer px-6 py-1 rounded-md hover:bg-accent/20 image-node text-sm" // Indent slightly
                    onClick={() => {
                         // Handle selection of root image - maybe show it alone?
                         // For now, let's just log or open modal directly
                         console.log("Selected root image:", node.name);
                         handleImageClick(node); // Open modal directly
                         setSelectedFolderPath(node.path); // Visually select in sidebar if needed
                    }}
                  >
                   <ImageIcon className="mr-2 w-4 h-4 text-muted-foreground" /> <span className="truncate">{node.name}</span>
                 </div>
               ) : null
             ) : <p className="px-2 text-muted-foreground text-sm">No items found.</p>}
            </ScrollArea>
          )}
        </aside>
        <main className="flex-1 overflow-auto">
           <MainContent
             selectedFolder={selectedFolder}
             // Pass empty array for imagesToShow, MainContent will filter based on selectedFolder
             imagesToShow={[]}
             isLoading={isLoading}
             onImageClick={handleImageClick}
           />
        </main>
      </div>
      <Toaster />
      {/* Modal Integration */}
      <ImageModal
        isOpen={!!selectedImage}
        onClose={handleCloseModal}
        imageUrl={selectedImage?.url}
        imageName={selectedImage?.name}
      />
    </>
  );
}

// Helper function for cn (classnames) - place in utils if not already there
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
