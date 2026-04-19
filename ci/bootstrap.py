"""Fixtures for the contract-test CI job.

Idempotent — safe to re-run. Prints `KEY=value` sentinel lines on stdout
that the workflow extracts into step outputs (and masks the SERVICE_TOKEN).
Anything else printed lands in the runner log for debugging — that's fine,
the workflow uses sed pattern matching, not `tail -n 1`.

Run from inside the cloned vas3k.club repo:
    python3 manage.py shell -c "$(cat ci/bootstrap.py)"
"""

from datetime import datetime, timedelta

from authn.models.openid import OAuth2App
from posts.models.post import Post
from rooms.models import Room
from users.models.user import User


def _utc_now():
    return datetime.utcnow()


def _make_user(slug: str, *, full_name: str, email: str, roles: list[str] | None = None) -> User:
    user, _ = User.objects.get_or_create(
        slug=slug,
        defaults=dict(
            email=email,
            full_name=full_name,
            membership_platform_type=User.MEMBERSHIP_PLATFORM_PATREON,
            patreon_id=slug,
            membership_started_at=_utc_now(),
            membership_expires_at=_utc_now() + timedelta(days=3650),
            is_email_verified=True,
            moderation_status=User.MODERATION_STATUS_APPROVED,
            roles=roles or [],
        ),
    )
    return user


# --- principals --------------------------------------------------------------
ci_user = _make_user("ci", full_name="CI bot", email="ci@example.com", roles=["god"])
friend_user = _make_user("ci-friend", full_name="CI friend", email="ci-friend@example.com")

# --- OAuth app to mint a service token --------------------------------------
app, _ = OAuth2App.objects.get_or_create(
    name="vas3k-mcp-ci",
    defaults=dict(
        owner=ci_user,
        redirect_uris="http://localhost:8788/callback",
        scope="openid contact",
    ),
)

# --- room (for subscribe_room / mute_room tests) ----------------------------
room, _ = Room.objects.get_or_create(
    slug="ci-room",
    defaults=dict(
        title="CI room",
        description="Fixture room for vas3k-mcp contract tests",
    ),
)

# --- post (for bookmark / upvote / retract / subscribe tests) ---------------
post, _ = Post.objects.get_or_create(
    slug="ci-test-post",
    defaults=dict(
        author=ci_user,
        type=Post.TYPE_POST,
        title="CI test post",
        text="This post is created by ci/bootstrap.py for contract testing.",
        is_visible=True,
        is_visible_in_feeds=True,
        is_approved_by_moderator=True,
        room=room,
        published_at=_utc_now(),
    ),
)

# --- sentinel outputs -------------------------------------------------------
print(f"SERVICE_TOKEN={app.service_token}")
print(f"POST_SLUG={post.slug}")
print(f"ROOM_SLUG={room.slug}")
print(f"FRIEND_SLUG={friend_user.slug}")
