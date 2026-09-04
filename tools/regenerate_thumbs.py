#!/usr/bin/env python3
"""Regenerate thumbnails for images folders.

Usage:
  python tools/regenerate_thumbs.py --id test-create --sizes 800x600,400x300

Writes thumb_<WxH>.jpg for each size and also writes thumb.jpg (first size).
"""
import os
import argparse
from PIL import Image

def parse_size(s):
    try:
        w,h = s.lower().split('x')
        return int(w), int(h)
    except Exception:
        raise ValueError('Invalid size: '+s)

def make_thumb(src_path, out_path, size):
    try:
        im = Image.open(src_path)
        im.thumbnail(size)
        # ensure RGB for JPEG
        if im.mode in ('RGBA','P'):
            im = im.convert('RGB')
        im.save(out_path, 'JPEG', quality=85)
        return True
    except Exception as e:
        print('Failed', src_path, '->', out_path, e)
        return False

def process_folder(folder, sizes, overwrite=False):
    imgs = [f for f in os.listdir(folder) if f.lower().endswith(('.jpg','.jpeg','.png','.webp','.gif'))]
    if not imgs:
        print('No images in', folder)
        return
    # pick first suitable image as source for generic thumb if no thumb exists
    for size_idx, size in enumerate(sizes):
        w,h = size
        name = f'thumb_{w}x{h}.jpg'
        outp = os.path.join(folder, name)
        # choose a source image (prefer 1.jpg or first non-thumb)
        src = None
        candidates = [n for n in imgs if not n.lower().startswith('thumb')]
        if '1.jpg' in candidates:
            src = os.path.join(folder, '1.jpg')
        else:
            src = os.path.join(folder, candidates[0])
        if not overwrite and os.path.exists(outp):
            print('Skipping existing', outp)
            continue
        ok = make_thumb(src, outp, (w,h))
        if ok:
            print('Wrote', outp)
        # also write thumb.jpg as the primary (first size)
        if size_idx == 0:
            primary = os.path.join(folder, 'thumb.jpg')
            try:
                if overwrite or not os.path.exists(primary):
                    make_thumb(src, primary, (w,h))
                    print('Wrote', primary)
            except Exception as e:
                print('Could not write primary thumb', e)

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--dir', default='images', help='Images root')
    p.add_argument('--id', help='Specific vehicle id folder (images/<id>)')
    p.add_argument('--sizes', default='800x600', help='Comma-separated sizes WxH')
    p.add_argument('--overwrite', action='store_true')
    args = p.parse_args()

    sizes = [parse_size(s.strip()) for s in args.sizes.split(',') if s.strip()]
    root = os.path.abspath(args.dir)
    if args.id:
        folder = os.path.join(root, args.id)
        if not os.path.isdir(folder):
            print('Folder not found:', folder)
            return
        process_folder(folder, sizes, overwrite=args.overwrite)
    else:
        # process all folders under images
        for name in sorted(os.listdir(root)):
            folder = os.path.join(root, name)
            if os.path.isdir(folder):
                print('Processing', folder)
                process_folder(folder, sizes, overwrite=args.overwrite)

if __name__ == '__main__':
    main()
