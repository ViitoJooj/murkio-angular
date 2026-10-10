import {
  DestroyRef,
  ENVIRONMENT_INITIALIZER,
  InjectionToken,
  PLATFORM_ID,
  inject,
  makeEnvironmentProviders,
  signal,
  type EnvironmentProviders,
  type Signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { HttpInterceptorFn } from '@angular/common/http';
import { Router, type CanActivateFn } from '@angular/router';
import { defineElements, init, type AccessClaims, type Me, type Murkio, type MurkioOptions } from '@murkio/html';
import { from, switchMap } from 'rxjs';

export interface MurkioAngularOptions extends MurkioOptions {
  /** Where murkioAuthGuard() sends visitors who are not signed in. */
  signInUrl?: string;
}

/** The page's Murkio client, or null on the server (SSR). */
export const MURKIO = new InjectionToken<Murkio | null>('murkio');
const OPTIONS = new InjectionToken<MurkioAngularOptions>('murkio.options');

/**
 * `bootstrapApplication(App, { providers: [provideMurkio({ publishableKey: 'pk_...' })] })`.
 * Creates the client and registers the <murkio-identity-*> elements in the
 * browser only. Components that use the elements declare
 * `schemas: [CUSTOM_ELEMENTS_SCHEMA]`.
 */
export function provideMurkio(options: MurkioAngularOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: OPTIONS, useValue: options },
    {
      provide: MURKIO,
      useFactory: () => {
        if (!isPlatformBrowser(inject(PLATFORM_ID))) return null;
        defineElements();
        return init(options);
      },
    },
    { provide: ENVIRONMENT_INITIALIZER, multi: true, useValue: () => inject(MURKIO) },
  ]);
}

export interface Auth {
  isLoaded: Signal<boolean>;
  isSignedIn: Signal<boolean>;
  claims: Signal<AccessClaims | null>;
  /** The signed-in user's profile (POST /v1/me), loaded on demand. */
  user: Signal<Me | null>;
  getToken(): Promise<string | null>;
  signOut(): Promise<void>;
}

/** Auth state as signals, following the session in every tab. Call it in an injection context (a constructor or field). */
export function injectAuth(): Auth {
  const murkio = inject(MURKIO);
  const claims = signal<AccessClaims | null>(null);
  const user = signal<Me | null>(null);
  const isSignedIn = signal(false);

  if (murkio) {
    const stop = murkio.onAuthChange((next) => {
      claims.set(next);
      isSignedIn.set(next !== null);
      if (!next) user.set(null);
      else murkio.getUser().then((profile) => user.set(profile), () => user.set(null));
    });
    inject(DestroyRef).onDestroy(stop);
  }

  return {
    isLoaded: signal(murkio !== null).asReadonly(),
    isSignedIn: isSignedIn.asReadonly(),
    claims: claims.asReadonly(),
    user: user.asReadonly(),
    getToken: () => murkio?.getToken() ?? Promise.resolve(null),
    signOut: () => murkio?.signOut() ?? Promise.resolve(),
  };
}

/**
 * A route guard: `{ path: 'dashboard', canActivate: [murkioAuthGuard()] }`.
 * Visitors who are not signed in go to `signInUrl` (with `?redirect=`); with
 * `roles`, signed-in users without one of them are refused. On the server it
 * lets the route render: the browser runs the guard again once it loads.
 */
export function murkioAuthGuard(options: { signInUrl?: string; roles?: string[] } = {}): CanActivateFn {
  return (_route, state) => {
    const murkio = inject(MURKIO);
    if (!murkio) return true;
    const claims = murkio.claims;
    if (claims) return !options.roles || options.roles.some((role) => claims.roles.includes(role));
    const signInUrl = options.signInUrl ?? inject(OPTIONS).signInUrl;
    return signInUrl ? inject(Router).createUrlTree([signInUrl], { queryParams: { redirect: state.url } }) : false;
  };
}

function sameOrigin(url: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    return typeof location !== 'undefined' && new URL(url).origin === location.origin;
  } catch {
    return false;
  }
}

/**
 * Adds `Authorization: Bearer <access token>` to the requests for your API.
 * By default only same-origin URLs get it; pass the other API URL prefixes
 * explicitly, so the token never goes to a third party:
 * `provideHttpClient(withInterceptors([murkioInterceptor(['https://api.example.com/'])]))`.
 */
export function murkioInterceptor(prefixes: string[] = []): HttpInterceptorFn {
  return (request, next) => {
    const murkio = inject(MURKIO);
    const matches = sameOrigin(request.url) || prefixes.some((prefix) => request.url.startsWith(prefix));
    if (!murkio || !matches || request.headers.has('Authorization')) return next(request);
    return from(murkio.getToken()).pipe(
      switchMap((token) => next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request)),
    );
  };
}

export { MurkioError, translate } from '@murkio/html';
export type { AccessClaims, Me, MurkioOptions } from '@murkio/html';
