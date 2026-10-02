from pathlib import Path
import json,shutil
root=Path.cwd()
required={'apps/iam/src/server.ts': [('registerOnboarding(app,db,verify,cfg);', "app.get('/v1/tenants/:tenant_id/roles',async(req,reply)=>{\n const params=idPath.safeParse(req.params);\n if(!params.success)return invalid(reply);\n let actor:Principal;\n try{actor=await requireUser(req.headers.authorization);}catch{return invalid(reply,401);}\n const member=await db.query(`SELECT 1 FROM memberships m JOIN tenants t ON t.id=m.tenant_id\n WHERE m.tenant_id=$1 AND m.identity_id=$2 AND m.status='active' AND t.status='active'`,[params.data.tenant_id,actor.identityId]);\n if(!member.rowCount)return invalid(reply,403);\n const r=await db.query(`SELECT r.id,r.name,r.product_id FROM roles r JOIN tenant_products tp\n ON tp.tenant_id=r.tenant_id AND tp.product_id=r.product_id AND tp.status='active'\n WHERE r.tenant_id=$1 ORDER BY r.name`,[params.data.tenant_id]);\n return reply.send({roles:r.rows});\n});\nregisterOnboarding(app,db,verify,cfg);")], 'scripts/migrate.ts': [("await apply(process.env.DEMO_DATABASE_URL ?? '', 'db/002_demo.sql', '002_demo');", "await apply(process.env.DEMO_DATABASE_URL ?? '', 'db/002_demo.sql', '002_demo');\nawait apply(process.env.WEB_DATABASE_URL ?? '', 'db/004_web_sessions.sql', '004_web_sessions');")], '.env.example': [('IAM_URL=http://localhost:4000', 'WEB_DATABASE_URL=postgres://web_dev:web_dev_only@localhost:5435/web_dev\nIAM_URL=http://localhost:4000')], 'infra/compose.yaml': [('  keycloak:', '  web-db:\n    image: postgres:17\n    environment:\n      POSTGRES_USER: web_dev\n      POSTGRES_PASSWORD: web_dev_only\n      POSTGRES_DB: web_dev\n    ports: ["5435:5432"]\n  keycloak:')]}
patches={}
for name,edits in required.items():
 path=root/name
 if not path.is_file():raise SystemExit(f'Missing prerequisite: {name}')
 contents=path.read_text()
 for old,new in edits:
  if contents.count(old)!=1:raise SystemExit(f'Expected one patch anchor in {name}; no files changed')
  contents=contents.replace(old,new)
 patches[path]=contents
ts=root/'tsconfig.json'
if not ts.is_file():raise SystemExit('Missing tsconfig.json')
typeconfig=json.loads(ts.read_text())
excluded=set(typeconfig.get('exclude',[]))
if 'apps/web/**' in excluded:raise SystemExit('Increment 2 already applied')
typeconfig['exclude']=sorted(excluded|{'apps/web/**'})
patches[ts]=json.dumps(typeconfig,indent=2)+'\n'
for src in (root/'increment_files').rglob('*'):
 if src.is_file() and (root/src.relative_to(root/'increment_files')).exists():
  raise SystemExit(f'Patch destination exists: {src.relative_to(root/"increment_files")}; no files changed')
for path,contents in patches.items():path.write_text(contents)
for src in (root/'increment_files').rglob('*'):
 if src.is_file():
  dest=root/src.relative_to(root/'increment_files');dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dest)
print('BFF added. Merge web DB URL into root .env; copy apps/web/.env.example to apps/web/.env.local; install and validate.')
