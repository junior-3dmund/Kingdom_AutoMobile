import requests
try:
    r = requests.post('http://127.0.0.1:5001/admin/upload', data={'id':'test-no-files'})
    print(r.status_code)
    print(r.text)
except Exception as e:
    print('err', e)
