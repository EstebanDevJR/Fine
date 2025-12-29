from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

import boto3
import mimetypes

from app.core.config import Settings


def _client(settings: Settings):
    return boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )


def presign_put(
    settings: Settings,
    bucket: str,
    key: str,
    content_type: str,
    max_size_bytes: int,
) -> dict:
    if not settings.aws_access_key_id or not settings.aws_secret_access_key or not settings.aws_region:
        raise ValueError("AWS S3 not configured")
    client = _client(settings)
    expires_in = max(settings.s3_presign_exp_seconds, 60)
    conditions = [
        ["content-length-range", 1, max_size_bytes],
        {"Content-Type": content_type},
    ]
    presigned = client.generate_presigned_post(
        Bucket=bucket,
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=conditions,
        ExpiresIn=expires_in,
    )
    return presigned


def build_s3_path(prefix: str, user_id: str, filename: str) -> str:
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    return f"{prefix}/{user_id}/{ts}_{filename}"


def download_to_path(settings: Settings, bucket: str, key: str, destination: str) -> str:
    if not settings.aws_access_key_id or not settings.aws_secret_access_key or not settings.aws_region:
        raise ValueError("AWS S3 not configured")
    client = _client(settings)
    from pathlib import Path

    Path(destination).parent.mkdir(parents=True, exist_ok=True)
    client.download_file(bucket, key, destination)
    return destination


def upload_file(settings: Settings, bucket: str, key: str, local_path: str) -> str:
    if not settings.aws_access_key_id or not settings.aws_secret_access_key or not settings.aws_region:
        raise ValueError("AWS S3 not configured")
    client = _client(settings)
    content_type, _ = mimetypes.guess_type(local_path)
    extra_args = {"ContentType": content_type} if content_type else None
    client.upload_file(local_path, bucket, key, ExtraArgs=extra_args or {})
    return f"s3://{bucket}/{key}"


def presign_get(settings: Settings, bucket: str, key: str, expires_in: int | None = None) -> str:
    """Generate a presigned GET URL for private downloads."""
    if not settings.aws_access_key_id or not settings.aws_secret_access_key or not settings.aws_region:
        raise ValueError("AWS S3 not configured")
    client = _client(settings)
    exp = expires_in or max(settings.s3_presign_exp_seconds, 60)
    return client.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=exp,
    )


def delete_object(settings: Settings, bucket: str, key: str) -> None:
    if not settings.aws_access_key_id or not settings.aws_secret_access_key or not settings.aws_region:
        raise ValueError("AWS S3 not configured")
    client = _client(settings)
    client.delete_object(Bucket=bucket, Key=key)


def delete_s3_uri(settings: Settings, uri: str) -> None:
    """
    Delete an object given an s3://bucket/key uri. Ignores errors silently.
    """
    if not uri.startswith("s3://"):
        return
    try:
        without_scheme = uri[len("s3://") :]
        bucket, key = without_scheme.split("/", 1)
        delete_object(settings, bucket, key)
    except Exception:
        # best-effort; do not raise to avoid blocking cleanup
        return

