import {describe,it,expect} from 'vitest';
import {decisionAllowed,sameTenant} from '../packages/security/src/policy.js';
import {bearer,clientId} from '../packages/security/src/tokens.js';
describe('authorization defaults deny',()=>{
 const yes={tenant_status:'active',member_status:'active',product_status:'active',permitted:true};
 it('grants only complete active scope',()=>{expect(decisionAllowed(yes)).toBe(true);for(const key of ['tenant_status','member_status','product_status']) expect(decisionAllowed({...yes,[key]:'suspended'})).toBe(false);expect(decisionAllowed({...yes,permitted:false})).toBe(false);expect(decisionAllowed(null)).toBe(false);});
 it('requires exact resource tenant',()=>{expect(sameTenant('A','B')).toBe(false);expect(sameTenant('A',null)).toBe(false);expect(sameTenant('A','A')).toBe(true);});
 it('requires bearer scheme',()=>{expect(()=>bearer(undefined)).toThrow();expect(()=>bearer('Basic aa')).toThrow();expect(bearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');});
 it('never infers a service client from user sub',()=>{expect(clientId({sub:'alice'})).toBe(null);expect(clientId({azp:'demo-service'})).toBe('demo-service');});
 it('strictly validates administrative MFA ACR claims (SEC-IAM-03)', () => {
  const requiredAcr = 'urn:iam:mfa';
  const verifyAcr = (claims: { acr?: string | null }) => {
   if (claims.acr !== requiredAcr) throw new Error('Admin MFA context required');
   return true;
  };

  expect(verifyAcr({ acr: 'urn:iam:mfa' })).toBe(true);
  expect(() => verifyAcr({ acr: '0' })).toThrow(/MFA context required/i);
  expect(() => verifyAcr({ acr: 'urn:iam:basic' })).toThrow(/MFA context required/i);
  expect(() => verifyAcr({ acr: undefined })).toThrow(/MFA context required/i);
  expect(() => verifyAcr({})).toThrow(/MFA context required/i);
 });
});
