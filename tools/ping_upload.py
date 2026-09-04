import requests
try:
    r = requests.get('http://127.0.0.1:5001/admin/upload')
    print(r.status_code)
    print(r.text[:800])
except Exception as e:
    print('error', e)
