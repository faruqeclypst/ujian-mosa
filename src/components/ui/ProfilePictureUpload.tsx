import { useState, useRef } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import pb from "../../lib/pocketbase";
import { uploadInventoryImage, deleteImageFromStorage } from "../../lib/storage";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/toast";

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
  const { user } = useAuth();
  const { addToast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-32 w-32 md:h-40 md:w-40"
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-8 w-8"
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Harap pilih file gambar.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran gambar maksimal 5MB.');
      return;
    }

    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewURL(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    uploadToStorage(file);
  };

  const uploadToStorage = async (file: File) => {
    if (!user) return;

    setIsUploading(true);
    try {
      // 1. Upload ke Storage (R2/PocketBase via uploadInventoryImage)
      const uploadRes = await uploadInventoryImage("profiles", file);
      const downloadURL = uploadRes.url;

      // 2. Update record user di PocketBase
      await pb.collection("users").update(user.id, {
        avatar_url: downloadURL // Gunakan field avatar_url jika ada, atau avatar
      });

      addToast({
        title: "Foto Berhasil Diperbarui",
        description: "Foto profil Anda telah diperbarui.",
        type: "success"
      });

      if (onUpdate) {
        onUpdate(downloadURL, displayName || '');
      }

      setPreviewURL(null);
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      setError('Gagal mengunggah foto: ' + (error.message || 'Cek koneksi internet.'));
      setPreviewURL(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user || !currentPhotoURL) return;

    setIsUploading(true);
    try {
      // Coba hapus dari storage jika memungkinkan (R2 key usually identifiable from URL)
      if (currentPhotoURL.includes('r2.cloudflarestorage.com') || currentPhotoURL.includes('.r2.dev')) {
         // Logic for getting key from URL might be needed here
         // For now we just clear the reference in DB
      }

      await pb.collection("users").update(user.id, {
        avatar_url: "",
        avatar: null
      });

      addToast({
        title: "Foto Dihapus",
        description: "Foto profil Anda telah dihapus.",
        type: "success"
      });

      if (onUpdate) {
        onUpdate('', displayName || '');
      }
    } catch (error: any) {
      console.error('Error removing photo:', error);
      setError('Gagal menghapus foto.');
    } finally {
      setIsUploading(false);
    }
  };

  const displayURL = previewURL || currentPhotoURL;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <div className={cn(
          "relative rounded-[2rem] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl transition-all duration-500",
          sizeClasses[size],
          isUploading && "opacity-50 grayscale"
        )}>
          {displayURL ? (
            <img
              src={displayURL}
              alt={displayName || "Profile"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center text-white">
              <span className="text-4xl md:text-5xl font-black opacity-40">
                {(displayName || 'A').charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="animate-spin h-8 w-8 text-white" />
            </div>
          )}
        </div>

        {showUploadButton && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              "absolute -bottom-2 -right-2 bg-white hover:bg-slate-50 text-blue-600 rounded-2xl p-3 shadow-xl border border-slate-100 transition-all duration-200 transform hover:scale-110",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            title="Ganti Foto"
          >
            <Camera size={20} />
          </button>
        )}

        {displayURL && showUploadButton && (
          <button
            onClick={handleRemovePhoto}
            disabled={isUploading}
            className={cn(
              "absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-2xl p-2 shadow-lg transition-all duration-200 transform hover:scale-110 opacity-0 group-hover:opacity-100",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            title="Hapus Foto"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-xs font-medium text-red-500 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100 text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

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