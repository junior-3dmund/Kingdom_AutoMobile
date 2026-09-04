import os
try:
    from PIL import Image, ImageDraw, ImageFont
except Exception:
    raise SystemExit('Pillow is required to run this script')
import requests

repo_root = os.path.dirname(os.path.dirname(__file__))
img_dir = os.path.join(repo_root, 'images', 'test-create')
os.makedirs(img_dir, exist_ok=True)

files_to_send = []
for i in range(2):
    path = os.path.join(img_dir, f'{i+1}.jpg')
    im = Image.new('RGB', (1200, 800), (220, 200 + i*10, 200 + (1-i)*10))
    d = ImageDraw.Draw(im)
    text = f'Test Image {i+1}'
    try:
        fnt = ImageFont.load_default()
    except Exception:
        fnt = None
    d.text((60, 60), text, fill=(10, 10, 10), font=fnt)
    im.save(path, 'JPEG', quality=85)
    files_to_send.append(path)

# prepare multipart upload
files = []
opens = []
try:
    for p in files_to_send:
        f = open(p, 'rb')
        opens.append(f)
        files.append(('files', (os.path.basename(p), f, 'image/jpeg')))

    data = {
        'current_password': 'testpass123!',
        'id': 'test-create',
        'title': 'Test Car (with images)',
        'price': 'GH₵1,234',
        'year': '2020'
    }
    r = requests.post('http://127.0.0.1:5001/admin/create_vehicle', data=data, files=files)
    print(r.status_code)
    print(r.text)
finally:
    for f in opens:
        try:
            f.close()
        except:
            pass
