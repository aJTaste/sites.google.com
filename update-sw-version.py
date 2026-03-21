import time,re
v='apphub-'+str(int(time.time()))
with open('public/sw.js','r') as f:
    c=f.read()
c=re.sub(r"const CACHE='apphub-[^']+';",f"const CACHE='{v}';",c)
with open('public/sw.js','w') as f:
    f.write(c)
print(f"Cache version: {v}")
