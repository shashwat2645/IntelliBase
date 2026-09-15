import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base



load_dotenv()

DB_URL = os.getenv("DATABASE_URL")

if not DB_URL:
    raise ValueError("DATABASE_URL environment variable is not set!")

engine = create_async_engine(DB_URL, echo = True)
SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind = engine, expire_on_commit = False)

Base = declarative_base()




import app.models