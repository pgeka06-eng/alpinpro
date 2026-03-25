import { useState, useRef } from "react";
import { Camera, Trash2, Loader2, ImagePlus, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface OrderPhotosProps {
  orderId: string;
  compact?: boolean;
}

type PhotoType = "before" | "after";

interface OrderPhoto {
  id: string;
  order_id: string;
  user_id: string;
  type: string;
  photo_url: string;
  caption: string | null;
  created_at: string;
}

export function OrderPhotos({ orderId, compact = false }: OrderPhotosProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<PhotoType | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["order-photos", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_photos")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at");
      if (error) throw error;
      return data as OrderPhoto[];
    },
    enabled: !!user && !!orderId,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: PhotoType }) => {
      setUploading(type);
      const ext = file.name.split(".").pop();
      const path = `${user!.id}/${orderId}/${type}_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("order-photos")
        .upload(path, file);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("order-photos")
        .getPublicUrl(path);

      const { error: dbErr } = await supabase.from("order_photos").insert({
        order_id: orderId,
        user_id: user!.id,
        type,
        photo_url: urlData.publicUrl,
        file_path: path,
      });
      if (dbErr) throw dbErr;
    },
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries({ queryKey: ["order-photos", orderId] });
      toast.success(`Фото «${type === "before" ? "ДО" : "ПОСЛЕ"}» загружено`);
      setUploading(null);
    },
    onError: (err: any) => {
      toast.error(err.message);
      setUploading(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photo: OrderPhoto) => {
      if ((photo as any).file_path) {
        await supabase.storage.from("order-photos").remove([(photo as any).file_path]);
      }
      const { error } = await supabase.from("order_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-photos", orderId] });
      toast.success("Фото удалено");
    },
  });

  const handleFileChange = (type: PhotoType) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate({ file, type });
    e.target.value = "";
  };

  const beforePhotos = photos.filter((p) => p.type === "before");
  const afterPhotos = photos.filter((p) => p.type === "after");

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {beforePhotos.length > 0 && (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Camera className="w-3 h-3" /> ДО: {beforePhotos.length}
          </Badge>
        )}
        {afterPhotos.length > 0 && (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Camera className="w-3 h-3" /> ПОСЛЕ: {afterPhotos.length}
          </Badge>
        )}
        {photos.length === 0 && (
          <span className="text-[10px] text-muted-foreground">Нет фото</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-card-foreground">Фото ДО / ПОСЛЕ</h4>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Before section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">До работы</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => beforeRef.current?.click()}
              disabled={uploading === "before"}
            >
              {uploading === "before" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
              Загрузить
            </Button>
            <input ref={beforeRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange("before")} />
          </div>

          {beforePhotos.length === 0 ? (
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => beforeRef.current?.click()}
            >
              <Camera className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Нажмите для загрузки</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {beforePhotos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} onPreview={setPreviewUrl} onDelete={deleteMutation.mutate} />
              ))}
            </div>
          )}
        </div>

        {/* After section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">После работы</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => afterRef.current?.click()}
              disabled={uploading === "after"}
            >
              {uploading === "after" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
              Загрузить
            </Button>
            <input ref={afterRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange("after")} />
          </div>

          {afterPhotos.length === 0 ? (
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => afterRef.current?.click()}
            >
              <Camera className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Нажмите для загрузки</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {afterPhotos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} onPreview={setPreviewUrl} onDelete={deleteMutation.mutate} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen preview */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          {previewUrl && (
            <img src={previewUrl} alt="Preview" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PhotoCard({
  photo,
  onPreview,
  onDelete,
}: {
  photo: OrderPhoto;
  onPreview: (url: string) => void;
  onDelete: (photo: OrderPhoto) => void;
}) {
  return (
    <div className="relative group rounded-lg overflow-hidden border border-border">
      <img
        src={photo.photo_url}
        alt={photo.type}
        className="w-full h-24 object-cover"
      />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:text-white" onClick={() => onPreview(photo.photo_url)}>
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-white hover:text-destructive"
          onClick={() => {
            if (confirm("Удалить фото?")) onDelete(photo);
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <div className="absolute bottom-1 left-1">
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-background/80">
          {new Date(photo.created_at).toLocaleDateString("ru-RU")}
        </Badge>
      </div>
    </div>
  );
}
