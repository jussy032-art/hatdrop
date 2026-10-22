"""Personal bosses: a skeleton that spawns for one player at a random moment and lives for an hour.

Every accepted stake (upgrades and chests) deals damage: 1 GRAM of turnover = 1 HP (times the mode multiplier).
HP is random between hp_min and hp_max. The NFT reward is fixed at spawn: the cheapest catalogue gift for a
boss with hp_min, scaling linearly up to price_mult_max times that price for a boss with hp_max.
Defeating the boss also grants Kostyan's hand (weapon "skeleton") if the player does not own it yet.
"""
import copy
import math
import secrets
import threading
import time

HAND = 'skeleton'
HAND_IMAGE = '/static/weapons/skeleton-hand-icon.png'
DEFAULTS = {
    'enabled': True,
    'hp_min': 100.0, 'hp_max': 300.0,
    'interval_min_h': 4.0, 'interval_max_h': 12.0,
    'duration_min': 60,
    'price_mult_max': 3.0,
    'active_days': 7,
    'rates': {'upgrade': 1.0, 'chests': 1.0},
    'give_hand': True,
}
HISTORY_KEEP = 20
_rng = secrets.SystemRandom()


def install(g):
    ApiError = g['ApiError']

    def database():
        return g['db']

    def cfg():
        raw = database().setdefault('settings', {}).get('personal_boss')
        raw = raw if isinstance(raw, dict) else {}
        out = copy.deepcopy(DEFAULTS)
        for key, value in raw.items():
            if key == 'rates' and isinstance(value, dict):
                out['rates'].update({k: float(v) for k, v in value.items() if k in out['rates']})
            elif key in out:
                out[key] = value
        return out

    def number(body, key, low, high, integer=False):
        try:
            value = float(body.get(key))
        except (TypeError, ValueError):
            raise ApiError('bad_request', 400, message=f'Проверьте поле «{key}».')
        if not math.isfinite(value) or not low <= value <= high or (integer and value != int(value)):
            raise ApiError('bad_request', 400, message=f'Поле «{key}»: от {low:g} до {high:g}.')
        return int(value) if integer else value

    # ---------- reward ----------
    def priced_gifts():
        rows = []
        for slug in list(g['gifts_map']()):
            try:
                price = float(g['gift_floor'](slug))
            except Exception:
                continue
            if price > 0 and math.isfinite(price):
                rows.append((price, slug))
        rows.sort()
        return rows

    def reward_for(hp, c):
        rows = priced_gifts()
        if not rows:
            return None
        cheapest = rows[0][0]
        span = c['hp_max'] - c['hp_min']
        share = min(1.0, max(0.0, (hp - c['hp_min']) / span)) if span > 0 else 0.0
        mult = 1 + (c['price_mult_max'] - 1) * share
        budget = cheapest * mult * 1.000001
        price, slug = max((row for row in rows if row[0] <= budget), default=rows[0])
        target = g['resolve_target']({'gift': slug, 'model': ''}, 'gift')
        return {'slug': slug, 'name': target['name'], 'image': target['image'],
                'value': g['money'](target['value']), 'mult': round(mult, 2)}

    def hand_view():
        meta = g['weapons_lib'].WEAPONS.get(HAND, {})
        return {'id': HAND, 'name': 'Рука Костяна', 'weapon_name': meta.get('name', 'Рука скелета'),
                'image': HAND_IMAGE}

    # ---------- lifecycle ----------
    def eligible(user, now, c):
        if not str(user.get('id', '')).startswith('tg') or user.get('demo') or user.get('banned'):
            return False
        history = user.get('history') or []
        last = history[0].get('ts', 0) if history else 0
        return last >= now - c['active_days'] * 86400

    def schedule(user, after, c):
        low, high = sorted((float(c['interval_min_h']), float(c['interval_max_h'])))
        user['pboss_next'] = int(after + _rng.uniform(low, high) * 3600)

    def spawn(user, now=None, c=None, hp=None):
        c = c or cfg()
        now = int(now or time.time())
        low, high = sorted((float(c['hp_min']), float(c['hp_max'])))
        hp = float(hp) if hp else float(round(_rng.uniform(low, high)))
        reward = reward_for(hp, c)
        if reward is None:
            schedule(user, now, c)
            return None
        boss = {'id': secrets.token_hex(6), 'start': now, 'end': now + int(c['duration_min']) * 60,
                'hp': hp, 'damage': 0.0, 'reward': reward, 'hand': bool(c['give_hand']),
                'rates': dict(c['rates']), 'status': 'active', 'intro_seen': False, 'result_seen': False}
        user['pboss'] = boss
        schedule(user, boss['end'], c)
        return boss

    def archive(user, boss):
        rows = user.setdefault('pboss_history', [])
        rows.insert(0, {k: boss.get(k) for k in ('id', 'start', 'end', 'hp', 'damage', 'status', 'finished_at')}
                    | {'reward': (boss.get('reward') or {}).get('name', '')})
        del rows[HISTORY_KEEP:]

    def finish(user, boss, defeated, now=None):
        now = int(now or time.time())
        boss.update(status='defeated' if defeated else 'expired', finished_at=now, result_seen=False)
        if defeated:
            awards = []
            spec = boss['reward']
            try:
                target = g['resolve_target']({'gift': spec['slug'], 'model': ''}, 'gift')
                value, name, image = target['value'], target['name'], target['image']
            except Exception:
                value, name, image = spec['value'], spec['name'], spec['image']
            prize = g['add_prize'](user, f"gift:{spec['slug']}:", name, value, image)
            prize['source'] = 'personal_boss'
            awards.append({'kind': 'nft', 'name': name, 'image': image, 'value': g['money'](value)})
            if boss.get('hand'):
                hand = hand_view()
                owned = g['weapons_lib'].has(user, HAND)
                if not owned:
                    g['grant_weapon'](user, HAND)
                awards.append({'kind': 'item', 'name': hand['name'], 'image': hand['image'], 'already': owned})
            boss['awards'] = awards
        archive(user, boss)

    def check(user, now=None, c=None):
        """Expire an overdue boss; returns the boss dict (or None)."""
        boss = user.get('pboss')
        if boss and boss.get('status') == 'active' and (now or time.time()) >= boss['end']:
            finish(user, boss, False, boss['end'])
        return user.get('pboss')

    def hit(user, cost, mode):
        boss = user.get('pboss')
        now = time.time()
        if not boss or boss.get('status') != 'active' or cost <= 0 or user.get('demo'):
            return
        if now >= boss['end']:
            finish(user, boss, False, boss['end'])
            return
        rate = float((boss.get('rates') or {}).get(mode, 1))
        if rate <= 0:
            return
        boss['damage'] = round(min(boss['hp'], boss.get('damage', 0) + cost * rate), 6)
        boss['last_hit'] = int(now)
        if boss['damage'] + 1e-8 >= boss['hp']:
            boss['damage'] = boss['hp']
            finish(user, boss, True, now)

    def view(user):
        boss = check(user)
        if not boss:
            return None
        status = boss['status']
        if status != 'active' and boss.get('result_seen'):
            return None
        hand = hand_view() if boss.get('hand') else None
        return {'id': boss['id'], 'status': status, 'start': boss['start'], 'end': boss['end'], 'now': int(time.time()),
                'hp': boss['hp'], 'damage': boss.get('damage', 0), 'remaining': max(0.0, boss['hp'] - boss.get('damage', 0)),
                'rates': boss.get('rates', {}), 'reward': boss['reward'], 'hand': hand,
                'intro_seen': bool(boss.get('intro_seen')), 'awards': boss.get('awards', []),
                'name': 'Скелет-Жнец'}

    # ---------- hooks ----------
    original_hit = g['boss_hit']

    def boss_hit(user, cost, ts=None, mode='upgrade'):
        original_hit(user, cost, ts, mode=mode)
        try:
            hit(user, cost, mode)
        except Exception:
            g['app'].logger.exception('personal boss hit failed')

    original_state = g['full_state']

    def full_state(user):
        result = original_state(user)
        result['personal_boss'] = view(user)
        return result

    original_detail = g['admin_user_detail']

    def admin_user_detail(u):
        result = original_detail(u)
        boss = check(u)
        result['personal_boss'] = {
            'active': copy.deepcopy({k: boss[k] for k in ('id', 'start', 'end', 'hp', 'damage', 'reward')})
            if boss and boss.get('status') == 'active' else None,
            'next': int(u.get('pboss_next') or 0), 'now': int(time.time()),
            'history': copy.deepcopy(u.get('pboss_history', [])[:5]),
            'hp_min': cfg()['hp_min'], 'hp_max': cfg()['hp_max'],
        }
        return result

    g.update(boss_hit=boss_hit, full_state=full_state, admin_user_detail=admin_user_detail)

    # ---------- player API ----------
    # under /api/state/… so the request wrapper treats it as read-only polling (no synchronous DB flush)
    @g['route']('/api/state/personal-boss')
    def personal_boss_status(user, body):
        return {'personal_boss': view(user), 'server_time': int(time.time())}

    @g['route']('/api/personal-boss/ack')
    def personal_boss_ack(user, body):
        boss = user.get('pboss')
        if not boss or boss.get('id') != body.get('id'):
            raise ApiError('not_found', 404)
        if body.get('kind') == 'intro':
            boss['intro_seen'] = True
        elif body.get('kind') == 'result' and boss.get('status') != 'active':
            boss['result_seen'] = True
        else:
            raise ApiError('bad_request')
        return {'personal_boss': view(user), 'prizes': g['visible_prizes'](user),
                'weapons': g['weapons_lib'].owned(user)}

    # ---------- admin API ----------
    def admin_view():
        c = cfg()
        now = time.time()
        active = []
        stats = {'active': 0, 'defeated_24h': 0, 'expired_24h': 0, 'scheduled': 0}
        for u in database()['users'].values():
            boss = u.get('pboss')
            if boss and boss.get('status') == 'active' and now < boss['end']:
                stats['active'] += 1
                active.append({'uid': u['id'], 'key': u.get('key'), 'name': g['display_name'](u), 'hp': boss['hp'],
                               'damage': boss.get('damage', 0), 'end': boss['end'], 'reward': boss['reward']['name']})
            for row in u.get('pboss_history', []):
                if row.get('finished_at', 0) >= now - 86400:
                    stats['defeated_24h' if row.get('status') == 'defeated' else 'expired_24h'] += 1
            if u.get('pboss_next'):
                stats['scheduled'] += 1
        active.sort(key=lambda r: r['end'])
        preview = []
        for hp in (c['hp_min'], (c['hp_min'] + c['hp_max']) / 2, c['hp_max']):
            try:
                reward = reward_for(hp, c)
            except Exception:
                reward = None
            preview.append({'hp': hp, 'reward': reward})
        return {'settings': c, 'hatcoin_cashback_percent': g['hatcoin_cashback_percent'](),
                'stats': stats, 'active': active[:30], 'preview': preview, 'hand': hand_view(), 'now': int(now)}

    @g['route']('/api/admin/personal-boss')
    def admin_personal_boss(user, body):
        g['require_admin'](user)
        return admin_view()

    @g['route']('/api/admin/personal-boss/save')
    def admin_personal_boss_save(user, body):
        g['require_admin'](user)
        hp_min = number(body, 'hp_min', 1, 1_000_000)
        hp_max = number(body, 'hp_max', 1, 1_000_000)
        imin = number(body, 'interval_min_h', 0.05, 24 * 30)
        imax = number(body, 'interval_max_h', 0.05, 24 * 30)
        if hp_max < hp_min or imax < imin:
            raise ApiError('bad_request', 400, message='Минимум не может быть больше максимума.')
        rates = body.get('rates') if isinstance(body.get('rates'), dict) else {}
        settings = {
            'enabled': body.get('enabled') is True,
            'hp_min': hp_min, 'hp_max': hp_max, 'interval_min_h': imin, 'interval_max_h': imax,
            'duration_min': number(body, 'duration_min', 1, 24 * 60, integer=True),
            'price_mult_max': number(body, 'price_mult_max', 1, 100),
            'active_days': number(body, 'active_days', 1, 365, integer=True),
            'rates': {k: number(rates, k, 0, 1000) for k in ('upgrade', 'chests')},
            'give_hand': body.get('give_hand') is True,
        }
        cashback = number(body, 'hatcoin_cashback_percent', 0, 1000)
        old = cfg()
        database()['settings']['personal_boss'] = settings
        database()['settings']['hatcoin_cashback_percent'] = cashback
        if (old['interval_min_h'], old['interval_max_h']) != (imin, imax):
            now = time.time()
            for u in database()['users'].values():
                if u.get('pboss_next', 0) > now:
                    schedule(u, now, settings)
        return admin_view()

    @g['route']('/api/admin/personal-boss/spawn')
    def admin_personal_boss_spawn(user, body):
        g['require_admin'](user)
        target = g['find_user'](str(body.get('key') or user.get('key')))
        boss = check(target)
        if boss and boss.get('status') == 'active':
            raise ApiError('busy', 409, message='У игрока уже есть активный личный босс.')
        hp = number(body, 'hp', 1, 1_000_000) if body.get('hp') not in (None, '') else None
        if not spawn(target, hp=hp):
            raise ApiError('no_price', 409, message='Каталог подарков не загружен — нечем награждать.')
        return {'user': g['admin_user_detail'](target)} if body.get('for') == 'user' else admin_view()

    @g['route']('/api/admin/personal-boss/cancel')
    def admin_personal_boss_cancel(user, body):
        g['require_admin'](user)
        target = g['find_user'](str(body.get('key') or ''))
        boss = target.get('pboss')
        if not boss or boss.get('status') != 'active':
            raise ApiError('not_found', 404)
        boss.update(status='cancelled', finished_at=int(time.time()), result_seen=True)
        archive(target, boss)
        return {'user': g['admin_user_detail'](target)} if body.get('for') == 'user' else admin_view()

    # ---------- spawner ----------
    def tick():
        changed = False
        with g['lock']:
            c = cfg()
            now = time.time()
            for user in database()['users'].values():
                boss = user.get('pboss')
                if boss and boss.get('status') == 'active':
                    if now >= boss['end']:
                        finish(user, boss, False, boss['end'])
                        changed = True
                    continue
                if not c['enabled'] or not eligible(user, now, c):
                    continue
                if not user.get('pboss_next'):
                    schedule(user, now, c)
                    changed = True
                elif now >= user['pboss_next']:
                    if now - user['pboss_next'] > 3600:
                        schedule(user, now, c)
                    else:
                        spawn(user, now, c)
                    changed = True
            if changed:
                g['save_db']()

    def loop():
        time.sleep(15)
        while True:
            if not g['app'].config.get('TESTING'):
                try:
                    tick()
                except Exception:
                    g['app'].logger.exception('personal boss tick failed')
            time.sleep(30)

    threading.Thread(target=loop, daemon=True, name='personal-boss').start()
    g['personal_boss_tick'] = tick
    g['personal_boss_spawn'] = spawn
