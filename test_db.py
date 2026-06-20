import asyncio
from app.database import async_session
from app.models import User, CandidateProfile, Job, Application
from sqlalchemy import select

async def main():
    async with async_session() as db:
        # Find candidate 338
        cand = await db.execute(select(CandidateProfile).where(CandidateProfile.id == 338))
        cand = cand.scalar_one_or_none()
        if not cand:
            print("Candidate 338 not found")
            return
        print(f"Found candidate: {cand.user_id}")

asyncio.run(main())
