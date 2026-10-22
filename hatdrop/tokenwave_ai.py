
import base64
import copy
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

ORIGIN = 'https://tokenwave.ru'


class SameOriginRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = urllib.parse.urlparse(newurl)
        if target.scheme != 'https' or target.netloc != 'tokenwave.ru':
            raise ValueError('Unexpected provider redirect')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def install(g):
    secret_lock = threading.RLock()
    model_lock = threading.Lock()
    model_cache = {'at': 0, 'data': None}
    opener = urllib.request.build_opener(SameOriginRedirect())

    def secret_path():
        return Path(os.environ.get('TOKENWAVE_KEY_PATH') or (str(Path(g['SQLITE_PATH']).absolute().parent / 'tokenwave-private.json')))

    def read_key():
        with secret_lock:
            try: return json.loads(secret_path().read_text(encoding='utf-8')).get('key', '')
            except FileNotFoundError: return ''

    def write_key(key):
        with secret_lock:
            path = secret_path(); path.parent.mkdir(parents=True, exist_ok=True)
            if not key:
                path.unlink(missing_ok=True)
                return
            temporary = path.with_name(path.name+'.'+secrets.token_hex(6))
            try:
                with os.fdopen(os.open(temporary, os.O_WRONLY|os.O_CREAT|os.O_EXCL, 0o600), 'w', encoding='utf-8') as file:
                    json.dump({'key': key}, file); file.flush(); os.fsync(file.fileno())
                os.replace(temporary, path); os.chmod(path, 0o600)
            finally: temporary.unlink(missing_ok=True)

    def doc():
        value = g['db'].setdefault('ai', {})
        value.setdefault('jobs', {}); value.setdefault('conversations', {})
        return value

    def api_error(code, message, status=400):
        return g['ApiError'](code, status, message=message)

    def provider(path, payload=None, key='', timeout=25, limit=4_000_000):
        headers = {'Accept':'application/json', 'User-Agent':'HatDrop-Admin/1.0'}
        if payload is not None: headers['Content-Type']='application/json'
        if key: headers['Authorization']='Bearer '+key
        request = urllib.request.Request(ORIGIN+path, data=json.dumps(payload).encode() if payload is not None else None, headers=headers)
        try:
            with g['ai_http_open'](request, timeout=timeout) as response:
                raw = response.read(limit+1)
                if len(raw)>limit: raise api_error('ai_response_too_large','Ответ сервиса слишком большой.')
                result = json.loads(raw)
                if not isinstance(result, dict) or result.get('error'):
                    raise api_error('ai_provider_error','TokenWave не выполнил запрос. Проверьте ключ и баланс.')
                return result
        except g['ApiError']: raise
        except urllib.error.HTTPError as exc:
            messages={401:'TokenWave отклонил ключ.',402:'На ключе TokenWave недостаточно токенов.',403:'TokenWave ограничил доступ. Проверьте ключ в кабинете сервиса.',429:'Лимит запросов TokenWave. Повторите позже.'}
            raise api_error('ai_provider_error',messages.get(exc.code,'TokenWave вернул ошибку. Проверьте историю списаний перед повторной генерацией.'),502) from None
        except Exception:
            raise api_error('ai_unavailable','Ответ TokenWave не получен. Перед повторной генерацией проверьте историю списаний.',502) from None

    def models(force=False):
        with model_lock:
            if not force and model_cache['data'] and time.time()-model_cache['at']<900: return copy.deepcopy(model_cache['data'])
            raw = provider('/data/models.json')
            text=[]; images=[]
            for family in raw.get('providers', []):
                for model in family.get('models', []):
                    if isinstance(model.get('id'), str): text.append({'id':model['id'],'name':model.get('name',model['id']),'ratio':model.get('ratio'),'provider':family.get('name','')})
            for model in raw.get('images', []):
                if isinstance(model.get('id'),str): images.append({'id':model['id'],'name':model.get('name',model['id']),'tiers':model.get('tiers',{})})
            if not text: raise api_error('ai_catalog_unavailable','Каталог моделей TokenWave временно недоступен.',502)
            result={'text':text,'images':images,'updated':int(time.time())}
            model_cache.update(at=time.time(),data=result)
            return copy.deepcopy(result)

    def status():
        key=read_key()
        return {'configured':bool(key),'key_tail':key[-4:] if key else ''}

    def stats(key):
        result=provider('/api/stats',{'key':key})
        if result.get('ok') is not True:
            raise api_error('ai_stats_unavailable','Не удалось получить статистику TokenWave. Проверьте ключ в кабинете сервиса.',502)

        def number(value):
            if isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value): return value
            return None
        def label(value): return str(value or '').replace(key,'[скрыто]')[:160]
        clean={'remaining':number(result.get('remaining')),'used':number(result.get('used')),'unlimited':result.get('unlimited') is True,'active':result.get('active') is True}
        clean['totals']={k:number(result.get('totals',{}).get(k)) for k in ('requests','tokens_in','tokens_out','spent')}
        clean['recent']=[{'model':label(row.get('model')),**{k:number(row.get(k)) for k in ('at','in','out','spent','secs')}} for row in result.get('recent',[])[:200] if isinstance(row,dict)]
        clean['by_model']=[{'model':label(row.get('model')),**{k:number(row.get(k)) for k in ('requests','tokens','ratio','spent')}} for row in result.get('by_model',[])[:200] if isinstance(row,dict)]
        clean['daily']=[{'date':label(row.get('date')),'spent':number(row.get('spent'))} for row in result.get('daily',[])[:90] if isinstance(row,dict)]
        return clean

    def owner():
        with g['lock']:
            user,_=g['current_user']();g['require_admin'](user);return user['id']

    def job_view(job):
        return {k:copy.deepcopy(job[k]) for k in ('id','conversation_id','mode','model','status','created','finished','prompt','result','error','usage','request_id') if k in job}

    def summaries(uid):
        conversations=[v for v in doc()['conversations'].values() if v['uid']==uid]
        conversations.sort(key=lambda v:v.get('updated',v['created']),reverse=True)
        jobs=[j for j in doc()['jobs'].values() if j['uid']==uid]
        jobs.sort(key=lambda j:j['created'],reverse=True)
        return {'conversations':[{k:c[k] for k in ('id','title','created','updated')} for c in conversations[:30]],'jobs':[job_view(j) for j in jobs[:30]]}

    @g['route']('/api/admin/ai/status')
    def ai_status(user,body):
        g['require_admin'](user)
        return {**status(),**summaries(user['id'])}

    @g['route']('/api/admin/ai/key')
    def ai_key(user,body):
        g['require_admin'](user)
        if any(j['status'] in ('queued','running') for j in doc()['jobs'].values()):
            raise api_error('ai_busy','Дождитесь завершения текущей генерации.',409)
        key='' if body.get('clear') is True else str(body.get('key') or '').strip()
        if not body.get('clear') and (not 8<=len(key)<=512 or any(not 33<=ord(c)<=126 for c in key)):
            raise api_error('bad_key','Вставьте ключ TokenWave целиком, без пробелов.')
        write_key(key);doc().pop('stats',None)
        return status()

    @g['admin_io']('/api/admin/ai/models')
    def ai_models(body):
        return models()

    @g['admin_io']('/api/admin/ai/dashboard')
    def ai_dashboard(body):
        uid=owner();key=read_key()
        if not key: return {**status(),'stats':None}
        data=stats(key)
        with g['lock']:
            doc()['stats']={'at':int(time.time()),'data':data}
            return {**status(),'stats':data,**summaries(uid)}

    @g['route']('/api/admin/ai/conversation')
    def ai_conversation(user,body):
        g['require_admin'](user)
        conversation=doc()['conversations'].get(str(body.get('id') or ''))
        if not conversation or conversation['uid']!=user['id']: raise g['ApiError']('not_found',404)
        return {'conversation':copy.deepcopy(conversation)}

    @g['route']('/api/admin/ai/job')
    def ai_job(user,body):
        g['require_admin'](user)
        job=doc()['jobs'].get(str(body.get('id') or ''))
        if not job or job['uid']!=user['id']: raise g['ApiError']('not_found',404)
        return {'job':job_view(job)}

    def store_image(encoded):
        from PIL import Image
        if not isinstance(encoded,str) or len(encoded)>40_000_000: raise api_error('ai_bad_image','Сервис вернул слишком большое изображение.')
        try:
            raw=base64.b64decode(encoded,validate=True)
            with Image.open(io.BytesIO(raw)) as picture:
                width,height=picture.size;fmt=picture.format
                if fmt not in ('PNG','JPEG','WEBP') or width*height>20_000_000 or min(width,height)<16: raise ValueError()
                picture.verify()
        except Exception: raise api_error('ai_bad_image','TokenWave вернул некорректное изображение.') from None
        ext={'PNG':'png','JPEG':'jpg','WEBP':'webp'}[fmt]
        folder=Path(g['MEDIA_DIR']);folder.mkdir(parents=True,exist_ok=True)
        name=hashlib.sha256(raw).hexdigest()+'.'+ext;path=folder/name
        if not path.exists():
            temporary=folder/(name+'.'+secrets.token_hex(6)+'.tmp')
            try: temporary.write_bytes(raw);os.replace(temporary,path)
            finally: temporary.unlink(missing_ok=True)
        return '/media/'+name

    def run_job(job_id,key,request_payload):
        with g['lock']:
            job=doc()['jobs'].get(job_id)
            if not job or job['status']!='queued': return
            job['status']='running';g['save_db']()
        try:
            g['flush_db']()
            if job['mode']=='image':
                answer=provider('/v1/images/generations',request_payload,key,timeout=180,limit=45_000_000)
                encoded=(answer.get('data') or [{}])[0].get('b64_json')
                image=store_image(encoded)
                result={'content':'Изображение готово.','image':image}
            else:
                answer=provider('/v1/chat/completions',request_payload,key,timeout=120)
                content=(answer.get('choices') or [{}])[0].get('message',{}).get('content')
                if isinstance(content,list): content='\n'.join(str(block.get('text','')) for block in content if isinstance(block,dict))
                if not isinstance(content,str) or not content.strip(): raise api_error('ai_empty_reply','Модель вернула пустой ответ. Проверьте историю списаний перед повторным запросом.')
                result={'content':content[:150000]}
            with g['lock']:
                raw_usage=answer.get('usage') if isinstance(answer.get('usage'),dict) else {}
                usage={k:v for k,v in raw_usage.items() if k in ('prompt_tokens','completion_tokens','total_tokens','input_tokens','output_tokens') and isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) and v>=0}
                job=doc()['jobs'][job_id];job.update(status='done',finished=int(time.time()),result=result,usage=usage)
                conversation=doc()['conversations'][job['conversation_id']]
                conversation['messages'].append({'role':'assistant','content':result['content'],'image':result.get('image',''),'model':job['model'],'job_id':job_id,'usage':job['usage']})
                conversation['messages']=conversation['messages'][-80:];conversation['updated']=int(time.time());g['save_db']()
        except Exception as exc:
            message=exc.extra.get('message') if isinstance(exc,g['ApiError']) and hasattr(exc,'extra') else ''

            with g['lock']:
                job=doc()['jobs'].get(job_id)
                if job: job.update(status='error',finished=int(time.time()),error=message or 'Генерация не завершилась. Проверьте историю списаний перед повторным запросом.')
                g['save_db']()
        try:g['flush_db']()
        except Exception:g['app'].logger.error('AI result persistence failed')

    def generate(uid,body):
        key=read_key()
        if not key:raise api_error('ai_key_missing','Сначала сохраните ключ TokenWave.')
        mode=str(body.get('mode') or 'chat');model=str(body.get('model') or '');prompt=str(body.get('prompt') or '').strip();rid=str(body.get('request_id') or '')
        if mode not in ('chat','post','image') or not 1<=len(prompt)<=12000 or not re.fullmatch(r'[a-zA-Z0-9_-]{12,80}',rid): raise api_error('bad_request','Проверьте текст запроса и модель.')
        catalog=models();selected=next((m for m in catalog['images' if mode=='image' else 'text'] if m['id']==model),None)
        if not selected:raise api_error('ai_model_invalid','Выберите модель из актуального каталога TokenWave.')
        quality=str(body.get('quality') or next(iter(selected.get('tiers',{})),'auto'))
        if mode=='image' and quality not in selected.get('tiers',{}):raise api_error('ai_quality_invalid','Выберите доступное качество изображения.')
        original_cid=str(body.get('conversation_id') or '')
        fingerprint=hashlib.sha256(json.dumps([mode,model,prompt,original_cid,quality],ensure_ascii=False).encode()).hexdigest()
        with g['lock']:
            existing=next((j for j in doc()['jobs'].values() if j['uid']==uid and j['request_id']==rid),None)
            if existing:
                if existing['fingerprint']!=fingerprint:raise api_error('request_conflict','Этот запрос уже использован.',409)
                return {'job':job_view(existing)}
            active=[j for j in doc()['jobs'].values() if j['status'] in ('queued','running')]
            if len(active)>=2:raise api_error('ai_busy','Две генерации уже выполняются. Дождитесь завершения.',409)
            conversation=doc()['conversations'].get(original_cid) if original_cid else None
            if original_cid and (not conversation or conversation['uid']!=uid):raise g['ApiError']('not_found',404)
            if conversation and any(j['conversation_id']==original_cid for j in active):raise api_error('ai_busy','Дождитесь ответа в этом чате.',409)
            now=int(time.time())
            if not conversation:
                cid=secrets.token_hex(12);conversation={'id':cid,'uid':uid,'title':prompt[:64],'created':now,'updated':now,'messages':[]};doc()['conversations'][cid]=conversation
            cid=conversation['id'];job_id=secrets.token_hex(12)
            context=[];budget=48000
            for message in reversed(conversation['messages'][-12:]):
                text=message.get('content')
                if not isinstance(text,str):continue
                text=text[-budget:]
                context.insert(0,{'role':message['role'],'content':text});budget-=len(text)
                if budget<=0:break
            conversation['messages'].append({'role':'user','content':prompt,'job_id':job_id});conversation['updated']=now
            system='Вы — AI-ассистент администратора игры. Отвечайте на русском языке. Не заявляйте, что изменили игру или отправили сообщения: вы только готовите текст.'
            if mode=='post':system+=' Подготовьте готовый к публикации пост по запросу пользователя. Не добавляйте служебные вступления.'
            payload={'model':model,'prompt':prompt,'quality':quality,'n':1,'size':'1024x1024','response_format':'b64_json'} if mode=='image' else {'model':model,'messages':[{'role':'system','content':system}]+context+[{'role':'user','content':prompt}],'stream':False,'max_tokens':4096}
            job={'id':job_id,'uid':uid,'conversation_id':cid,'request_id':rid,'fingerprint':fingerprint,'mode':mode,'model':model,'prompt':prompt,'status':'queued','created':now}
            doc()['jobs'][job_id]=job;g['save_db']()
        try:g['flush_db']()
        except Exception:
            with g['lock']:job.update(status='error',error='Запрос не сохранён. Генерация не запускалась.');g['save_db']()
            raise api_error('ai_storage_failed','Не удалось сохранить запрос. Генерация не запускалась.',503)
        threading.Thread(target=run_job,args=(job_id,key,payload),daemon=True).start()
        with g['lock']:return {'job':job_view(job)}

    @g['admin_io']('/api/admin/ai/generate')
    def ai_generate(body):
        return generate(owner(),body)

    def recover():
        changed=False
        for job in doc()['jobs'].values():
            if job['status'] in ('queued','running'):
                job.update(status='interrupted',error='Сервер перезапускался во время генерации. Проверьте историю списаний TokenWave перед повторным запросом.')
                changed=True
        return changed

    g.update(ai_recover_jobs=recover,ai_provider_request=provider,ai_model_catalog=models,ai_run_job=run_job,
             ai_http_open=opener.open,ai_clear_model_cache=lambda:model_cache.update(at=0,data=None))
