import requests
print('posting simple form to upload')
r = requests.post('http://127.0.0.1:5001/admin/upload', data={'id':'simple-test'})
print(r.status_code)
print(r.text)
