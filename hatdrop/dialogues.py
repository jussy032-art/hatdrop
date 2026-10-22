
SECTIONS = {'welcome':'Знакомство','shop':'Магазин','achievements':'Достижения','quests':'Квесты'}
POSES = {'wave':'Приветствие','shop':'У прилавка','cheer':'Радость','point':'Указывает рукой'}
DEFAULTS = {
    'welcome':{'pose':'wave','text':'Здарова! Я Костян, хозяин этой лавки. Давай коротко покажу, что тут есть.'},
    'shop':{'pose':'shop','text':'Магазин. Тут я меняю товары на HatCoin и TON: оружие, подарки, NFT. Некоторых ордеров мало, так что не зевай.'},
    'achievements':{'pose':'cheer','text':'Достижения. Выполняй условия и забирай награды. Обычные остаются навсегда, а ивентовые — до завершения ивента.'},
    'quests':{'pose':'point','text':'Квесты. Задания со сроком: успей выполнить до конца таймера и забирай награду.'},
}

def view(db):
    saved=db.get('settings',{}).get('kostyan_dialogues',{})
    return {key:{**value,**(saved.get(key,{}) if isinstance(saved,dict) and isinstance(saved.get(key),dict) else {})} for key,value in DEFAULTS.items()}

def update(db,data):
    action=data.get('action','view')
    if action=='reset':db['settings'].pop('kostyan_dialogues',None)
    elif action=='save':
        submitted=data.get('dialogues')
        if not isinstance(submitted,dict) or any(key not in SECTIONS for key in submitted):raise ValueError('dialogues')
        clean=view(db)
        for key,value in submitted.items():
            if not isinstance(value,dict):raise ValueError('dialogues')
            text=value.get('text');pose=value.get('pose')
            if not isinstance(text,str) or not 1<=len(text.strip())<=600:raise ValueError('text')
            if pose not in POSES:raise ValueError('pose')
            clean[key]={'text':text.strip(),'pose':pose}
        db['settings']['kostyan_dialogues']=clean
    elif action!='view':raise ValueError('action')
    return {'dialogues':view(db),'sections':[{'id':key,'label':label} for key,label in SECTIONS.items()],
            'poses':[{'id':key,'label':label} for key,label in POSES.items()]}
