import { useState, useRef, useCallback, useEffect } from "react";
import { useTenant } from "../context/TenantContext";
import { useToast } from "../components/ui/toast";

export interface UseAsyncActionOptions<TArgs extends any[] = any[], TResult = any> {
  /** Jeda waktu (ms) setelah aksi selesai sebelum tombol boleh dipicu lagi (default: 350ms) */
  cooldownMs?: number;
  /** Batas waktu maksimal (ms) sebelum lock otomatis dilepas jika koneksi gantung/timeout (default: 30000ms) */
  timeoutMs?: number;
  /** Callback saat aksi berhasil */
  onSuccess?: (result: TResult, ...args: TArgs) => void | Promise<void>;
  /** Callback saat aksi gagal */
  onError?: (error: any, ...args: TArgs) => void | Promise<void>;
  /** Pesan toast sukses otomatis (jika diisi) */
  successMessage?: string;
  /** Pesan toast error kustom (jika tidak diisi, memakai error.message server) */
  errorMessage?: string;
  /** Apakah me-rethrow error ke pemanggil (default: false, error ditangani via toast & onError) */
  throwOnError?: boolean;
}

/**
 * useAsyncAction:
 * Hook kanonis untuk membungkus fungsi asinkron (API call, submit, delete, export, duplikat)
 * dengan garansi anti double-click (mutex lock sinkron via ref + state loading reaktif).
 *
 * Contoh penggunaan:
 * ```tsx
 * const [handleSave, isSaving] = useAsyncAction(async (data) => {
 *   await pb.collection('exam_rooms').create(data);
 * }, {
 *   successMessage: "Ruang ujian berhasil dibuka",
 *   onSuccess: () => { fetchRooms(); setIsOpen(false); }
 * });
 *
 * <Button onClick={() => handleSave(payload)} disabled={isSaving}>
 *   {isSaving ? "Menyimpan..." : "Buka Ruangan"}
 * </Button>
 * ```
 */
export function useAsyncAction<TArgs extends any[] = any[], TResult = any>(
  asyncFn: (...args: TArgs) => Promise<TResult>,
  options: UseAsyncActionOptions<TArgs, TResult> = {}
) {
  const {
    cooldownMs = 350,
    timeoutMs = 30000,
    onSuccess,
    onError,
    successMessage,
    errorMessage,
    throwOnError = false,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const isRunningRef = useRef(false);
  const isMountedRef = useRef(true);
  const timeoutIdRef = useRef<any>(null);
  const { addToast } = useToast();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    };
  }, []);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      // 1. Guard sinkron instan: tolak klik berikutnya jika aksi pertama sedang berjalan
      if (isRunningRef.current) {
        return undefined;
      }

      isRunningRef.current = true;
      if (isMountedRef.current) {
        setIsLoading(true);
      }

      // Safety timeout: jika server/jaringan freeze tanpa respons, lepaskan lock setelah timeoutMs
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = setTimeout(() => {
        if (isMountedRef.current && isRunningRef.current) {
          console.warn("[useAsyncAction] Safety timeout tercapai, melepaskan action lock.");
          isRunningRef.current = false;
          setIsLoading(false);
        }
      }, timeoutMs);

      try {
        const result = await asyncFn(...args);

        if (successMessage) {
          addToast({
            type: "success",
            title: "Berhasil",
            description: successMessage,
          });
        }

        if (onSuccess) {
          await onSuccess(result, ...args);
        }

        return result;
      } catch (err: any) {
        console.error("[useAsyncAction] Action error:", err);

        const errorDesc = errorMessage || err?.message || "Terjadi kesalahan saat memproses data.";
        addToast({
          type: "error",
          title: "Gagal",
          description: errorDesc,
        });

        if (onError) {
          await onError(err, ...args);
        }

        if (throwOnError) {
          throw err;
        }
        return undefined;
      } finally {
        if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);

        if (isMountedRef.current) {
          setIsLoading(false);
          // Beri cooldown kecil untuk menepis klik ganda yang tak sengaja
          setTimeout(() => {
            if (isMountedRef.current) {
              isRunningRef.current = false;
            }
          }, cooldownMs);
        } else {
          isRunningRef.current = false;
        }
      }
    },
    [asyncFn, cooldownMs, timeoutMs, onSuccess, onError, successMessage, errorMessage, throwOnError, addToast]
  );

  return [execute, isLoading] as const;
}

export interface UseCrudActionOptions<T = any> {
  collection: string;
  entityName?: string;
  onRefresh?: () => void | Promise<void>;
  onSuccess?: () => void | Promise<void>;
}

/**
 * useCrudAction:
 * Hook spesifik untuk operasi database PocketBase (create, update, delete).
 * Mengintegrasikan useAsyncAction dengan otomatisasi toast, refresh callback, dan error handling.
 */
export function useCrudAction<T = any>(options: UseCrudActionOptions<T>) {
  const { collection, entityName = "Data", onRefresh, onSuccess } = options;
  const { pb } = useTenant();
  const { addToast } = useToast();

  // Create Record
  const [create, isCreating] = useAsyncAction(
    async (payload: any) => {
      if (!pb) throw new Error("PocketBase client belum siap");
      const record = await pb.collection(collection).create(payload);
      addToast({
        type: "success",
        title: "Berhasil Ditambahkan",
        description: `${entityName} berhasil ditambahkan.`,
      });
      if (onRefresh) await onRefresh();
      if (onSuccess) await onSuccess();
      return record;
    },
    { errorMessage: `Gagal menambahkan ${entityName.toLowerCase()}.` }
  );

  // Update Record
  const [update, isUpdating] = useAsyncAction(
    async (id: string, payload: any) => {
      if (!pb) throw new Error("PocketBase client belum siap");
      const record = await pb.collection(collection).update(id, payload);
      addToast({
        type: "success",
        title: "Berhasil Diperbarui",
        description: `${entityName} berhasil diperbarui.`,
      });
      if (onRefresh) await onRefresh();
      if (onSuccess) await onSuccess();
      return record;
    },
    { errorMessage: `Gagal memperbarui ${entityName.toLowerCase()}.` }
  );

  // Delete Record
  const [remove, isDeleting] = useAsyncAction(
    async (id: string) => {
      if (!pb) throw new Error("PocketBase client belum siap");
      await pb.collection(collection).delete(id);
      addToast({
        type: "success",
        title: "Berhasil Dihapus",
        description: `${entityName} berhasil dihapus.`,
      });
      if (onRefresh) await onRefresh();
      if (onSuccess) await onSuccess();
    },
    { errorMessage: `Gagal menghapus ${entityName.toLowerCase()}.` }
  );

  return {
    create,
    update,
    remove,
    isCreating,
    isUpdating,
    isDeleting,
    isBusy: isCreating || isUpdating || isDeleting,
  };
}
