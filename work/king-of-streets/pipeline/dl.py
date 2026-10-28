import sys,json,os,urllib.request,time
tok=os.environ['SF_TOKEN']
uid,name=sys.argv[1],sys.argv[2]
r=urllib.request.Request(f'https://sketchfab.com/v3/models/{uid}/download',headers={'Authorization':'Token '+tok})
d=json.load(urllib.request.urlopen(r))
print({k:(v.get('size') if isinstance(v,dict) else v) for k,v in d.items()})
fmt='gltf' if 'gltf' in d else 'source'
url=d[fmt]['url']
os.makedirs(f'src/{name}',exist_ok=True)
urllib.request.urlretrieve(url,f'src/{name}/{name}.zip')
m=json.load(urllib.request.urlopen(urllib.request.Request(f'https://sketchfab.com/v3/models/{uid}',headers={'Authorization':'Token '+tok})))
json.dump({'uid':uid,'name':m['name'],'author':m['user']['displayName'],'username':m['user']['username'],'license':m['license']['label'],'licenseUrl':m['license'].get('url'),'url':m['viewerUrl'],'faces':m['faceCount']},open(f'src/{name}/meta.json','w'),indent=1)
