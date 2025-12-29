import pandas as pd
from sklearn.linear_model import LogisticRegression
import joblib

df = pd.read_csv("dataset.csv")
X = df[["feat1", "feat2"]]
y = df["label"]

model = LogisticRegression().fit(X, y)
joblib.dump(model, "model.pkl")
print("saved model.pkl")