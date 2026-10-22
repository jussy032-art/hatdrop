
import copy
import re
import time
from urllib.parse import urlsplit
from decimal import Decimal, ROUND_DOWN

DAY = 86400
LOCK = 3 * DAY
NANO = 1_000_000_000


def hat(prize):
    tier = str(prize.get('tier', ''))
    if tier in ('random', 'onyx', 'black'):
        return True
    collection = tier.split(':')[1] if tier.startswith(('gift:', 'nft:')) and ':' in tier else ''
    collection=re.sub(r'-\d+$','',collection)
    slug = re.sub(r'-\d+$', '', str(prize.get('nft_slug', '')))
    return any(re.sub('[^a-z]', '', value.lower()) in ('witchhat', 'witchhead', 'bechat', 'beachhead') for value in (collection, slug))


def locked(prize, now=None):
    return prize.get('status') in ('staked','deposit_pending') or int(prize.get('staking_lock_until', 0)) > int(time.time() if now is None else now)


def settle(user, now):
    balance = int(user.get('staking_balance_nano', 0))
    for prize in user.get('prizes', []):
        if prize.get('status') != 'staked':
            continue
        row = prize['staking']
        elapsed = max(0, now - row['last'])
        earned, remainder = divmod(elapsed * row['daily_nano'] + row.get('remainder', 0), DAY)
        balance += earned
        row['earned_nano'] = row.get('earned_nano', 0) + earned
        row['remainder'] = remainder
        row['last'] = max(row['last'], now)
    user['staking_balance_nano'] = balance


def install(g):
    def active_count():
        return sum(p.get('status')=='staked' and hat(p) for user in g['db']['users'].values() for p in user.get('prizes',[]))

    def rate_settings():
        settings=g['db'].setdefault('settings',{}).setdefault('staking',{})
        if settings.get('tier_policy')!=2:
            settings.setdefault('percent_per_day',1);settings.setdefault('above_percent_per_day',.5)
            settings['tier_policy']=2;settings.pop('tier_signature',None)
        return settings

    def percent():
        settings=rate_settings()
        return Decimal(str(settings.get('percent_per_day',1) if settings.get('admissions',0)<100 else settings.get('above_percent_per_day',.5)))

    def sync_rates(now=None):
        now=int(time.time()) if now is None else now
        settings=rate_settings();entries=[(user,prize) for user in g['db']['users'].values() for prize in user.get('prizes',[]) if hat(prize) and prize.get('staking')]
        signature=f"{settings['percent_per_day']}:{settings['above_percent_per_day']}"
        pending=sorted(((user,prize) for user,prize in entries if not prize['staking'].get('global_order')),key=lambda entry:(entry[1]['staking']['started'],entry[1]['id'],entry[0]['id']))
        settings['admissions']=max([settings.get('admissions',0)]+[prize['staking'].get('global_order',0) for _,prize in entries])
        if settings.get('tier_signature')==signature and not pending:return
        for user in g['db']['users'].values():settle(user,now)
        for _,prize in pending:
            settings['admissions']+=1;prize['staking']['global_order']=settings['admissions']
        for _,prize in entries:
            if prize.get('status')=='staked':
                row=prize['staking'];value=Decimal(str(settings['percent_per_day'] if row['global_order']<=100 else settings['above_percent_per_day']))
                row['daily_nano']=daily_for(row['base_nano'],value);row['percent_per_day']=float(value)
        settings['tier_signature']=signature

    def daily_for(base, value=None):
        return int((Decimal(base)*(percent() if value is None else value)/100).to_integral_value(rounding=ROUND_DOWN))

    def refresh_quote(user,prize):
        choice=prize.get('deposit_choice',{})
        if choice.get('status')!='pending' or choice.get('rule')=='hat110' or not choice.get('portal_ton'):return
        portal=choice['portal_ton'];prize['value']=portal;choice.update(amount_ton=g['ton'](portal*1.1),rule='hat110')
        event=g['relayer_doc']()['events'].get(choice['event_key'])
        if event:event['price_ton']=choice['amount_ton']
        job=g['db'].get('deposit_notifications',{}).get(f'hat-choice:{user["id"]}:{prize["id"]}')
        if job and job.get('status')=='pending':
            payload=g['message_payload'](g['bot_editor_config']()['messages'],'hat_deposit_choice',g['_bot_app_url'](),gift=prize['name'],extra={'value':f'{choice["amount_ton"]:g}','prize_id':prize['id']});payload['photo']=job['payload'].get('photo');job['payload']=payload

    def base_price():
        if g['db'].get('settings', {}).get('active_market', 'portals') != 'portals':
            return 0
        for key, entry in g['CATALOG'].items():
            if g['_norm'](key) in ('witchhat', 'witchhead', 'bechat', 'beachhead') and entry.get('source', 'portals') == 'portals':
                value = Decimal(str(entry.get('floor') or 0))
                if value.is_finite() and value > 0:
                    return int((value * NANO).to_integral_value(rounding=ROUND_DOWN))
        return 0

    def view(user):
        now = int(time.time());sync_rates(now);settle(user, now)
        positions=[];eligible=[];daily=0
        for prize in user.get('prizes', []):
            if not hat(prize):
                continue
            if prize.get('status') == 'staked':
                row=prize['staking'];daily+=row['daily_nano']
                positions.append({**g['prize_view'](prize), 'started':row['started'], 'unlock_at':row['unlock_at'],
                                  'base_ton':row['base_nano']/NANO, 'daily_ton':row['daily_nano']/NANO,'global_order':row['global_order'],
                                  'percent_per_day':row.get('percent_per_day',float(Decimal(row['daily_nano'])*100/row['base_nano'])),
                                  'earned_ton':row.get('earned_nano',0)/NANO})
            elif prize.get('status') == 'deposit_pending' and prize.get('deposit_choice',{}).get('status') == 'pending':
                refresh_quote(user,prize)
                eligible.append({**g['prize_view'](prize),'credit_ton':prize['deposit_choice']['amount_ton']})
        base=base_price()
        return {'now':now,'percent_per_day':float(percent()),'lock_seconds':LOCK,'return_lock_seconds':LOCK,
                'balance_ton':user.get('staking_balance_nano',0)/NANO,'daily_ton':daily/NANO,
                'base_ton':base/NANO,'new_daily_ton':daily_for(base)/NANO,'price_available':base>0,
                'positions':positions,'eligible':eligible,'total_hats':active_count(),'admissions':rate_settings().get('admissions',0),'remaining_high_rate':max(0,100-rate_settings().get('admissions',0)),'rate_threshold':100,'base_percent_per_day':float(rate_settings()['percent_per_day']),'above_percent_per_day':float(rate_settings()['above_percent_per_day'])}

    original_prize_view=g['prize_view']
    def prize_view(prize):
        result=original_prize_view(prize)
        slug=str(prize.get('nft_slug',''))
        if re.fullmatch(r'[A-Za-z][A-Za-z0-9]{1,63}-[1-9][0-9]{0,10}',slug):
            result.update(nft_slug=slug,telegram_url='https://t.me/nft/'+slug,image='/nft-img/'+slug.lower()+'.png',animation='/nft-animation/'+slug.lower()+'.json')
        result['staking_eligible']=hat(prize) and prize.get('status')=='deposit_pending' and prize.get('deposit_choice',{}).get('status')=='pending'
        result['staking_lock_until']=int(prize.get('staking_lock_until',0))
        if prize.get('staking'):
            result['staking_earned_ton']=prize['staking'].get('earned_nano',0)/NANO
        if locked(prize):
            result.pop('sell_ton',None)
        return result
    g['prize_view']=prize_view
    original_visible=g['visible_prizes']
    g['visible_prizes']=lambda user:[p for p in original_visible(user) if p['status'] not in ('staked','deposit_pending')]
    original_state=g['full_state']
    def full_state(user):
        staking=view(user)
        return {**original_state(user),'staking':staking}
    g['full_state']=full_state
    g['staking_view']=view;g['staking_prize_locked']=locked
    original_detail=g['admin_user_detail']
    g['admin_user_detail']=lambda user:{**original_detail(user),'staking':view(user)}

    def receipt(user, body, action):
        key=str(body.get('request_id') or '')
        if not 12<=len(key)<=80:
            raise g['ApiError']('bad_request')
        signature=f"{action}:{body.get('prize_id','')}"
        old=user.get('staking_requests',{}).get(key)
        if old:
            if old['signature']!=signature:
                raise g['ApiError']('request_conflict',409)
            return key,signature,{'staking':view(user),'prizes':g['visible_prizes'](user),'balance_ton':g['ton'](user['balance']),**copy.deepcopy(old['response'])}
        return key,signature,None

    def response(user, key, signature, **extra):
        result={'staking':view(user),'prizes':g['visible_prizes'](user),'balance_ton':g['ton'](user['balance']),**extra}
        user.setdefault('staking_requests',{})[key]={'signature':signature,'response':copy.deepcopy(extra)}
        return result

    def find(user,body):
        return next((p for p in user['prizes'] if p['id']==body.get('prize_id')),None)

    def queue_deposit(user,info,collection,name,amount,portal,event):
        image='/nft-img/'+re.sub(r'[^A-Za-z0-9_-]','',info['slug'])+'.png'
        prize=g['add_prize'](user,f"gift:{collection}:{info.get('model','')}",name,portal,image)
        prize.update(status='deposit_pending',nft_slug=info['slug'],sell_rate=1)
        prize['deposit_choice']={'status':'pending','amount_ton':amount,'portal_ton':portal,'event_key':info['key'],'created':int(time.time()),'rule':'hat110'}
        event.update(status='awaiting_choice',uid=user['id'],prize_id=prize['id'],price_ton=amount,portal_ton=portal,collection=collection)
        origin=urlsplit(g['_bot_app_url']());photo=f'{origin.scheme}://{origin.netloc}{image}' if origin.scheme=='https' and origin.netloc else g['gift_image'](collection,info.get('model',''))
        payload=g['message_payload'](g['bot_editor_config']()['messages'],'hat_deposit_choice',g['_bot_app_url'](),gift=name,extra={'value':f'{amount:g}','prize_id':prize['id']})
        payload['photo']=photo
        g['db'].setdefault('deposit_notifications',{})[f'hat-choice:{user["id"]}:{prize["id"]}']={'uid':user['id'],'payload':payload,'status':'pending','attempts':0,'next':0}
        g['wake_deposit_notifications']()
        return prize

    def choose(user,prize,action):
        if prize:refresh_quote(user,prize)
        choice=(prize or {}).get('deposit_choice',{})
        if action not in ('staking','balance') or not prize or not hat(prize) or not choice:
            raise g['ApiError']('not_stakeable',409,message='В стейкинг можно отправить только шляпу, поступившую при пополнении.')
        if choice.get('status')!='pending':
            if choice.get('status')==action and prize.get('status')==('staked' if action=='staking' else 'sold'):return
            raise g['ApiError']('request_conflict',409,message='Для этой шляпы уже выбран другой вариант.')
        if prize.get('status')!='deposit_pending':raise g['ApiError']('request_conflict',409)
        now=int(time.time());event=g['relayer_doc']()['events'].get(choice['event_key'])
        if action=='staking':
            g['require_section']('staking');base=base_price()
            if base<=0:raise g['ApiError']('price_unavailable',409,message='Цена обычной шляпы на Portals пока недоступна. Попробуйте позже.')
            sync_rates(now);settle(user,now);prize['status']='staked'
            prize['staking']={'started':now,'last':now,'unlock_at':now+LOCK,'base_nano':base,'daily_nano':daily_for(base),'percent_per_day':float(percent()),'remainder':0,'earned_nano':0}
            sync_rates(now)
            if event:event.update(status='staked',decided_at=now,price_ton=prize['value'])
        else:
            amount=choice['amount_ton'];user['balance']=g['ton'](user['balance']+amount);prize['status']='sold'
            try:g['_quest_record_deposit'](g['db'],user,amount=amount,payment_id='nft:'+choice['event_key'])
            except ValueError:pass
            g['credit_referral_bonus'](user,amount);g['relayer_stats_add'](user['id'][2:],amount)
            g['queue_deposit_notice'](user,'gift',amount,'nft:'+choice['event_key'])
            if event:event.update(status='credited',decided_at=now)
        choice.update(status=action,decided_at=now)
        job=g['db'].get('deposit_notifications',{}).get(f'hat-choice:{user["id"]}:{prize["id"]}')
        if job and job.get('status')=='pending':job['status']='cancelled'

    def callback(query):
        match=re.fullmatch(r'hat:(staking|balance):(\d+)',str(query.get('data','')))
        if not match:return {'ok':True}
        sender=str((query.get('from') or {}).get('id',''));message=query.get('message') or {};chat=message.get('chat') or {}
        text='';success=False
        try:
            with g['lock']:
                user=g['db']['users'].get('tg'+sender)
                if not user or user.get('banned') or str(chat.get('id'))!=sender or chat.get('type')!='private':raise g['ApiError']('forbidden',403)
                prize=find(user,{'prize_id':int(match[2])});choose(user,prize,match[1]);g['save_db']()
            try:g['flush_db']()
            except Exception:return g['jsonify']({'ok':False}),503
            success=True;text='Шляпа отправлена в стейкинг.' if match[1]=='staking' else f'На баланс зачислено {prize["deposit_choice"]["amount_ton"]:g} GRAM.'
        except g['ApiError'] as exc:text=exc.extra.get('message') or 'Не удалось выполнить действие.'
        try:
            g['tg_api']('answerCallbackQuery',callback_query_id=query['id'],text=text,show_alert=not success)
            if success:g['tg_api']('editMessageReplyMarkup',chat_id=chat['id'],message_id=message['message_id'],reply_markup={'inline_keyboard':[]})
        except Exception:pass
        return {'ok':True}

    g.update(queue_staking_deposit=queue_deposit,staking_choose_deposit=choose,staking_deposit_callback=callback)

    @g['route']('/api/staking/state')
    def staking_state(user,body):
        return {'staking':view(user)}

    @g['route']('/api/staking/add')
    def staking_add(user,body):
        key,signature,old=receipt(user,body,'add')
        if old is not None:return old
        choose(user,find(user,body),'staking')
        return response(user,key,signature)

    @g['route']('/api/staking/deposit/balance')
    def staking_deposit_balance(user,body):
        key,signature,old=receipt(user,body,'balance')
        if old is not None:return old
        choose(user,find(user,body),'balance')
        return response(user,key,signature)

    @g['route']('/api/staking/remove')
    def staking_remove(user,body):
        key,signature,old=receipt(user,body,'remove')
        if old is not None:return old
        prize=find(user,body);now=int(time.time())
        if not prize or prize.get('status')!='staked':
            raise g['ApiError']('not_found',404)
        if now<prize['staking']['unlock_at']:
            raise g['ApiError']('staking_locked',409,until=prize['staking']['unlock_at'],message='Шляпа заморожена на первые 3 дня.')
        sync_rates(now);settle(user,now)
        prize['status']='owned';prize['staking']['ended_at']=now;prize['staking_lock_until']=now+LOCK
        sync_rates(now)
        return response(user,key,signature)

    @g['route']('/api/staking/withdraw')
    def staking_withdraw(user,body):
        key,signature,old=receipt(user,body,'withdraw')
        if old is not None:return old
        sync_rates();settle(user,int(time.time()))
        amount=(user.get('staking_balance_nano',0)//1000)*1000
        if amount<=0:
            raise g['ApiError']('nothing_to_withdraw',409,message='Пока нет начислений для перевода на баланс.')
        user['staking_balance_nano']-=amount
        user['balance']=g['ton'](user['balance']+amount/NANO)
        user['staking_withdrawn_nano']=int(user.get('staking_withdrawn_nano',0))+amount
        return response(user,key,signature,payout_ton=amount/NANO)

    def number(value,maximum):
        try:
            result=Decimal(str(value))
            if not result.is_finite() or result<0 or result>maximum:raise ValueError()
            return result
        except Exception:
            raise g['ApiError']('bad_request',400,message='Проверьте числовое значение.')

    def admin_key(admin,body,ledger):
        key=str(body.get('request_id') or '')
        if not 12<=len(key)<=80:raise g['ApiError']('bad_request')
        key=str(admin['id'])+':'+key
        signature={k:v for k,v in body.items() if k not in ('request_id','initData')}
        if key in ledger and ledger[key]!=signature:raise g['ApiError']('request_conflict',409)
        return key,signature,key in ledger

    def audit(admin,target,kind,details):
        rows=g['db'].setdefault('staking_admin_audit',[])
        rows.append({'at':int(time.time()),'admin':admin['id'],'uid':target,'kind':kind,**details})
        del rows[:-500]

    @g['route']('/api/admin/staking')
    def admin_staking(admin,body):
        g['require_admin'](admin)
        query=str(body.get('query') or '').strip().casefold()
        offset=max(0,int(number(body.get('offset',0),1_000_000)))
        rows=[];totals={'participants':0,'hats':0,'balance_ton':0,'daily_ton':0}
        for user in g['db']['users'].values():
            if not any(p.get('status')=='staked' for p in user.get('prizes',[])) and not user.get('staking_balance_nano'):continue
            data=view(user);totals['participants']+=1;totals['hats']+=len(data['positions']);totals['balance_ton']+=data['balance_ton'];totals['daily_ton']+=data['daily_ton']
            name=g['display_name']({**user,'anon':False})
            if query and query not in (' '.join([str(user['id']),user['key'],name,str(user.get('username',''))])).casefold():continue
            rows.append({'key':user['key'],'id':user['id'],'name':name,'balance_ton':data['balance_ton'],'daily_ton':data['daily_ton'],'count':len(data['positions']),'positions':data['positions'][:20]})
        rows.sort(key=lambda row:(-row['count'],row['key']))
        return {'percent_per_day':float(percent()),'base_percent_per_day':float(rate_settings()['percent_per_day']),'above_percent_per_day':float(rate_settings()['above_percent_per_day']),'rate_threshold':100,'totals':totals,'rows':rows[offset:offset+25],'count':len(rows),'offset':offset,'next_offset':offset+25 if offset+25<len(rows) else None,'audit':list(reversed(g['db'].get('staking_admin_audit',[])[-30:]))}

    @g['route']('/api/admin/staking/settings')
    def admin_staking_settings(admin,body):
        g['require_admin'](admin);value=number(body.get('percent_per_day'),100)
        above=number(body.get('above_percent_per_day',.5),100)
        ledger=g['db'].setdefault('staking_setting_requests',{});key,signature,old=admin_key(admin,body,ledger)
        if not old:
            sync_rates();settings=rate_settings();settings.update(percent_per_day=float(value),above_percent_per_day=float(above))
            sync_rates()
            audit(admin,'','settings',{'percent_per_day':float(value),'above_percent_per_day':float(above),'threshold':100,'active_changed':active_count()})
            ledger[key]=signature
        return {'ok':True,'percent_per_day':float(percent())}

    @g['route']('/api/admin/staking/user')
    def admin_staking_user(admin,body):
        g['require_admin'](admin);target=g['find_user'](body.get('key'))
        ledger=target.setdefault('staking_admin_requests',{});key,signature,old=admin_key(admin,body,ledger)
        if old:return {'user':g['admin_user_detail'](target)}
        now=int(time.time());settle(target,now)
        if body.get('action')=='balance':
            amount=number(body.get('amount'),1_000_000_000)
            units=int((amount*NANO).to_integral_value(rounding=ROUND_DOWN));before=target.get('staking_balance_nano',0)
            if body.get('mode')=='add':target['staking_balance_nano']=before+units
            elif body.get('mode')=='set':target['staking_balance_nano']=units
            else:raise g['ApiError']('bad_request')
            audit(admin,target['id'],'balance',{'before_nano':before,'after_nano':target['staking_balance_nano']})
        elif body.get('action')=='unlock':
            hours=number(body.get('hours'),87600)
            prize=find(target,body)
            if not prize or prize.get('status')!='staked':raise g['ApiError']('not_found',404)
            before=prize['staking']['unlock_at'];prize['staking']['unlock_at']=now+int(hours*3600)
            audit(admin,target['id'],'unlock',{'prize_id':prize['id'],'before':before,'after':prize['staking']['unlock_at']})
        else:raise g['ApiError']('bad_request')
        ledger[key]=signature
        return {'user':g['admin_user_detail'](target)}
