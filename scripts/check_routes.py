#!/usr/bin/env python3
from pathlib import Path
import re,sys
root=Path(__file__).resolve().parents[1]
source=chr(10).join((root/p).read_text() for p in ('apps/iam/src/server.ts','apps/iam/src/onboarding.ts'))
actual=set()
for method,path in re.findall(r"app\.(get|post|patch|delete)\(\s*['\"](/v1/[^'\"]+)['\"]",source):
 actual.add((method,re.sub(r':([a-z_]+)',lambda m:'{'+m.group(1)+'}',path)))
text=(root/'docs/openapi-implemented.yaml').read_text()
spec=set();current=None
for line in text.splitlines():
 p=re.match(r'^  (/v1/[^:]+):\s*$',line)
 if p:current=p.group(1);continue
 m=re.match(r'^    (get|post|patch|delete):\s*$',line)
 if m and current:spec.add((m.group(1),current))
missing=actual-spec;extra=spec-actual
if missing or extra:
 print('Contract route drift. Missing in spec:',sorted(missing),'Extra in spec:',sorted(extra));sys.exit(1)
print(f'PASS: {len(actual)} IAM routes match current OpenAPI paths/methods (schemas and runtime NOT verified).')
