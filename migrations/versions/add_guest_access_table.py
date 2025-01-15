"""Add guest access table

Revision ID: add_guest_access_table
Revises: d04ac4af7650
Create Date: 2025-01-15 16:02:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_guest_access_table'
down_revision = 'd04ac4af7650'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('guest_access',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('access_token', sa.String(length=64), nullable=False),
        sa.Column('access_level', sa.String(length=20), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('last_accessed', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('access_token')
    )

def downgrade():
    op.drop_table('guest_access')
