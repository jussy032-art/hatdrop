"""Blocked themes: an admin can switch an appearance (e.g. meadow) off for everyone or for one player, owners included.

Blocked themes (global settings.blocked_themes plus the player's own user.blocked_themes) are added to the
player's hidden list (hidden_for), so the game hides them from the theme picker and the shop, /api/theme/set
refuses them and effective_theme moves the player off them. When the player's theme is blocked they get the first
allowed theme they own (Halloween during the event, then basement, hall, meadow). If nothing else is available the
game still has to draw something, so meadow stays as the last resort.
"""

ORDER = ('halloween', 'basement', 'hall', 'meadow')


def install(g):
    ApiError = g['ApiError']
    weapons_lib = g['weapons_lib']

    def database():
        return g['db']

    def theme_ids():
        return [k for k, v in weapons_lib.WEAPONS.items() if v.get('kind') == 'theme']

    def clean(raw):
        known = set(theme_ids())
        return {t for t in raw if t in known} if isinstance(raw, list) else set()

    def blocked_global():
        return clean(database().setdefault('settings', {}).get('blocked_themes'))

    def blocked_for(user):
        return blocked_global() | clean(user.get('blocked_themes'))

    original_hidden_for = g['hidden_for']

    def hidden_for(user):
        extra = blocked_for(user)
        base = original_hidden_for(user)
        return sorted(set(base) | extra) if extra else base

    original_effective = g['effective_theme']

    def effective_theme(user):
        theme = original_effective(user)
        locked = blocked_for(user)
        if 'theme_' + theme not in locked:
            return theme
        owned, hidden = weapons_lib.owned(user), set(hidden_for(user))
        settings = database()['settings']
        for cand in ORDER:
            wid = 'theme_' + cand
            if wid in locked or wid in hidden or wid not in owned:
                continue
            if cand == 'halloween' and settings.get('halloween_enabled') is not True and not weapons_lib.has(user, wid):
                continue
            user['theme'] = cand
            return cand
        return theme

    g.update(hidden_for=hidden_for, effective_theme=effective_theme)

    def chosen_ids(body):
        ids = body.get('blocked')
        if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
            raise ApiError('bad_request', 400, message='Передайте список оформлений.')
        return sorted(clean(ids))

    # ---------- everyone ----------
    def admin_view():
        locked = blocked_global()
        rows = [{'id': k, 'name': weapons_lib.WEAPONS[k]['name'], 'blocked': k in locked} for k in theme_ids()]
        return {'themes': rows}

    @g['route']('/api/admin/themes/blocked')
    def admin_themes_blocked(user, body):
        g['require_admin'](user)
        return admin_view()

    @g['route']('/api/admin/themes/blocked/save')
    def admin_themes_blocked_save(user, body):
        g['require_admin'](user)
        chosen = chosen_ids(body)
        if len(chosen) >= len(theme_ids()):
            raise ApiError('bad_request', 400, message='Нельзя скрыть все оформления — хотя бы одно должно остаться.')
        database()['settings']['blocked_themes'] = chosen
        return admin_view()

    # ---------- one player ----------
    def user_view(target):
        everyone, own = blocked_global(), clean(target.get('blocked_themes'))
        owned = set(weapons_lib.owned(target))
        rows = [{'id': k, 'name': weapons_lib.WEAPONS[k]['name'], 'owned': k in owned,
                 'blocked': k in own, 'blocked_all': k in everyone} for k in theme_ids()]
        return {'themes': rows, 'current': g['effective_theme'](target)}

    @g['route']('/api/admin/user/themes')
    def admin_user_themes(user, body):
        g['require_admin'](user)
        return user_view(g['find_user'](str(body.get('key') or '')))

    @g['route']('/api/admin/user/themes/save')
    def admin_user_themes_save(user, body):
        g['require_admin'](user)
        target = g['find_user'](str(body.get('key') or ''))
        chosen = chosen_ids(body)
        if len(set(chosen) | blocked_global()) >= len(theme_ids()):
            raise ApiError('bad_request', 400, message='Нельзя скрыть игроку все оформления — хотя бы одно должно остаться.')
        if chosen:
            target['blocked_themes'] = chosen
        else:
            target.pop('blocked_themes', None)
        return user_view(target)
