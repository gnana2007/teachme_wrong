import time
from collections import defaultdict, deque

import jwt
from fastapi import Header, HTTPException, Request

from app.config import settings
from app.database.repo import repo


def current_user(authorization: str | None = Header(None), x_user_id: str | None = Header(None)) -> dict:
    """Prod: Supabase JWT (Bearer). Dev/demo: X-User-Id header against the in-memory repo."""
    if settings.supabase_jwt_secret and authorization:
        try:
            claims = jwt.decode(authorization.removeprefix("Bearer "), settings.supabase_jwt_secret,
                                algorithms=["HS256"], audience="authenticated")
        except jwt.PyJWTError:
            raise HTTPException(401, "Invalid token")
        uid_ = claims["sub"]
        if uid_ not in repo.users:
            meta = claims.get("user_metadata", {})
            repo.add_user(meta.get("name", claims.get("email", "User")), claims.get("email", ""), meta.get("role", "student"), uid_)
        return repo.users[uid_]
    if settings.supabase_jwt_secret:
        raise HTTPException(401, "Missing token")
    if not x_user_id or x_user_id not in repo.users:
        raise HTTPException(401, "Unknown user")
    return repo.users[x_user_id]


def require_role(user: dict, role: str):
    if user["role"] != role:
        raise HTTPException(403, f"{role} access only")


_hits: dict[str, deque] = defaultdict(deque)


async def rate_limit(request: Request, call_next):
    ip = request.client.host if request.client else "anon"
    q, t = _hits[ip], time.time()
    while q and t - q[0] > 60:
        q.popleft()
    if len(q) >= settings.rate_limit_per_minute:
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)
    q.append(t)
    return await call_next(request)
