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
