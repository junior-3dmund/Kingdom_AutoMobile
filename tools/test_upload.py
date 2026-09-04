import io, json, os, urllib.request
from PIL import Image

# create a small test image
os.makedirs('images/test-upload', exist_ok=True)
img_path = os.path.join('images','test-upload','1.png')
img = Image.new('RGB', (100,100), (200,50,50))
img.save(img_path)

url = 'http://127.0.0.1:5001/admin/upload'
boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
from urllib import request as req

def post_file(path, vid):
    with open(path,'rb') as f:
        data = f.read()
    import requests
    r = requests.post(url, data={'id': vid}, files={'files': open(path,'rb')})
    print(r.status_code, r.text)

if __name__ == '__main__':
    try:
        post_file(img_path, 'test-upload')
    except Exception as e:
        print('upload failed', e)
