#!/usr/bin/env python3
"""Script to configure CORS on S3 buckets."""

import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import get_settings
from app.core.s3_cors import configure_bucket_cors, get_bucket_cors


def main():
    """Configure CORS for all configured S3 buckets."""
    settings = get_settings()

    buckets_to_configure = []

    if settings.s3_bucket_datasets:
        buckets_to_configure.append(("datasets", settings.s3_bucket_datasets))
    if settings.s3_bucket_models:
        buckets_to_configure.append(("models", settings.s3_bucket_models))
    if settings.s3_bucket_reports:
        buckets_to_configure.append(("reports", settings.s3_bucket_reports))
    if settings.s3_bucket_artifacts:
        buckets_to_configure.append(("artifacts", settings.s3_bucket_artifacts))

    if not buckets_to_configure:
        print("No S3 buckets configured. Set S3_BUCKET_* environment variables.")
        return

    # Get allowed origins from environment or use defaults
    import os

    allowed_origins_env = os.getenv("S3_CORS_ORIGINS")
    if allowed_origins_env:
        allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",")]
    else:
        # Default origins
        allowed_origins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:8080",
        ]

    print(f"Configuring CORS with allowed origins: {allowed_origins}\n")

    for bucket_type, bucket_name in buckets_to_configure:
        print(f"Configuring {bucket_type} bucket: {bucket_name}")
        try:
            # Check current CORS config
            current_cors = get_bucket_cors(settings, bucket_name)
            if current_cors:
                print(f"  Current CORS rules: {len(current_cors)}")

            # Configure CORS
            configure_bucket_cors(settings, bucket_name, allowed_origins)
            print("  ✓ Successfully configured CORS\n")
        except Exception as e:
            print(f"  ✗ Error: {e}\n")


if __name__ == "__main__":
    main()
