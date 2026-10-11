from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.user import User
from app.schemas.user import UserCreate
from app.utils.security import get_password_hash

async def get_user_by_email(db: AsyncSession, email: str):
    result = await db.execute(select(User).where(User.email == email))

    return result.scalars().first()

async def create_user(db: AsyncSession, user: UserCreate):
    hashed_pwd = get_password_hash(user.password)

    db_user = User(email=user.email, hashed_password=hashed_pwd)

    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    return db_user

    