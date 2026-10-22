
import asyncio
import copy
import secrets
import threading
import time
import math


async def telegram_stars_level(relayer, api_id, api_hash, session, uid, username, bot_token=''):
    client = relayer._client(api_id, api_hash, session)
    try:
        await asyncio.wait_for(client.connect(), 15)
        if not await client.is_user_authorized():
            if bot_token:
                await client.sign_in(bot_token=bot_token)
            else:
                raise ValueError('telegram_not_authorized')
        if bot_token:
            me = await client.get_me()
            if not getattr(me, 'bot', False): raise ValueError('bot_session_required')

        entity = await client.get_entity('@'+username if username else int(uid))
        if int(entity.id) != int(uid):
            raise ValueError('telegram_identity_mismatch')
        _, functions, *_ = relayer._imports()
        result = await client(functions.users.GetFullUserRequest(entity))
        rating = getattr(result.full_user, 'stars_rating', None)
        return (int(rating.level) if rating is not None else 0, client.session.save())
    finally:
        await relayer._finish(client)


def install(g):
    def database(): return g['db']
    def coin_amount(value, allow_zero=False):
        try: number = float(value)
        except (ValueError, TypeError): raise g['ApiError']('bad_request', message='Укажите целое количество монет.')
        if isinstance(value, bool) or not math.isfinite(number) or number != int(number) or not (0 if allow_zero else 1) <= number <= 100000:
            raise g['ApiError']('bad_request', message='Количество монет должно быть целым: от 1 до 100000.')
        return int(number)
    def coin_balance(user):

        for row in user.get('free_spins', []):
            if not row.get('coin_migrated'):
                user['free_spin_coins'] = int(user.get('free_spin_coins', 0)) + max(0, int(row.get('remaining', 0)))
                row.update(remaining=0, coin_migrated=True)
        return max(0, int(user.get('free_spin_coins', 0)))

    def deposit_total(user):
        return sum(float(row.get('amount', 0)) for row in g['verified_promo_deposits'](user))

    def qualified(user):
        rating = user.get('telegram_stars_rating', {})
        return (user['id'].startswith('tg') and rating.get('verified') is True
                and rating.get('level', -1) >= 2 and deposit_total(user) + 1e-9 >= 1)

    def settle_referral(user):
        owner = database()['users'].get(user.get('ref_by', ''))
        if not owner or not qualified(user): return 0
        if not user.get('ref_qualified_at'):
            user['ref_qualified_at'] = int(time.time())
        pending = float(user.pop('ref_pending_principal', 0))
        bonus = g['ton'](pending * g['referral_percent']() / 100)
        if bonus:
            owner['ref_balance'] = g['ton'](owner.get('ref_balance', 0) + bonus)
            owner['ref_earned'] = g['ton'](owner.get('ref_earned', 0) + bonus)
        count = sum(1 for u in database()['users'].values() if u.get('ref_by') == owner['id'] and qualified(u))

        recorded = set(owner.get('qualified_referrals', []))
        recorded.update(u['id'] for u in database()['users'].values() if u.get('ref_by') == owner['id'] and qualified(u))
        owner['qualified_referrals'] = sorted(recorded)
        milestones = len(recorded) // 10
        awarded = int(owner.get('ref_coin_milestones', 0))
        if milestones > awarded:
            owner['free_spin_coins'] = coin_balance(owner) + milestones - awarded
            owner['ref_coin_milestones'] = milestones
        return bonus

    def credit_referral_bonus(user, amount):
        if amount <= 0 or not database()['users'].get(user.get('ref_by', '')): return 0
        user['ref_pending_principal'] = g['ton'](user.get('ref_pending_principal', 0) + amount)
        return settle_referral(user)

    original_current = g['current_user']
    def current_user():
        user, body = original_current()
        coin_balance(user)
        if user.get('ref_by') and not user.get('ref_join_coin_granted'):
            user['free_spin_coins'] = coin_balance(user) + 1
            user['ref_join_coin_granted'] = True
        return user, body

    original_referral = g['referral_view']
    def referral_view(user):
        result = original_referral(user)
        children = [u for u in database()['users'].values() if u.get('ref_by') == user['id']]
        result.update(count=sum(qualified(u) for u in children), joined=len(children),
                      invited=bool(user.get('ref_by')),
                      pending=sum(not qualified(u) for u in children), qualifying_level=2, qualifying_deposit_ton=1,
                      milestone_every=10, milestone_progress=len(user.get('qualified_referrals', [])) % 10,
                      milestone_coins=int(user.get('ref_coin_milestones', 0)),
                      telegram_stars_rating=user.get('telegram_stars_rating', {'verified': False}))
        return result

    def boss_status(user):
        cur = g['season_current']()
        boss = g['boss_view'](cur)
        if boss:
            boss.update(id=cur['id'], remaining_hp=max(0, boss['hp']-boss['damage']),
                        personal_damage=g['boss_personal_damage'](user, cur))
        return boss

    def receipts(user):
        rows = copy.deepcopy([r for r in user.get('tournament_receipts', []) if not r.get('seen')][:10])
        for row in rows:
            for award in row.get('awards', []):
                name = award.get('name','')
                if not award.get('kind') and ('монет' in name and 'фриспина' in name or 'Free Spin Coins' in name):
                    try: amount = int(name.split()[0])
                    except (ValueError,IndexError): continue
                    award.update(kind='free_coin',amount=amount,name='Монета фриспина',image='/static/free-coins/coin.png')
        return rows

    original_state = g['full_state']
    def full_state(user):
        if user.get('ref_by') and not user.get('ref_join_coin_granted'):
            user['free_spin_coins'] = coin_balance(user) + 1
            user['ref_join_coin_granted'] = True
        balance = coin_balance(user)
        cur = g['season_current']()
        if cur and cur.get('finished'): append_receipts(cur)
        result = original_state(user)
        result.update(deposit_notices=g['deposit_notice_view'](user), free_spins=[], free_spin_coins=balance, boss=boss_status(user), tournament_receipts=receipts(user))
        return result

    @g['route']('/api/free-coins/spin')
    def free_coin_spin(user, body):
        g['require_section']('upgrade')
        key = str(body.get('request_id') or '')
        if not 12 <= len(key) <= 80:
            raise g['ApiError']('bad_request')
        ledger = user.setdefault('free_coin_spins', {})
        if key in ledger: return copy.deepcopy(ledger[key])
        balance = coin_balance(user)
        if balance < 1: raise g['ApiError']('no_free_coins', message='Недостаточно Free Spin Coins.')
        target = g['resolve_target']({}, 'random')
        updated = copy.deepcopy(user)
        updated['free_spin_coins'] = balance - 1
        win = secrets.randbelow(1_000_000) < 100_000
        prize = None
        if win:
            prize = g['add_prize'](updated, target['tier'], target['name'], target['value'], target['image'])
        g['record_game'](updated, 'upgrade', 0, win, target['name'], target['image'] or 'tier:random', False, target['value'] if win else 0)
        updated['history'][0].update(free=True, kind='free_spin', image='/static/free-coins/golden-hat.png')
        result = {'win': win, 'free_spin_coins': balance-1, 'prize': prize,
                  'name': target['name'], 'image': target['image'] or '/images/hat.png', 'request_id': key}
        updated.setdefault('free_coin_spins', {})[key] = copy.deepcopy(result)
        user.clear(); user.update(updated)

        return result

    @g['route']('/api/boss/status')
    def live_boss(user, body):
        return {'deposit_notices':g['deposit_notice_view'](user),'boss': boss_status(user), 'tournament_receipts': receipts(user), 'free_spin_coins': coin_balance(user)}

    @g['route']('/api/tournament/receipt')
    def receipt_ack(user, body):
        row = next((r for r in user.get('tournament_receipts', []) if r['id'] == body.get('id')), None)
        if not row: raise g['ApiError']('not_found', 404)

        row['seen'] = int(time.time())
        return {'ok': True, 'prizes': g['visible_prizes'](user)}

    @g['route']('/api/referral/code/rename')
    def rename(user, body):
        old = user.get('ref_code', '')
        codes = database().setdefault('promocodes', {})
        item = codes.get(old)
        if not item or item.get('owner_uid') != user['id'] or not item.get('personal_referral'):
            raise g['ApiError']('not_found', 404)
        code = g['campaign_code'](body.get('code'))
        if code == old: return {'referral': referral_view(user)}
        if g['code_reserved'](code): raise g['ApiError']('promo_exists', message='Этот код уже занят.')
        codes[code] = copy.deepcopy(item)
        codes[old] = {'active': False, 'deleted': True, 'alias_to': code, 'owner_uid': user['id'], 'uses': item.get('uses', 0)}
        for alias in codes.values():
            if alias.get('alias_to') == old: alias['alias_to'] = code

        for account in database()['users'].values():
            for row in account.get('deposit_promos', []):
                if row['code'] == old: row['code'] = code
            if account.get('deposit_promo_code') == old: account['deposit_promo_code'] = code
            if account.get('referral_code_claimed') == old: account['referral_code_claimed'] = code
        user['ref_code'] = code
        return {'referral': referral_view(user)}

    @g['route']('/api/referral/verify')
    def request_rating(user, body):
        user['telegram_stars_check_requested'] = True
        return {'rating': user.get('telegram_stars_rating', {'verified': False}), 'pending': True}

    @g['route']('/api/admin/free-coins')
    def admin_coin_balance(user, body):
        g['require_admin'](user)
        target = g['find_user'](body.get('key'))
        mode = body.get('mode')
        if mode not in ('set', 'add'): raise g['ApiError']('bad_request')
        amount = coin_amount(body.get('amount'), allow_zero=mode=='set')
        request_id = str(body.get('request_id') or '')
        if not 12 <= len(request_id) <= 80: raise g['ApiError']('bad_request')
        ledger = database().setdefault('free_coin_admin_events', {})
        key = user['id']+':'+request_id
        if key in ledger:
            previous = ledger[key]
            if (previous['uid'], previous['mode'], previous['amount']) != (target['id'], mode, amount): raise g['ApiError']('request_conflict',409)
            return {'user': g['admin_user_detail'](target)}
        before = coin_balance(target)
        after = amount if mode=='set' else before+amount
        if after > 1_000_000_000: raise g['ApiError']('bad_request')
        target['free_spin_coins'] = after
        ledger[key] = {'uid': target['id'], 'mode': mode, 'amount': amount, 'delta': after-before, 'by': user['id'], 'ts': int(time.time())}
        return {'user': g['admin_user_detail'](target)}

    original_boss = g['boss_finish']
    original_season = g['season_finish']
    def append_receipts(cur):
        if not cur.get('finished') or cur.get('receipts_created'): return
        winners = {w['uid']: w for w in cur.get('winners', [])}
        for row in cur.get('final_rows', []):
            user = database()['users'].get(row['uid'])
            if not user: continue
            winner = winners.get(user['id'])
            awards = []
            if winner:
                spec = cur.get('prizes', {}).get(str(winner['place']), {})
                awards.append({'name': winner['prize'], 'image': spec.get('image') or (g['gift_image'](spec['gift'], spec.get('model', '')) if spec.get('gift') else '/images/hat.png')})
            if cur.get('mode') == 'boss' and cur.get('result') == 'defeated':
                awards.extend(g['boss_reward_display'](r) for r in cur.get('participant_rewards', []))
            user.setdefault('tournament_receipts', []).append({'id': str(cur['id']), 'name': cur['name'], 'place': row['rank'],
                'mode': cur.get('mode', 'normal'), 'victory': cur.get('result') == 'defeated' if cur.get('mode') == 'boss' else True,
                'awards': awards, 'created': int(time.time())})
        cur['receipts_created'] = True
        g['save_db']()

    def boss_finish(cur, award=True):
        original_boss(cur, award);append_receipts(cur)
    def season_finish(cur, award=True):
        original_season(cur, award);append_receipts(cur)

    def rating_cycle():


        with g['lock']:
            api_id, api_hash = g['relayer_creds']()
            doc = g['relayer_doc']()
            session = doc.get('session') if doc.get('auth', {}).get('status') not in ('qr_wait', 'code_sent', 'need_password') else ''
            bot_session = database().get('telegram_rating_bot_session', '')
            bot_token = g.get('BOT_TOKEN', '')
            if not api_id or not api_hash or not (session or bot_token): return
            now = time.time()
            candidates = [(u['id'], u.get('username', '')) for u in database()['users'].values()
                if u.get('ref_by') and u['id'].startswith('tg') and
                (u.pop('telegram_stars_check_requested', False) or now-u.get('telegram_stars_rating', {}).get('checked_at', 0) >= 3600)]
        for uid, username in candidates[:5]:
            try:
                try:
                    if not bot_token: raise ValueError('no_bot_token')
                    level, bot_session = g['relayer_lib'].run(asyncio.wait_for(telegram_stars_level(g['relayer_lib'], api_id, api_hash, bot_session, uid[2:], username, bot_token), 25))
                    with g['lock']: database()['telegram_rating_bot_session'] = bot_session
                except Exception:
                    if not session or not g['RELAYER_SCAN_MUTEX'].acquire(blocking=False): raise
                    try:
                        level, _ = g['relayer_lib'].run(asyncio.wait_for(telegram_stars_level(g['relayer_lib'], api_id, api_hash, session, uid[2:], username), 25))
                    finally: g['RELAYER_SCAN_MUTEX'].release()
                rating = {'verified': True, 'level': level, 'checked_at': int(time.time()), 'source': 'telegram.users.getFullUser'}
            except Exception:
                rating = {'verified': False, 'checked_at': int(time.time()), 'status': 'unavailable'}
            with g['lock']:
                user = database()['users'].get(uid)
                if user:
                    if rating['verified'] or not user.get('telegram_stars_rating', {}).get('verified'):
                        user['telegram_stars_rating'] = rating
                    else: user['telegram_stars_rating']['checked_at'] = rating['checked_at']
                    settle_referral(user);g['save_db']()

    def worker():
        while True:
            time.sleep(30)
            if g['app'].config.get('TESTING'): continue
            try: rating_cycle()
            except Exception: g['app'].logger.exception('Telegram Stars verification failed')

    g.update(current_user=current_user, full_state=full_state, referral_view=referral_view,
             credit_referral_bonus=credit_referral_bonus, free_spins_view=lambda user: [],
             boss_finish=boss_finish, season_finish=season_finish, free_coin_balance=coin_balance,
             referral_qualified=qualified, settle_referral=settle_referral, telegram_rating_cycle=rating_cycle)
    g['finite_free_coin_amount'] = coin_amount
    g['referral_rating_loop'] = worker
