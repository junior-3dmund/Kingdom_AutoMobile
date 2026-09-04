import json, urllib.request
url = 'http://127.0.0.1:5001/admin/rotate'
payload = {'current_password':'Kingdom@Auto26','new_username':'admin2','new_password':'NewPass123'}
data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type':'application/json'})
res = urllib.request.urlopen(req)
print(res.read().decode('utf-8'))
