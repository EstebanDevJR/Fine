from fastapi import HTTPException, status

ALLOWED_DATASET_EXT = {"csv", "parquet"}
ALLOWED_MODEL_EXT = {"pkl", "joblib", "pt", "pth", "bin", "onnx"}


def ensure_allowed_extension(filename: str, allowed: set[str]) -> str:
    parts = filename.rsplit(".", maxsplit=1)
    if len(parts) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo debe tener extensión"
        )
    ext = parts[1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión no permitida: .{ext}. Permitidas: {', '.join(sorted(allowed))}",
        )
    return ext

