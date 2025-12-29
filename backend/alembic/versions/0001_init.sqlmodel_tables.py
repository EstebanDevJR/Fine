"""init sqlmodel tables

Revision ID: 0001_init
Revises: 
Create Date: 2025-12-29
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Minimal bootstrap. For portfolio purposes, we keep it explicit instead of autogenerate.
    op.create_table(
        "dataset",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("path", sa.String(), nullable=False),
        sa.Column("s3_uri", sa.String(), nullable=True),
        sa.Column("file_format", sa.String(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("target_column", sa.String(), nullable=False),
        sa.Column("checksum", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "modelartifact",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("framework", sa.String(), nullable=False),
        sa.Column("task_type", sa.String(), nullable=True),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("path", sa.String(), nullable=False),
        sa.Column("s3_uri", sa.String(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("checksum", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "analysis",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.Column("model_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("result_json", sa.Text(), nullable=True),
        sa.Column("report_path", sa.String(), nullable=True),
        sa.Column("pdf_path", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_index("idx_analysis_owner_created", "analysis", ["owner_id", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_analysis_owner_created", table_name="analysis")
    op.drop_table("analysis")
    op.drop_table("modelartifact")
    op.drop_table("dataset")
