from functools import lru_cache
from urllib.parse import unquote, urlparse
import uuid

from fastapi import HTTPException, status
from supabase import create_client

from app.core.config import settings


@lru_cache(maxsize=1)
def get_storage_client():
    if not settings.SUPABASE_URL or not settings.SUPABASE_STORAGE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para usar almacenamiento de imágenes",
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_STORAGE_KEY)


def upload_image(folder: str, filename: str, content: bytes, content_type: str) -> str:
    """Upload an image to the configured public Supabase Storage bucket."""
    object_path = f"{folder}/{uuid.uuid4().hex}_{filename}"
    try:
        client = get_storage_client()
        bucket = client.storage.from_(settings.SUPABASE_PRODUCT_IMAGES_BUCKET)
        bucket.upload(
            path=object_path,
            file=content,
            file_options={"content-type": content_type, "cache-control": "3600", "upsert": "false"},
        )
        return bucket.get_public_url(object_path)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No se pudo guardar la imagen en Supabase Storage",
        ) from exc


def delete_image(image_url: str) -> None:
    """Delete a file only when its URL belongs to this configured Storage bucket."""
    if not settings.SUPABASE_URL:
        return
    parsed = urlparse(image_url)
    configured_host = urlparse(settings.SUPABASE_URL or "").netloc.lower()
    if not configured_host or parsed.netloc.lower() != configured_host:
        return
    storage_prefix = "/storage/v1/object/public/"
    if not parsed.path.startswith(storage_prefix):
        return
    bucket_and_path = parsed.path[len(storage_prefix):]
    bucket, separator, object_path = bucket_and_path.partition("/")
    if not separator or unquote(bucket) != settings.SUPABASE_PRODUCT_IMAGES_BUCKET:
        return
    try:
        get_storage_client().storage.from_(bucket).remove([unquote(object_path)])
    except Exception:
        # The database reference is removed independently; a failed cleanup can be retried manually.
        return


def download_image(image_url: str) -> bytes | None:
    """Download an image owned by this bucket; return None for legacy local URLs."""
    parsed = urlparse(image_url)
    configured_host = urlparse(settings.SUPABASE_URL or "").netloc.lower()
    if not configured_host or parsed.netloc.lower() != configured_host:
        return None
    storage_prefix = "/storage/v1/object/public/"
    if not parsed.path.startswith(storage_prefix):
        return None
    bucket_and_path = parsed.path[len(storage_prefix):]
    bucket, separator, object_path = bucket_and_path.partition("/")
    if not separator or unquote(bucket) != settings.SUPABASE_PRODUCT_IMAGES_BUCKET:
        return None
    try:
        return get_storage_client().storage.from_(bucket).download(unquote(object_path))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No se pudo descargar la imagen desde Supabase Storage",
        ) from exc
