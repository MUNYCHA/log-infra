import { useEffect } from "react";
import { clsx } from "keycloakify/tools/clsx";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import { useSetClassName } from "keycloakify/tools/useSetClassName";
import { useInitialize } from "keycloakify/login/Template.useInitialize";
import type { TemplateProps } from "keycloakify/login/TemplateProps";
import type { KcContext } from "./KcContext";
import type { I18n } from "./i18n";
import logoUrl from "./assets/user.png";
import "./main.css";

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

    const { msgStr, currentLanguage, enabledLanguages } = i18n;
    const { realm, message, isAppInitiatedAction } = kcContext;

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
            <div className="ls-card">
                <div className="ls-card-icon">
                    <img src={logoUrl} alt="" />
                </div>

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

                {headerNode}

                {displayMessage &&
                    message !== undefined &&
                    (message.type !== "warning" || !isAppInitiatedAction) && (
                        <div className={clsx("ls-alert", `ls-alert-${message.type}`)} aria-live="polite">
                            <span dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }} />
                        </div>
                    )}

                {children}

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
