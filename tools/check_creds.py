import json, binascii, hashlib
p = 'Kingdom@Auto26'
with open('admin/creds.json','r',encoding='utf-8') as f:
    creds = json.load(f)
salt = binascii.unhexlify(creds['salt'])
iters = int(creds.get('iterations', 100000))
dk = hashlib.pbkdf2_hmac('sha256', p.encode('utf-8'), salt, iters, dklen=32)
print('computed:', binascii.hexlify(dk).decode())
print('stored:  ', creds['hash'])
print('match:', binascii.hexlify(dk).decode() == creds['hash'])
