# End-to-end smoke procedure (not yet executed)
1. Start Keycloak and both databases, `npm install && npm run db:migrate`, configure realm and create users/client as in KEYCLOAK_DEV.md. Run `npm run seed:demo` and copy product_id into `.env` as `DEMO_PRODUCT_ID` before starting app; run `seed:admin` for existing operator subject.
2. Start IAM and demo processes. Obtain operator token with `aud=iam-api` through authorization code + PKCE. POST `/v1/tenants` with `{slug,name,owner_issuer,owner_subject,initial_product_id}` and Authorization Bearer operator token. Copy tenant ID.
3. `npm run widget:create -- <tenant-id> example` to populate demo product DB. Obtain owner access token `aud=demo-api` and call GET `/tenants/<tenant>/widgets/<widget>` on localhost:4001; expect 200.
4. For pilot, the platform operator is also the tenant owner (`owner_subject` must equal the caller subject). Create a second tenant using the same operator, then another widget; try the first tenant ID with the second widget. Expect 404 even if JWT is valid. Change tenant ID to mismatched value and repeat; expect 404.
5. Suspend first tenant membership via IAM with operator? The endpoint is tenant-admin only: owner must obtain `iam-api` audience token and POST `/v1/tenants/<tenant>/memberships/<identity-id>/suspend` with `{reason}`. If this is the only owner expect 403, which is correct. Add another owner using administrative workflow before testing successful suspension; this workflow is **not implemented** in this slice.
6. Call decisions/check without service account token, with product Y ID or a user ID token in place of API access token. All must deny. Stop IAM and request a widget; expect 503, never 200. Record outcomes as evidence for G1.

Example tenant create:
```
curl -i -X POST http://localhost:4000/v1/tenants \
  -H "Authorization: Bearer $OPERATOR_IAM_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"slug\":\"pilot-a\",\"name\":\"Pilot A\",\"owner_issuer\":\"$OIDC_ISSUER\",\"owner_subject\":\"$OWNER_SUB\",\"initial_product_id\":\"$DEMO_PRODUCT_ID\"}"
```
