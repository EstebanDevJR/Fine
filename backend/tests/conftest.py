import pathlib
import tempfile
from collections.abc import Generator

import joblib
import pandas as pd
import pytest
from sklearn.linear_model import LogisticRegression


@pytest.fixture(scope="session")
def tmp_storage() -> Generator[pathlib.Path, None, None]:
    with tempfile.TemporaryDirectory() as tmpdir:
        yield pathlib.Path(tmpdir)


@pytest.fixture(scope="session")
def sample_dataset(tmp_storage: pathlib.Path) -> pathlib.Path:
    df = pd.DataFrame(
        {
            "gender": ["M", "M", "F", "F"],
            "feat1": [1, 2, 2, 3],
            "feat2": [2, 1, 3, 3],
            "label": [0, 0, 1, 1],
        }
    )
    path = tmp_storage / "sample.csv"
    df.to_csv(path, index=False)
    return path


@pytest.fixture(scope="session")
def sample_model(tmp_storage: pathlib.Path, sample_dataset: pathlib.Path) -> pathlib.Path:
    df = pd.read_csv(sample_dataset)
    X = df[["feat1", "feat2"]]
    y = df["label"]
    model = LogisticRegression().fit(X, y)
    path = tmp_storage / "model.pkl"
    joblib.dump(model, path)
    return path
