import { useState } from "react";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import { useIsPasswordRevealed } from "keycloakify/tools/useIsPasswordRevealed";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";

// Username/password login styled to match the dashboard (Material outlined
// inputs, blue CTA, inline errors). Standard Keycloak password flow; passkey/
// WebAuthn conditional UI is intentionally omitted — add it back from
// keycloakify's default Login.tsx if the realm enables it.
export default function Login(props: PageProps<Extract<KcContext, { pageId: "login.ftl" }>, I18n>) {
    const { kcContext, i18n, Template, doUseDefaultCss, classes } = props;

    const { social, realm, url, usernameHidden, login, auth, messagesPerField } = kcContext;
    const { msg, msgStr } = i18n;

    const [isLoginButtonDisabled, setIsLoginButtonDisabled] = useState(false);
    const hasError = messagesPerField.existsError("username", "password");
    const brand = realm.displayName || "LogStream";

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!hasError}
            headerNode={
                <>
                    <h1 className="ls-title">Sign in</h1>
                    <p className="ls-subtitle">to continue to {brand}</p>
                </>
            }
            displayInfo
            infoNode={
                <span>
                    Don&apos;t have access?{" "}
                    <a className="ls-link" href="mailto:">
                        Contact your admin
                    </a>
                </span>
            }
            socialProvidersNode={
                realm.password && social?.providers !== undefined && social.providers.length !== 0 ? (
                    <div id="kc-social-providers" className="ls-social">
                        <div className="ls-divider">or</div>
                        <ul className="ls-social-list">
                            {social.providers.map(p => (
                                <li key={p.alias}>
                                    <a id={`social-${p.alias}`} href={p.loginUrl}>
                                        <IconLock />
                                        <span
                                            dangerouslySetInnerHTML={{ __html: kcSanitize(p.displayName) }}
                                        />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null
            }
        >
            <div id="kc-form">
                <div id="kc-form-wrapper">
                    {realm.password && (
                        <form
                            id="kc-form-login"
                            onSubmit={() => {
                                setIsLoginButtonDisabled(true);
                                return true;
                            }}
                            action={url.loginAction}
                            method="post"
                        >
                            {!usernameHidden && (
                                <div className="ls-form-group">
                                    <label htmlFor="username" className="ls-label">
                                        {!realm.loginWithEmailAllowed
                                            ? msg("username")
                                            : !realm.registrationEmailAsUsername
                                              ? msg("usernameOrEmail")
                                              : msg("email")}
                                    </label>
                                    <input
                                        tabIndex={2}
                                        id="username"
                                        className="ls-input"
                                        name="username"
                                        defaultValue={login.username ?? ""}
                                        type="text"
                                        autoFocus
                                        autoComplete="username"
                                        aria-invalid={hasError}
                                    />
                                </div>
                            )}

                            <div className="ls-form-group">
                                <label htmlFor="password" className="ls-label">
                                    {msg("password")}
                                </label>
                                <PasswordWrapper i18n={i18n} passwordInputId="password">
                                    <input
                                        tabIndex={3}
                                        id="password"
                                        className="ls-input"
                                        name="password"
                                        type="password"
                                        autoComplete="current-password"
                                        aria-invalid={hasError}
                                    />
                                </PasswordWrapper>
                                {hasError && (
                                    <span id="input-error" className="ls-input-error" aria-live="polite">
                                        <IconError />
                                        <span
                                            dangerouslySetInnerHTML={{
                                                __html: kcSanitize(
                                                    messagesPerField.getFirstError("username", "password")
                                                )
                                            }}
                                        />
                                    </span>
                                )}
                            </div>

                            <div className="ls-options">
                                {realm.rememberMe && !usernameHidden ? (
                                    <label className="ls-checkbox">
                                        <input
                                            tabIndex={5}
                                            id="rememberMe"
                                            name="rememberMe"
                                            type="checkbox"
                                            defaultChecked={!!login.rememberMe}
                                        />
                                        {msg("rememberMe")}
                                    </label>
                                ) : (
                                    <span />
                                )}
                                {realm.resetPasswordAllowed && (
                                    <a tabIndex={6} className="ls-link" href={url.loginResetCredentialsUrl}>
                                        {msg("doForgotPassword")}
                                    </a>
                                )}
                            </div>

                            <div id="kc-form-buttons">
                                <input
                                    type="hidden"
                                    id="id-hidden-input"
                                    name="credentialId"
                                    value={auth.selectedCredential}
                                />
                                <input
                                    tabIndex={7}
                                    disabled={isLoginButtonDisabled}
                                    className="ls-button"
                                    name="login"
                                    id="kc-login"
                                    type="submit"
                                    value={msgStr("doLogIn")}
                                />
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </Template>
    );
}

function PasswordWrapper(props: { i18n: I18n; passwordInputId: string; children: JSX.Element }) {
    const { i18n, passwordInputId, children } = props;
    const { msgStr } = i18n;
    const { isPasswordRevealed, toggleIsPasswordRevealed } = useIsPasswordRevealed({ passwordInputId });

    return (
        <div className="ls-input-group">
            {children}
            <button
                type="button"
                className="ls-reveal"
                aria-label={msgStr(isPasswordRevealed ? "hidePassword" : "showPassword")}
                aria-controls={passwordInputId}
                onClick={toggleIsPasswordRevealed}
            >
                {isPasswordRevealed ? <IconEyeOff /> : <IconEye />}
            </button>
        </div>
    );
}

function IconEye() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}
function IconEyeOff() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.6 9.6 0 004.3-1" />
            <path d="M9.9 9.9a3 3 0 004.2 4.2" />
        </svg>
    );
}
function IconError() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5M12 16h.01" />
        </svg>
    );
}
function IconLock() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 018 0v3" />
        </svg>
    );
}
