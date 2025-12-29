"""Utility to configure CORS on S3 buckets."""

from __future__ import annotations

import boto3
from botocore.exceptions import ClientError

from app.core.config import Settings


def configure_bucket_cors(
    settings: Settings, bucket: str, allowed_origins: list[str] | None = None
) -> None:
    """
    Configure CORS on an S3 bucket to allow uploads from frontend.

    Args:
        settings: Application settings with AWS credentials
        bucket: Name of the S3 bucket
        allowed_origins: List of allowed origins. Defaults to common development origins.
    """
    if (
        not settings.aws_access_key_id
        or not settings.aws_secret_access_key
        or not settings.aws_region
    ):
        raise ValueError("AWS S3 not configured")

    if allowed_origins is None:
        # Default origins for development and production
        allowed_origins = [
            "http://localhost:5173",  # Vite dev server
            "http://localhost:3000",  # Common React dev server
            "http://localhost:8080",  # Common dev server
            "https://*.vercel.app",  # Vercel deployments
            "https://*.netlify.app",  # Netlify deployments
        ]

    client = boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )

    cors_configuration = {
        "CORSRules": [
            {
                "AllowedHeaders": ["*"],
                "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
                "AllowedOrigins": allowed_origins,
                "ExposeHeaders": ["ETag", "x-amz-server-side-encryption", "x-amz-request-id"],
                "MaxAgeSeconds": 3000,
            }
        ]
    }

    try:
        client.put_bucket_cors(Bucket=bucket, CORSConfiguration=cors_configuration)
        print(f"✓ CORS configured successfully for bucket: {bucket}")
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code == "NoSuchBucket":
            raise ValueError(f"Bucket '{bucket}' does not exist") from e
        elif error_code == "AccessDenied":
            raise PermissionError(
                "Access denied. Check AWS credentials and bucket permissions."
            ) from e
        else:
            raise RuntimeError(f"Failed to configure CORS: {e}") from e


def get_bucket_cors(settings: Settings, bucket: str) -> dict | None:
    """Get current CORS configuration for a bucket."""
    if (
        not settings.aws_access_key_id
        or not settings.aws_secret_access_key
        or not settings.aws_region
    ):
        raise ValueError("AWS S3 not configured")

    client = boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )

    try:
        response = client.get_bucket_cors(Bucket=bucket)
        return response.get("CORSRules", [])
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code == "NoSuchCORSConfiguration":
            return None
        raise


if __name__ == "__main__":
    # Example usage
    from app.core.config import get_settings

    settings = get_settings()

    if settings.s3_bucket_datasets:
        print(f"Configuring CORS for dataset bucket: {settings.s3_bucket_datasets}")
        configure_bucket_cors(settings, settings.s3_bucket_datasets)

    if settings.s3_bucket_models:
        print(f"Configuring CORS for model bucket: {settings.s3_bucket_models}")
        configure_bucket_cors(settings, settings.s3_bucket_models)
