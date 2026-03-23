import { useState, useRef } from "react";
import { Camera, Upload, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, storage } from "../../lib/firebase";
import r2Service from "../../lib/r2";

import { Button } from "./button";
import { cn } from "../../lib/utils";

interface ProfilePictureUploadProps {
  currentPhotoURL?: string;
  displayName?: string;
  onUpdate?: (photoURL: string, displayName: string) => void;
  size?: "sm" | "md" | "lg";
  showUploadButton?: boolean;
}

const ProfilePictureUpload = ({
  currentPhotoURL,
  displayName,
  onUpdate,
  size = "md",
  showUploadButton = true
}: ProfilePictureUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16"
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-8 w-8"
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewURL(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Firebase
    uploadToFirebase(file);
  };

  const uploadToFirebase = async (file: File) => {
    if (!auth.currentUser) return;

    setIsUploading(true);
    try {
      // Delete old photo if exists
      if (currentPhotoURL) {
        try {
          const oldRef = ref(storage, currentPhotoURL);
          await deleteObject(oldRef);
        } catch (error) {
          console.log('Firebase Storage deletion failed:', error);
        }

        // Delete from R2 if it's an R2 URL
        if (r2Service.isR2Url(currentPhotoURL)) {
          try {
            await r2Service.deleteFile(currentPhotoURL);
          } catch (error) {
            console.log('R2 deletion failed:', error);
          }
        }
      }

      // Upload new photo to Firebase Storage
      const photoRef = ref(storage, `profile-pictures/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(photoRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update user profile
      await updateProfile(auth.currentUser, {
        photoURL: downloadURL
      });

      // Call onUpdate callback
      if (onUpdate) {
        onUpdate(downloadURL, displayName || '');
      }

      setPreviewURL(null);
    } catch (error) {
      console.error('Error uploading photo:', error);
      setError('Failed to upload photo. Please try again.');
      setPreviewURL(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!auth.currentUser || !currentPhotoURL) return;

    setIsUploading(true);
    try {
      // Delete from Firebase Storage
      try {
        const photoRef = ref(storage, currentPhotoURL);
        await deleteObject(photoRef);
      } catch (error) {
        console.log('Firebase Storage deletion failed, trying R2:', error);
      }

      // Delete from R2 Storage if it's an R2 URL
      if (r2Service.isR2Url(currentPhotoURL)) {
        try {
          await r2Service.deleteFile(currentPhotoURL);
        } catch (error) {
          console.log('R2 deletion failed:', error);
        }
      }

      // Update user profile
      await updateProfile(auth.currentUser, {
        photoURL: null
      });

      if (onUpdate) {
        onUpdate('', displayName || '');
      }
    } catch (error) {
      console.error('Error removing photo:', error);
      setError('Failed to remove photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const displayURL = previewURL || currentPhotoURL;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Profile Picture */}
      <div className="relative group">
        <div className={cn(
          "relative rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center overflow-hidden border-2 border-white shadow-lg",
          sizeClasses[size],
          isUploading && "opacity-50"
        )}>
          {displayURL ? (
            <img
              src={displayURL}
              alt={displayName || "Profile"}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white font-semibold text-lg">
              {(displayName || 'A').charAt(0).toUpperCase()}
            </span>
          )}

          {/* Loading overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            </div>
          )}
        </div>

        {/* Upload button */}
        {showUploadButton && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              "absolute -bottom-1 -right-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-full p-1.5 shadow-lg transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              size === "sm" ? "p-1" : "p-1.5"
            )}
          >
            <Camera className={iconSizes[size]} />
          </button>
        )}

        {/* Remove button */}
        {displayURL && showUploadButton && (
          <button
            onClick={handleRemovePhoto}
            disabled={isUploading}
            className={cn(
              "absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-all duration-200 opacity-0 group-hover:opacity-100",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              size === "sm" ? "p-1" : "p-1"
            )}
          >
            <X className={iconSizes[size]} />
          </button>
        )}
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm text-red-600 text-center max-w-32"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default ProfilePictureUpload;