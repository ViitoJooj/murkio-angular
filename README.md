# @murkio/angular

Murkio identity for Angular 17+ (standalone). Angular renders the
`<murkio-identity-*>` custom elements of [`@murkio/html`](../html/README.md); this
package adds the providers, signals, a route guard and an HTTP interceptor.

```ts
// main.ts
bootstrapApplication(App, {
  providers: [
    provideMurkio({ publishableKey: 'pk_...', signInUrl: '/login', afterLogin: '/dashboard' }),
    provideRouter([{ path: 'dashboard', component: Dashboard, canActivate: [murkioAuthGuard()] }]),
    provideHttpClient(withInterceptors([murkioInterceptor()])),
  ],
});
```

```ts
@Component({
  selector: 'app-login',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @if (auth.isSignedIn()) {
      <button (click)="auth.signOut()">Sign out {{ auth.user()?.email }}</button>
    } @else {
      <murkio-identity-canvas (murkio-login)="onLogin()" (murkio-error)="onError($event)"></murkio-identity-canvas>
    }
  `,
})
export class Login {
  auth = injectAuth();
  onLogin() {}
  onError(event: Event) { console.log((event as CustomEvent).detail.code); }
}
```

- Your own layout: `<murkio-identity-email-input class="input">`, `-password-input`,
  `-keep-logged`, `-login-button`, `-register-button`, `-error`.
- `murkioInterceptor()` adds the access token only to same-origin URLs; list your API
  hosts explicitly (`murkioInterceptor(['https://api.example.com/'])`).
- With SSR the client is created in the browser only; the guard lets the server render
  and runs again in the browser.

## Developing

```sh
npm ci     # also builds the package (the `prepare` script)
npm test
```

`@murkio/html` is not on the npm registry yet, so `package.json` takes it from its
repository at a pinned commit, built on install; `.npmrc` allows that (npm 12 refuses git
dependencies by default) and `npm publish` refuses to run until the dependency is a plain
version. The tests run against that build, the same code an application gets.

The checks in `infra/pipeline/` are kept in the Murkio identity service and synced from
there, so they are not edited here.

Every pull request runs the workflows in `.github/workflows`. The same checks, locally:

| Workflow | What it runs |
| --- | --- |
| Build | `npm run build`, `npm run package:check` (publint) and `npm pack --dry-run`, on Node.js 20 and 24 |
| Format | `npm run format:check` (Biome; `npm run format` fixes) |
| Lint | `npm run lint` (Biome), `npm run typecheck` (strict TypeScript) |
| Tests | `npm test` on Node.js 20 and 24 |
| Quality & Governance Checks | `for check in infra/pipeline/*.py; do python3 "$check"; done` |
| Security | `npm audit --omit=dev`, `npm audit --audit-level=high`, `npm audit signatures`, `gitleaks git .`, `zizmor --pedantic .` |
| CodeQL, Dependency Review | run by GitHub on the pull request |

Security reports: see [SECURITY.md](SECURITY.md).
