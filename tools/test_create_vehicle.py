import requests
r = requests.post('http://127.0.0.1:5001/admin/create_vehicle', data={'current_password':'testpass123!','id':'test-create','title':'Test Car','price':'GH₵1,234','year':'2020'})
print(r.status_code)
print(r.text)
