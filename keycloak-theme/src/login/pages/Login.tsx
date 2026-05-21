import { useState } from "react";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import { useIsPasswordRevealed } from "keycloakify/tools/useIsPasswordRevealed";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";

// Username/password login styled to match the dashboard. Standard Keycloak
// password flow; passkey/WebAuthn conditional UI is intentionally omitted —
// add it back from keycloakify's default Login.tsx if the realm enables it.
export default function Login(props: PageProps<Extract<KcContext, { pageId: "login.ftl" }>, I18n>) {
    const { kcContext, i18n, Template, doUseDefaultCss, classes } = props;

    const { social, realm, url, usernameHidden, login, auth, registrationDisabled, messagesPerField } =
        kcContext;
    const { msg, msgStr } = i18n;

    const [isLoginButtonDisabled, setIsLoginButtonDisabled] = useState(false);
    const hasError = messagesPerField.existsError("username", "password");

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!hasError}
            headerNode={msg("loginAccountTitle")}
            displayInfo={realm.password && realm.registrationAllowed && !registrationDisabled}
            infoNode={
                <span>
                    {msg("noAccount")}{" "}
                    <a className="ls-link" tabIndex={8} href={url.registrationUrl}>
                        {msg("doRegister")}
                    </a>
                </span>
            }
            socialProvidersNode={
                realm.password && social?.providers !== undefined && social.providers.length !== 0 ? (
                    <div id="kc-social-providers" className="ls-social">
                        <div className="ls-social-divider">{msg("identity-provider-login-label")}</div>
                        <ul className="ls-social-list">
                            {social.providers.map(p => (
                                <li key={p.alias}>
                                    <a id={`social-${p.alias}`} href={p.loginUrl}>
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
                                    <span
                                        id="input-error"
                                        className="ls-input-error"
                                        aria-live="polite"
                                        dangerouslySetInnerHTML={{
                                            __html: kcSanitize(
                                                messagesPerField.getFirstError("username", "password")
                                            )
                                        }}
                                    />
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

function PasswordWrapper(props: {
    i18n: I18n;
    passwordInputId: string;
    children: JSX.Element;
}) {
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
                {isPasswordRevealed ? "HIDE" : "SHOW"}
            </button>
        </div>
    );
}
