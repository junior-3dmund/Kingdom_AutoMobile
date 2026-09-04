#!/usr/bin/env python3
import argparse
import os

def remove_from_file(path, target_link):
    if not os.path.exists(path):
        return False
    with open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    if target_link not in s:
        return False
    # naive: remove the article that contains the link
    start = s.find('<article', s.find(target_link)-200)
    if start == -1:
        return False
    end = s.find('</article>', start)
    if end == -1:
        return False
    end += len('</article>')
    new = s[:start] + s[end:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new)
    return True

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--id', required=True)
    args = p.parse_args()
    repo_root = os.path.dirname(os.path.dirname(__file__))
    target = f'vehicle-{args.id}.html'
    target_path = os.path.join(repo_root, target)
    if os.path.exists(target_path):
        os.remove(target_path)
        print('Removed', target_path)
    else:
        print(target_path, 'not found')

    changed = False
    for f in ('stock.html','index.html'):
        path = os.path.join(repo_root, f)
        if remove_from_file(path, target):
            print('Updated', f)
            changed = True
    if not changed:
        print('No references removed from stock/index')

if __name__ == '__main__':
    main()
