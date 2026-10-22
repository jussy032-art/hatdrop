
import math
import time
import weapons
from quest_engine import content_deadline, remove_event_quests, remove_quests

EVENTS = {"halloween": {"name": "Хэллоуин", "default_equipment": ["skeleton"], "theme": "theme_halloween"}}


def settings(db, event="halloween"):
    if event not in EVENTS:
        raise ValueError("event")
    all_settings = db.setdefault("settings", {})
    conf = all_settings.setdefault("events", {}).setdefault(event, {})
    conf.setdefault("equipment", list(EVENTS[event]["default_equipment"]))
    conf.setdefault("duration_hours", 0)
    conf.setdefault("started_at", 0)
    conf.setdefault("ends_at", 0)
    return conf


def clean_config(data, current):
    value = data.get("duration_hours", current.get("duration_hours", 0))
    if isinstance(value, bool):
        raise ValueError("duration_hours")
    try:
        hours = float(value)
    except (ValueError, TypeError, OverflowError):
        raise ValueError("duration_hours")
    if not math.isfinite(hours) or not 0 <= hours <= 8760:
        raise ValueError("duration_hours")
    equipment = data.get("equipment", current.get("equipment", ["skeleton"]))
    if not isinstance(equipment, list) or len(equipment) > len(weapons.WEAPONS):
        raise ValueError("equipment")
    for wid in equipment:
        w = weapons.WEAPONS.get(wid) if isinstance(wid, str) else None
        if not w or w["default"] or w.get("kind", "gear") != "gear":
            raise ValueError("equipment")
    return {"duration_hours": hours, "equipment": sorted(set(equipment))}


def sync_grants(db):
    active = []
    for event, spec in EVENTS.items():
        conf = settings(db, event)
        weapons.EVENT_GRANTS[event] = set(conf["equipment"]) | {spec["theme"]}
        if db["settings"].get(event + "_enabled") is True:
            active.append(event)
    weapons.ACTIVE_EVENT = active[0] if active else ""


def finish(db, event="halloween", *, now=None, reason="manual"):
    now = int(time.time() if now is None else now)
    conf = settings(db, event)
    if db["settings"].get(event + "_enabled") is not True:
        return {"event_quests_removed": 0, "event_offers_removed": 0}
    db["settings"][event + "_enabled"] = False
    db["settings"]["event_content_version"] = int(db["settings"].get("event_content_version") or 0) + 1
    conf.update(ended_at=now, end_reason=reason)
    quest_count = remove_event_quests(db, event)
    offers = db.get("shop", {}).get("offers", {})
    expired = [oid for oid, offer in offers.items() if isinstance(offer, dict) and offer.get("event") == event]
    for oid in expired:
        del offers[oid]
    theme = EVENTS[event]["theme"].removeprefix("theme_")
    for user in db.get("users", {}).values():
        if isinstance(user, dict) and user.get("theme") == theme and not weapons.has(user, "theme_" + theme):
            user["theme"] = "meadow"
    sync_grants(db)
    return {"event_quests_removed": quest_count, "event_offers_removed": len(expired)}


def update(db, data, *, now=None):
    now = int(time.time() if now is None else now)
    event = str(data.get("id") or "halloween")
    conf = settings(db, event)
    action = data.get("action") or ("start" if data.get("enabled") is True else "finish" if "enabled" in data else "view")
    if "enabled" in data and not isinstance(data["enabled"], bool):
        raise ValueError("enabled")
    if action not in ("view", "save", "start", "finish"):
        raise ValueError("action")
    removed = {"event_quests_removed": 0, "event_offers_removed": 0}
    if action in ("save", "start"):
        clean = clean_config(data, conf)
        was_active = db["settings"].get(event + "_enabled") is True
        conf.update(clean)
        if action == "start" and not was_active:
            db["settings"][event + "_enabled"] = True
            db["settings"][event + "_epoch"] = int(db["settings"].get(event + "_epoch") or 0) + 1
            conf.update(started_at=now, ended_at=0, end_reason="")
        if db["settings"].get(event + "_enabled") is True:
            if not conf["started_at"]:
                conf["started_at"] = now
            conf["ends_at"] = conf["started_at"] + max(1, math.ceil(conf["duration_hours"] * 3600)) if conf["duration_hours"] else 0
            if conf["ends_at"] and conf["ends_at"] <= now:
                removed = finish(db, event, now=now, reason="automatic")
    elif action == "finish":
        removed = finish(db, event, now=now)
    sync_grants(db)
    return {**view(db, event, now=now), **removed}


def tick(db, *, now=None):
    now = int(time.time() if now is None else now)
    changed = False
    for event in EVENTS:
        conf = settings(db, event)
        if db["settings"].get(event + "_enabled") is not True:
            continue
        if conf["ends_at"] and conf["ends_at"] <= now:
            finish(db, event, now=now, reason="automatic")
            changed = True
            continue
        quest_ids = [qid for qid, q in db.get("quests", {}).items()
                     if isinstance(q, dict) and q.get("event") == event
                     and content_deadline(db, q) and content_deadline(db, q) <= now]
        if quest_ids:
            remove_quests(db, quest_ids)
            changed = True
        offers = db.get("shop", {}).get("offers", {})
        offer_ids = [oid for oid, offer in offers.items() if isinstance(offer, dict) and offer.get("event") == event
                     and content_deadline(db, offer) and content_deadline(db, offer) <= now]
        for oid in offer_ids:
            del offers[oid]
            changed = True
    if changed:
        db["settings"]["event_content_version"] = int(db["settings"].get("event_content_version") or 0) + 1
        sync_grants(db)
    return changed


def view(db, event="halloween", *, now=None):
    now = int(time.time() if now is None else now)
    conf = settings(db, event)
    enabled = db["settings"].get(event + "_enabled") is True
    quests = [q for q in db.get("quests", {}).values() if isinstance(q, dict) and q.get("event") == event]
    offers = [o for o in db.get("shop", {}).get("offers", {}).values() if isinstance(o, dict) and o.get("event") == event]
    return {"id": event, "name": EVENTS[event]["name"], "enabled": enabled, **conf, "server_time": now,
            "remaining_seconds": max(0, conf["ends_at"] - now) if enabled and conf["ends_at"] else None,
            "quest_count": sum(not q.get("achievement") for q in quests),
            "achievement_count": sum(bool(q.get("achievement")) for q in quests), "offer_count": len(offers),
            "events": [{"id": key, "label": value["name"]} for key, value in EVENTS.items()],
            "weapons": [{"id": wid, "name": w["name"]} for wid, w in weapons.WEAPONS.items()
                        if not w["default"] and w.get("kind", "gear") == "gear"]}
