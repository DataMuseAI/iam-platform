from pathlib import Path
import json,shutil
root=Path.cwd()
required={'apps/iam/src/server.ts': [("import { Pool, type PoolClient } from 'pg';", "import { Pool, type PoolClient } from 'pg';\nimport { registerOnboarding } from './onboarding.js';"), ("app.addHook('onClose',async()=>{await db.end();});", "registerOnboarding(app,db,verify,cfg);\napp.addHook('onClose',async()=>{await db.end();});")], 'scripts/migrate.ts': [("await apply(process.env.DEMO_DATABASE_URL ?? '', 'db/002_demo.sql', '002_demo');", "await apply(process.env.IAM_DATABASE_URL ?? '', 'db/003_invitations.sql', '003_invitations');\nawait apply(process.env.DEMO_DATABASE_URL ?? '', 'db/002_demo.sql', '002_demo');")], '.env.example': [('IAM_URL=http://localhost:4000', 'INVITE_TOKEN_KEY_BASE64=REPLACE_WITH_32_RANDOM_BYTES_BASE64\nSMTP_HOST=localhost\nSMTP_PORT=1025\nSMTP_FROM=invites@local.test\nSMTP_TLS=false\nINVITE_ACCEPT_URL=http://localhost:3000/accept-invite\nIAM_URL=http://localhost:4000')], 'infra/compose.yaml': [('  keycloak:', '  mailpit:\n    image: axllent/mailpit:latest\n    ports: ["8025:8025", "1025:1025"]\n  keycloak:')]}
patches={}
for path,pairs in required.items():
 p=root/path
 if not p.is_file(): raise SystemExit(f'Missing starter file: {path}')
 text=p.read_text()
 for old,new in pairs:
  if text.count(old)!=1: raise SystemExit(f'Expected exactly one anchor {old!r} in {path}; no files changed')
  text=text.replace(old,new)
 patches[p]=text
pkgpath=root/'package.json'
if not pkgpath.is_file(): raise SystemExit('Missing package.json; no files changed')
pkg=json.loads(pkgpath.read_text())
if 'dev:mail' in pkg['scripts'] or 'nodemailer' in pkg['dependencies']: raise SystemExit('Already applied; no files changed')
pkg['scripts']['dev:mail']='tsx watch apps/iam/src/mail-worker.ts'
pkg['dependencies']['nodemailer']='^6.10.1'
pkg['devDependencies']['@types/nodemailer']='^6.4.17'
patches[pkgpath]=json.dumps(pkg,indent=2)+'\n'
for src in (root/'increment_files').rglob('*'):
 if src.is_file() and (root/src.relative_to(root/'increment_files')).exists():
  raise SystemExit(f'Patch destination exists: {src.relative_to(root/"increment_files")}; no files changed')
for target,text in patches.items(): target.write_text(text)
for src in (root/'increment_files').rglob('*'):
 if src.is_file():
  dest=root/src.relative_to(root/'increment_files');dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dest)
print('Increment applied. Merge new .env.example keys into .env and run npm install, migrations, typecheck and tests.')
