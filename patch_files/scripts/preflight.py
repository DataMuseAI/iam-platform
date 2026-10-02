#!/usr/bin/env python3
from pathlib import Path
import json,os,sys
root=Path(__file__).resolve().parents[1]
required=['apps/iam/src/server.ts','apps/iam/src/onboarding.ts','apps/web/package.json','apps/web/src/lib/oidc.ts','db/001_initial.sql','db/003_invitations.sql','db/004_web_sessions.sql','db/005_idempotency.sql','infra/compose.yaml','docs/openapi-implemented.yaml']
errors=[f'Missing {p}' for p in required if not (root/p).is_file()]
if (root/'package.json').is_file():
 pkg=json.loads((root/'package.json').read_text())
 for name in ['db:migrate','typecheck','test']:
  if name not in pkg.get('scripts',{}):errors.append(f'Missing npm script {name}')
for env_name in ['IAM_DATABASE_URL','DEMO_DATABASE_URL','WEB_DATABASE_URL','OIDC_ISSUER','IAM_API_AUDIENCE','IAM_ADMIN_ACR','INVITE_TOKEN_KEY_BASE64']:
 if not os.getenv(env_name):errors.append(f'Unset environment {env_name} (load root .env before running)')
if not errors:
 text=(root/'scripts/migrate.ts').read_text()
 for version in ['001_initial','002_demo','003_invitations','004_web_sessions','005_idempotency']:
  if version not in text:errors.append(f'Migration not registered: {version}')
print('Preflight FAIL: '+('; '.join(errors)) if errors else 'Preflight PASS: files, env presence and migration registration only; no runtime test performed.')
sys.exit(bool(errors))
