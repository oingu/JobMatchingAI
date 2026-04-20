from collections import defaultdict, deque
from threading import Lock
from time import time

from fastapi import HTTPException

_lock = Lock()
_buckets: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    now = time()
    with _lock:
        bucket = _buckets[key]
        while bucket and (now - bucket[0]) > window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(status_code=429, detail="Too many requests. Please retry later.")
        bucket.append(now)
