import { useEffect, type ReactNode } from "react";
import { clsx } from "keycloakify/tools/clsx";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import { useSetClassName } from "keycloakify/tools/useSetClassName";
import { useInitialize } from "keycloakify/login/Template.useInitialize";
import type { TemplateProps } from "keycloakify/login/TemplateProps";
import type { KcContext } from "./KcContext";
import type { I18n } from "./i18n";
import logoUrl from "./assets/logo.svg";
import "./main.css";

// Login page gets the two-column Material hero+card layout; every other auth
// page (reset password, OTP, update password, error...) reuses the centered
// .ls-card. Markup mirrors keycloakify's default Template (alerts,
// try-another-way, social, info) but with our own ls-* classes.
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

    const card = (
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
    );

    if (kcContext.pageId === "login.ftl") {
        return (
            <div className="ls-split">
                <Hero brandName={realm.displayNameHtml || realm.displayName || "LogStream"} />
                <div className="ls-pane">{card}</div>
            </div>
        );
    }

    return <div className="ls-page">{card}</div>;
}

// Marketing copy is hardcoded English (single-language realm) rather than
// plumbed through i18n — these keys don't exist in Keycloak's message bundle.
const FEATURES: { icon: ReactNode; label: string }[] = [
    { icon: <IconStream />, label: "Real-time log streaming" },
    { icon: <IconFilter />, label: "Server-side filtering & search" },
    { icon: <IconSources />, label: "Multi-source, multi-topic" }
];

function Hero(props: { brandName: string }) {
    const year = new Date().getFullYear();

    return (
        <div className="ls-hero">
            <div className="ls-hero-aurora" aria-hidden="true">
                <span />
                <span />
                <span />
            </div>
            <div className="ls-hero-grid" aria-hidden="true" />

            <div className="ls-hero-brand">
                <img src={logoUrl} alt="" />
                <span dangerouslySetInnerHTML={{ __html: kcSanitize(props.brandName) }} />
            </div>

            <div className="ls-hero-body">
                <h1 className="ls-hero-headline">Observe everything. Miss nothing.</h1>
                <p className="ls-hero-subtitle">
                    Centralized log intelligence for your entire infrastructure — stream, search,
                    and filter across every topic in milliseconds.
                </p>
                <ul className="ls-features">
                    {FEATURES.map((f, i) => (
                        <li key={i}>
                            <span className="ls-feature-icon" aria-hidden="true">
                                {f.icon}
                            </span>
                            {f.label}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="ls-hero-footer">
                © {year} LogStream · <a href="#">Privacy</a> · <a href="#">Terms</a>
            </div>
        </div>
    );
}

function IconStream() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h10M4 18h13" />
            <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </svg>
    );
}
function IconFilter() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M3 5h18l-7 8v5l-4 2v-7z" />
        </svg>
    );
}
function IconSources() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="6" cy="6" r="2.4" />
            <circle cx="6" cy="18" r="2.4" />
            <circle cx="18" cy="12" r="2.4" />
            <path d="M8 7l8 4M8 17l8-4" />
        </svg>
    );
}
