import {describe,expect,it} from 'vitest';
import {recoveryEntry,recoveryRedirect,newPasswordError} from './passwordRecovery';
const base='https://example.github.io/Educart/';
describe('password recovery',()=>{
  it('recognizes recovery callbacks but not normal login or signup',()=>{
    expect(recoveryEntry(base+'#access_token=a&refresh_token=b&type=recovery')).toBe('pending');
    expect(recoveryEntry(base+'#access_token=a&refresh_token=b&type=signup')).toBe('none');
    expect(recoveryEntry(base+'#/consulta-publica')).toBe('none');
    expect(recoveryEntry(base+'#/redefinir-senha')).toBe('invalid');
    expect(recoveryEntry(base+'#type=recovery')).toBe('invalid');
    expect(recoveryEntry(base+'#error=access_denied&error_code=otp_expired')).toBe('invalid');
  });
  it('redirects to the app base without credentials, hash or query',()=>{
    expect(recoveryRedirect(base+'?other=1#/login','/Educart/')).toBe(base);
    expect(recoveryRedirect('http://localhost:4173/#/login','/')).toBe('http://localhost:4173/');
  });
  it('validates length and confirmation without trimming passwords',()=>{
    expect(newPasswordError('short','short')).not.toBe('');
    expect(newPasswordError('password1','password2')).not.toBe('');
    expect(newPasswordError(' password1',' password1')).toBe('');
  });
});
