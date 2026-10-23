#!/usr/bin/env python3
"""Keep public update configuration separate from signing credentials."""
import json
import plistlib
import re
import sys
from pathlib import Path

plist_path, config_path = map(Path, sys.argv[1:])
config = json.loads(config_path.read_text())
with plist_path.open('rb') as stream:
    info = plistlib.load(stream)
repo, key = config.get('repository', ''), config.get('publicKey', '')
if repo and key:
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo):
        raise ValueError('Invalid GitHub repository')
    import base64
    if len(base64.b64decode(key, validate=True)) != 32:
        raise ValueError('Invalid Ed25519 public key')
    info.update(SUFeedURL=f'https://github.com/{repo}/releases/latest/download/appcast.xml',
                SUPublicEDKey=key, SUEnableAutomaticChecks=True,
                SUAutomaticallyUpdate=False, SUEnableSystemProfiling=False)
with plist_path.open('wb') as stream:
    plistlib.dump(info, stream, sort_keys=False)
