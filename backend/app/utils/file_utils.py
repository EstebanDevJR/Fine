import hashlib
from pathlib import Path
from typing import BinaryIO

from fastapi import UploadFile

CHUNK_SIZE = 1024 * 1024


def compute_checksum(file_obj: BinaryIO) -> str:
    """Compute sha256 checksum of a binary stream."""
    sha = hashlib.sha256()
    while chunk := file_obj.read(CHUNK_SIZE):
        sha.update(chunk)
    return sha.hexdigest()


async def save_upload_file(upload_file: UploadFile, destination: Path) -> tuple[int, str]:
    """Save UploadFile to destination and return (size_bytes, sha256)."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    size = 0
    sha = hashlib.sha256()

    with destination.open("wb") as out:
        while chunk := await upload_file.read(CHUNK_SIZE):
            size += len(chunk)
            sha.update(chunk)
            out.write(chunk)

    await upload_file.seek(0)
    return size, sha.hexdigest()
