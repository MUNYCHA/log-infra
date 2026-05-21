import type { Meta, StoryObj } from "@storybook/react";
import { createKcPageStory } from "../KcPageStory";

const { KcPageStory } = createKcPageStory({ pageId: "login.ftl" });

const meta = {
    title: "login/Login",
    component: KcPageStory,
    // Render edge-to-edge: the login is a full-viewport two-column layout, so
    // Storybook's default "padded" wrapper makes the panels look detached.
    parameters: { layout: "fullscreen" }
} satisfies Meta<typeof KcPageStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => <KcPageStory />
};

export const WithServerError: Story = {
    render: () => (
        <KcPageStory
            kcContext={{
                message: {
                    type: "error",
                    summary: "Your account is temporarily locked. Try again later."
                }
            }}
        />
    )
};

export const WithFieldError: Story = {
    render: () => (
        <KcPageStory
            kcContext={{
                login: { username: "ops@logstream.dev" },
                messagesPerField: {
                    existsError: (...fields: string[]) =>
                        fields.includes("username") || fields.includes("password"),
                    getFirstError: () => "Invalid username or password."
                }
            }}
        />
    )
};

export const WithGoogleSso: Story = {
    render: () => (
        <KcPageStory
            kcContext={{
                social: {
                    displayInfo: true,
                    providers: [
                        {
                            alias: "google",
                            displayName: "Google",
                            loginUrl: "#",
                            providerId: "google",
                            iconClasses: "fa fa-google"
                        }
                    ]
                }
            }}
        />
    )
};
