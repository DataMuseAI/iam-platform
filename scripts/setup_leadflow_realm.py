"""
Keycloak Realm & Client Setup for LeadFlow and IAM Platform.
Configures saas-dev realm on Keycloak running on port 8081.
"""
import requests
import json
import time
import sys

KC_URL = "http://localhost:8081"
ADMIN_USER = "admin"
ADMIN_PASS = "admin-local-only"

print(f"Connecting to Keycloak at {KC_URL}...")
for _ in range(15):
    try:
        resp = requests.post(
            f"{KC_URL}/realms/master/protocol/openid-connect/token",
            data={
                "client_id": "admin-cli",
                "username": ADMIN_USER,
                "password": ADMIN_PASS,
                "grant_type": "password"
            },
            timeout=5
        )
        resp.raise_for_status()
        token = resp.json()["access_token"]
        break
    except Exception as e:
        time.sleep(2)
else:
    print("Failed to authenticate to Keycloak admin-cli")
    sys.exit(1)

headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
print("Authenticated successfully to Keycloak admin plane.")

# 1. Create realm 'saas-dev'
realm_data = {
    "realm": "saas-dev",
    "enabled": True,
    "registrationAllowed": True,
    "resetPasswordAllowed": True,
    "verifyEmail": False,
    "loginWithEmailAllowed": True,
    "attributes": {
        "acr.loa.map": '{"urn:iam:mfa": 1}'
    }
}
resp = requests.post(f"{KC_URL}/admin/realms", json=realm_data, headers=headers)
if resp.status_code in (201, 409):
    print("✓ Realm 'saas-dev' created or already exists.")
else:
    print(f"Realm creation response: {resp.status_code} {resp.text}")

# Ensure realm exists
requests.get(f"{KC_URL}/admin/realms/saas-dev", headers=headers).raise_for_status()

# 2. Create client scopes for audiences
scopes = {}
for aud in ["iam-api", "demo-api", "demo-2-api", "leadflow-api", "leadflow-platform-admin"]:
    resp = requests.post(
        f"{KC_URL}/admin/realms/saas-dev/client-scopes",
        json={"name": aud, "protocol": "openid-connect", "attributes": {"include.in.token.scope": "true", "display.on.consent.screen": "false"}},
        headers=headers
    )
    resp = requests.get(f"{KC_URL}/admin/realms/saas-dev/client-scopes", headers=headers)
    scope = next(s for s in resp.json() if s["name"] == aud)
    scopes[aud] = scope["id"]
    # Add audience mapper
    mapper = {
        "name": f"{aud}-mapper",
        "protocol": "openid-connect",
        "protocolMapper": "oidc-audience-mapper",
        "consentRequired": False,
        "config": {
            "included.client.audience": aud,
            "id.token.claim": "false",
            "access.token.claim": "true",
            "userinfo.token.claim": "false"
        }
    }
    requests.post(f"{KC_URL}/admin/realms/saas-dev/client-scopes/{scope['id']}/protocol-mappers/models", json=mapper, headers=headers)

print(f"✓ Created audience client scopes: {list(scopes.keys())}")

# 3. Create leadflow-frontend public SPA client (PKCE S256)
frontend_client_data = {
    "clientId": "leadflow-frontend",
    "enabled": True,
    "publicClient": True,
    "standardFlowEnabled": True,
    "implicitFlowEnabled": False,
    "directAccessGrantsEnabled": True,
    "serviceAccountsEnabled": False,
    "redirectUris": [
        "http://localhost:5173/*",
        "http://127.0.0.1:5173/*",
        "http://localhost:3000/*",
        "http://127.0.0.1:3000/*"
    ],
    "webOrigins": ["+"],
    "attributes": {
        "pkce.code.challenge.method": "S256"
    }
}
resp = requests.post(f"{KC_URL}/admin/realms/saas-dev/clients", json=frontend_client_data, headers=headers)
resp = requests.get(f"{KC_URL}/admin/realms/saas-dev/clients?clientId=leadflow-frontend", headers=headers)
leadflow_frontend_id = resp.json()[0]["id"]

# Assign audience scopes to leadflow-frontend
for aud in ["leadflow-api", "leadflow-platform-admin"]:
    requests.put(f"{KC_URL}/admin/realms/saas-dev/clients/{leadflow_frontend_id}/default-client-scopes/{scopes[aud]}", headers=headers)

print("✓ Created public client 'leadflow-frontend' with PKCE (S256) and webOrigins: ['+']")

# 4. Create web-bff client
web_bff_data = {
    "clientId": "web-bff",
    "enabled": True,
    "clientAuthenticatorType": "client-secret",
    "secret": "web_bff_secret_123",
    "standardFlowEnabled": True,
    "implicitFlowEnabled": False,
    "directAccessGrantsEnabled": False,
    "serviceAccountsEnabled": False,
    "publicClient": False,
    "redirectUris": ["http://localhost:3000/api/auth/callback", "https://localhost:3000/api/auth/callback"],
    "attributes": {
        "pkce.code.challenge.method": "S256"
    }
}
requests.post(f"{KC_URL}/admin/realms/saas-dev/clients", json=web_bff_data, headers=headers)
resp = requests.get(f"{KC_URL}/admin/realms/saas-dev/clients?clientId=web-bff", headers=headers)
web_bff_id = resp.json()[0]["id"]
for scope_id in scopes.values():
    requests.put(f"{KC_URL}/admin/realms/saas-dev/clients/{web_bff_id}/default-client-scopes/{scope_id}", headers=headers)

# 5. Create leadflow-service client (confidential M2M / service accounts)
leadflow_service_data = {
    "clientId": "leadflow-service",
    "enabled": True,
    "clientAuthenticatorType": "client-secret",
    "secret": "leadflow_service_secret_789",
    "standardFlowEnabled": False,
    "implicitFlowEnabled": False,
    "directAccessGrantsEnabled": False,
    "serviceAccountsEnabled": True,
    "publicClient": False
}
requests.post(f"{KC_URL}/admin/realms/saas-dev/clients", json=leadflow_service_data, headers=headers)
resp = requests.get(f"{KC_URL}/admin/realms/saas-dev/clients?clientId=leadflow-service", headers=headers)
leadflow_service_id = resp.json()[0]["id"]
requests.put(f"{KC_URL}/admin/realms/saas-dev/clients/{leadflow_service_id}/default-client-scopes/{scopes['iam-api']}", headers=headers)
requests.put(f"{KC_URL}/admin/realms/saas-dev/clients/{leadflow_service_id}/default-client-scopes/{scopes['leadflow-api']}", headers=headers)

resp = requests.get(f"{KC_URL}/admin/realms/saas-dev/clients/{leadflow_service_id}/service-account-user", headers=headers)
leadflow_service_sub = resp.json()["id"]
print("✓ Created service client 'leadflow-service' with M2M service accounts")

# 6. Add tenant_id protocol mapper so Keycloak tokens include tenant_id & role
tenant_mapper = {
    "name": "tenant-id-mapper",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-usermodel-attribute-mapper",
    "consentRequired": False,
    "config": {
        "user.attribute": "tenant_id",
        "claim.name": "tenant_id",
        "id.token.claim": "true",
        "access.token.claim": "true",
        "userinfo.token.claim": "true",
        "claim.type": "String",
        "multivalued": "false",
        "aggregate.attrs": "false"
    }
}
requests.post(f"{KC_URL}/admin/realms/saas-dev/clients/{leadflow_frontend_id}/protocol-mappers/models", json=tenant_mapper, headers=headers)

# 7. Create Pilot / AddOn Admin user
user_data = {
    "username": "counsellor@addon.org",
    "email": "counsellor@addon.org",
    "enabled": True,
    "emailVerified": True,
    "firstName": "Sarah",
    "lastName": "Counsellor",
    "attributes": {
        "tenant_id": "11111111-1111-4111-8111-111111111111",
        "role": "admin"
    },
    "credentials": [{"type": "password", "value": "AddonAdmin2026!", "temporary": False}]
}
requests.post(f"{KC_URL}/admin/realms/saas-dev/users", json=user_data, headers=headers)
resp = requests.get(f"{KC_URL}/admin/realms/saas-dev/users?username=counsellor@addon.org", headers=headers)
counsellor_sub = resp.json()[0]["id"]
print(f"✓ Created test pilot user 'counsellor@addon.org' (ID: {counsellor_sub})")

print("\n" + "=" * 60)
print("KEYCLOAK REALM 'saas-dev' CONFIGURATION COMPLETE")
print("=" * 60)
print(f"OIDC Issuer:     {KC_URL}/realms/saas-dev")
print("Frontend Client: leadflow-frontend (Public, PKCE S256)")
print("Service Client:  leadflow-service (Secret: leadflow_service_secret_789)")
print("Default User:    counsellor@addon.org / AddonAdmin2026!")
print("Tenant ID:       11111111-1111-4111-8111-111111111111")
