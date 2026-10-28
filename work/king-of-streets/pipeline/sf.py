import sys,json,subprocess,os,urllib.parse,urllib.request
tok=os.environ['SF_TOKEN']
def search(q,lic=None,count=24,extra=None):
    p={'type':'models','downloadable':'true','count':count,'q':q,'sort_by':'-likeCount'}
    if lic: p['license']=lic
    if extra: p.update(extra)
    r=urllib.request.Request('https://sketchfab.com/v3/search?'+urllib.parse.urlencode(p),headers={'Authorization':'Token '+tok})
    return json.load(urllib.request.urlopen(r))['results']
if __name__=='__main__':
    q=sys.argv[1]
    for lic in ['by','cc0']:
        try:
            for m in search(q,lic):
                print(m['uid'],'|',m['name'][:45],'|',(m['license'] or {}).get('label','-'),'|',m['faceCount'],'|',m['likeCount'],'|',m['user']['username'])
        except Exception as e: print('err',e)
