import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export function PrivacyPolicy() {
    const currentDate = "December 7, 2025";

    return (
        <>
            <Navbar />
            <main className="min-w-screen bg-background min-h-screen pt-24 pb-16">
                <div className="container mx-auto px-4 max-w-3xl">
                    <h1 className="text-4xl font-bold mb-4 tracking-tight">Privacy Policy for Liva</h1>
                    <p className="text-muted-foreground mb-8">Last updated: {currentDate}</p>

                    <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">Overview</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Liva is an AI assisted whiteboard designed to help users brainstorm, visualize ideas, and collaborate with intelligent support. This policy explains what data we collect, why we collect it, how we use it, and the rights users have over their information.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">Data We Collect</h2>

                            <h3 className="text-xl font-medium mb-2 text-foreground">1. Content You Create</h3>
                            <p className="text-muted-foreground mb-4">We store the data you generate while using Liva:</p>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
                                <li>Whiteboards and snapshots of boards</li>
                                <li>Audio inputs processed through Whisper or other models</li>
                                <li>Text inputs, chat history, and interactions</li>
                                <li>Edit history and system activity logs</li>
                            </ul>

                            <h3 className="text-xl font-medium mb-2 text-foreground">2. Account Information</h3>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
                                <li>Google login users: we store your Google provided UID only</li>
                                <li>Anonymous users: session and workspace data stored temporarily</li>
                                <li>No names, emails, or profile photos are collected unless voluntarily provided for support</li>
                            </ul>

                            <h3 className="text-xl font-medium mb-2 text-foreground">3. Automatically Collected Data</h3>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                <li>IP address and basic device metadata (for routing, security, and performance)</li>
                                <li>Cookies necessary for authentication and session functionality</li>
                                <li>Analytics data via Mixpanel and Microsoft Clarity (see below)</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">Analytics and Telemetry</h2>
                            <p className="text-muted-foreground mb-4">
                                Liva uses Mixpanel and Microsoft Clarity strictly for product insights, performance monitoring, and debugging. Data sent to these services is not anonymized or pseudonymized.
                            </p>
                            <p className="text-muted-foreground mb-2">Analytics Features Enabled:</p>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                                <li>Session replay</li>
                                <li>Heatmaps</li>
                                <li>Navigation behavior</li>
                                <li>Event based product analytics</li>
                            </ul>
                            <p className="text-muted-foreground">
                                These tools do not give us direct access to your identity unless you explicitly authenticate with Google.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">AI Processing</h2>
                            <p className="text-muted-foreground mb-4">We use AI models (Whisper, Gemini, OpenAI) to process:</p>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                                <li>Audio inputs (speech to text)</li>
                                <li>Text inputs and chat content</li>
                                <li>Board snapshots for context around user requests</li>
                            </ul>
                            <p className="text-muted-foreground">
                                AI model outputs may be stored to improve continuity, context, and user experience.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">How Long We Keep Data</h2>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                <li>All user generated data (boards, snapshots, logs, audio, text, histories) is retained for up to <strong>1 year</strong>, unless the user requests earlier deletion.</li>
                                <li>Anonymous user data follows the same retention window.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">Data Deletion</h2>
                            <p className="text-muted-foreground">
                                You may request data deletion at any time by emailing <a href="mailto:shivamd20@gmail.com" className="text-primary hover:underline font-medium">shivamd20@gmail.com</a>. A delete data button will be added to the product soon.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">Sensitive Data</h2>
                            <p className="text-muted-foreground mb-4">We do not intentionally collect or store any sensitive categories of data such as:</p>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                <li>Biometric information</li>
                                <li>Health data</li>
                                <li>Political or religious beliefs</li>
                                <li>Financial information</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">Data Storage and Security</h2>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                <li>Data is stored in the nearest Cloudflare region relative to the user for optimal performance.</li>
                                <li>All data is encrypted <strong>in transit</strong>.</li>
                                <li>Encryption at rest may vary by underlying Cloudflare implementation.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">Cross Device Tracking</h2>
                            <p className="text-muted-foreground">
                                We do not track users across devices. No persistent identifiers are used for cross device correlation.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">Data Sharing</h2>
                            <p className="text-muted-foreground mb-4">We do not sell, rent, or trade your personal data. Data is only shared with:</p>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                                <li>Mixpanel (product analytics)</li>
                                <li>Microsoft Clarity (session analytics)</li>
                                <li>AI model providers (OpenAI, Google Gemini, Whisper)</li>
                            </ul>
                            <p className="text-muted-foreground">
                                Only the minimum data necessary to provide the functionality is shared.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">Legal Basis for Processing</h2>
                            <p className="text-muted-foreground mb-4">Liva processes data only for:</p>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                <li>Debugging and product insights</li>
                                <li>Delivering core functionality (whiteboard storage and AI responses)</li>
                                <li>Maintaining service reliability and security</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">Age Restrictions</h2>
                            <p className="text-muted-foreground">
                                Liva is not intended for minors under 13. Users under 13 should not use the service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">Global Availability</h2>
                            <p className="text-muted-foreground">
                                Liva is available globally. Your data may be routed or stored across international regions depending on Cloudflare’s network.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">Policy Updates</h2>
                            <p className="text-muted-foreground">
                                We will notify users of any material changes to this Privacy Policy via an in app popup.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4 text-foreground">Contact Information</h2>
                            <p className="text-muted-foreground">
                                For all privacy concerns, data requests, or questions, contact: <br />
                                <a href="mailto:shivamd20@gmail.com" className="text-primary hover:underline font-bold">shivamd20@gmail.com</a>
                            </p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}

export default PrivacyPolicy;
