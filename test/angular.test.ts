import '@angular/compiler';
import { HttpHeaders, HttpRequest, type HttpEvent, type HttpHandlerFn } from '@angular/common/http';
import { createEnvironmentInjector, Injector, PLATFORM_ID, runInInjectionContext, type EnvironmentInjector } from '@angular/core';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { reset } from '@murkio/html';
import { firstValueFrom, of, type Observable } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { injectAuth, MURKIO, murkioAuthGuard, murkioInterceptor, provideMurkio } from '../src';

const fetch = (async () => new Response('{}', { status: 503 })) as typeof globalThis.fetch;

function jwt(claims: Record<string, unknown>) {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'EdDSA' })}.${encode(claims)}.sig`;
}

function injector(platform = 'browser'): EnvironmentInjector {
  return createEnvironmentInjector(
    [
      provideMurkio({ publishableKey: 'pk_angular', apiUrl: 'https://api.example.com', fetch, signInUrl: '/login' }),
      { provide: PLATFORM_ID, useValue: platform },
      { provide: Router, useValue: { createUrlTree: (commands: string[], extras: unknown) => ({ commands, extras }) } },
    ],
    Injector.NULL as EnvironmentInjector,
  );
}

function signIn(env: EnvironmentInjector, roles: string[] = []) {
  env.get(MURKIO)!.session.setSession(
    { access_token: jwt({ sub: 'u', sid: 's', exp: Math.floor(Date.now() / 1000) + 900, roles }), token_type: 'Bearer', expires_in: 900, refresh_token: 'rt', session_id: 's' },
    true,
  );
}

afterEach(() => {
  localStorage.clear();
  reset();
});

describe('@murkio/angular', () => {
  it('creates the client in the browser only', () => {
    expect(injector().get(MURKIO)).not.toBeNull();
    expect(customElements.get('murkio-identity-canvas')).toBeDefined();
    reset();
    expect(injector('server').get(MURKIO)).toBeNull();
  });

  it('exposes the session as signals', () => {
    const env = injector();
    const auth = runInInjectionContext(env, () => injectAuth());
    expect(auth.isLoaded()).toBe(true);
    expect(auth.isSignedIn()).toBe(false);
    signIn(env, ['admin']);
    expect(auth.isSignedIn()).toBe(true);
    expect(auth.claims()?.roles).toEqual(['admin']);
    env.destroy();
  });

  it('guards routes', () => {
    const env = injector();
    const state = { url: '/dashboard' } as RouterStateSnapshot;
    const route = {} as ActivatedRouteSnapshot;
    expect(runInInjectionContext(env, () => murkioAuthGuard()(route, state))).toEqual({ commands: ['/login'], extras: { queryParams: { redirect: '/dashboard' } } });
    signIn(env, ['user']);
    expect(runInInjectionContext(env, () => murkioAuthGuard()(route, state))).toBe(true);
    expect(runInInjectionContext(env, () => murkioAuthGuard({ roles: ['admin'] })(route, state))).toBe(false);
  });

  it('adds the token to same-origin and listed URLs only', async () => {
    const env = injector();
    signIn(env);
    const next: HttpHandlerFn = (request) => of(request as unknown as HttpEvent<unknown>);
    const run = (url: string) =>
      runInInjectionContext(env, () => firstValueFrom(murkioInterceptor(['https://api.example.com/'])(new HttpRequest('GET', url), next) as Observable<HttpEvent<unknown>>)) as Promise<unknown> as Promise<HttpRequest<unknown>>;

    expect((await run('/api/orders')).headers.get('Authorization')).toMatch(/^Bearer /);
    expect((await run('https://api.example.com/orders')).headers.get('Authorization')).toMatch(/^Bearer /);
    expect((await run('https://evil.example.com/steal')).headers.has('Authorization')).toBe(false);
    expect(new HttpHeaders().has('Authorization')).toBe(false);
  });
});
