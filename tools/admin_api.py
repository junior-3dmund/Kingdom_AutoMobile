#!/usr/bin/env python3
from flask import Flask, request, jsonify
import os, json, hashlib, binascii
from werkzeug.utils import secure_filename
try:
    from PIL import Image
    PIL_AVAILABLE = True
except Exception:
    PIL_AVAILABLE = False

app = Flask(__name__)

CREDS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'admin', 'creds.json')
IMAGES_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'images')

ALLOWED_EXT = set(['png','jpg','jpeg','gif','webp'])

def allowed_filename(filename):
    return '.' in filename and filename.rsplit('.',1)[1].lower() in ALLOWED_EXT

def verify_password(password, creds):
    if not creds:
        return False
    if 'hash' in creds and 'salt' in creds:
        salt = binascii.unhexlify(creds['salt'])
        iters = int(creds.get('iterations', 100000))
        dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iters, dklen=32)
        return binascii.hexlify(dk).decode('ascii') == creds['hash']
    # fallback plaintext
    return creds.get('password') == password

def write_creds(username, password, iterations=100000):
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations, dklen=32)
    data = {
        'username': username,
        'salt': binascii.hexlify(salt).decode('ascii'),
        'hash': binascii.hexlify(dk).decode('ascii'),
        'iterations': iterations
    }
    os.makedirs(os.path.dirname(CREDS_PATH), exist_ok=True)
    with open(CREDS_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    return data

@app.route('/admin/rotate', methods=['POST', 'OPTIONS'])
def rotate():
    # simple CORS support for local dev
    if request.method == 'OPTIONS':
        resp = jsonify({'ok': True})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp

    body = request.get_json() or {}
    current = body.get('current_password')
    new_user = body.get('new_username')
    new_pass = body.get('new_password')
    if not (current and new_user and new_pass):
        resp = jsonify({'error': 'current_password, new_username and new_password required'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400

    # load existing creds
    if os.path.exists(CREDS_PATH):
        with open(CREDS_PATH, 'r', encoding='utf-8') as f:
            creds = json.load(f)
    else:
        creds = None

    if not verify_password(current, creds):
        resp = jsonify({'error':'current password invalid'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 403

    new = write_creds(new_user, new_pass)
    resp = jsonify({'ok': True, 'creds': {'username': new['username']}})
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


@app.route('/admin/upload', methods=['POST', 'OPTIONS'])
def upload():
    if request.method == 'OPTIONS':
        resp = jsonify({'ok': True})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp

    vehicle_id = request.form.get('id')
    if not vehicle_id:
        resp = jsonify({'error':'id field required'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400

    files = request.files.getlist('files') or []
    saved = []
    os.makedirs(IMAGES_ROOT, exist_ok=True)
    target_dir = os.path.join(IMAGES_ROOT, vehicle_id)
    os.makedirs(target_dir, exist_ok=True)

    for f in files:
        filename = secure_filename(f.filename)
        if not filename:
            continue
        if not allowed_filename(filename):
            # save but skip thumbnail
            out_path = os.path.join(target_dir, filename)
            f.save(out_path)
            saved.append(os.path.relpath(out_path, os.path.dirname(os.path.dirname(__file__))).replace('\\','/'))
            continue
        out_path = os.path.join(target_dir, filename)
        f.save(out_path)
        saved.append(os.path.relpath(out_path, os.path.dirname(os.path.dirname(__file__))).replace('\\','/'))
        # generate thumbnail
        if PIL_AVAILABLE:
            try:
                img = Image.open(out_path)
                img.thumbnail((800,600))
                thumb_path = os.path.join(target_dir, 'thumb.jpg')
                img.convert('RGB').save(thumb_path, 'JPEG', quality=85)
            except Exception as e:
                # ignore thumbnail errors
                pass

    resp = jsonify({'ok': True, 'files': saved})
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


# aliases to be tolerant of trailing slashes or alternate paths
@app.route('/admin/upload/', methods=['POST', 'OPTIONS', 'GET'])
@app.route('/upload', methods=['POST', 'OPTIONS', 'GET'])
def upload_alias():
    return upload()


@app.route('/admin/create_vehicle', methods=['POST', 'OPTIONS'])
def create_vehicle():
    if request.method == 'OPTIONS':
        resp = jsonify({'ok': True})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp

    # authenticate using current password in form
    current = request.form.get('current_password') or (request.json and request.json.get('current_password'))
    if not current:
        resp = jsonify({'error':'current_password required'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400

    # load existing creds
    if os.path.exists(CREDS_PATH):
        with open(CREDS_PATH, 'r', encoding='utf-8') as f:
            creds = json.load(f)
    else:
        creds = None
    if not verify_password(current, creds):
        resp = jsonify({'error':'current password invalid'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 403

    # gather metadata
    vid = request.form.get('id')
    title = request.form.get('title') or request.form.get('name')
    price = request.form.get('price','')
    year = request.form.get('year','')
    transmission = request.form.get('transmission','')
    fuel = request.form.get('fuel','')
    mileage = request.form.get('mileage','')
    vin = request.form.get('vin','')
    condition = request.form.get('condition','')
    history = request.form.get('history','')
    location = request.form.get('location','Tamale')

    if not vid or not title:
        resp = jsonify({'error':'id and title required'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400

    # save files similar to upload
    files = request.files.getlist('files') or []
    saved = []
    target_dir = os.path.join(IMAGES_ROOT, vid)
    os.makedirs(target_dir, exist_ok=True)
    for f in files:
        filename = secure_filename(f.filename)
        if not filename:
            continue
        out_path = os.path.join(target_dir, filename)
        f.save(out_path)
        saved.append(os.path.relpath(out_path, os.path.dirname(os.path.dirname(__file__))).replace('\\','/'))
        if PIL_AVAILABLE and allowed_filename(filename):
            try:
                img = Image.open(out_path)
                img.thumbnail((800,600))
                thumb_path = os.path.join(target_dir, 'thumb.jpg')
                img.convert('RGB').save(thumb_path, 'JPEG', quality=85)
            except Exception:
                pass

    # Build images argument for generator: use saved paths or existing images in folder
    images_arg = ''
    if saved:
        images_arg = ','.join(saved)
    else:
        # try to use any files already in folder
        existing = [os.path.join('images', vid, fn).replace('\\','/') for fn in os.listdir(target_dir) if allowed_filename(fn)]
        images_arg = ','.join(existing)

    # invoke generator script to create vehicle page and update stock/index
    import subprocess, sys
    repo_root = os.path.dirname(os.path.dirname(__file__))
    gen = os.path.join(repo_root, 'tools', 'generate_vehicle.py')
    cmd = [sys.executable, gen, '--id', vid, '--title', title, '--price', price or '', '--year', str(year or ''), '--transmission', transmission, '--fuel', fuel, '--mileage', mileage, '--vin', vin, '--condition', condition, '--history', history, '--location', location, '--images', images_arg]
    try:
        proc = subprocess.run(cmd, cwd=repo_root, capture_output=True, text=True, timeout=60)
        ok = proc.returncode == 0
        out = proc.stdout + '\n' + proc.stderr
    except Exception as e:
        ok = False
        out = str(e)

    resp = jsonify({'ok': ok, 'output': out})
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


@app.route('/admin/regenerate_thumbs', methods=['POST', 'OPTIONS'])
def regenerate_thumbs():
    if request.method == 'OPTIONS':
        resp = jsonify({'ok': True})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp

    # require auth via current_password
    current = request.form.get('current_password') or (request.json and request.json.get('current_password'))
    if not current:
        resp = jsonify({'error':'current_password required'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400

    # load existing creds
    if os.path.exists(CREDS_PATH):
        with open(CREDS_PATH, 'r', encoding='utf-8') as f:
            creds = json.load(f)
    else:
        creds = None
    if not verify_password(current, creds):
        resp = jsonify({'error':'current password invalid'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 403

    vid = request.form.get('id') or (request.json and request.json.get('id'))
    sizes = request.form.get('sizes') or (request.json and request.json.get('sizes')) or '800x600'
    if not vid:
        resp = jsonify({'error':'id required'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400

    # parse sizes
    size_list = []
    try:
        for part in sizes.split(','):
            part = part.strip()
            if not part: continue
            w,h = part.lower().split('x')
            size_list.append((int(w), int(h)))
    except Exception:
        resp = jsonify({'error':'invalid sizes format'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400

    target_dir = os.path.join(IMAGES_ROOT, vid)
    if not os.path.isdir(target_dir):
        resp = jsonify({'error':'images folder not found for id: '+vid})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 404

    written = []
    # pick source image
    candidates = [n for n in os.listdir(target_dir) if allowed_filename(n)]
    if not candidates:
        resp = jsonify({'error':'no source images found in folder'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 400
    src_name = '1.jpg' if '1.jpg' in candidates else candidates[0]
    src_path = os.path.join(target_dir, src_name)

    if not PIL_AVAILABLE:
        resp = jsonify({'error':'Pillow not available on server'})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 500

    try:
        from PIL import Image
        for idx, (w,h) in enumerate(size_list):
            out_name = f'thumb_{w}x{h}.jpg'
            out_path = os.path.join(target_dir, out_name)
            try:
                img = Image.open(src_path)
                img.thumbnail((w,h))
                if img.mode in ('RGBA','P'):
                    img = img.convert('RGB')
                img.save(out_path, 'JPEG', quality=85)
                written.append(os.path.relpath(out_path, os.path.dirname(os.path.dirname(__file__))).replace('\\','/'))
            except Exception as e:
                # continue on error
                written.append({'error': str(e), 'file': out_name})
            # write thumb.jpg for first size
            if idx == 0:
                primary = os.path.join(target_dir, 'thumb.jpg')
                try:
                    img = Image.open(src_path)
                    img.thumbnail((w,h))
                    if img.mode in ('RGBA','P'):
                        img = img.convert('RGB')
                    img.save(primary, 'JPEG', quality=85)
                    written.append(os.path.relpath(primary, os.path.dirname(os.path.dirname(__file__))).replace('\\','/'))
                except Exception as e:
                    written.append({'error': str(e), 'file': 'thumb.jpg'})
    except Exception as e:
        resp = jsonify({'error': 'thumbnail generation failed: '+str(e)})
        resp.headers['Access-Control-Allow-Origin'] = '*'
        return resp, 500

    resp = jsonify({'ok': True, 'written': written})
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp

if __name__ == '__main__':
    print('URL map:', app.url_map)
    app.run(host='127.0.0.1', port=5001)
