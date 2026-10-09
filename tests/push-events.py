#!/usr/bin/env python3
"""Turn a run's transcript into per-document JSON files for the Surya bench artifact database.

Usage:
  push-events.py scenes <run-id> <version-label> <note> /tmp/voice-transcript-vN.json   [--frames none]
  push-events.py footage <run-id> <version-label> <note> <outDir-with-transcript.json>

Writes <out>/run.json and <out>/events/<seq>.json under /tmp/surya-push/<run-id>/ and prints a batch manifest
(JSON list of {op,collection,doc_id,file_path}) in chunks of at most 20 writes, ready for the ArtifactData batch action.
Frames are embedded as data URIs (about 36 KB each), well under the 256 KiB document limit.
"""
import base64, json, os, sys, time

kind, run_id, version, note, src = sys.argv[1:6]
out = f'/tmp/surya-push/{run_id}'
os.makedirs(f'{out}/events', exist_ok=True)
events = []
if kind == 'scenes':
    d = json.load(open(src))
    for scene, rows in d.items():
        for r in rows:
            events.append({'scene': scene, 't': r['t'], 'text': r['text'], 'durMs': r['durMs'], 'cutOff': r['cutOff'], 'truth': r.get('truthWhenSpoken')})
else:
    d = json.load(open(os.path.join(src, 'transcript.json')))
    for r in d['sentences']:
        fp = os.path.join(src, r['frame'])
        frame = None
        if os.path.exists(fp):
            frame = 'data:image/jpeg;base64,' + base64.b64encode(open(fp, 'rb').read()).decode()
        events.append({'t': r['t'], 'text': r['text'], 'durMs': r.get('durMs'), 'cutOff': r['cutOff'], 'chosen': r.get('chosen'), 'frame': frame})

run = {'kind': kind, 'version': version, 'note': note, 'status': 'done', 'started': int(time.time() * 1000), 'count': len(events)}
json.dump(run, open(f'{out}/run.json', 'w'))
manifest = [{'op': 'set', 'collection': 'runs', 'doc_id': run_id, 'file_path': f'{out}/run.json'}]
for i, e in enumerate(events):
    e['run'] = run_id
    e['seq'] = i
    p = f'{out}/events/{i:03d}.json'
    json.dump(e, open(p, 'w'))
    manifest.append({'op': 'set', 'collection': 'events', 'doc_id': f'{run_id}-{i:03d}', 'file_path': p})
chunks = [manifest[i:i + 20] for i in range(0, len(manifest), 20)]
json.dump(chunks, open(f'{out}/batches.json', 'w'))
print(json.dumps({'run': run_id, 'events': len(events), 'batches': len(chunks), 'manifest': f'{out}/batches.json'}))
