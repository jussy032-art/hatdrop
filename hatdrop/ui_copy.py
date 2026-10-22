import copy,json,re
from pathlib import Path

DEFAULTS=json.loads((Path(__file__).parent/'static/ui-copy-defaults.json').read_text(encoding='utf-8'))
VARIABLE=re.compile(r'\{(\w+)\}')

def install(g):
    original=g['full_state']
    def full_state(user):
        result=original(user);result['config']['ui_texts']=copy.deepcopy(g['db']['settings'].get('ui_texts',{}));return result
    g['full_state']=full_state

    @g['route']('/api/admin/copy')
    def admin_copy(user,body):
        g['require_admin'](user);saved=g['db']['settings'].get('ui_texts',{});query=str(body.get('query') or '').strip().casefold()
        keys=set(DEFAULTS)|set(saved);rows=[]
        for key in sorted(keys):
            defaults=DEFAULTS.get(key,{'ru':key,'en':key,'zh':key});texts={**defaults,**saved.get(key,{})}
            if query and query not in (' '.join([key,*texts.values()])).casefold():continue
            rows.append({'key':key,'texts':texts,'changed':key in saved,'defaults':defaults})
        try:offset=max(0,min(100000,int(body.get('offset',0))))
        except (ValueError,TypeError):raise g['ApiError']('bad_request')
        return {'rows':rows[offset:offset+30],'count':len(rows),'next_offset':offset+30 if len(rows)>offset+30 else None}

    @g['route']('/api/admin/copy/save')
    def admin_copy_save(user,body):
        g['require_admin'](user);key=body.get('key')
        if not isinstance(key,str) or not 1<=len(key)<=4000:raise g['ApiError']('bad_request')
        saved=g['db']['settings'].setdefault('ui_texts',{})
        if body.get('reset') is True:saved.pop(key,None)
        else:
            values=body.get('texts')
            if not isinstance(values,dict):raise g['ApiError']('bad_request')
            clean={}
            for language in ('ru','en','zh'):
                value=values.get(language)
                if not isinstance(value,str) or not value.strip() or len(value)>6000 or re.search(r'<[/!]?[A-Za-z]',value):raise g['ApiError']('bad_request',message='Введите текст без HTML для каждого языка.')
                if set(VARIABLE.findall(value))!=set(VARIABLE.findall(key)):raise g['ApiError']('bad_request',message='Сохраните все переменные в фигурных скобках.')
                clean[language]=value
            saved[key]=clean
        return {'ok':True,'ui_texts':copy.deepcopy(saved)}
