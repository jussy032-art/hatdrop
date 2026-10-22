

RARITIES = {"common": "Обычное", "rare": "Редкое", "epic": "Эпическое", "legendary": "Легендарное"}
WEAPONS = {
    "axe": {"name": "Топор", "default": True, "event": "", "rarity": "common"},
    "staff": {"name": "Посох", "default": True, "event": "", "rarity": "common"},
    "skeleton": {"name": "Рука скелета", "default": False, "event": "halloween", "rarity": "rare", "event_free": True},
    "sword": {"name": "Меч", "default": False, "event": "", "rarity": "rare"},
    "hammer": {"name": "Молот", "default": False, "event": "", "rarity": "rare"},
    "trident": {"name": "Трезубец", "default": False, "event": "", "rarity": "epic"},
    "crystal": {"name": "Кристальный жезл", "default": False, "event": "", "rarity": "legendary"},
    "club": {"name": "Костяная дубина", "default": False, "event": "halloween", "rarity": "rare"},
    "pumpkin": {"name": "Тыквенный посох", "default": False, "event": "halloween", "rarity": "epic"},
    "scythe": {"name": "Коса жнеца", "default": False, "event": "halloween", "rarity": "legendary"},

    "shovel": {"name": "Лопата фермера", "default": False, "event": "", "rarity": "common"},
    "pitchfork": {"name": "Вилы", "default": False, "event": "", "rarity": "rare"},
    "flower": {"name": "Цветочный жезл", "default": False, "event": "", "rarity": "rare"},
    "rainbow": {"name": "Радужный посох", "default": False, "event": "", "rarity": "epic"},
    "butterfly": {"name": "Жезл бабочки", "default": False, "event": "", "rarity": "epic"},
    "sun": {"name": "Солнечный скипетр", "default": False, "event": "", "rarity": "legendary"},
    "pickaxe": {"name": "Кирка шахтёра", "default": False, "event": "", "rarity": "common"},
    "mace": {"name": "Булава", "default": False, "event": "", "rarity": "common"},
    "spear": {"name": "Копьё", "default": False, "event": "", "rarity": "rare"},
    "orb": {"name": "Жезл мага", "default": False, "event": "", "rarity": "rare"},
    "frost": {"name": "Ледяной клинок", "default": False, "event": "", "rarity": "epic"},
    "flame": {"name": "Огненный жезл", "default": False, "event": "", "rarity": "epic"},
    "dragon": {"name": "Клинок дракона", "default": False, "event": "", "rarity": "legendary"},
    "thunder": {"name": "Молния Зевса", "default": False, "event": "", "rarity": "legendary"},

    "spin_plain": {"name": "Прокрут: Обычный", "default": True, "event": "", "rarity": "common", "kind": "spin"},
    "spin_wild": {"name": "Прокрут: Дикий", "default": True, "event": "", "rarity": "rare", "kind": "spin"},
    "spin_roulette": {"name": "Прокрут: Рулетка", "default": False, "event": "", "rarity": "rare", "kind": "spin"},
    "spin_turbo": {"name": "Прокрут: Рывок", "default": False, "event": "", "rarity": "rare", "kind": "spin"},
    "spin_spring": {"name": "Прокрут: Пружина", "default": False, "event": "", "rarity": "rare", "kind": "spin"},
    "spin_snap": {"name": "Прокрут: Замах", "default": False, "event": "", "rarity": "epic", "kind": "spin"},
    "spin_pendulum": {"name": "Прокрут: Маятник", "default": False, "event": "", "rarity": "epic", "kind": "spin"},
    "spin_tease": {"name": "Прокрут: Интрига", "default": False, "event": "", "rarity": "epic", "kind": "spin"},
    "spin_swing": {"name": "Прокрут: Качели", "default": False, "event": "", "rarity": "legendary", "kind": "spin"},

    "theme_hall": {"name":"Оформление: Зал","default":False,"event":"","rarity":"legendary","kind":"theme"},
    "hall_emerald_scepter": {'name': 'Изумрудный жезл', 'default': False, 'event': '', 'rarity': 'legendary', 'theme': 'hall', 'requires_theme': 'theme_hall'},
    "hall_host_axe": {'name': 'Топор Хозяина', 'default': False, 'event': '', 'rarity': 'legendary', 'theme': 'hall', 'requires_theme': 'theme_hall'},
    "hall_ember_poker": {'name': 'Каминная кочерга', 'default': False, 'event': '', 'rarity': 'legendary', 'theme': 'hall', 'requires_theme': 'theme_hall'},
    "theme_basement": {"name": "Оформление: Подвал", "default": False, "event": "", "rarity": "epic", "kind": "theme"},
    "basement_wrench": {"name": "Ключ смотрителя", "default": False, "event": "", "rarity": "epic", "theme": "basement", "requires_theme": "theme_basement"},
    "theme_meadow": {"name": "Оформление: Поляна", "default": True, "event": "", "rarity": "common", "kind": "theme"},
    "theme_halloween": {"name": "Оформление: Хэллоуин", "default": False, "event": "halloween", "rarity": "rare", "kind": "theme", "event_free": True},
}


ACTIVE_EVENT = ""
EVENT_GRANTS = {}


def owned(user):

    got = user.get("weapons") if isinstance(user.get("weapons"), list) else []
    free = {k for k, v in WEAPONS.items() if v.get("event_free") and ACTIVE_EVENT and v["event"] == ACTIVE_EVENT}
    if ACTIVE_EVENT in EVENT_GRANTS:
        free = EVENT_GRANTS[ACTIVE_EVENT]
    available = {k for k, v in WEAPONS.items() if v["default"]} | free | {w for w in got if w in WEAPONS}
    return sorted(w for w in available if not required_theme(w) or has(user, required_theme(w)))



DEFAULT_VISIBLE = {"axe", "staff", "skeleton", "spin_plain", "spin_wild", "basement_wrench", "theme_meadow", "theme_halloween", "theme_basement", "theme_hall", "hall_emerald_scepter", "hall_host_axe", "hall_ember_poker"}


def is_hideable(wid):
    return wid in WEAPONS and (WEAPONS[wid].get("kind", "gear") in ("gear", "spin") or (WEAPONS[wid].get("kind") == "theme" and not WEAPONS[wid]["default"]))


def hidden_set(settings):

    raw = settings.get("weapon_hidden")
    if isinstance(raw, list):
        return {w for w in raw if is_hideable(w)}
    return {w for w in WEAPONS if is_hideable(w) and w not in DEFAULT_VISIBLE}


def has(user, wid):

    got = user.get("weapons") if isinstance(user.get("weapons"), list) else []
    return wid in WEAPONS and (bool(WEAPONS[wid]["default"]) or wid in got) and (not required_theme(wid) or has(user, required_theme(wid)))


def required_theme(wid):
    return WEAPONS.get(wid, {}).get("requires_theme", "")


def reconcile_theme_equipment(user):

    got = user.get("weapons")
    if isinstance(got, list):
        user["weapons"] = [w for w in got if not required_theme(w) or has(user, required_theme(w))]


def grant(user, weapon):
    if weapon not in WEAPONS:
        raise ValueError("bad_weapon")
    if required_theme(weapon) and not has(user, required_theme(weapon)):
        raise ValueError("theme_required")
    have = user.setdefault("weapons", [])
    if weapon not in have:
        have.append(weapon)


def revoke(user, weapon):
    if weapon not in WEAPONS or WEAPONS[weapon]["default"]:
        raise ValueError("bad_weapon")
    removed = {weapon}
    while True:
        dependents = {w for w in WEAPONS if required_theme(w) in removed}
        if dependents <= removed:
            break
        removed |= dependents
    user["weapons"] = [w for w in user.get("weapons", []) if w not in removed]
    if isinstance(user.get("unhidden"), list):
        user["unhidden"] = [w for w in user["unhidden"] if w not in removed]



DEFAULT_CFG = {
    "collections": [
        {"id": "halloween", "name": "Хэллоуин", "need": 4, "reward": 0, "weapons": ["skeleton", "club", "pumpkin", "scythe"]},
    ],
    "levels": [],
}


def is_gear(wid):
    return wid in WEAPONS and WEAPONS[wid].get("kind") not in ("spin", "theme")


def gear_ids():
    return [k for k in WEAPONS if is_gear(k)]


def clean_cfg(raw):

    raw = raw if isinstance(raw, dict) else {}
    used, cols, ids = set(), [], set()
    for c in (raw.get("collections") or [])[:30]:
        if not isinstance(c, dict):
            continue
        name = str(c.get("name") or "").strip()[:40]
        if not name:
            raise ValueError("collection_name")
        cid = str(c.get("id") or "").strip()[:20] or "c" + str(len(cols) + 1)
        while cid in ids:
            cid += "x"
        ids.add(cid)
        ws = []
        for w in c.get("weapons") or []:
            w = str(w)
            if is_gear(w) and w not in used:
                used.add(w)
                ws.append(w)
        try:
            reward = round(max(0.0, min(100000.0, float(c.get("reward") or 0))), 6)
            need = int(c.get("need") or len(ws))
        except (TypeError, ValueError):
            raise ValueError("collection_number")
        cols.append({"id": cid, "name": name, "need": max(1, min(need, max(1, len(ws)))), "reward": reward, "weapons": ws})
    levels, lids = [], set()
    for lv in (raw.get("levels") or [])[:30]:
        if not isinstance(lv, dict):
            continue
        try:
            need = int(lv.get("need") or 0)
            reward = round(max(0.0, min(100000.0, float(lv.get("reward") or 0))), 6)
        except (TypeError, ValueError):
            raise ValueError("level_number")
        if need < 1:
            raise ValueError("level_number")
        lid = str(lv.get("id") or "").strip()[:20] or "l" + str(len(levels) + 1)
        while lid in lids:
            lid += "x"
        lids.add(lid)
        levels.append({"id": lid, "need": need, "reward": reward})
    levels.sort(key=lambda x: x["need"])
    return {"collections": cols, "levels": levels}


def get_cfg(settings):
    cfg = settings.get("weapon_cfg")
    return clean_cfg(cfg) if isinstance(cfg, dict) else clean_cfg(DEFAULT_CFG)


def collection_of(cfg):
    return {w: c["id"] for c in cfg["collections"] for w in c["weapons"]}


def progress(user, cfg):
    have = set(owned(user))
    allg = gear_ids()
    return {
        "total": len(allg), "have": sum(1 for w in allg if w in have),
        "collections": {c["id"]: sum(1 for w in c["weapons"] if w in have) for c in cfg["collections"]},
    }
