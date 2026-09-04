import os, requests
repo_root = os.path.dirname(os.path.dirname(__file__))
d = os.path.join(repo_root, 'images', 'test-create')
if not os.path.isdir(d):
    raise SystemExit('Directory not found: ' + d)
files = []
opens = []
for fn in sorted(os.listdir(d)):
    if fn.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif')):
        p = os.path.join(d, fn)
        f = open(p, 'rb')
        opens.append(f)
        # guess mime
        mime = 'image/jpeg' if fn.lower().endswith(('.jpg','.jpeg')) else 'image/png'
        files.append(('files', (fn, f, mime)))
if not files:
    print('No image files found in', d)
else:
    data = {'current_password':'testpass123!','id':'test-create','title':'Test Car (uploaded)','price':'GH₵1,234','year':'2020'}
    try:
        r = requests.post('http://127.0.0.1:5001/admin/create_vehicle', data=data, files=files)
        print(r.status_code)
        print(r.text)
    except Exception as e:
        print('Upload error', e)
    finally:
        for f in opens:
            try:
                f.close()
            except:
                pass
