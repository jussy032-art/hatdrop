
import copy
import hashlib
import math
import time
import threading

def install(g):
    labels={'ton':'GRAM-кошелёк','crypto':'CryptoBot','stars':'Telegram Stars','gift':'Подарок Telegram'}
    wake=threading.Event();delivery=threading.Lock()

    def queue(user, source, amount, identity, bonus=0, send_bot=True,template='deposit_received',extra=None):
        if source not in labels or not math.isfinite(float(amount)) or amount<=0: raise ValueError('Invalid deposit receipt')
        key=hashlib.sha256((str(user['id'])+':'+str(identity)).encode()).hexdigest()
        receipts=user.setdefault('deposit_receipts',{})
        if key in receipts: return
        row={'id':key,'source':source,'label':labels[source],'amount':float(amount),'bonus':float(bonus or 0),
             'balance':g['ton'](user['balance']),'created':int(time.time())}
        receipts[key]=row
        if send_bot and user['id'].startswith('tg') and not user.get('demo'):
            payload=g['message_payload'](g['bot_editor_config']()['messages'],template,g['_bot_app_url'](),extra={'mode':labels[source],'value':f'{amount:g}','balance':f'{row["balance"]:g}','bonus':f'Бонус промокода: +{bonus:g} GRAM.' if bonus else '',**(extra or {})})
            g['db'].setdefault('deposit_notifications',{}).setdefault(key,{'uid':user['id'],'payload':payload,'status':'pending','attempts':0,'next':0});wake.set()

        seen=sorted((r for r in receipts.values() if r.get('seen')),key=lambda r:r['created'],reverse=True)
        for old in seen[100:]: receipts.pop(old['id'],None)

    def view(user):
        rows=[r for r in user.get('deposit_receipts',{}).values() if not r.get('seen')]
        return copy.deepcopy(sorted(rows,key=lambda r:r['created'])[:20])

    @g['route']('/api/deposits/notice/read')
    def deposit_notice_read(user,body):
        row=user.get('deposit_receipts',{}).get(str(body.get('id') or ''))
        if not row:raise g['ApiError']('not_found',404)
        row.setdefault('seen',int(time.time()))
        return {'ok':True,'deposit_notices':view(user)}

    def deliver():
        if not delivery.acquire(blocking=False):return
        try:g['deliver_boss_notifications'](queue_name='deposit_notifications')
        finally:delivery.release()

    def loop():
        while True:
            wake.wait(2);wake.clear()
            if g['app'].config.get('TESTING'):continue
            try:deliver()
            except Exception as error:print('Deposit notification retry:',type(error).__name__,flush=True)

    g.update(queue_deposit_notice=queue,deposit_notice_view=view,deliver_deposit_notifications=deliver,wake_deposit_notifications=wake.set,deposit_notification_loop=loop)
