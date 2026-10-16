import requests

KC_URL = "http://localhost:8080"
# Get admin token
resp = requests.post(
    f"{KC_URL}/realms/master/protocol/openid-connect/token",
    data={
        "client_id": "admin-cli",
        "username": "admin",
        "password": "admin_dev_only",
        "grant_type": "password"
    }
)
resp.raise_for_status()
token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Get clients
resp = requests.get(f"{KC_URL}/admin/realms/saas-dev/clients", headers=headers)
clients = resp.json()
lf_client = next(c for c in clients if c["clientId"] == "leadflow-frontend")

mapper = {
    "name": "aud-iam-api",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-audience-mapper",
    "consentRequired": False,
    "config": {
        "included.custom.audience": "iam-api",
        "id.token.claim": "false",
        "access.token.claim": "true"
    }
}
resp = requests.post(f"{KC_URL}/admin/realms/saas-dev/clients/{lf_client['id']}/protocol-mappers/models", json=mapper, headers=headers)
print(resp.status_code, resp.text)
