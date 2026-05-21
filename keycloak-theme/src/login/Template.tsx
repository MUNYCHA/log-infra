import { useEffect } from "react";
import { clsx } from "keycloakify/tools/clsx";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import { useSetClassName } from "keycloakify/tools/useSetClassName";
import { useInitialize } from "keycloakify/login/Template.useInitialize";
import type { TemplateProps } from "keycloakify/login/TemplateProps";
import type { KcContext } from "./KcContext";
import type { I18n } from "./i18n";
import logoUrl from "./assets/logo.svg";
import "./main.css";

// Custom shell for every login page: app background, centered brand + card.
// Markup mirrors keycloakify's default Template (alerts, try-another-way,
// social, info) but uses our own ls-* classes instead of PatternFly.
export default function Template(props: TemplateProps<KcContext, I18n>) {
    const {
        displayInfo = false,
        displayMessage = true,
        headerNode,
        socialProvidersNode = null,
        infoNode = null,
        documentTitle,
        kcContext,
        i18n,
        doUseDefaultCss,
        children
    } = props;

    const { msg, msgStr, currentLanguage, enabledLanguages } = i18n;
    const { realm, auth, url, message, isAppInitiatedAction } = kcContext;

    useEffect(() => {
        document.title = documentTitle ?? msgStr("loginTitle", realm.displayName || realm.name);
    }, []);

    useSetClassName({ qualifiedName: "html", className: "ls-html" });
    useSetClassName({ qualifiedName: "body", className: "ls-body" });

    const { isReadyToRender } = useInitialize({ kcContext, doUseDefaultCss });

    if (!isReadyToRender) {
        return null;
    }

    return (
        <div className="ls-page">
            <div className="ls-brand">
                <img className="ls-brand-logo" src={logoUrl} alt="" />
                <span
                    className="ls-brand-name"
                    dangerouslySetInnerHTML={{
                        __html: kcSanitize(realm.displayNameHtml || realm.displayName || "Logstream")
                    }}
                />
            </div>

            <div className="ls-card">
                {enabledLanguages.length > 1 && (
                    <div className="ls-locale" id="kc-locale">
                        <select
                            aria-label={msgStr("languages")}
                            value={currentLanguage.languageTag}
                            onChange={event => {
                                const href = enabledLanguages.find(
                                    l => l.languageTag === event.target.value
                                )?.href;
                                if (href) {
                                    window.location.href = href;
                                }
                            }}
                        >
                            {enabledLanguages.map(({ languageTag, label }) => (
                                <option key={languageTag} value={languageTag}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <h1 id="kc-page-title" className="ls-title">
                    {headerNode}
                </h1>

                {displayMessage &&
                    message !== undefined &&
                    (message.type !== "warning" || !isAppInitiatedAction) && (
                        <div
                            className={clsx("ls-alert", `ls-alert-${message.type}`)}
                            aria-live="polite"
                        >
                            <span
                                dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }}
                            />
                        </div>
                    )}

                {children}

                {auth !== undefined && auth.showTryAnotherWayLink && (
                    <form
                        id="kc-select-try-another-way-form"
                        action={url.loginAction}
                        method="post"
                    >
                        <input type="hidden" name="tryAnotherWay" value="on" />
                        <a
                            href="#"
                            id="try-another-way"
                            className="ls-link"
                            onClick={event => {
                                (
                                    document.forms as unknown as Record<string, HTMLFormElement>
                                )["kc-select-try-another-way-form"].requestSubmit();
                                event.preventDefault();
                                return false;
                            }}
                        >
                            {msg("doTryAnotherWay")}
                        </a>
                    </form>
                )}

                {socialProvidersNode}

                {displayInfo && (
                    <div id="kc-info" className="ls-info">
                        {infoNode}
                    </div>
                )}
            </div>
        </div>
    );
}
