import requests
import json
import time

KC_URL = "http://localhost:8080"
ADMIN_USER = "admin"
ADMIN_PASS = "admin_dev_only"

# Get admin token
for _ in range(30):
    try:
        resp = requests.post(
            f"{KC_URL}/realms/master/protocol/openid-connect/token",
            data={
                "client_id": "admin-cli",
                "username": ADMIN_USER,
                "password": ADMIN_PASS,
                "grant_type": "password"
            }
        )
        resp.raise_for_status()
        token = resp.json()["access_token"]
        break
    except Exception:
        time.sleep(2)
else:
    print("Failed to connect to Keycloak")
    exit(1)

headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# 1. Create realm
realm_data = {
    "realm": "saas-dev",
    "enabled": True,
    "registrationAllowed": True,
    "resetPasswordAllowed": True,
    "verifyEmail": True,
    "loginWithEmailAllowed": True,
    "attributes": {
        "acr.loa.map": '{"urn:iam:mfa": 1}'
    }
}
resp = requests.post(f"{KC_URL}/admin/realms", json=realm_data, headers=headers)
if resp.status_code not in (201, 409):
    print("Realm creation failed", resp.text)
    exit(1)

# Get realm representation to ensure it exists
requests.get(f"{KC_URL}/admin/realms/saas-dev", headers=headers).raise_for_status()

# 2. Create client scopes for audiences
scopes = {}
for aud in ["iam-api", "demo-api"]:
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

# 3. Create web-bff client
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
    "redirectUris": ["https://localhost:3000/api/auth/callback", "http://localhost:3000/api/auth/callback"],
    "attributes": {
        "pkce.code.challenge.method": "S256"
    }
}
requests.post(f"{KC_URL}/admin/realms/saas-dev/clients", json=web_bff_data, headers=headers)
resp = requests.get(f"{KC_URL}/admin/realms/saas-dev/clients?clientId=web-bff", headers=headers)
web_bff_id = resp.json()[0]["id"]
for scope_id in scopes.values():
    requests.put(f"{KC_URL}/admin/realms/saas-dev/clients/{web_bff_id}/default-client-scopes/{scope_id}", headers=headers)

# 4. Add hardcoded claim for ACR (simulating MFA) to web-bff for development
acr_mapper = {
    "name": "acr-mfa-mock",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-hardcoded-claim-mapper",
    "consentRequired": False,
    "config": {
        "claim.name": "acr",
        "claim.value": "urn:iam:mfa",
        "id.token.claim": "true",
        "access.token.claim": "true",
        "userinfo.token.claim": "true",
        "claim.type": "String"
    }
}
requests.post(f"{KC_URL}/admin/realms/saas-dev/clients/{web_bff_id}/protocol-mappers/models", json=acr_mapper, headers=headers)


# 5. Create demo-service client
demo_service_data = {
    "clientId": "demo-service",
    "enabled": True,
    "clientAuthenticatorType": "client-secret",
    "secret": "demo_service_secret_123",
    "standardFlowEnabled": False,
    "implicitFlowEnabled": False,
    "directAccessGrantsEnabled": False,
    "serviceAccountsEnabled": True,
    "publicClient": False
}
requests.post(f"{KC_URL}/admin/realms/saas-dev/clients", json=demo_service_data, headers=headers)
resp = requests.get(f"{KC_URL}/admin/realms/saas-dev/clients?clientId=demo-service", headers=headers)
demo_service_id = resp.json()[0]["id"]
requests.put(f"{KC_URL}/admin/realms/saas-dev/clients/{demo_service_id}/default-client-scopes/{scopes['iam-api']}", headers=headers)
requests.put(f"{KC_URL}/admin/realms/saas-dev/clients/{demo_service_id}/default-client-scopes/{scopes['demo-api']}", headers=headers)

# Get demo-service service account user ID
resp = requests.get(f"{KC_URL}/admin/realms/saas-dev/clients/{demo_service_id}/service-account-user", headers=headers)
demo_service_sub = resp.json()["id"]

# 6. Create platform operator user
operator_data = {
    "username": "operator@local.test",
    "email": "operator@local.test",
    "enabled": True,
    "emailVerified": True,
    "credentials": [{"type": "password", "value": "operator123", "temporary": False}]
}
requests.post(f"{KC_URL}/admin/realms/saas-dev/users", json=operator_data, headers=headers)
resp = requests.get(f"{KC_URL}/admin/realms/saas-dev/users?username=operator@local.test", headers=headers)
operator_sub = resp.json()[0]["id"]

# Also create pilot end user
pilot_data = {
    "username": "pilot@local.test",
    "email": "pilot@local.test",
    "enabled": True,
    "emailVerified": True,
    "credentials": [{"type": "password", "value": "pilot123", "temporary": False}]
}
requests.post(f"{KC_URL}/admin/realms/saas-dev/users", json=pilot_data, headers=headers)

print(f"OIDC_CLIENT_SECRET=web_bff_secret_123")
print(f"DEMO_SERVICE_CLIENT_SECRET=demo_service_secret_123")
print(f"DEMO_SERVICE_SUBJECT={demo_service_sub}")
print(f"OPERATOR_SUBJECT={operator_sub}")
print("Keycloak configuration successful")
