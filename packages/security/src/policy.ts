export type ScopeState = {tenant_status?:string|null;member_status?:string|null;product_status?:string|null;permitted?:boolean|null};
export function decisionAllowed(row:ScopeState|null|undefined):boolean {
 return Boolean(row && row.tenant_status==='active' && row.member_status==='active' && row.product_status==='active' && row.permitted===true);
}
export function sameTenant(requested:string,stored:string|null|undefined):boolean {
 return Boolean(stored && requested===stored);
}
